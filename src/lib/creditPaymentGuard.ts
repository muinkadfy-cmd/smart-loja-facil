export type CreditPaymentMethod = 'dinheiro' | 'pix' | 'cartao' | 'outro';

export type MoneyParseResult =
  | { ok: true; amount: number; formatted: string }
  | { ok: false; message: string };

export interface CreditPaymentInstallmentSnapshot {
  id: string;
  number: number;
  amount: number;
  paid_amount: number;
  status: string;
}

export interface CreditPaymentSnapshot {
  balance: number;
  installments: CreditPaymentInstallmentSnapshot[];
}

export type CreditPaymentSeverity = 'exact' | 'partial' | 'over-installment' | 'blocked';

export interface CreditPaymentReview {
  ok: boolean;
  severity: CreditPaymentSeverity;
  message: string;
  amount: number;
  formattedAmount: string;
  installmentOriginal: number;
  installmentPaidBefore: number;
  installmentOpenBefore: number;
  creditOpenBefore: number;
  difference: number;
  missing: number;
  applyToFuture: number;
  remainingAfter: number;
  statusAfter: 'Parcial' | 'Paga' | 'Quitado';
  method: CreditPaymentMethod;
  redistribute: boolean;
}

const MONEY_FORMATTER = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export function formatBrazilianMoney(value: number): string {
  return MONEY_FORMATTER.format(Number.isFinite(value) ? value : 0);
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function normalizeDecimalText(value: string): string | null {
  const clean = value
    .trim()
    .replace(/\s/g, '')
    .replace(/^R\$/i, '')
    .replace(/[^0-9,.-]/g, '');
  if (!clean) return null;
  if (!/[0-9]/.test(clean)) return null;

  const sign = clean.startsWith('-') ? '-' : '';
  const unsigned = clean.replace(/-/g, '');
  const lastComma = unsigned.lastIndexOf(',');
  const lastDot = unsigned.lastIndexOf('.');

  if (lastComma >= 0 && lastDot >= 0) {
    const decimalSeparator = lastComma > lastDot ? ',' : '.';
    const thousandsSeparator = decimalSeparator === ',' ? '.' : ',';
    return sign + unsigned.split(thousandsSeparator).join('').replace(decimalSeparator, '.');
  }

  if (lastComma >= 0) {
    return sign + unsigned.replace(/\./g, '').replace(',', '.');
  }

  if (lastDot >= 0) {
    const parts = unsigned.split('.');
    const last = parts[parts.length - 1] ?? '';
    const hasGroupedThousands = parts.length > 1 && parts.slice(1).every((part) => part.length === 3);
    if (parts.length > 2 || (hasGroupedThousands && last.length === 3)) return sign + parts.join('');
    return sign + unsigned;
  }

  return sign + unsigned;
}

export function parseBrazilianMoneyInput(value: string): MoneyParseResult {
  const normalized = normalizeDecimalText(value);
  if (!normalized) return { ok: false, message: 'Informe um valor maior que R$ 0,00.' };
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed <= 0) return { ok: false, message: 'Informe um valor maior que R$ 0,00.' };
  const amount = roundMoney(parsed);
  return { ok: true, amount, formatted: formatBrazilianMoney(amount) };
}

export function normalizeCreditPaymentMethod(value: string): CreditPaymentMethod | '' {
  if (value === 'dinheiro' || value === 'pix' || value === 'cartao' || value === 'outro') return value;
  return '';
}

export function creditPaymentMethodLabel(method: CreditPaymentMethod | string): string {
  if (method === 'dinheiro') return 'Dinheiro';
  if (method === 'pix') return 'PIX';
  if (method === 'cartao') return 'Cartão';
  if (method === 'outro') return 'Outro';
  return 'Não informado';
}

export function remainingInstallmentAmount(installment: CreditPaymentInstallmentSnapshot): number {
  return roundMoney(Math.max(0, Number(installment.amount || 0) - Number(installment.paid_amount || 0)));
}

export function totalCreditOpenAmount(credit: CreditPaymentSnapshot): number {
  const fromInstallments = credit.installments
    .filter((item) => item.status !== 'pago' && item.status !== 'paid' && item.status !== 'cancelada' && item.status !== 'canceled')
    .reduce((sum, item) => sum + remainingInstallmentAmount(item), 0);
  return roundMoney(Math.max(0, fromInstallments || Number(credit.balance || 0)));
}

export function buildCreditPaymentReview({
  credit,
  installment,
  rawAmount,
  method,
  redistribute,
}: {
  credit: CreditPaymentSnapshot;
  installment: CreditPaymentInstallmentSnapshot;
  rawAmount: string;
  method: string;
  redistribute: boolean;
}): CreditPaymentReview {
  const paymentMethod = normalizeCreditPaymentMethod(method);
  const installmentOpenBefore = remainingInstallmentAmount(installment);
  const creditOpenBefore = totalCreditOpenAmount(credit);
  const parse = parseBrazilianMoneyInput(rawAmount);
  const blockedBase = {
    ok: false,
    severity: 'blocked' as const,
    amount: 0,
    formattedAmount: formatBrazilianMoney(0),
    installmentOriginal: roundMoney(Number(installment.amount || 0)),
    installmentPaidBefore: roundMoney(Number(installment.paid_amount || 0)),
    installmentOpenBefore,
    creditOpenBefore,
    difference: 0,
    missing: 0,
    applyToFuture: 0,
    remainingAfter: creditOpenBefore,
    statusAfter: 'Parcial' as const,
    method: (paymentMethod || 'dinheiro') as CreditPaymentMethod,
    redistribute,
  };

  if (installment.status === 'pago' || installment.status === 'paid') {
    return { ...blockedBase, message: 'Essa parcela já está paga. Escolha outra parcela em aberto.' };
  }
  if (!paymentMethod) {
    return { ...blockedBase, message: 'Escolha como o cliente pagou: dinheiro, PIX, cartão ou outro.' };
  }
  if (!parse.ok) {
    return { ...blockedBase, message: parse.message };
  }

  const amount = parse.amount;
  const difference = roundMoney(Math.max(0, amount - installmentOpenBefore));
  const missing = roundMoney(Math.max(0, installmentOpenBefore - amount));
  const remainingAfter = roundMoney(Math.max(0, creditOpenBefore - amount));
  const applyToFuture = roundMoney(Math.max(0, amount - installmentOpenBefore));
  const base = {
    amount,
    formattedAmount: parse.formatted,
    installmentOriginal: roundMoney(Number(installment.amount || 0)),
    installmentPaidBefore: roundMoney(Number(installment.paid_amount || 0)),
    installmentOpenBefore,
    creditOpenBefore,
    difference,
    missing,
    applyToFuture,
    remainingAfter,
    statusAfter: remainingAfter <= 0.009 ? 'Quitado' as const : amount >= installmentOpenBefore ? 'Paga' as const : 'Parcial' as const,
    method: paymentMethod,
    redistribute,
  };

  if (amount > creditOpenBefore + 0.009) {
    return {
      ...base,
      ok: false,
      severity: 'blocked',
      message: 'Esse valor parece maior que o saldo em aberto. Confira antes de receber.',
    };
  }

  if (amount > installmentOpenBefore + 0.009 && !redistribute) {
    return {
      ...base,
      ok: false,
      severity: 'blocked',
      message: 'Esse valor parece maior que a parcela. Para abater próximas parcelas, marque a opção de redistribuir antes de confirmar.',
    };
  }

  if (amount > installmentOpenBefore + 0.009) {
    return {
      ...base,
      ok: true,
      severity: 'over-installment',
      message: 'Esse valor parece maior que o saldo em aberto. Confira antes de receber.',
    };
  }

  if (amount < installmentOpenBefore - 0.009) {
    return {
      ...base,
      ok: true,
      severity: 'partial',
      message: 'Você está recebendo menos que a parcela. O restante ficará em aberto.',
    };
  }

  return {
    ...base,
    ok: true,
    severity: 'exact',
    message: 'Confira o resumo antes de baixar o pagamento.',
  };
}

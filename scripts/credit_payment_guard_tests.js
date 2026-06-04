import assert from 'node:assert/strict';

function roundMoney(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function parseMoney(value) {
  const clean = String(value ?? '')
    .trim()
    .replace(/\s/g, '')
    .replace(/^R\$/i, '')
    .replace(/[^0-9,.-]/g, '');
  if (!clean || !/[0-9]/.test(clean)) return { ok: false, message: 'Informe um valor maior que R$ 0,00.' };
  const sign = clean.startsWith('-') ? '-' : '';
  const unsigned = clean.replace(/-/g, '');
  const lastComma = unsigned.lastIndexOf(',');
  const lastDot = unsigned.lastIndexOf('.');
  let normalized;
  if (lastComma >= 0 && lastDot >= 0) {
    const decimalSeparator = lastComma > lastDot ? ',' : '.';
    const thousandsSeparator = decimalSeparator === ',' ? '.' : ',';
    normalized = sign + unsigned.replaceAll(thousandsSeparator, '').replace(decimalSeparator, '.');
  } else if (lastComma >= 0) {
    normalized = sign + unsigned.replace(/\./g, '').replace(',', '.');
  } else if (lastDot >= 0) {
    const parts = unsigned.split('.');
    const last = parts[parts.length - 1] ?? '';
    const hasGroupedThousands = parts.length > 1 && parts.slice(1).every((part) => part.length === 3);
    normalized = sign + (parts.length > 2 || (hasGroupedThousands && last.length === 3) ? parts.join('') : unsigned);
  } else {
    normalized = sign + unsigned;
  }
  const amount = roundMoney(Number(normalized));
  if (!Number.isFinite(amount) || amount <= 0) return { ok: false, message: 'Informe um valor maior que R$ 0,00.' };
  return { ok: true, amount };
}

function remaining(installment) {
  return roundMoney(Math.max(0, installment.amount - installment.paid_amount));
}

function totalOpen(credit) {
  return roundMoney(credit.installments.filter((item) => item.status !== 'pago').reduce((sum, item) => sum + remaining(item), 0));
}

function review({ credit, installment, rawAmount, method = 'dinheiro', redistribute = false }) {
  const parsed = parseMoney(rawAmount);
  const installmentOpen = remaining(installment);
  const creditOpen = totalOpen(credit);
  if (installment.status === 'pago') return { ok: false, severity: 'blocked', message: 'Essa parcela já está paga. Escolha outra parcela em aberto.' };
  if (!['dinheiro', 'pix', 'cartao', 'outro'].includes(method)) return { ok: false, severity: 'blocked', message: 'Escolha como o cliente pagou: dinheiro, PIX, cartão ou outro.' };
  if (!parsed.ok) return { ok: false, severity: 'blocked', message: parsed.message };
  if (parsed.amount > creditOpen + 0.009) return { ok: false, severity: 'blocked', amount: parsed.amount, creditOpen };
  if (parsed.amount > installmentOpen + 0.009 && !redistribute) return { ok: false, severity: 'blocked', amount: parsed.amount, installmentOpen };
  if (parsed.amount > installmentOpen + 0.009) return { ok: true, severity: 'over-installment', applyToFuture: roundMoney(parsed.amount - installmentOpen), remainingAfter: roundMoney(creditOpen - parsed.amount) };
  if (parsed.amount < installmentOpen - 0.009) return { ok: true, severity: 'partial', missing: roundMoney(installmentOpen - parsed.amount) };
  return { ok: true, severity: 'exact', remainingAfter: roundMoney(creditOpen - parsed.amount) };
}

const open100 = { id: 'i1', number: 1, amount: 100, paid_amount: 0, status: 'aberto' };
const paid100 = { id: 'i1', number: 1, amount: 100, paid_amount: 100, status: 'pago' };
const credit100 = { balance: 100, installments: [open100] };
const credit200 = { balance: 200, installments: [open100, { id: 'i2', number: 2, amount: 100, paid_amount: 0, status: 'aberto' }] };

assert.equal(review({ credit: credit100, installment: open100, rawAmount: '1000' }).ok, false, 'saldo 100 e valor 1000 deve bloquear');
assert.deepEqual(
  { ok: review({ credit: credit100, installment: open100, rawAmount: '10' }).ok, severity: review({ credit: credit100, installment: open100, rawAmount: '10' }).severity, missing: review({ credit: credit100, installment: open100, rawAmount: '10' }).missing },
  { ok: true, severity: 'partial', missing: 90 },
  'saldo 100 e valor 10 deve virar parcial com falta 90',
);
assert.equal(review({ credit: credit100, installment: open100, rawAmount: '0' }).message, 'Informe um valor maior que R$ 0,00.', 'valor zero deve bloquear');
assert.equal(review({ credit: credit100, installment: open100, rawAmount: '' }).message, 'Informe um valor maior que R$ 0,00.', 'valor vazio deve bloquear');
assert.equal(review({ credit: { balance: 0, installments: [paid100] }, installment: paid100, rawAmount: '10' }).message, 'Essa parcela já está paga. Escolha outra parcela em aberto.', 'parcela paga deve bloquear');
assert.equal(parseMoney('10,00').amount, 10, 'valor com vírgula deve virar 10');
assert.equal(parseMoney('10.00').amount, 10, 'valor com ponto decimal deve virar 10');
assert.equal(parseMoney('1.000,00').amount, 1000, 'valor brasileiro com milhar deve virar 1000');
assert.deepEqual(
  review({ credit: credit200, installment: open100, rawAmount: '150,00', redistribute: true }),
  { ok: true, severity: 'over-installment', applyToFuture: 50, remainingAfter: 50 },
  'valor maior que uma parcela deve abater próxima quando redistribuir estiver marcado',
);
assert.equal(review({ credit: credit200, installment: open100, rawAmount: '250,00', redistribute: true }).ok, false, 'valor maior que dívida total deve bloquear excesso');

process.stdout.write('OK: proteção de recebimento do crediário passou nos cenários obrigatórios.\n');

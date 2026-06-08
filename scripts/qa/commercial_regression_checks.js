import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const failures = [];

function assert(condition, message) {
  if (!condition) failures.push(message);
}

function roundMoney(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function calculateSale(items, discount, amountPaid, method = 'dinheiro') {
  const subtotal = roundMoney(items.reduce((sum, item) => sum + item.qty * item.unitPrice, 0));
  const total = roundMoney(Math.max(0, subtotal - Math.max(0, discount)));
  const change = method === 'dinheiro' ? roundMoney(Math.max(0, amountPaid - total)) : 0;
  return { subtotal, discount: roundMoney(discount), total, amountPaid: roundMoney(amountPaid), change };
}

function splitInstallments(total, count) {
  const totalCents = Math.round(total * 100);
  const base = Math.floor(totalCents / count);
  const remainder = totalCents % count;
  return Array.from({ length: count }, (_, index) => (base + (index === count - 1 ? remainder : 0)) / 100);
}

function applyCreditPayment(installments, installmentNumber, amount, redistribute) {
  let remaining = roundMoney(amount);
  const next = installments.map((item) => ({ ...item }));
  for (const installment of next.filter((item) => item.number >= installmentNumber && item.status !== 'paid')) {
    if (!redistribute && installment.number !== installmentNumber) break;
    const open = roundMoney(installment.amount - installment.paidAmount);
    const paidNow = Math.min(open, remaining);
    installment.paidAmount = roundMoney(installment.paidAmount + paidNow);
    installment.status = installment.paidAmount + 0.009 >= installment.amount ? 'paid' : 'partial';
    remaining = roundMoney(remaining - paidNow);
    if (remaining <= 0.009) break;
  }
  return { installments: next, unapplied: remaining, balance: roundMoney(next.reduce((sum, item) => sum + Math.max(0, item.amount - item.paidAmount), 0)) };
}

function normalizeSkuPart(value, fallback) {
  const text = String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '')
    .toUpperCase()
    .slice(0, 4);
  return text || fallback;
}

function generateProductSku(name = '', category = '', seed = Date.now()) {
  const categoryPart = normalizeSkuPart(category, 'LOJA');
  const namePart = normalizeSkuPart(name, 'PROD');
  const suffix = Math.abs(seed).toString(36).toUpperCase().slice(-5).padStart(5, '0');
  return `${categoryPart}-${namePart}-${suffix}`;
}

function ean13Checksum(first12) {
  const sum = first12.split('').reduce((total, digit, index) => total + (Number(digit) || 0) * (index % 2 === 0 ? 1 : 3), 0);
  return String((10 - (sum % 10)) % 10);
}

function validEan13(value) {
  return /^[0-9]{13}$/.test(value) && value.slice(12) === ean13Checksum(value.slice(0, 12));
}

function restoreByUpsert(currentRows, backupRows) {
  const rows = new Map(currentRows.map((row) => [row.id, { ...row }]));
  for (const row of backupRows) rows.set(row.id, { ...rows.get(row.id), ...row });
  return Array.from(rows.values()).sort((a, b) => a.id.localeCompare(b.id));
}

const sale = calculateSale([
  { qty: 2, unitPrice: 39.9 },
  { qty: 1, unitPrice: 20.1 },
], 10, 100, 'dinheiro');
assert(sale.subtotal === 99.9, `Subtotal esperado 99.90, obtido ${sale.subtotal}`);
assert(sale.total === 89.9, `Total esperado 89.90, obtido ${sale.total}`);
assert(sale.change === 10.1, `Troco esperado 10.10, obtido ${sale.change}`);

const installments = splitInstallments(100, 3);
assert(JSON.stringify(installments) === JSON.stringify([33.33, 33.33, 33.34]), `Parcelamento 100/3 incorreto: ${installments.join(', ')}`);

const partial = applyCreditPayment([
  { number: 1, amount: 50, paidAmount: 0, status: 'open' },
  { number: 2, amount: 50, paidAmount: 0, status: 'open' },
], 1, 20, false);
assert(partial.installments[0].status === 'partial' && partial.balance === 80, 'Pagamento parcial deveria deixar parcela parcial e saldo 80.');

const redistributed = applyCreditPayment([
  { number: 1, amount: 50, paidAmount: 0, status: 'open' },
  { number: 2, amount: 50, paidAmount: 0, status: 'open' },
], 1, 70, true);
assert(redistributed.installments[0].status === 'paid', 'Redistribuicao deveria quitar a primeira parcela.');
assert(redistributed.installments[1].paidAmount === 20 && redistributed.installments[1].status === 'partial', 'Redistribuicao deveria abater 20 na proxima parcela.');
assert(redistributed.balance === 30, `Saldo redistribuido esperado 30, obtido ${redistributed.balance}`);

const sku = generateProductSku('Blusa Azul', 'Roupas femininas', 123456789);
assert(/^ROUP-BLUS-[0-9A-Z]{5}$/.test(sku), `SKU automatico fora do padrao: ${sku}`);
assert(validEan13(`200000000001${ean13Checksum('200000000001')}`), 'Validador EAN-13 falhou.');

const receiptsSource = fs.readFileSync(path.join(root, 'src/mobile-app/screens/ReceiptsScreen.tsx'), 'utf8');
assert(receiptsSource.includes('%PDF-1.4'), 'Geracao de PDF real nao encontrada em ReceiptsScreen.');
assert(!/%PDF-1\.4[\s\S]{0,2000}<html/i.test(receiptsSource), 'PDF nao deve embutir HTML cru perto do cabecalho PDF.');
assert(receiptsSource.includes('receiptStoreName(store)'), 'PDF precisa usar o nome da loja cadastrada.');

const restored = restoreByUpsert(
  [{ id: 'p1', name: 'Produto antigo', stock: 1 }],
  [{ id: 'p1', name: 'Produto restaurado', stock: 3 }, { id: 'c1', name: 'Cliente restaurado' }],
);
assert(restored.length === 2, 'Restore por upsert nao deveria duplicar registros.');
assert(restored.find((row) => row.id === 'p1')?.stock === 3, 'Restore por upsert deveria atualizar registro existente.');

if (failures.length) {
  process.stderr.write(`QA comercial encontrou ${failures.length} falha(s):\n`);
  for (const failure of failures) process.stderr.write(`- ${failure}\n`);
  process.exit(1);
}

process.stdout.write('OK: QA comercial minimo passou (calculos, parcelas, pagamento parcial, SKU/barras, PDF e persistencia simulada).\n');

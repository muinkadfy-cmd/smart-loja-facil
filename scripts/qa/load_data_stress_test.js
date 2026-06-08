import { performance } from 'node:perf_hooks';
import fs from 'node:fs';

const KB = 1024;
const MB = 1024 * KB;

const scenarios = [
  {
    name: 'operacao_grande',
    products: 2000,
    customers: 3000,
    sales: 8000,
    creditNotes: 2500,
    installmentsPerCredit: 6,
    movements: 12000,
    receipts: 8000,
    photoProducts: 350,
  },
  {
    name: 'carga_extrema_local',
    products: 10000,
    customers: 20000,
    sales: 50000,
    creditNotes: 15000,
    installmentsPerCredit: 8,
    movements: 70000,
    receipts: 50000,
    photoProducts: 2000,
  },
];

function roundMoney(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function fmtMs(value) {
  return `${value.toFixed(1)}ms`;
}

function fmtBytes(value) {
  if (value >= MB) return `${(value / MB).toFixed(1)} MB`;
  if (value >= KB) return `${(value / KB).toFixed(1)} KB`;
  return `${value} B`;
}

function memSnapshot() {
  const usage = process.memoryUsage();
  return {
    rss: usage.rss,
    heapUsed: usage.heapUsed,
    heapTotal: usage.heapTotal,
  };
}

function makeId(prefix, index) {
  return `${prefix}-${String(index).padStart(8, '0')}`;
}

function makeProducts(count, photoProducts) {
  return Array.from({ length: count }, (_, index) => {
    const price = roundMoney(29.9 + (index % 90) * 1.15);
    const promo = index % 7 === 0 ? roundMoney(price * 0.9) : null;
    return {
      id: makeId('product', index),
      store_id: 'store-load-test',
      name: `Produto carga ${index}`,
      category: index % 3 === 0 ? 'Roupas femininas' : index % 3 === 1 ? 'Presentes' : 'Acessorios',
      cost_price: roundMoney(price * 0.52),
      price,
      promo_price: promo,
      stock: 2 + (index % 30),
      unit: 'un',
      size: ['P', 'M', 'G', 'Unico'][index % 4],
      color: ['Preto', 'Azul', 'Rosa', 'Sortido'][index % 4],
      internal_code: `LOAD-SKU-${String(index).padStart(6, '0')}`,
      barcode: `20${String(index).padStart(10, '0')}${index % 10}`,
      image_url: index < photoProducts ? `stores/store-load-test/products/${makeId('product', index)}/foto-${index}.jpg` : '',
      status: index % 19 === 0 ? 'inactive' : 'active',
      created_at: '2026-06-05T12:00:00.000Z',
      updated_at: '2026-06-05T12:00:00.000Z',
    };
  });
}

function makeCustomers(count) {
  return Array.from({ length: count }, (_, index) => ({
    id: makeId('customer', index),
    store_id: 'store-load-test',
    name: `Cliente carga ${index}`,
    phone: `4399${String(index).padStart(7, '0')}`,
    whatsapp: index % 5 === 0 ? '' : `554399${String(index).padStart(6, '0')}`,
    address: `Rua Teste ${index}, Centro`,
    credit_limit: index % 4 === 0 ? 0 : 500 + (index % 20) * 50,
    status: index % 23 === 0 ? 'inactive' : 'active',
    notes: index % 10 === 0 ? 'Cliente usado em teste de carga local.' : '',
    created_at: '2026-06-05T12:00:00.000Z',
    updated_at: '2026-06-05T12:00:00.000Z',
  }));
}

function makeSales(count, products, customers) {
  const sales = [];
  const saleItems = [];
  for (let index = 0; index < count; index += 1) {
    const product = products[index % products.length];
    const second = products[(index * 7 + 3) % products.length];
    const customer = index % 4 === 0 ? null : customers[index % customers.length];
    const firstPrice = product.promo_price ?? product.price;
    const secondPrice = second.promo_price ?? second.price;
    const subtotal = roundMoney(firstPrice + secondPrice);
    const discount = index % 10 === 0 ? 5 : 0;
    const total = roundMoney(subtotal - discount);
    const saleId = makeId('sale', index);
    const method = index % 9 === 0 ? 'crediario' : index % 3 === 0 ? 'pix' : index % 3 === 1 ? 'cartao' : 'dinheiro';
    sales.push({
      id: saleId,
      store_id: 'store-load-test',
      number: index + 1,
      customer_id: customer?.id ?? null,
      customer_name: customer?.name ?? 'Balcao',
      subtotal,
      discount,
      total,
      payment_method: method,
      status: 'finalized',
      created_at: '2026-06-05T12:00:00.000Z',
    });
    saleItems.push({
      id: `${saleId}-item-1`,
      store_id: 'store-load-test',
      sale_id: saleId,
      product_id: product.id,
      product_name: product.name,
      qty: 1,
      unit_price: firstPrice,
      total: firstPrice,
      created_at: '2026-06-05T12:00:00.000Z',
    });
    saleItems.push({
      id: `${saleId}-item-2`,
      store_id: 'store-load-test',
      sale_id: saleId,
      product_id: second.id,
      product_name: second.name,
      qty: 1,
      unit_price: secondPrice,
      total: secondPrice,
      created_at: '2026-06-05T12:00:00.000Z',
    });
  }
  return { sales, saleItems };
}

function makeCredits(count, customers, installmentsPerCredit) {
  const credits = [];
  const installments = [];
  for (let index = 0; index < count; index += 1) {
    const customer = customers[index % customers.length];
    const total = roundMoney(120 + (index % 50) * 7.35);
    const paidInstallments = index % installmentsPerCredit;
    const creditId = makeId('credit', index);
    let balance = total;
    const amounts = splitInstallments(total, installmentsPerCredit);
    amounts.forEach((amount, installmentIndex) => {
      const paid = installmentIndex < paidInstallments ? amount : installmentIndex === paidInstallments && index % 5 === 0 ? roundMoney(amount / 2) : 0;
      balance = roundMoney(balance - paid);
      installments.push({
        id: `${creditId}-installment-${installmentIndex + 1}`,
        store_id: 'store-load-test',
        credit_id: creditId,
        number: installmentIndex + 1,
        amount,
        paid_amount: paid,
        due_date: `2026-${String((installmentIndex % 12) + 1).padStart(2, '0')}-10`,
        paid_at: paid >= amount ? '2026-06-05T12:00:00.000Z' : null,
        status: paid >= amount ? 'paid' : paid > 0 ? 'partial' : 'open',
        payment_method: paid > 0 ? 'pix' : null,
        created_at: '2026-06-05T12:00:00.000Z',
      });
    });
    credits.push({
      id: creditId,
      store_id: 'store-load-test',
      customer_id: customer.id,
      customer_name: customer.name,
      sale_id: makeId('sale', index),
      total,
      balance,
      status: balance <= 0.009 ? 'paid' : 'open',
      created_at: '2026-06-05T12:00:00.000Z',
    });
  }
  return { credits, installments };
}

function splitInstallments(total, count) {
  const cents = Math.round(total * 100);
  const base = Math.floor(cents / count);
  const remainder = cents % count;
  return Array.from({ length: count }, (_, index) => (base + (index === count - 1 ? remainder : 0)) / 100);
}

function makeMovements(count, sales) {
  return Array.from({ length: count }, (_, index) => {
    const sale = sales[index % sales.length];
    return {
      id: makeId('movement', index),
      store_id: 'store-load-test',
      cash_session_id: 'cash-session-load-test',
      sale_id: index < sales.length ? sale.id : null,
      type: index % 11 === 0 ? 'saida' : 'entrada',
      method: sale.payment_method === 'crediario' ? 'pix' : sale.payment_method,
      amount: index % 11 === 0 ? 25 : sale.payment_method === 'crediario' ? roundMoney(sale.total / 3) : sale.total,
      reason: index % 11 === 0 ? 'Saida teste de carga' : 'Entrada teste de carga',
      created_at: '2026-06-05T12:00:00.000Z',
    };
  });
}

function makeReceipts(count, sales) {
  return Array.from({ length: count }, (_, index) => {
    const sale = sales[index % sales.length];
    return {
      id: makeId('receipt', index),
      store_id: 'store-load-test',
      sale_id: sale.id,
      sale_number: sale.number,
      receipt_type: sale.payment_method === 'crediario' ? 'crediario-a4' : 'venda-a4',
      total: sale.total,
      status: sale.payment_method === 'crediario' ? 'open' : 'generated',
      content_html: `<section><h1>Jaque Confeccoes e Presentes</h1><p>Venda #${sale.number}</p><p>Total ${sale.total}</p></section>`,
      created_at: '2026-06-05T12:00:00.000Z',
    };
  });
}

function summarize(products, customers, sales, credits, installments, movements) {
  const stockCost = roundMoney(products.reduce((sum, item) => sum + item.stock * item.cost_price, 0));
  const stockSale = roundMoney(products.reduce((sum, item) => sum + item.stock * (item.promo_price ?? item.price), 0));
  const totalSales = roundMoney(sales.reduce((sum, item) => sum + item.total, 0));
  const paidCredits = roundMoney(installments.reduce((sum, item) => sum + item.paid_amount, 0));
  const openCredits = roundMoney(credits.reduce((sum, item) => sum + item.balance, 0));
  const cashIn = roundMoney(movements.filter((item) => item.type === 'entrada').reduce((sum, item) => sum + item.amount, 0));
  const cashOut = roundMoney(movements.filter((item) => item.type === 'saida').reduce((sum, item) => sum + item.amount, 0));
  return {
    products: products.length,
    customers: customers.length,
    sales: sales.length,
    credits: credits.length,
    installments: installments.length,
    stockCost,
    stockSale,
    totalSales,
    paidCredits,
    openCredits,
    cashBalance: roundMoney(cashIn - cashOut),
    averageTicket: sales.length ? roundMoney(totalSales / sales.length) : 0,
  };
}

function estimatePhotoRisk(photoProducts) {
  const appTargetBytes = 1.65 * MB;
  const storageLimitBytes = 4 * MB;
  return {
    photoProducts,
    estimatedInlineJsonAtAppTargetBytes: Math.round(photoProducts * appTargetBytes * 1.37),
    estimatedStorageBytesAtAppTarget: Math.round(photoProducts * appTargetBytes),
    estimatedStorageBytesAtLimit: Math.round(photoProducts * storageLimitBytes),
  };
}

function runScenario(config) {
  const marks = {};
  const startedAt = performance.now();
  const memStart = memSnapshot();

  marks.productsStart = performance.now();
  const products = makeProducts(config.products, config.photoProducts);
  marks.products = performance.now() - marks.productsStart;

  marks.customersStart = performance.now();
  const customers = makeCustomers(config.customers);
  marks.customers = performance.now() - marks.customersStart;

  marks.salesStart = performance.now();
  const { sales, saleItems } = makeSales(config.sales, products, customers);
  marks.sales = performance.now() - marks.salesStart;

  marks.creditsStart = performance.now();
  const { credits, installments } = makeCredits(config.creditNotes, customers, config.installmentsPerCredit);
  marks.credits = performance.now() - marks.creditsStart;

  marks.movementsStart = performance.now();
  const movements = makeMovements(config.movements, sales);
  marks.movements = performance.now() - marks.movementsStart;

  marks.receiptsStart = performance.now();
  const receipts = makeReceipts(config.receipts, sales);
  marks.receipts = performance.now() - marks.receiptsStart;

  marks.summaryStart = performance.now();
  const totals = summarize(products, customers, sales, credits, installments, movements);
  marks.summary = performance.now() - marks.summaryStart;

  const backup = {
    kind: 'smart-loja-facil-load-test-backup',
    created_at: '2026-06-05T12:00:00.000Z',
    store: { id: 'store-load-test', name: 'Jaque Confeccoes e Presentes' },
    tables: { products, customers, sales, sale_items: saleItems, credits, credit_installments: installments, cash_movements: movements, receipts },
  };

  marks.stringifyStart = performance.now();
  const backupJson = JSON.stringify(backup);
  marks.stringify = performance.now() - marks.stringifyStart;

  marks.parseStart = performance.now();
  const parsed = JSON.parse(backupJson);
  marks.parse = performance.now() - marks.parseStart;

  const memEnd = memSnapshot();
  const totalMs = performance.now() - startedAt;
  const rows = products.length + customers.length + sales.length + saleItems.length + credits.length + installments.length + movements.length + receipts.length;
  const backupBytes = Buffer.byteLength(backupJson, 'utf8');
  const photoRisk = estimatePhotoRisk(config.photoProducts);

  return {
    name: config.name,
    rows,
    backupBytes,
    parseRowsOk: parsed.tables.products.length === products.length && parsed.tables.sales.length === sales.length,
    timings: {
      generateProducts: marks.products,
      generateCustomers: marks.customers,
      generateSalesAndItems: marks.sales,
      generateCreditsAndInstallments: marks.credits,
      generateCashMovements: marks.movements,
      generateReceipts: marks.receipts,
      calculateSummary: marks.summary,
      stringifyBackup: marks.stringify,
      parseBackup: marks.parse,
      total: totalMs,
    },
    memory: {
      rssDelta: memEnd.rss - memStart.rss,
      heapUsedDelta: memEnd.heapUsed - memStart.heapUsed,
      heapUsedEnd: memEnd.heapUsed,
    },
    totals,
    photoRisk,
  };
}

const results = scenarios.map(runScenario);

function readSource(path) {
  try {
    return fs.readFileSync(path, 'utf8');
  } catch {
    return '';
  }
}

function inspectSourceMitigations() {
  const webApi = readSource('src/lib/webApi.ts');
  const productsCustomers = readSource('src/mobile-app/screens/ProductsCustomersScreens.tsx');
  const releaseCheck = readSource('scripts/release_check.js');
  return {
    noInlinePhotoFallback: !webApi.includes('image_url: inlinePhoto') && !webApi.includes('image_url: dataUrl'),
    backupFetchIsPaged: webApi.includes('WEB_BACKUP_FETCH_PAGE_SIZE') && webApi.includes('.range(from, to)'),
    backupDoesNotDownloadStoragePhotosIntoJson: !webApi.includes('fetch(url') && webApi.includes('manifest_only'),
    mobileCrudListIsBatched: productsCustomers.includes('CRUD_VISIBLE_BATCH') && productsCustomers.includes('visibleProducts') && productsCustomers.includes('visibleCustomers'),
    releaseRequiresLoadScript: releaseCheck.includes("'qa:load'") || releaseCheck.includes('"qa:load"'),
  };
}

const mitigations = inspectSourceMitigations();

for (const result of results) {
  process.stdout.write(`\nCenario: ${result.name}\n`);
  process.stdout.write(`Linhas simuladas: ${result.rows.toLocaleString('pt-BR')}\n`);
  process.stdout.write(`Backup JSON sem fotos embutidas: ${fmtBytes(result.backupBytes)}\n`);
  process.stdout.write(`Memoria heap usada no fim: ${fmtBytes(result.memory.heapUsedEnd)}; delta heap: ${fmtBytes(result.memory.heapUsedDelta)}; delta RSS: ${fmtBytes(result.memory.rssDelta)}\n`);
  process.stdout.write(`Tempos: total=${fmtMs(result.timings.total)}, stringify=${fmtMs(result.timings.stringifyBackup)}, parse=${fmtMs(result.timings.parseBackup)}, resumo=${fmtMs(result.timings.calculateSummary)}\n`);
  process.stdout.write(`Totais: vendas=${result.totals.totalSales.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}, caixa=${result.totals.cashBalance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}, crediario_aberto=${result.totals.openCredits.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}\n`);
  process.stdout.write(`Fotos: ${result.photoRisk.photoProducts.toLocaleString('pt-BR')} produto(s); estimativa se base64 no JSON=${fmtBytes(result.photoRisk.estimatedInlineJsonAtAppTargetBytes)}, Storage alvo=${fmtBytes(result.photoRisk.estimatedStorageBytesAtAppTarget)}, Storage limite=${fmtBytes(result.photoRisk.estimatedStorageBytesAtLimit)}\n`);
  process.stdout.write(`Integridade parse/reload: ${result.parseRowsOk ? 'OK' : 'FALHOU'}\n`);
}

const extreme = results.at(-1);
const warnings = [];
const mitigated = [];
if (extreme.backupBytes > 50 * MB) {
  if (mitigations.backupFetchIsPaged) mitigated.push('Backup grande tem busca paginada e aviso de tamanho, mas arquivo unico grande ainda exige teste real no celular.');
  else warnings.push('Backup JSON sem fotos ja passa de 50 MB em carga extrema.');
}
if (extreme.photoRisk.estimatedInlineJsonAtAppTargetBytes > 200 * MB) {
  if (mitigations.noInlinePhotoFallback && mitigations.backupDoesNotDownloadStoragePhotosIntoJson) mitigated.push('Risco de foto base64 mitigado: sem fallback permanente e sem baixar Storage para dentro do JSON.');
  else warnings.push('Fotos embutidas em base64 tornam backup pesado demais para celular.');
}
if (extreme.timings.stringifyBackup > 3000 || extreme.timings.parseBackup > 3000) warnings.push('Serializacao/parse do backup pode travar UI se rodar na thread principal.');
if (extreme.memory.heapUsedEnd > 256 * MB) {
  if (mitigations.mobileCrudListIsBatched) mitigated.push('Listas principais de produtos/clientes renderizam em lotes, reduzindo custo de DOM no mobile.');
  else warnings.push('Uso de heap alto para celulares simples; telas precisam paginar/virtualizar listas.');
}
if (!mitigations.releaseRequiresLoadScript) warnings.push('release_check ainda nao exige o script qa:load.');

process.stdout.write('\nAvaliacao automatica:\n');
process.stdout.write(`Mitigacoes no codigo: foto_base64=${mitigations.noInlinePhotoFallback ? 'OK' : 'FALHOU'}, backup_paginado=${mitigations.backupFetchIsPaged ? 'OK' : 'FALHOU'}, fotos_no_json=${mitigations.backupDoesNotDownloadStoragePhotosIntoJson ? 'OK' : 'FALHOU'}, listas_em_lotes=${mitigations.mobileCrudListIsBatched ? 'OK' : 'FALHOU'}, release_gate=${mitigations.releaseRequiresLoadScript ? 'OK' : 'FALHOU'}\n`);
for (const item of mitigated) process.stdout.write(`MITIGADO: ${item}\n`);
if (warnings.length === 0) {
  process.stdout.write('OK: carga sintetica passou sem alerta critico local.\n');
} else {
  for (const warning of warnings) process.stdout.write(`AVISO: ${warning}\n`);
}

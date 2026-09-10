import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const args = process.argv.slice(2);
const option = (name, fallback) => args.includes(name) ? args[args.indexOf(name) + 1] : fallback;
const baseUrl = option('--base', 'http://127.0.0.1:4182');
const outputDir = path.resolve(option('--output', 'qa-screenshots/desktop-premium/current'));
const viewportText = option('--viewport', '1366x768');
const routeText = option('--routes', 'dashboard,sales,cash,orders,credits,receipts,coupons,products,customers,reports,backup,settings,audit,diagnostics');
const clickText = option('--clicks', '');
const captureName = option('--name', '');
const [width, height] = viewportText.split('x').map(Number);
const routes = routeText.split(',').map((value) => value.trim()).filter(Boolean);
const clicks = clickText.split('|').map((value) => value.trim()).filter(Boolean);
const chromePath = option('--chrome', 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe');

if (!Number.isFinite(width) || !Number.isFinite(height) || width < 300 || height < 500) {
  throw new Error(`Viewport inválida: ${viewportText}`);
}
if (!fs.existsSync(chromePath)) throw new Error(`Chrome não encontrado: ${chromePath}`);

fs.mkdirSync(outputDir, { recursive: true });
const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'smart-loja-desktop-qa-'));

function waitForDevTools(child, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    let buffer = '';
    const timer = setTimeout(() => reject(new Error('Chrome não abriu a porta de depuração a tempo.')), timeoutMs);
    const inspect = (chunk) => {
      buffer += chunk.toString();
      const match = buffer.match(/DevTools listening on (ws:\/\/[^\s]+)/);
      if (!match) return;
      clearTimeout(timer);
      resolve(match[1]);
    };
    child.stderr.on('data', inspect);
    child.once('exit', (code) => {
      clearTimeout(timer);
      reject(new Error(`Chrome encerrou antes da captura (código ${code}).`));
    });
  });
}

class CdpClient {
  constructor(url) {
    this.url = url;
    this.sequence = 0;
    this.pending = new Map();
    this.listeners = new Map();
  }

  async open() {
    this.socket = new WebSocket(this.url);
    await new Promise((resolve, reject) => {
      this.socket.addEventListener('open', resolve, { once: true });
      this.socket.addEventListener('error', reject, { once: true });
    });
    this.socket.addEventListener('message', async (event) => {
      const raw = typeof event.data === 'string' ? event.data : Buffer.from(await event.data.arrayBuffer()).toString('utf8');
      const message = JSON.parse(raw);
      if (message.id && this.pending.has(message.id)) {
        const { resolve, reject } = this.pending.get(message.id);
        this.pending.delete(message.id);
        if (message.error) reject(new Error(`${message.error.message} (${message.error.code})`));
        else resolve(message.result || {});
        return;
      }
      const key = `${message.sessionId || ''}:${message.method}`;
      const callbacks = this.listeners.get(key) || [];
      for (const callback of callbacks) callback(message.params || {});
    });
  }

  send(method, params = {}, sessionId) {
    const id = ++this.sequence;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    });
  }

  waitFor(method, sessionId, timeoutMs = 15000) {
    const key = `${sessionId || ''}:${method}`;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.listeners.set(key, (this.listeners.get(key) || []).filter((callback) => callback !== done));
        reject(new Error(`Evento ${method} não ocorreu a tempo.`));
      }, timeoutMs);
      const done = (payload) => {
        clearTimeout(timer);
        this.listeners.set(key, (this.listeners.get(key) || []).filter((callback) => callback !== done));
        resolve(payload);
      };
      this.listeners.set(key, [...(this.listeners.get(key) || []), done]);
    });
  }

  close() {
    this.socket.close();
  }
}

async function evaluate(client, sessionId, expression) {
  const result = await client.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, sessionId);
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || 'Falha ao avaliar a página.');
  return result.result?.value;
}

async function waitForReady(client, sessionId, timeoutMs = 20000) {
  const startedAt = Date.now();
  let clickedEnter = false;
  while (Date.now() - startedAt < timeoutMs) {
    const state = await evaluate(client, sessionId, `(() => {
      const root = document.querySelector('.mapp-root');
      const title = document.querySelector('.mapp-page-title-row h1')?.textContent?.trim() || '';
      const online = document.querySelector('.mapp-online-chip')?.textContent?.trim() === 'Online';
      const syncing = [...document.querySelectorAll('.mapp-inline-status')].some((node) => /Sincronizando/i.test(node.textContent || ''));
      const enter = [...document.querySelectorAll('button')].find((button) => /Abrir painel/i.test(button.textContent || ''));
      return { ready: Boolean(root && title && online && !syncing), title, hasRoot: Boolean(root), online, syncing, canEnter: Boolean(enter) };
    })()`);
    if (state.ready) return state;
    if (state.canEnter && !clickedEnter) {
      await evaluate(client, sessionId, `(() => { const button = [...document.querySelectorAll('button')].find((item) => /Abrir painel/i.test(item.textContent || '')); button?.click(); return Boolean(button); })()`);
      clickedEnter = true;
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error('A tela não estabilizou em estado Online dentro do limite de QA.');
}

const chrome = spawn(chromePath, [
  '--headless=new',
  '--disable-gpu',
  '--hide-scrollbars',
  '--no-first-run',
  '--no-default-browser-check',
  '--disable-background-networking',
  '--remote-debugging-port=0',
  `--user-data-dir=${profileDir}`,
  `--window-size=${width},${height}`,
  'about:blank',
], { stdio: ['ignore', 'ignore', 'pipe'], windowsHide: true });

let client;
try {
  const debuggerUrl = await waitForDevTools(chrome);
  client = new CdpClient(debuggerUrl);
  await client.open();
  const { targetId } = await client.send('Target.createTarget', { url: 'about:blank', background: false });
  const { sessionId } = await client.send('Target.attachToTarget', { targetId, flatten: true });
  await client.send('Page.enable', {}, sessionId);
  await client.send('Runtime.enable', {}, sessionId);
  await client.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 700 }, sessionId);

  const report = { baseUrl, viewport: { width, height }, capturedAt: new Date().toISOString(), routes: [] };
  for (const route of routes) {
    const load = client.waitFor('Page.loadEventFired', sessionId);
    const url = new URL(baseUrl);
    url.searchParams.set('page', route);
    url.searchParams.set('source', 'desktop-premium-qa');
    await client.send('Page.navigate', { url: url.href }, sessionId);
    await load;
    const ready = await waitForReady(client, sessionId);
    await new Promise((resolve) => setTimeout(resolve, 250));
    for (const label of clicks) {
      const clicked = await evaluate(client, sessionId, `((label) => {
        const normalize = (value) => String(value || '').replace(/\\s+/g, ' ').trim();
        const buttons = [...document.querySelectorAll('button')].filter((button) => button.offsetParent !== null && !button.disabled);
        const accessibleName = (item) => normalize(item.getAttribute('aria-label') || item.textContent);
        const button = buttons.find((item) => accessibleName(item) === label) || buttons.find((item) => accessibleName(item).includes(label));
        button?.click();
        return button ? accessibleName(button) : '';
      })(${JSON.stringify(label)})`);
      if (!clicked) {
        const available = await evaluate(client, sessionId, `(() => [...document.querySelectorAll('button')]
          .filter((button) => button.offsetParent !== null && !button.disabled)
          .map((button) => String(button.getAttribute('aria-label') || button.textContent || '').replace(/\\s+/g, ' ').trim())
          .filter(Boolean))()`);
        throw new Error(`Botão visível não encontrado: ${label}. Disponíveis: ${available.join(' | ')}`);
      }
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
    const metrics = await evaluate(client, sessionId, `(() => ({
      innerWidth,
      innerHeight,
      scrollWidth: document.documentElement.scrollWidth,
      scrollHeight: document.documentElement.scrollHeight,
      title: document.querySelector('.mapp-page-title-row h1')?.textContent?.trim() || '',
      online: document.querySelector('.mapp-online-chip')?.textContent?.trim() || '',
      dialogs: document.querySelectorAll('[role="dialog"]').length,
      horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 1
    }))()`);
    if (metrics.innerWidth !== width || metrics.innerHeight !== height) {
      throw new Error(`Viewport real divergente em ${route}: ${metrics.innerWidth}x${metrics.innerHeight}, esperado ${width}x${height}.`);
    }
    const image = await client.send('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: false }, sessionId);
    const file = path.join(outputDir, `${captureName && routes.length === 1 ? captureName : route}.png`);
    fs.writeFileSync(file, Buffer.from(image.data, 'base64'));
    report.routes.push({ route, file, ready, metrics });
    process.stdout.write(`captured ${route} ${width}x${height}\n`);
  }
  const metricsName = captureName && routes.length === 1 ? `${captureName}.metrics.json` : 'metrics.json';
  fs.writeFileSync(path.join(outputDir, metricsName), `${JSON.stringify(report, null, 2)}\n`);
} finally {
  try { client?.close(); } catch {}
  try {
    const exited = new Promise((resolve) => chrome.once('exit', resolve));
    chrome.kill();
    await Promise.race([exited, new Promise((resolve) => setTimeout(resolve, 1500))]);
  } catch {}
  try { fs.rmSync(profileDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); } catch {}
}

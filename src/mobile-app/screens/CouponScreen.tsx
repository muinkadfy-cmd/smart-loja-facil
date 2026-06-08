import { useMemo, useState } from 'react';
import type { Settings } from '../../types';
import { InlineIcon } from '../components/InlineIcon';

interface CouponScreenProps {
  settings: Settings | null;
}

type BusyAction = 'png' | 'share' | 'copy' | null;

interface CouponTemplateOptions {
  clientName: string;
  discount: number;
  couponCode: string;
  validText: string;
  storeName: string;
}

const DEFAULT_STORE_NAME = 'Jaque Confecções e Presentes';
const DEFAULT_VALID_TEXT = 'Válido mediante compra na Jaque Confecções e Presentes. Consulte as condições na loja.';

function clampDiscount(value: number): number {
  if (!Number.isFinite(value)) return 20;
  return Math.max(1, Math.min(90, Math.round(value)));
}

function escapeXml(value: string): string {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function safeCouponCode(value: string, discount: number): string {
  const clean = String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9_-]+/gi, '')
    .toUpperCase()
    .slice(0, 26);
  return clean || `CLIENTEJAQUE${discount}`;
}

function safeName(value: string): string {
  const clean = String(value || '').replace(/\s+/g, ' ').trim();
  if (!clean) return 'Nome do cliente';
  return clean.length > 40 ? `${clean.slice(0, 37)}...` : clean;
}

function safeFilePart(value: string): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9_-]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
    .slice(0, 70) || 'cupom';
}

function couponFileName(options: CouponTemplateOptions): string {
  const stamp = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '');
  return `${safeFilePart(`cupom-${options.couponCode}-${options.clientName || 'cliente'}`)}-${stamp}.png`;
}

function svgDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function buildCouponSvg(options: CouponTemplateOptions): string {
  const discount = clampDiscount(options.discount);
  const clientName = escapeXml(safeName(options.clientName));
  const couponCode = escapeXml(safeCouponCode(options.couponCode, discount));
  const storeName = escapeXml(options.storeName || DEFAULT_STORE_NAME);
  const validText = escapeXml(options.validText || DEFAULT_VALID_TEXT);
  const subtitle = 'em armações, óculos de grau, solares e acessórios selecionados.';

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350" viewBox="0 0 1080 1350" role="img" aria-label="Cupom de desconto ${discount}% off para cliente da Jaque">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#fff7fb"/>
      <stop offset="0.54" stop-color="#ffe4ef"/>
      <stop offset="1" stop-color="#fffdf9"/>
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="49%" r="62%">
      <stop offset="0" stop-color="#ffffff" stop-opacity="1"/>
      <stop offset="0.38" stop-color="#ffd9ea" stop-opacity="0.92"/>
      <stop offset="1" stop-color="#ff8fbc" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="red" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ff221b"/>
      <stop offset="0.58" stop-color="#d60b0b"/>
      <stop offset="1" stop-color="#a80000"/>
    </linearGradient>
    <linearGradient id="pink" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#ff4ba1"/>
      <stop offset="0.55" stop-color="#ed1765"/>
      <stop offset="1" stop-color="#c60843"/>
    </linearGradient>
    <linearGradient id="gold" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#fff696"/>
      <stop offset="0.52" stop-color="#ffd83e"/>
      <stop offset="1" stop-color="#ff9d17"/>
    </linearGradient>
    <filter id="softShadow" x="-18%" y="-18%" width="136%" height="136%">
      <feDropShadow dx="0" dy="12" stdDeviation="10" flood-color="#97001d" flood-opacity="0.24"/>
    </filter>
    <filter id="bigShadow" x="-18%" y="-18%" width="136%" height="136%">
      <feDropShadow dx="0" dy="18" stdDeviation="10" flood-color="#710000" flood-opacity="0.30"/>
    </filter>
    <filter id="whiteLift" x="-14%" y="-14%" width="128%" height="128%">
      <feDropShadow dx="0" dy="6" stdDeviation="3" flood-color="#6f0010" flood-opacity="0.28"/>
    </filter>
  </defs>

  <rect width="1080" height="1350" rx="28" fill="#d80000"/>
  <rect x="18" y="18" width="1044" height="1314" rx="36" fill="url(#bg)"/>
  <rect x="30" y="31" width="1020" height="1288" rx="30" fill="none" stroke="#cf0000" stroke-width="5" stroke-dasharray="20 16"/>
  <circle cx="540" cy="704" r="520" fill="url(#glow)"/>

  <g opacity="0.62" stroke="#fff" stroke-width="6">
    <line x1="104" y1="850" x2="976" y2="256"/>
    <line x1="136" y1="910" x2="1006" y2="340"/>
    <line x1="120" y1="360" x2="976" y2="936"/>
    <line x1="82" y1="444" x2="1010" y2="1002"/>
  </g>

  <g fill="none" stroke="#c40000" stroke-width="8" stroke-linecap="round" stroke-linejoin="round" transform="translate(24 24)">
    <circle cx="40" cy="16" r="16"/><circle cx="40" cy="60" r="16"/><path d="M52 35 L112 4 M52 42 L112 72"/>
  </g>
  <g fill="none" stroke="#c40000" stroke-width="8" stroke-linecap="round" stroke-linejoin="round" transform="translate(956 1250) rotate(-8)">
    <circle cx="40" cy="16" r="16"/><circle cx="40" cy="60" r="16"/><path d="M52 35 L112 4 M52 42 L112 72"/>
  </g>

  <g filter="url(#softShadow)">
    <path d="M52 58 Q52 34 76 34 H562 Q590 34 590 62 V232 Q590 262 560 269 H78 Q52 269 52 243 Z" fill="url(#red)"/>
    <text x="90" y="116" transform="rotate(-8 90 116)" font-family="Arial Black, Arial, sans-serif" font-size="33" font-weight="900" fill="#ffffff">Rede de Óticas</text>
    <text x="88" y="172" transform="rotate(-8 88 172)" font-family="Arial Black, Arial, sans-serif" font-size="56" font-weight="900" fill="#ffffff" stroke="#ffffff" stroke-width="2">mercadão</text>
    <text x="150" y="228" transform="rotate(-8 150 228)" font-family="Arial Black, Arial, sans-serif" font-size="48" font-weight="900" fill="#ffffff">dos Óculos!</text>
  </g>

  <g filter="url(#softShadow)">
    <rect x="596" y="54" width="414" height="206" rx="46" fill="#ffd5e7" opacity="0.95"/>
    <text x="672" y="154" font-family="Georgia, 'Times New Roman', serif" font-size="104" font-style="italic" font-weight="900" fill="#ef1563" stroke="#ffffff" stroke-width="5">Jaque</text>
    <path d="M657 184 H955 L923 242 H690 Z" fill="url(#pink)" stroke="#ff7bb0" stroke-width="3"/>
    <text x="705" y="225" font-family="Arial Black, Arial, sans-serif" font-size="31" font-weight="900" fill="#ffffff">Confecções e Presentes</text>
    <g transform="translate(844 44)">
      <rect x="0" y="22" width="74" height="62" rx="8" fill="#ff4aa1" stroke="#b80d3e" stroke-width="3"/>
      <rect x="32" y="22" width="13" height="62" fill="#ffdd46"/>
      <rect x="0" y="45" width="74" height="12" fill="#ffdd46"/>
      <path d="M37 23 C12 -8 -22 19 16 36 C26 31 31 27 37 23 Z" fill="#ffdd46" stroke="#d97500" stroke-width="3"/>
      <path d="M42 23 C70 -10 104 20 63 37 C54 31 48 26 42 23 Z" fill="#ffdd46" stroke="#d97500" stroke-width="3"/>
    </g>
  </g>

  <g filter="url(#softShadow)">
    <circle cx="548" cy="175" r="54" fill="#ffffff"/>
    <circle cx="548" cy="175" r="44" fill="#ff4b92"/>
    <path d="M523 176 C535 160 545 166 551 174 C559 162 577 164 583 177 C574 192 559 202 548 210 C537 202 524 192 523 176 Z" fill="#ffffff" opacity="0.96"/>
  </g>

  <g filter="url(#softShadow)">
    <path d="M88 352 Q540 276 992 352 L966 515 Q540 458 114 515 Z" fill="url(#pink)" stroke="#ff77ac" stroke-width="4"/>
    <path d="M96 414 H984" fill="none" stroke="#ffb7d2" stroke-width="4" stroke-dasharray="12 14"/>
    <text x="540" y="407" text-anchor="middle" font-family="Arial Black, Arial, sans-serif" font-size="64" font-weight="900" fill="#ffffff" filter="url(#whiteLift)">Cliente da Jaque tem</text>
    <text x="540" y="481" text-anchor="middle" font-family="Arial Black, Arial, sans-serif" font-size="62" font-weight="900" fill="#ffffff" filter="url(#whiteLift)">vantagem na <tspan fill="#fff36a">Ótica!</tspan></text>
  </g>

  <g filter="url(#bigShadow)">
    <text x="502" y="804" text-anchor="middle" font-family="Arial Black, Arial, sans-serif" font-size="395" font-weight="900" fill="#ffffff" stroke="#ffffff" stroke-width="26">${discount}</text>
    <text x="502" y="804" text-anchor="middle" font-family="Arial Black, Arial, sans-serif" font-size="395" font-weight="900" fill="url(#red)" stroke="#b00000" stroke-width="6">${discount}</text>
    <text x="807" y="690" text-anchor="middle" font-family="Arial Black, Arial, sans-serif" font-size="132" font-weight="900" fill="#ffffff" stroke="#ffffff" stroke-width="16">%</text>
    <text x="807" y="690" text-anchor="middle" font-family="Arial Black, Arial, sans-serif" font-size="132" font-weight="900" fill="url(#red)" stroke="#9b0000" stroke-width="4">%</text>
    <text x="800" y="790" text-anchor="middle" font-family="Arial Black, Arial, sans-serif" font-size="95" font-weight="900" fill="#ffffff" stroke="#ffffff" stroke-width="14">OFF</text>
    <text x="800" y="790" text-anchor="middle" font-family="Arial Black, Arial, sans-serif" font-size="95" font-weight="900" fill="url(#red)" stroke="#9b0000" stroke-width="3">OFF</text>
  </g>

  <g filter="url(#softShadow)">
    <rect x="190" y="842" width="700" height="92" rx="20" fill="url(#red)"/>
    <text x="540" y="895" text-anchor="middle" font-family="Arial Black, Arial, sans-serif" font-size="37" font-weight="900" fill="#ffffff">Apresente este cupom e aproveite sua oferta</text>
    <text x="540" y="929" text-anchor="middle" font-family="Arial Black, Arial, sans-serif" font-size="35" font-weight="900" fill="#fff36a">especial na Rede de Óticas Mercadão dos Óculos.</text>
  </g>

  <text x="540" y="992" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="33" font-weight="900" fill="#421315">${subtitle}</text>

  <g transform="translate(72 973)" fill="none" stroke="#c01853" stroke-width="5" stroke-linecap="round">
    <path d="M0 32 C28 -10 72 -8 99 32"/><circle cx="25" cy="34" r="24"/><circle cx="76" cy="34" r="24"/><path d="M49 34 H54"/>
  </g>
  <g transform="translate(760 960)" fill="#1b1b1f" stroke="#111" stroke-width="4">
    <path d="M0 46 C12 15 52 16 66 43 C75 18 116 18 132 48 C119 75 83 75 69 50 C58 75 17 74 0 46 Z"/>
    <path d="M63 43 H71" stroke="#111"/>
  </g>

  <g filter="url(#softShadow)">
    <rect x="68" y="1015" width="944" height="100" rx="20" fill="#ffffff" stroke="#e92168" stroke-width="3"/>
    <circle cx="104" cy="1063" r="46" fill="#ef1d65"/>
    <circle cx="104" cy="1048" r="15" fill="#ffffff"/>
    <path d="M78 1087 C84 1065 124 1065 130 1087" fill="#ffffff"/>
    <text x="170" y="1057" font-family="Arial Black, Arial, sans-serif" font-size="26" font-weight="900" fill="#3a1111">Nome do cliente:</text>
    <rect x="168" y="1070" width="806" height="37" rx="12" fill="#f9fbff" stroke="#e2e8f0" stroke-width="2"/>
    <text x="192" y="1098" font-family="Arial, Helvetica, sans-serif" font-size="27" font-weight="800" fill="#2d1620">${clientName}</text>
  </g>

  <g filter="url(#softShadow)">
    <rect x="68" y="1132" width="944" height="118" rx="22" fill="url(#pink)"/>
    <line x1="384" y1="1144" x2="384" y2="1238" stroke="#ffd4e3" stroke-width="4" stroke-dasharray="16 14"/>
    <g transform="translate(108 1164)" fill="none" stroke="#ffffff" stroke-width="7" stroke-linejoin="round">
      <path d="M0 16 L28 -12 H82 L110 16 V74 H0 Z"/>
      <text x="55" y="56" text-anchor="middle" font-family="Arial Black, Arial, sans-serif" font-size="48" font-weight="900" fill="#ffffff" stroke="none">%</text>
    </g>
    <text x="200" y="1186" font-family="Arial Black, Arial, sans-serif" font-size="34" font-weight="900" fill="#ffffff">CÓDIGO</text>
    <text x="200" y="1224" font-family="Arial Black, Arial, sans-serif" font-size="34" font-weight="900" fill="#ffffff">DO CUPOM:</text>
    <rect x="414" y="1150" width="565" height="82" rx="15" fill="#ffffff"/>
    <text x="696" y="1206" text-anchor="middle" font-family="Arial Black, Arial, sans-serif" font-size="54" font-weight="900" fill="#3a0903">${couponCode}</text>
  </g>

  <g transform="translate(810 1246)">
    <path d="M30 65 L30 12 Q60 -14 90 12 L90 65" fill="none" stroke="#e41a69" stroke-width="5"/>
    <rect x="12" y="48" width="96" height="74" rx="10" fill="#ff83b5" stroke="#d7195e" stroke-width="4"/>
    <rect x="55" y="48" width="12" height="74" fill="#ffd84a"/>
    <rect x="12" y="74" width="96" height="12" fill="#ffd84a"/>
  </g>

  <text x="128" y="1283" font-family="Arial, Helvetica, sans-serif" font-size="27" font-weight="900" fill="#421315">${validText}</text>
  <text x="128" y="1314" font-family="Arial, Helvetica, sans-serif" font-size="24" font-weight="800" fill="#6a2d35">Cupom gerado por ${storeName}. Informe o nome do cliente antes de enviar.</text>
  <g fill="#ff1c67">
    <path d="M80 322 l14 30 32 5 -23 22 5 32 -28 -15 -28 15 5 -32 -23 -22 32 -5z"/>
    <path d="M982 408 l10 22 24 4 -18 16 5 24 -21 -12 -21 12 5 -24 -18 -16 24 -4z"/>
    <path d="M92 1268 l12 25 28 4 -20 19 5 28 -25 -13 -25 13 5 -28 -20 -19 28 -4z"/>
  </g>
</svg>`;
}

async function svgToPngBlob(svg: string): Promise<Blob> {
  const image = new Image();
  image.decoding = 'async';
  const url = svgDataUrl(svg);
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error('Não foi possível montar a arte do cupom.'));
    image.src = url;
  });
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1350;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Seu navegador não liberou a geração do PNG.');
  context.fillStyle = '#fff7fb';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png', 0.96));
  if (!blob) throw new Error('Não foi possível salvar o cupom em PNG.');
  return blob;
}

function downloadBlob(blob: Blob, fileName: string): void {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1200);
}

export function CouponScreen({ settings }: CouponScreenProps): JSX.Element {
  const [clientName, setClientName] = useState('');
  const [discountInput, setDiscountInput] = useState('20');
  const [couponCode, setCouponCode] = useState('CLIENTEJAQUE20');
  const [validText, setValidText] = useState(DEFAULT_VALID_TEXT);
  const [busy, setBusy] = useState<BusyAction>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const discount = clampDiscount(Number(discountInput));
  const storeName = (settings?.store_name || DEFAULT_STORE_NAME).replace(/\s+Web$/i, '') || DEFAULT_STORE_NAME;
  const renderOptions = useMemo<CouponTemplateOptions>(() => ({
    clientName,
    discount,
    couponCode: safeCouponCode(couponCode, discount),
    validText,
    storeName,
  }), [clientName, couponCode, discount, storeName, validText]);
  const svg = useMemo(() => buildCouponSvg(renderOptions), [renderOptions]);
  const previewUrl = useMemo(() => svgDataUrl(svg), [svg]);

  function updateDiscount(value: string): void {
    setDiscountInput(value);
    const next = clampDiscount(Number(value));
    if (/^CLIENTEJAQUE\d{1,2}$/i.test(couponCode) || !couponCode.trim()) setCouponCode(`CLIENTEJAQUE${next}`);
  }

  async function handleDownload(): Promise<void> {
    setBusy('png');
    setFeedback(null);
    try {
      const blob = await svgToPngBlob(svg);
      downloadBlob(blob, couponFileName(renderOptions));
      setFeedback('PNG gerado com fidelidade do layout. Você pode enviar pelo WhatsApp ou salvar na galeria.');
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Não foi possível gerar o PNG agora.');
    } finally {
      setBusy(null);
    }
  }

  async function handleShare(): Promise<void> {
    setBusy('share');
    setFeedback(null);
    try {
      const blob = await svgToPngBlob(svg);
      const file = new File([blob], couponFileName(renderOptions), { type: 'image/png' });
      const shareData: ShareData = {
        title: `Cupom ${discount}% OFF`,
        text: `Cupom ${discount}% OFF para cliente da Jaque usar na Rede de Óticas Mercadão dos Óculos. Código: ${renderOptions.couponCode}`,
        files: [file],
      };
      if (navigator.share && (!navigator.canShare || navigator.canShare(shareData))) {
        await navigator.share(shareData);
        setFeedback('Cupom PNG aberto para compartilhamento.');
      } else {
        downloadBlob(blob, file.name);
        setFeedback('Este aparelho não liberou compartilhamento direto. Baixei o PNG para você enviar manualmente.');
      }
    } catch (error) {
      if (error instanceof Error && /AbortError/i.test(error.name)) setFeedback('Compartilhamento cancelado. O cupom não foi alterado.');
      else setFeedback(error instanceof Error ? error.message : 'Não foi possível compartilhar o PNG agora.');
    } finally {
      setBusy(null);
    }
  }

  async function copyCode(): Promise<void> {
    setBusy('copy');
    setFeedback(null);
    try {
      await navigator.clipboard?.writeText(renderOptions.couponCode);
      setFeedback('Código do cupom copiado.');
    } catch {
      setFeedback(`Código do cupom: ${renderOptions.couponCode}`);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mapp-screen mapp-coupon-screen">
      <section className="mapp-coupon-hero">
        <span className="mapp-coupon-hero-icon"><InlineIcon name="etiquetas" size={32} /></span>
        <div>
          <strong>Cupom de parceria em PNG</strong>
          <p>Monte o cupom para clientes da Jaque, altere desconto e nome, baixe ou compartilhe a arte pronta com aparência de campanha promocional.</p>
        </div>
        <span className="mapp-coupon-hero-chip">PNG 1080 × 1350</span>
      </section>

      <section className="mapp-coupon-grid">
        <div className="mapp-form-panel mapp-coupon-form-panel">
          <div className="mapp-form-head">
            <span className="mapp-form-icon"><InlineIcon name="etiquetas" size={32} /></span>
            <div>
              <strong>Editar cupom</strong>
              <p>Campos simples para usuário leigo. O layout atualiza na hora.</p>
            </div>
          </div>

          <div className="mapp-form-grid">
            <label>
              <span>Nome do cliente</span>
              <input value={clientName} onChange={(event) => setClientName(event.target.value)} placeholder="Ex.: Maria Aparecida" maxLength={40} />
            </label>
            <label>
              <span>Porcentagem de desconto</span>
              <input type="number" inputMode="numeric" min="1" max="90" value={discountInput} onChange={(event) => updateDiscount(event.target.value)} />
            </label>
            <label className="span-2">
              <span>Código do cupom</span>
              <input value={couponCode} onChange={(event) => setCouponCode(event.target.value.toUpperCase())} placeholder="CLIENTEJAQUE20" maxLength={26} />
            </label>
            <label className="span-2">
              <span>Mensagem de validade</span>
              <textarea value={validText} onChange={(event) => setValidText(event.target.value)} maxLength={150} />
            </label>
          </div>

          <div className="mapp-coupon-discount-picks" aria-label="Descontos rápidos">
            {[10, 15, 20, 25, 30, 40].map((value) => (
              <button key={value} type="button" className={discount === value ? 'active' : ''} onClick={() => updateDiscount(String(value))}>{value}%</button>
            ))}
          </div>

          <div className="mapp-form-actions mapp-coupon-actions">
            <button type="button" className="mapp-secondary-button" disabled={busy !== null} onClick={copyCode}>{busy === 'copy' ? 'Copiando...' : 'Copiar código'}</button>
            <button type="button" className="mapp-secondary-button" disabled={busy !== null} onClick={handleDownload}>{busy === 'png' ? 'Gerando...' : 'Baixar PNG'}</button>
            <button type="button" className="mapp-primary-button" disabled={busy !== null} onClick={handleShare}>{busy === 'share' ? 'Abrindo...' : 'Compartilhar PNG'}</button>
          </div>

          {feedback ? <div className="mapp-form-feedback mapp-form-feedback-info">{feedback}</div> : null}

          <div className="mapp-coupon-safe-note">
            <InlineIcon name="bloqueio_seguro" size={24} />
            <span>Esta aba gera a imagem no aparelho. Não salva cliente, cupom ou dados pessoais na nuvem.</span>
          </div>
        </div>

        <aside className="mapp-coupon-preview-card" aria-label="Prévia do cupom em PNG">
          <div className="mapp-coupon-preview-head">
            <div>
              <strong>Prévia fiel do PNG</strong>
              <span>{discount}% OFF · {renderOptions.couponCode}</span>
            </div>
            <b>4:5</b>
          </div>
          <div className="mapp-coupon-preview-frame">
            <img src={previewUrl} alt={`Cupom ${discount}% OFF para ${safeName(clientName)}`} />
          </div>
          <div className="mapp-coupon-preview-foot">
            <span>Cliente: <b>{safeName(clientName)}</b></span>
            <span>Destino: <b>Mercadão dos Óculos</b></span>
          </div>
        </aside>
      </section>
    </div>
  );
}

import { useEffect, useMemo, useRef, useState } from 'react';
import type { PageKey } from '../../types';

const COUPON_BG_URL = '/coupons/cupom-jaque-otica-base.png';
const COUPON_WIDTH = 1080;
const COUPON_HEIGHT = 1350;
const QUICK_DISCOUNTS = [10, 20, 30, 50];

type ExportState = 'idle' | 'loading';

interface CouponFormState {
  discount: string;
  customerName: string;
  code: string;
}

function sanitizeDiscount(value: string): string {
  const digits = value.replace(/\D+/g, '').slice(0, 2);
  if (!digits) return '';
  const numeric = Math.min(99, Math.max(1, Number(digits)));
  return String(numeric);
}

function normalizeDiscount(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return 20;
  return Math.min(99, Math.max(1, parsed));
}

function buildDefaultCouponCode(discount: string | number): string {
  const numeric = typeof discount === 'number' ? discount : normalizeDiscount(discount);
  return `CLIENTEJAQUE${numeric}`;
}

function fitCanvasFont(ctx: CanvasRenderingContext2D, text: string, width: number, maxSize: number, minSize: number, weight = 900, family = 'Arial, sans-serif'): number {
  let size = maxSize;
  while (size > minSize) {
    ctx.font = `${weight} ${size}px ${family}`;
    if (ctx.measureText(text).width <= width) return size;
    size -= 2;
  }
  return minSize;
}

function wrapCanvasText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width <= maxWidth || !current) current = test;
    else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines.slice(0, 2);
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Não foi possível carregar a arte base do cupom.'));
    image.src = src;
  });
}

function drawRoundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number): void {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

async function renderCouponCanvas(form: CouponFormState): Promise<HTMLCanvasElement> {
  const background = await loadImage(COUPON_BG_URL);
  const canvas = document.createElement('canvas');
  canvas.width = COUPON_WIDTH;
  canvas.height = COUPON_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Seu navegador não conseguiu preparar o PNG do cupom.');

  ctx.drawImage(background, 0, 0, COUPON_WIDTH, COUPON_HEIGHT);

  const discount = normalizeDiscount(form.discount);
  const discountText = String(discount);
  const customerName = form.customerName.trim();
  const couponCode = (form.code.trim() || buildDefaultCouponCode(discount)).slice(0, 26).toUpperCase();

  // Desconto principal dentro da área limpa da arte enviada.
  const discountSize = discountText.length >= 2 ? 306 : 360;
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.font = `900 ${discountSize}px Arial, sans-serif`;
  ctx.lineJoin = 'round';
  ctx.shadowColor = 'rgba(93, 0, 0, 0.28)';
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 10;
  ctx.fillStyle = '#cc0000';
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 24;
  ctx.strokeText(discountText, 410, 792);
  ctx.fillText(discountText, 410, 792);
  ctx.shadowColor = 'transparent';
  ctx.strokeStyle = '#8d0000';
  ctx.lineWidth = 4;
  ctx.strokeText(discountText, 410, 792);
  ctx.restore();

  // Símbolo %.
  ctx.save();
  ctx.textAlign = 'left';
  ctx.font = '900 118px Arial, sans-serif';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 14;
  ctx.fillStyle = '#d40000';
  ctx.strokeText('%', 700, 660);
  ctx.fillText('%', 700, 660);
  ctx.strokeStyle = '#8d0000';
  ctx.lineWidth = 3;
  ctx.strokeText('%', 700, 660);
  ctx.restore();

  // OFF.
  ctx.save();
  ctx.textAlign = 'left';
  ctx.font = '900 96px Arial, sans-serif';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 14;
  ctx.fillStyle = '#d40000';
  ctx.strokeText('OFF', 688, 782);
  ctx.fillText('OFF', 688, 782);
  ctx.strokeStyle = '#8d0000';
  ctx.lineWidth = 3;
  ctx.strokeText('OFF', 688, 782);
  ctx.restore();

  // Nome do cliente: campo protegido para não escapar da margem.
  if (customerName) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(168, 1099, 820, 36);
    ctx.clip();
    ctx.fillStyle = '#24171f';
    const fontSize = fitCanvasFont(ctx, customerName, 790, 28, 17, 850);
    ctx.font = `850 ${fontSize}px Arial, sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(customerName.slice(0, 46), 176, 1117);
    ctx.restore();
  }

  // Código do cupom: centralizado e protegido dentro do campo branco.
  ctx.save();
  ctx.beginPath();
  ctx.rect(420, 1202, 548, 62);
  ctx.clip();
  ctx.fillStyle = '#2e0b00';
  const codeFont = fitCanvasFont(ctx, couponCode, 520, 50, 24, 900);
  ctx.font = `900 ${codeFont}px Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(couponCode, 694, 1234);
  ctx.restore();

  return canvas;
}

async function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Não foi possível finalizar o PNG do cupom.'));
    }, 'image/png', 1);
  });
}

function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1200);
}

interface CouponPreviewProps {
  discount: number;
  customerName: string;
  code: string;
}

function CouponPreview({ discount, customerName, code }: CouponPreviewProps): JSX.Element {
  const discountText = String(discount);
  const nameLength = customerName.length;
  const codeLength = code.length;
  const numberClass = discountText.length >= 2 ? 'double' : 'single';
  const nameClass = nameLength > 30 ? 'xsmall' : nameLength > 23 ? 'small' : '';
  const codeClass = codeLength > 20 ? 'small' : codeLength > 15 ? 'medium' : '';

  return (
    <div className="mapp-coupon-art" aria-label="Prévia do cupom promocional">
      <img src={COUPON_BG_URL} alt="Cupom base Jaque e Mercadão dos Óculos" className="mapp-coupon-art-image" draggable={false} />
      <div className="mapp-coupon-discount-veil" aria-hidden="true" />
      <div className={`mapp-coupon-discount ${numberClass}`}>{discountText}</div>
      <div className="mapp-coupon-percent">%</div>
      <div className="mapp-coupon-off">OFF</div>
      <div className={`mapp-coupon-name ${nameClass}`}>{customerName || ' '}</div>
      <div className={`mapp-coupon-code ${codeClass}`}>{code || buildDefaultCouponCode(discount)}</div>
    </div>
  );
}

interface CouponScreenProps {
  onNavigate?: (page: PageKey) => void;
}

export function CouponScreen({ onNavigate }: CouponScreenProps): JSX.Element {
  const [form, setForm] = useState<CouponFormState>({
    discount: '20',
    customerName: '',
    code: buildDefaultCouponCode(20),
  });
  const [codeTouched, setCodeTouched] = useState(false);
  const [exportState, setExportState] = useState<ExportState>('idle');
  const [shareState, setShareState] = useState<ExportState>('idle');
  const [feedback, setFeedback] = useState<string>('');

  const discount = useMemo(() => normalizeDiscount(form.discount), [form.discount]);
  const normalizedCode = useMemo(() => (form.code.trim() || buildDefaultCouponCode(discount)).slice(0, 26).toUpperCase(), [form.code, discount]);
  const normalizedName = useMemo(() => form.customerName.replace(/\s+/g, ' ').slice(0, 46), [form.customerName]);

  useEffect(() => {
    if (!codeTouched) {
      setForm((current) => ({ ...current, code: buildDefaultCouponCode(current.discount) }));
    }
  }, [form.discount, codeTouched]);

  function patchForm<K extends keyof CouponFormState>(key: K, value: CouponFormState[K]): void {
    setForm((current) => ({ ...current, [key]: value }));
    setFeedback('');
  }

  async function generateCouponBlob(): Promise<Blob> {
    const canvas = await renderCouponCanvas({ discount: String(discount), customerName: normalizedName, code: normalizedCode });
    return canvasToBlob(canvas);
  }

  async function handleDownload(): Promise<void> {
    setExportState('loading');
    setFeedback('');
    try {
      const blob = await generateCouponBlob();
      downloadBlob(blob, `cupom-jaque-${discount}.png`);
      setFeedback('PNG gerado sem corte. Se quiser, agora você pode compartilhar este arquivo com o cliente.');
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Não foi possível gerar o PNG agora.');
    } finally {
      setExportState('idle');
    }
  }

  async function handleShare(): Promise<void> {
    setShareState('loading');
    setFeedback('');
    try {
      const blob = await generateCouponBlob();
      const file = new File([blob], `cupom-jaque-${discount}.png`, { type: 'image/png' });
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Cupom Jaque', text: `Cupom de ${discount}% para ${normalizedName || 'cliente'} na Rede de Óticas Mercadão dos Óculos.` });
        setFeedback('Cupom compartilhado com sucesso.');
      } else {
        downloadBlob(blob, `cupom-jaque-${discount}.png`);
        setFeedback('Seu navegador não libera compartilhar direto. Baixamos o PNG para você enviar manualmente.');
      }
    } catch (error) {
      if (error instanceof Error && /AbortError/i.test(error.name)) {
        setFeedback('Compartilhamento cancelado. O cupom continua pronto para baixar.');
      } else {
        setFeedback(error instanceof Error ? error.message : 'Não foi possível compartilhar agora.');
      }
    } finally {
      setShareState('idle');
    }
  }

  const detailLines = useMemo(() => {
    const sampleCode = normalizedCode;
    const fakeCtx = document.createElement('canvas').getContext('2d');
    if (!fakeCtx) return [] as string[];
    fakeCtx.font = '800 28px Arial, sans-serif';
    const wrapped = wrapCanvasText(fakeCtx, normalizedName || 'Nome do cliente', 780);
    const lines = wrapped.slice(0, 2);
    return [`Desconto ${discount}%`, `Código ${sampleCode}`, ...(lines.length ? [`Nome ${lines.join(' / ')}`] : [])];
  }, [discount, normalizedCode, normalizedName]);

  return (
    <div className="mapp-screen mapp-coupon-screen">
      <section className="mapp-panel mapp-coupon-hero">
        <div>
          <span className="mapp-coupon-kicker">Cupom promocional PNG</span>
          <strong>Cupom centralizado com base limpa</strong>
          <p>Desconto, nome e código entram dentro da própria foto, centralizados e protegidos para não escapar das margens.</p>
        </div>
        <div className="mapp-coupon-hero-actions">
          <button type="button" className="secondary-btn" onClick={() => onNavigate?.('dashboard')}>Voltar</button>
          <button type="button" className="secondary-btn" onClick={() => {
            setCodeTouched(false);
            setForm({ discount: '20', customerName: '', code: buildDefaultCouponCode(20) });
            setFeedback('');
          }}>Restaurar padrão</button>
        </div>
      </section>

      <section className="mapp-coupon-layout">
        <div className="mapp-coupon-controls">
          <article className="mapp-section-block mapp-coupon-card">
            <div className="mapp-section-title"><h2>Configuração do cupom</h2><span>Arte 1080 × 1350</span></div>
            <div className="mapp-coupon-form-grid">
              <label className="mapp-form-field">
                <span>Porcentagem de desconto</span>
                <input type="text" inputMode="numeric" value={form.discount} maxLength={2} onChange={(event) => patchForm('discount', sanitizeDiscount(event.target.value))} placeholder="20" />
              </label>
              <div className="mapp-coupon-quick-discounts" aria-label="Descontos rápidos">
                {QUICK_DISCOUNTS.map((value) => (
                  <button key={value} type="button" className={discount === value ? 'is-active' : ''} onClick={() => patchForm('discount', String(value))}>{value}%</button>
                ))}
              </div>
              <label className="mapp-form-field mapp-form-field-full">
                <span>Nome do cliente</span>
                <input type="text" value={form.customerName} onChange={(event) => patchForm('customerName', event.target.value.slice(0, 46))} placeholder="Digite o nome do cliente" />
                <small>{normalizedName.length}/46 caracteres</small>
              </label>
              <label className="mapp-form-field mapp-form-field-full">
                <span>Código do cupom</span>
                <input type="text" value={form.code} onChange={(event) => { setCodeTouched(true); patchForm('code', event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 26)); }} placeholder="CLIENTEJAQUE20" />
                <small>Se deixar como padrão, o código acompanha a porcentagem.</small>
              </label>
            </div>

            <div className="mapp-coupon-export-actions">
              <button type="button" className="primary-btn" disabled={exportState === 'loading'} onClick={() => void handleDownload()}>{exportState === 'loading' ? 'Gerando PNG...' : 'Baixar PNG'}</button>
              <button type="button" className="secondary-btn" disabled={shareState === 'loading'} onClick={() => void handleShare()}>{shareState === 'loading' ? 'Preparando...' : 'Compartilhar PNG'}</button>
            </div>
            {feedback ? <div className="mapp-form-feedback mapp-form-feedback-info">{feedback}</div> : null}
          </article>

          <article className="mapp-section-block mapp-coupon-card mapp-coupon-helper-card">
            <div className="mapp-section-title"><h2>Checklist do cupom</h2><span>Proteção visual</span></div>
            <ul className="mapp-coupon-checklist">
              <li>Rodapé travado sem corte.</li>
              <li>Área segura fixa para desconto, nome e código.</li>
              <li>Nome do cliente centralizado e protegido.</li>
              <li>PNG pronto para status, WhatsApp e Instagram.</li>
            </ul>
            <div className="mapp-coupon-mini-notes">
              {detailLines.map((line) => <span key={line}>{line}</span>)}
            </div>
          </article>
        </div>

        <article className="mapp-section-block mapp-coupon-preview-panel">
          <div className="mapp-section-title"><h2>Prévia fiel</h2><span>Base limpa ajustada</span></div>
          <CouponPreview discount={discount} customerName={normalizedName} code={normalizedCode} />
          <p className="mapp-coupon-preview-note">A prévia usa a nova arte limpa. Os campos ficam centralizados nas áreas brancas e são cortados com segurança se o texto ficar grande demais.</p>
        </article>
      </section>
    </div>
  );
}

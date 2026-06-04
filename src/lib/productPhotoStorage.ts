export const PRODUCT_PHOTO_BUCKET = 'product-photos';
export const PRODUCT_PHOTO_MAX_BYTES = 4 * 1024 * 1024;

export interface ProductPhotoBlob {
  blob: Blob;
  mimeType: string;
  extension: 'jpg' | 'jpeg' | 'png' | 'webp';
  bytes: number;
}

const INLINE_IMAGE_PATTERN = /^data:image\/(png|jpe?g|webp);base64,/i;

export function isInlineProductImageData(value: string | null | undefined): boolean {
  return INLINE_IMAGE_PATTERN.test(String(value ?? '').trim());
}

export function isCloudProductImageValue(value: string | null | undefined): boolean {
  const source = String(value ?? '').trim();
  return /^https?:\/\//i.test(source) || source.startsWith('stores/');
}

function extensionFromMime(mimeType: string): ProductPhotoBlob['extension'] {
  if (mimeType === 'image/webp') return 'webp';
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/jpeg') return 'jpg';
  return 'jpg';
}

export function productPhotoDataUrlToBlob(dataUrl: string): ProductPhotoBlob {
  const match = dataUrl.match(/^data:(image\/(?:png|jpe?g|webp));base64,(.+)$/i);
  if (!match) throw new Error('A foto precisa estar em PNG, JPG ou WEBP.');

  const mimeType = match[1].toLowerCase() === 'image/jpg' ? 'image/jpeg' : match[1].toLowerCase();
  const base64 = match[2];
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  const blob = new Blob([bytes], { type: mimeType });
  return {
    blob,
    mimeType,
    extension: extensionFromMime(mimeType),
    bytes: blob.size,
  };
}

export function safeStorageSegment(value: string): string {
  const normalized = String(value || 'produto')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
  return normalized || 'produto';
}

export function buildProductPhotoStoragePath(params: {
  storeId: string;
  productId: string;
  productName: string;
  extension: ProductPhotoBlob['extension'];
  requestId?: string;
}): string {
  const storeId = safeStorageSegment(params.storeId);
  const productId = safeStorageSegment(params.productId);
  const productName = safeStorageSegment(params.productName).slice(0, 48);
  const version = safeStorageSegment(params.requestId || `${Date.now()}`).slice(0, 40);
  return `stores/${storeId}/products/${productId}/${productName || 'produto'}-${version}.${params.extension}`;
}

export function describeProductPhotoStorage(value: string | null | undefined): string {
  if (!value) return 'Sem foto cadastrada.';
  if (isInlineProductImageData(value)) return 'Foto em modo compatibilidade. Salva no registro, mas ainda não está no Storage.';
  if (isCloudProductImageValue(value)) return 'Foto salva na nuvem e pronta para aparecer em outros aparelhos.';
  return 'Foto cadastrada.';
}

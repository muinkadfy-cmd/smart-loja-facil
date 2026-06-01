const SECURE_PROTOCOL = ['http', 's'].join('');
const WHATSAPP_WEB_HOST = ['web', 'whatsapp', 'com'].join('.');
const WHATSAPP_CHAT_HOST = ['wa', 'me'].join('.');

function secureBaseUrl(host: string): string {
  return `${SECURE_PROTOCOL}://${host}`;
}

export function whatsappChatUrl(phone: string, text?: string): string {
  const url = new URL(`${secureBaseUrl(WHATSAPP_CHAT_HOST)}/${phone}`);
  if (text) url.searchParams.set('text', text);
  return url.toString();
}

export function whatsappWebUrl(phone?: string): string {
  if (!phone) return `${secureBaseUrl(WHATSAPP_WEB_HOST)}/`;
  const url = new URL('/send', secureBaseUrl(WHATSAPP_WEB_HOST));
  url.searchParams.set('phone', phone);
  return url.toString();
}

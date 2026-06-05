import type { PageKey } from '../../types';

export type MobileActionToastTone = 'success' | 'error' | 'info' | 'warning';

export type MobileActionToastDetail = {
  title: string;
  message: string;
  tone?: MobileActionToastTone;
  page?: PageKey;
  actionLabel?: string;
};

export const MOBILE_ACTION_TOAST_EVENT = 'smart-loja:mobile-action-toast';

export function notifyMobileAction(detail: MobileActionToastDetail): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<MobileActionToastDetail>(MOBILE_ACTION_TOAST_EVENT, {
    detail: {
      tone: 'success',
      actionLabel: detail.page ? 'Abrir' : undefined,
      ...detail,
    },
  }));
}

import React, { FormEvent, useEffect, useState } from 'react';
import { AppIcon } from '../components/AppIcon';
import { api } from '../lib/api';
import { getRuntimeInfo } from '../lib/runtime';
import { useWebPermissions } from '../lib/useWebPermissions';
import type { Settings } from '../types';

interface PageProps { refreshToken: number; onChanged: () => void; settings: Settings | null; onSettingsSaved: (settings: Settings) => void; }

const fallback: Settings = {
  store_name: 'Minha Loja',
  owner_name: 'Administrador',
  phone: '',
  whatsapp: '',
  address: '',
  receipt_message: 'Obrigado pela preferência!',
  low_stock_limit: 3,
  slow_mode: false,
  admin_password_enabled: false,
  receipt_width_mm: 105,
  updated_at: '',
};

export function SettingsPage({ refreshToken, settings, onSettingsSaved, onChanged }: PageProps): JSX.Element {
  const [form, setForm] = useState<Settings>(settings ?? fallback);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const runtimeInfo = getRuntimeInfo();
  const permissions = useWebPermissions(refreshToken);
  const canEditSettings = !runtimeInfo.isWeb || permissions.canManageStore;

  useEffect(() => {
    api.settings().then((payload) => setForm({ ...payload, receipt_width_mm: 105 })).catch(() => setForm({ ...(settings ?? fallback), receipt_width_mm: 105 }));
  }, [refreshToken, settings]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    if (!canEditSettings) {
      setSaved(false);
      setError(permissions.readonlyMessage || 'Seu perfil não permite alterar configurações da loja.');
      return;
    }
    try {
      const payload = await api.saveSettings({ ...form, receipt_width_mm: 105 });
      setForm(payload);
      onSettingsSaved(payload);
      setSaved(true);
      onChanged();
      setTimeout(() => setSaved(false), 1800);
    } catch (err) {
      setSaved(false);
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <div className="stack settings-light-v65 settings-premium-v93">
      <div className="page-title"><h1>Configurações</h1><p>{runtimeInfo.isWeb ? 'Dados da loja sincronizados na nuvem para web/mobile.' : 'Dados da loja, comprovante A6 10,5 x 14,8 cm, estoque baixo e modo PC lento.'}</p></div>
      {runtimeInfo.isWeb && !canEditSettings ? <div className="web-readonly-module-note"><strong>{permissions.roleLabel}</strong><span>{permissions.readonlyMessage || 'Somente dono ou administrador pode mudar configurações da loja.'}</span></div> : null}
      <section className="settings-helper-v93">
        <div>
          <strong>Configure a loja com segurança</strong>
          <span>Revise nome, contato, mensagem do comprovante e estoque baixo. Essas informações aparecem em recibos, relatórios e telas do sistema.</span>
        </div>
        <div className="settings-helper-chips-v93">
          <span>{runtimeInfo.isWeb ? 'Nuvem' : 'Local'}</span>
          <span>{canEditSettings ? 'Pode editar' : 'Somente leitura'}</span>
          <span>A6 fixo</span>
        </div>
      </section>
      <section className="settings-summary-grid-v93">
        <article><small>Loja</small><strong>{form.store_name || 'Minha Loja'}</strong><span>Nome exibido no sistema</span></article>
        <article><small>Responsável</small><strong>{form.owner_name || 'Administrador'}</strong><span>Contato do operador/dono</span></article>
        <article><small>Estoque baixo</small><strong>{form.low_stock_limit}</strong><span>Alerta por quantidade mínima</span></article>
      </section>
      <section className="panel form-panel settings-form-panel-v93">
        <form className="form-grid settings-form-grid-v93" onSubmit={submit}>
          <label>Nome da loja<input value={form.store_name} onChange={(e) => setForm({ ...form, store_name: e.target.value })} readOnly={!canEditSettings} /></label>
          <label>Responsável<input value={form.owner_name} onChange={(e) => setForm({ ...form, owner_name: e.target.value })} readOnly={!canEditSettings} /></label>
          <label>Telefone<input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} readOnly={!canEditSettings} /></label>
          <label>WhatsApp<input value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} readOnly={!canEditSettings} /></label>
          <label className="span-2">Endereço<input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} readOnly={!canEditSettings} /></label>
          <label className="span-2">Mensagem do comprovante<input value={form.receipt_message} onChange={(e) => setForm({ ...form, receipt_message: e.target.value })} readOnly={!canEditSettings} /></label>
          <label>Limite estoque baixo<input type="number" min="0" step="1" value={form.low_stock_limit} onChange={(e) => setForm({ ...form, low_stock_limit: Number(e.target.value) })} readOnly={!canEditSettings} /></label>
          <label>Comprovante<select value={form.receipt_width_mm} onChange={(e) => setForm({ ...form, receipt_width_mm: Number(e.target.value) })} disabled={!canEditSettings}><option value={105}>A6 10,5 x 14,8 cm</option></select></label>
          <label className="check-row"><input type="checkbox" checked={form.slow_mode} onChange={(e) => setForm({ ...form, slow_mode: e.target.checked })} disabled={!canEditSettings} /> Modo PC lento</label>
          <label className="check-row"><input type="checkbox" checked={form.admin_password_enabled} onChange={(e) => setForm({ ...form, admin_password_enabled: e.target.checked })} disabled={!canEditSettings} /> Senha administrativa opcional</label>
          <button className="primary-btn settings-save-btn-v93" disabled={!canEditSettings}><AppIcon name="configuracoes" size={16} className="app-icon-button-inline" />{canEditSettings ? 'Salvar configurações' : 'Somente leitura'}</button>
        </form>
      </section>
      {saved && <div className="notice">{runtimeInfo.isWeb ? 'Configurações salvas no Supabase.' : 'Configurações salvas no SQLite local.'}</div>}
      {error && <div className="error-box">{error}</div>}
    </div>
  );
}

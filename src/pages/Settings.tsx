import React, { FormEvent, useEffect, useState } from 'react';
import { AppIcon } from '../components/AppIcon';
import { api } from '../lib/api';
import type { Settings } from '../types';

interface PageProps { refreshToken: number; onChanged: () => void; settings: Settings | null; onSettingsSaved: (settings: Settings) => void; }

const fallback: Settings = {
  store_name: 'Minha Loja',
  owner_name: 'Administrador',
  phone: '',
  whatsapp: '',
  address: '',
  receipt_message: 'Obrigado pela preferencia!',
  low_stock_limit: 3,
  slow_mode: false,
  admin_password_enabled: false,
  receipt_width_mm: 105,
  updated_at: '',
};

export function SettingsPage({ refreshToken, settings, onSettingsSaved, onChanged }: PageProps): JSX.Element {
  const [form, setForm] = useState<Settings>(settings ?? fallback);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.settings().then((payload) => setForm({ ...payload, receipt_width_mm: 105 })).catch(() => setForm({ ...(settings ?? fallback), receipt_width_mm: 105 }));
  }, [refreshToken, settings]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload = await api.saveSettings({ ...form, receipt_width_mm: 105 });
    setForm(payload);
    onSettingsSaved(payload);
    setSaved(true);
    onChanged();
    setTimeout(() => setSaved(false), 1800);
  }

  return (
    <div className="stack">
      <div className="page-title"><h1>Configuracoes</h1><p>Dados da loja, comprovante A6 10,5 x 14,8 cm, estoque baixo e modo PC lento.</p></div>
      <section className="panel form-panel">
        <form className="form-grid" onSubmit={submit}>
          <label>Nome da loja<input value={form.store_name} onChange={(e) => setForm({ ...form, store_name: e.target.value })} /></label>
          <label>Responsavel<input value={form.owner_name} onChange={(e) => setForm({ ...form, owner_name: e.target.value })} /></label>
          <label>Telefone<input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></label>
          <label>WhatsApp<input value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} /></label>
          <label className="span-2">Endereco<input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></label>
          <label className="span-2">Mensagem do comprovante<input value={form.receipt_message} onChange={(e) => setForm({ ...form, receipt_message: e.target.value })} /></label>
          <label>Limite estoque baixo<input type="number" min="0" step="1" value={form.low_stock_limit} onChange={(e) => setForm({ ...form, low_stock_limit: Number(e.target.value) })} /></label>
          <label>Comprovante<select value={form.receipt_width_mm} onChange={(e) => setForm({ ...form, receipt_width_mm: Number(e.target.value) })}><option value={105}>A6 10,5 x 14,8 cm</option></select></label>
          <label className="check-row"><input type="checkbox" checked={form.slow_mode} onChange={(e) => setForm({ ...form, slow_mode: e.target.checked })} /> Modo PC lento</label>
          <label className="check-row"><input type="checkbox" checked={form.admin_password_enabled} onChange={(e) => setForm({ ...form, admin_password_enabled: e.target.checked })} /> Senha administrativa opcional</label>
          <button className="primary-btn"><AppIcon name="configuracoes" size={16} className="app-icon-button-inline" />Salvar configuracoes</button>
        </form>
      </section>
      {saved && <div className="notice">Configuracoes salvas no SQLite local.</div>}
    </div>
  );
}

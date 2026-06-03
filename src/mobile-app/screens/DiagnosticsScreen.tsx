import { useEffect, useMemo, useState } from 'react';
import {
  getWebOutboxStats,
  readWebOutbox,
  readWebSyncSnapshot,
  flushWebOutbox,
  WEB_APP_VERSION,
  WEB_CACHE_VERSION,
  getWebStoreContext,
  webRoleLabel,
  getWebRoleCapabilities,
  webCommercialValidation,
  webPrintTestReceipt,
  type WebCommercialCheckItem,
  type WebCommercialValidationReport,
  type WebOutboxStats,
  type WebSyncSnapshot,
  type WebStoreRole,
} from '../../lib/webApi';
import type { AppStatus } from '../../types';
import { InlineIcon } from '../components/InlineIcon';
import { ListCard } from '../components/ListCard';
import { StatCard } from '../components/StatCard';
import { formatDateTime, formatNumber } from '../components/format';

interface DiagnosticsScreenProps {
  status: AppStatus | null;
  onRefresh: () => void;
}

type Feedback = { tone: 'success' | 'error' | 'info'; text: string };

type RoleState = {
  role: WebStoreRole | 'sem login';
  storeName: string;
  email: string;
};

function snapshotLabel(snapshot: WebSyncSnapshot): string {
  if (snapshot.status === 'synced') return 'Sincronizado';
  if (snapshot.status === 'syncing') return 'Enviando';
  if (snapshot.status === 'pending') return 'Pendente';
  if (snapshot.status === 'error') return 'Erro';
  return 'Aguardando';
}

function statusTone(snapshot: WebSyncSnapshot): 'green' | 'blue' | 'orange' | 'purple' {
  if (snapshot.status === 'synced') return 'green';
  if (snapshot.status === 'syncing') return 'blue';
  if (snapshot.status === 'pending') return 'orange';
  if (snapshot.status === 'error') return 'purple';
  return 'blue';
}

function checkToneClass(level: WebCommercialCheckItem['level']): string {
  if (level === 'ok') return 'ok';
  if (level === 'warn') return 'warn';
  return 'danger';
}

function readyText(report: WebCommercialValidationReport | null): string {
  if (!report) return 'Não testado';
  if (report.readyLabel === 'piloto') return 'Liberado para piloto controlado';
  if (report.readyLabel === 'quase') return 'Quase pronto';
  return 'Não vender ainda';
}

function reportToText(report: WebCommercialValidationReport, snapshot: WebSyncSnapshot): string {
  const lines = [
    'Smart Loja Fácil — teste comercial v126',
    `Gerado em: ${formatDateTime(report.createdAt)}`,
    `App: ${report.appVersion}`,
    `Cache: ${report.cacheVersion}`,
    `Loja: ${report.storeName}`,
    `E-mail: ${report.email}`,
    `Papel: ${report.roleLabel}`,
    `Nota automática: ${report.score}/10`,
    `Status: ${readyText(report)}`,
    `Pendências: ${report.outbox.total}`,
    `Última sincronização: ${snapshot.module} — ${snapshot.detail}`,
    '',
    'Checklist:',
    ...report.checks.map((check) => `- [${check.level.toUpperCase()}] ${check.area}: ${check.title} — ${check.detail} | ${check.evidence}`),
  ];
  return lines.join('\n');
}

export function DiagnosticsScreen({ status, onRefresh }: DiagnosticsScreenProps): JSX.Element {
  const [snapshot, setSnapshot] = useState<WebSyncSnapshot>(() => readWebSyncSnapshot());
  const [outbox, setOutbox] = useState<WebOutboxStats>(() => getWebOutboxStats());
  const [roleState, setRoleState] = useState<RoleState>({ role: 'sem login', storeName: '', email: '' });
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [busy, setBusy] = useState(false);
  const [commercialBusy, setCommercialBusy] = useState(false);
  const [printBusy, setPrintBusy] = useState<'58mm' | '80mm' | 'a4' | null>(null);
  const [report, setReport] = useState<WebCommercialValidationReport | null>(null);

  const refreshLocal = () => {
    setSnapshot(readWebSyncSnapshot());
    setOutbox(getWebOutboxStats());
  };

  const loadRole = async () => {
    try {
      const context = await getWebStoreContext({ createIfMissing: false });
      setRoleState({ role: context.role, storeName: context.store.name, email: context.email });
    } catch {
      setRoleState({ role: 'sem login', storeName: '', email: '' });
    }
  };

  useEffect(() => {
    refreshLocal();
    void loadRole();
    const handler = () => refreshLocal();
    window.addEventListener('smart-loja:web-sync-status', handler);
    window.addEventListener('smart-loja:web-outbox-change', handler);
    window.addEventListener('online', handler);
    window.addEventListener('offline', handler);
    return () => {
      window.removeEventListener('smart-loja:web-sync-status', handler);
      window.removeEventListener('smart-loja:web-outbox-change', handler);
      window.removeEventListener('online', handler);
      window.removeEventListener('offline', handler);
    };
  }, []);

  const capabilities = useMemo(() => getWebRoleCapabilities(roleState.role), [roleState.role]);
  const pendingItems = useMemo(() => readWebOutbox().slice(0, 6), [outbox.total]);
  const online = typeof navigator === 'undefined' ? true : navigator.onLine;
  const groupedChecks = useMemo(() => {
    const groups = new Map<string, WebCommercialCheckItem[]>();
    for (const check of report?.checks ?? []) {
      const rows = groups.get(check.area) ?? [];
      rows.push(check);
      groups.set(check.area, rows);
    }
    return Array.from(groups.entries());
  }, [report]);

  async function resendPending(): Promise<void> {
    setBusy(true);
    setFeedback(null);
    try {
      const stats = await flushWebOutbox();
      setOutbox(stats);
      setSnapshot(readWebSyncSnapshot());
      setFeedback({ tone: stats.total === 0 ? 'success' : 'info', text: stats.total === 0 ? 'Pendências enviadas para a nuvem.' : `${formatNumber(stats.total)} pendência(s) ainda precisam de atenção.` });
      onRefresh();
    } catch (error) {
      setFeedback({ tone: 'error', text: error instanceof Error ? error.message : String(error) });
    } finally {
      setBusy(false);
    }
  }

  async function clearCache(): Promise<void> {
    const ok = window.confirm('Limpar cache antigo e recarregar a versão nova neste aparelho?');
    if (!ok) return;
    try {
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((key) => caches.delete(key)));
      }
    } finally {
      window.location.reload();
    }
  }

  async function runCommercialTest(): Promise<void> {
    setCommercialBusy(true);
    setFeedback(null);
    try {
      const nextReport = await webCommercialValidation();
      setReport(nextReport);
      setOutbox(nextReport.outbox);
      setSnapshot(readWebSyncSnapshot());
      setFeedback({
        tone: nextReport.readyLabel === 'nao' ? 'error' : nextReport.readyLabel === 'piloto' ? 'success' : 'info',
        text: `Teste comercial concluído: ${nextReport.score}/10 — ${readyText(nextReport)}.`,
      });
    } catch (error) {
      setFeedback({ tone: 'error', text: error instanceof Error ? error.message : String(error) });
    } finally {
      setCommercialBusy(false);
    }
  }

  async function printTest(format: '58mm' | '80mm' | 'a4'): Promise<void> {
    setPrintBusy(format);
    setFeedback(null);
    try {
      await webPrintTestReceipt(format);
      setFeedback({ tone: 'success', text: `Amostra ${format} aberta. Ela não grava venda, não mexe no caixa e não baixa estoque.` });
    } catch (error) {
      setFeedback({ tone: 'error', text: error instanceof Error ? error.message : String(error) });
    } finally {
      setPrintBusy(null);
    }
  }

  async function copyDiagnostic(): Promise<void> {
    const text = report
      ? reportToText(report, snapshot)
      : [
          `App: ${WEB_APP_VERSION}`,
          `Cache: ${WEB_CACHE_VERSION}`,
          `Loja: ${roleState.storeName || status?.settings.store_name || 'sem loja'}`,
          `E-mail: ${roleState.email || 'sem login'}`,
          `Papel: ${webRoleLabel(roleState.role)}`,
          `Permissão: ${capabilities.writeLabel}`,
          `Conexão: ${online ? 'online' : 'offline'}`,
          `Nuvem: ${status?.sqlite_ok ? 'conectada' : 'verificar login/configuração'}`,
          `Pendências: ${outbox.total}`,
          `Última sincronização: ${snapshot.module} - ${snapshot.detail}`,
          `Largura: ${window.innerWidth}px`,
          `Altura: ${window.innerHeight}px`,
        ].join('\n');
    await navigator.clipboard?.writeText(text).catch(() => undefined);
    setFeedback({ tone: 'success', text: report ? 'Relatório comercial copiado.' : 'Diagnóstico copiado. Pode enviar para suporte sem expor senha.' });
  }

  return (
    <div className="mapp-screen mapp-diagnostics-screen">
      <section className="mapp-mini-stat-grid">
        <StatCard label="Nuvem" value={status?.sqlite_ok ? 'Online' : 'Verificar'} detail={online ? 'internet ativa' : 'sem internet'} icon="bloqueio_seguro" tone={status?.sqlite_ok ? 'green' : 'orange'} />
        <StatCard label="Sincronização" value={snapshotLabel(snapshot)} detail={snapshot.module} icon="atualizar" tone={statusTone(snapshot)} />
        <StatCard label="Pendências" value={formatNumber(outbox.total)} detail={outbox.total ? 'neste aparelho' : 'fila limpa'} icon="offline_local" tone={outbox.total ? 'orange' : 'green'} />
        <StatCard label="Comercial" value={report ? `${report.score}/10` : 'Testar'} detail={readyText(report)} icon="relatorios" tone={report?.readyLabel === 'nao' ? 'orange' : report?.readyLabel === 'piloto' ? 'green' : 'blue'} />
      </section>

      {feedback ? <div className={`mapp-form-feedback mapp-form-feedback-${feedback.tone}`}>{feedback.text}</div> : null}

      <section className="mapp-form-panel mapp-commercial-panel">
        <div className="mapp-form-head">
          <span className="mapp-form-icon tone-green"><InlineIcon name="bloqueio_seguro" size={24} /></span>
          <div>
            <strong>Validação comercial real</strong>
            <p>Testa login, papel, leitura das tabelas, pendências, cache e PWA sem gravar dados.</p>
          </div>
        </div>
        <div className="mapp-button-grid">
          <button type="button" className="mapp-primary-button" onClick={() => void runCommercialTest()} disabled={commercialBusy}>{commercialBusy ? 'Testando...' : 'Rodar teste comercial'}</button>
          <button type="button" className="mapp-secondary-button" onClick={() => void copyDiagnostic()}>Copiar relatório</button>
          <button type="button" className="mapp-secondary-button" onClick={onRefresh}>Puxar dados</button>
          <button type="button" className="mapp-secondary-button" onClick={() => void clearCache()}>Limpar cache antigo</button>
        </div>
      </section>

      {report ? (
        <section className="mapp-section-block mapp-commercial-report">
          <div className="mapp-section-title"><h2>Resultado comercial</h2><button type="button" onClick={() => void copyDiagnostic()}>Copiar</button></div>
          <div className="mapp-commercial-score-card">
            <span className={report.readyLabel === 'nao' ? 'danger' : report.readyLabel === 'piloto' ? 'ok' : 'warn'}>{report.score}/10</span>
            <div>
              <strong>{readyText(report)}</strong>
              <p>{report.storeName} · {report.roleLabel} · {formatDateTime(report.createdAt)}</p>
            </div>
          </div>
          <div className="mapp-commercial-groups">
            {groupedChecks.map(([area, checks]) => (
              <article key={area} className="mapp-commercial-group">
                <header><strong>{area}</strong><small>{checks.length} item(ns)</small></header>
                {checks.map((check) => (
                  <div key={check.id} className={`mapp-check-row ${checkToneClass(check.level)}`}>
                    <span>{check.level === 'ok' ? '✓' : check.level === 'warn' ? '!' : '×'}</span>
                    <div>
                      <strong>{check.title}</strong>
                      <p>{check.detail}</p>
                      <small>{check.evidence}</small>
                    </div>
                  </div>
                ))}
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section className="mapp-form-panel mapp-print-test-panel">
        <div className="mapp-form-head">
          <span className="mapp-form-icon tone-sky"><InlineIcon name="comprovantes" size={24} /></span>
          <div>
            <strong>Teste seguro de impressão</strong>
            <p>Abre uma amostra sem vender, sem baixar estoque e sem alterar caixa.</p>
          </div>
        </div>
        <div className="mapp-button-grid">
          <button type="button" className="mapp-secondary-button" onClick={() => void printTest('58mm')} disabled={Boolean(printBusy)}>{printBusy === '58mm' ? 'Abrindo...' : 'Teste 58mm'}</button>
          <button type="button" className="mapp-secondary-button" onClick={() => void printTest('80mm')} disabled={Boolean(printBusy)}>{printBusy === '80mm' ? 'Abrindo...' : 'Teste 80mm'}</button>
          <button type="button" className="mapp-secondary-button" onClick={() => void printTest('a4')} disabled={Boolean(printBusy)}>{printBusy === 'a4' ? 'Abrindo...' : 'Teste A4/PDF'}</button>
        </div>
      </section>

      <section className="mapp-section-block">
        <div className="mapp-section-title"><h2>Diagnóstico simples</h2><button type="button" onClick={() => { refreshLocal(); void loadRole(); onRefresh(); }}>Atualizar</button></div>
        <div className="mapp-diagnostic-grid">
          <span><b>Loja</b><strong>{roleState.storeName || status?.settings.store_name || 'Sem loja'}</strong></span>
          <span><b>Conexão</b><strong>{online ? 'Online' : 'Offline'}</strong></span>
          <span><b>App</b><strong>{status?.version ?? WEB_APP_VERSION}</strong></span>
          <span><b>Cache</b><strong>v126 validação</strong></span>
          <span><b>Papel</b><strong>{webRoleLabel(roleState.role)}</strong></span>
          <span><b>Permissão</b><strong>{capabilities.writeLabel}</strong></span>
          <span><b>Última área</b><strong>{snapshot.module}</strong></span>
          <span><b>Último envio</b><strong>{snapshot.at ? formatDateTime(snapshot.at) : 'Sem registro'}</strong></span>
        </div>
      </section>

      <section className="mapp-form-panel">
        <div className="mapp-form-head">
          <span className="mapp-form-icon tone-green"><InlineIcon name="atualizar" size={24} /></span>
          <div>
            <strong>{snapshotLabel(snapshot)}</strong>
            <p>{snapshot.detail}</p>
          </div>
        </div>
        <div className="mapp-button-grid">
          <button type="button" className="mapp-primary-button" onClick={() => void resendPending()} disabled={busy}>{busy ? 'Enviando...' : 'Reenviar pendências'}</button>
          <button type="button" className="mapp-secondary-button" onClick={onRefresh}>Puxar dados da nuvem</button>
          <button type="button" className="mapp-secondary-button" onClick={() => void copyDiagnostic()}>Copiar diagnóstico</button>
          <button type="button" className="mapp-secondary-button" onClick={() => void clearCache()}>Limpar cache antigo</button>
        </div>
      </section>

      <section className="mapp-section-block">
        <div className="mapp-section-title"><h2>Pendências neste aparelho</h2><button type="button" onClick={() => void resendPending()} disabled={busy}>Enviar</button></div>
        {pendingItems.length ? (
          <div className="mapp-list-stack">
            {pendingItems.map((item) => (
              <ListCard
                key={item.id}
                icon="offline_local"
                title={item.module}
                subtitle={`${item.action} · ${item.attempts} tentativa(s) · ${item.lastError || 'aguardando internet'}`}
                value={formatDateTime(item.createdAt)}
                tone={item.lastError ? 'orange' : 'blue'}
              />
            ))}
          </div>
        ) : (
          <div className="mapp-success-card"><strong>Sem pendências</strong><p>Tudo que este aparelho sabe já foi enviado ou não houve alteração offline.</p></div>
        )}
      </section>

      <section className="mapp-warning-card">
        <span><InlineIcon name="bloqueio_seguro" size={24} /></span>
        <div>
          <strong>Teste manual ainda é obrigatório antes de vender</strong>
          <p>Entre com dono, administrador, operador e leitor em dois aparelhos. Crie cliente/produto/venda/pedido, confira se aparece no outro aparelho e teste uma impressão real.</p>
        </div>
        <button type="button" onClick={() => void copyDiagnostic()}>Copiar</button>
      </section>
    </div>
  );
}

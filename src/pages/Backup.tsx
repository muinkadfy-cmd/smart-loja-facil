import React, { useEffect, useMemo, useState } from 'react';
import { AppIcon } from '../components/AppIcon';
import { DataTable } from '../components/DataTable';
import { TableFilters } from '../components/TableFilters';
import { api } from '../lib/api';
import { matchesFilterQuery } from '../lib/filter';
import { dateTime } from '../lib/format';
import { getPreferredBackupFolder, setPreferredBackupFolder } from '../lib/preferences';
import type { BackupInfo } from '../types';

interface PageProps { refreshToken: number; onChanged: () => void; }

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function BackupPage({ refreshToken, onChanged }: PageProps): JSX.Element {
  const [rows, setRows] = useState<BackupInfo[]>([]);
  const [query, setQuery] = useState('');
  const [integrityFilter, setIntegrityFilter] = useState('todos');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [preferredBackupFolder, setPreferredBackupFolderState] = useState<string | null>(getPreferredBackupFolder());

  async function reloadBackups() {
    setRows(await api.backups());
  }

  useEffect(() => { reloadBackups().catch(() => undefined); }, [refreshToken]);

  const safeCount = useMemo(() => rows.filter((row) => row.integrity_ok).length, [rows]);
  const lastBackup = rows[0] ?? null;
  const totalSize = useMemo(() => rows.reduce((sum, row) => sum + row.size_bytes, 0), [rows]);
  const filteredRows = useMemo(() => rows.filter((row) => {
    const matchesIntegrity = integrityFilter === 'todos'
      || (integrityFilter === 'ok' && row.integrity_ok)
      || (integrityFilter === 'falha' && !row.integrity_ok);
    const matchesQuery = matchesFilterQuery(query, [row.file_name, row.created_at, row.size_bytes, row.integrity_ok ? 'ok' : 'falha']);
    return matchesIntegrity && matchesQuery;
  }), [integrityFilter, query, rows]);

  function askRestoreConfirmation(label: string): string | null {
    const first = window.confirm(`Restaurar o backup ${label}? O sistema criara um backup de seguranca antes.`);
    if (!first) return null;
    return window.prompt('Digite exatamente RESTAURAR para confirmar a restauracao:');
  }

  async function createLocal() {
    setLoading(true);
    setMessage('');
    try {
      const info = await api.createBackup();
      await reloadBackups();
      setMessage(`Backup completo criado com sucesso: ${info.file_name}.`);
      onChanged();
    } finally { setLoading(false); }
  }

  async function createElsewhere() {
    setLoading(true);
    setMessage('');
    try {
      const folder = await api.pickBackupFolder();
      if (!folder) return;
      setPreferredBackupFolder(folder);
      setPreferredBackupFolderState(folder);
      const info = await api.createBackupTo(folder);
      await reloadBackups();
      setMessage(`Backup completo salvo na pasta escolhida: ${info.file_name}.`);
      onChanged();
    } finally { setLoading(false); }
  }

  async function restoreSaved(row: BackupInfo) {
    if (!row.integrity_ok) {
      window.alert('Este backup nao passou na validacao de integridade. Restauracao bloqueada.');
      return;
    }
    const confirmation = askRestoreConfirmation(row.file_name);
    if (confirmation !== 'RESTAURAR') return;
    setLoading(true);
    setMessage('');
    try {
      await api.restoreBackupFromPath(row.file_path, confirmation);
      await reloadBackups();
      setMessage('Backup restaurado. Feche e abra o app para garantir que banco e arquivos externos recarreguem corretamente.');
      onChanged();
    } finally { setLoading(false); }
  }

  async function restoreExternal() {
    setLoading(true);
    setMessage('');
    try {
      const backupPath = await api.pickRestoreBackupFile();
      if (!backupPath) return;
      const label = backupPath.split(/[/\\]/).pop() ?? backupPath;
      const confirmation = askRestoreConfirmation(label);
      if (confirmation !== 'RESTAURAR') return;
      await api.restoreBackupFromPath(backupPath, confirmation);
      await reloadBackups();
      setMessage('Backup externo restaurado. Feche e abra o app para garantir que banco e arquivos externos recarreguem corretamente.');
      onChanged();
    } finally { setLoading(false); }
  }

  return (
    <div className="stack">
      <div className="page-title">
        <div>
          <h1>Backup e Restauracao</h1>
          <p>Area critica de protecao do banco local e dos arquivos externos do sistema, com fluxo seguro para usuario leigo.</p>
        </div>
        <div className="hero-status reports-hero-status">
          <span className="status-chip"><AppIcon name="arquivo_banco_sqlite" size={16} className="app-icon-button-inline" />SQLite protegido</span>
          <span className="status-chip"><AppIcon name="relatorios" size={16} className="app-icon-button-inline" />Relatorios incluidos</span>
          <span className="status-chip"><AppIcon name="bloqueio_seguro" size={16} className="app-icon-button-inline" />Restauracao segura</span>
        </div>
      </div>

      <section className="panel reports-hero-panel">
        <div className="reports-summary-grid">
          <article className="mini-insight-card tone-blue">
            <small>Total de backups</small>
            <strong>{rows.length}</strong>
            <p>{rows.length === 1 ? '1 copia local disponivel.' : `${rows.length} copias locais disponiveis.`}</p>
          </article>
          <article className="mini-insight-card tone-green">
            <small>Backups integros</small>
            <strong>{safeCount}</strong>
            <p>Somente backups validos podem ser restaurados.</p>
          </article>
          <article className="mini-insight-card tone-purple">
            <small>Espaco usado</small>
            <strong>{formatSize(totalSize)}</strong>
            <p>{lastBackup ? `Ultimo backup em ${dateTime(lastBackup.created_at)}.` : 'Nenhum backup criado ainda.'}</p>
          </article>
        </div>
      </section>

      <section className="panel backup-callout backup-callout-premium">
        <div>
          <strong>Backup completo</strong>
          {preferredBackupFolder && <small>Pasta preferida atual: {preferredBackupFolder}</small>}
          <p>O pacote agora leva banco SQLite e pasta de relatorios. Antes de restaurar, o sistema cria outra copia de seguranca do estado atual.</p>
        </div>
        <div className="backup-action-buttons">
          <button className="primary-btn" onClick={createLocal} disabled={loading}><AppIcon name="backup" size={16} className="app-icon-button-inline" />{loading ? 'Processando backup...' : 'Criar backup local'}</button>
          <button className="secondary-btn" onClick={createElsewhere} disabled={loading}><AppIcon name="backup" size={16} className="app-icon-button-inline" />Salvar em outra pasta</button>
        </div>
      </section>

      <section className="backup-tips-grid">
        <article className="panel backup-tip-card">
          <strong>1. Pacote completo</strong>
          <p>O backup inclui o banco local e toda a pasta de relatorios do aplicativo.</p>
        </article>
        <article className="panel backup-tip-card">
          <strong>2. Restaurar externo</strong>
          <p>Tambem da para restaurar um arquivo externo fora da lista local do sistema.</p>
        </article>
        <article className="panel backup-tip-card">
          <strong>3. Confirmar</strong>
          <p>O sistema exige dupla confirmacao e cria uma copia de seguranca antes da troca.</p>
        </article>
      </section>

      {message && <div className="notice reports-notice">{message}</div>}

      <section className="panel backup-external-panel">
        <div className="panel-head panel-head-tight">
          <div>
            <h2>Restaurar backup externo</h2>
            <p>Selecione um `backup-manifest.json` do pacote completo ou um backup legado `.sqlite3`.</p>
          </div>
          <button className="secondary-btn" onClick={restoreExternal} disabled={loading}><AppIcon name="backup" size={16} className="app-icon-button-inline" />Escolher arquivo para restaurar</button>
        </div>
      </section>

      <section className="panel">
        <div className="panel-head panel-head-tight">
          <div>
            <h2>Lista de backups locais</h2>
            <p>Veja o historico salvo pelo app, confira a integridade e restaure com seguranca quando necessario.</p>
          </div>
        </div>
        <TableFilters
          query={query}
          onQueryChange={setQuery}
          queryPlaceholder="Buscar por nome do arquivo ou data"
          summary={`${filteredRows.length} de ${rows.length} backups visiveis`}
          selects={[
            {
              label: 'Integridade',
              value: integrityFilter,
              onChange: setIntegrityFilter,
              options: [
                { value: 'todos', label: 'Todos' },
                { value: 'ok', label: 'OK' },
                { value: 'falha', label: 'Falha' },
              ],
            },
          ]}
        />
        <DataTable<BackupInfo>
          rows={filteredRows}
          empty="Nenhum backup criado ainda. Clique em Criar backup local para gerar a primeira copia completa."
          columns={[
            { key: 'file', label: 'Arquivo', render: (row) => <div className="backup-file-cell"><strong>{row.file_name}</strong><small>{row.integrity_ok ? 'Pronto para restauracao' : 'Integridade reprovada'}</small></div> },
            { key: 'size', label: 'Tamanho', align: 'right', render: (row) => formatSize(row.size_bytes) },
            { key: 'ok', label: 'Integridade', render: (row) => row.integrity_ok ? <span className="ok-dot">OK</span> : <span className="bad-dot">Falha</span> },
            { key: 'date', label: 'Criado em', render: (row) => dateTime(row.created_at) },
            { key: 'actions', label: 'Acoes', align: 'right', render: (row) => <button className="secondary-btn small" disabled={loading || !row.integrity_ok} onClick={() => restoreSaved(row)}><AppIcon name="bloqueio_seguro" size={16} className="app-icon-button-inline" />{row.integrity_ok ? 'Restaurar backup' : 'Bloqueado'}</button> },
          ]}
        />
      </section>
    </div>
  );
}

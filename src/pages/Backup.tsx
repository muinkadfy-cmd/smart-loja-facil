import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AppIcon } from '../components/AppIcon';
import { DataTable } from '../components/DataTable';
import { TableFilters } from '../components/TableFilters';
import { api } from '../lib/api';
import { matchesFilterQuery } from '../lib/filter';
import { dateTime } from '../lib/format';
import { getPreferredBackupFolder, setPreferredBackupFolder } from '../lib/preferences';
import { getRuntimeInfo } from '../lib/runtime';
import type { BackupInfo } from '../types';

interface PageProps { refreshToken: number; onChanged: () => void; }

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function BackupPage({ refreshToken, onChanged }: PageProps): JSX.Element {
  const runtimeInfo = useMemo(() => getRuntimeInfo(), []);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [rows, setRows] = useState<BackupInfo[]>([]);
  const [query, setQuery] = useState('');
  const [integrityFilter, setIntegrityFilter] = useState('todos');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
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
    const first = window.confirm(`Restaurar o backup ${label}? O sistema criará um backup de segurança antes.`);
    if (!first) return null;
    return window.prompt('Digite exatamente RESTAURAR para confirmar a restauração:');
  }

  async function createLocal() {
    setLoading(true);
    setMessage('');
    setError('');
    try {
      const info = await api.createBackup();
      await reloadBackups();
      setMessage(runtimeInfo.isWeb
        ? `Backup web exportado: ${info.file_name}. O navegador baixou um arquivo JSON seguro para guardar fora do sistema.`
        : `Backup completo criado com sucesso: ${info.file_name}.`);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally { setLoading(false); }
  }

  async function createElsewhere() {
    if (runtimeInfo.isWeb) {
      await createLocal();
      return;
    }
    setLoading(true);
    setMessage('');
    setError('');
    try {
      const folder = await api.pickBackupFolder();
      if (!folder) return;
      setPreferredBackupFolder(folder);
      setPreferredBackupFolderState(folder);
      const info = await api.createBackupTo(folder);
      await reloadBackups();
      setMessage(`Backup completo salvo na pasta escolhida: ${info.file_name}.`);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally { setLoading(false); }
  }

  async function restoreSaved(row: BackupInfo) {
    if (runtimeInfo.isWeb) {
      setError('No navegador, a lista mostra apenas o histórico de downloads. Para restaurar, clique em Importar JSON e selecione o arquivo baixado.');
      return;
    }
    if (!row.integrity_ok) {
      window.alert('Este backup não passou na validação de integridade. Restauração bloqueada.');
      return;
    }
    const confirmation = askRestoreConfirmation(row.file_name);
    if (confirmation !== 'RESTAURAR') return;
    setLoading(true);
    setMessage('');
    setError('');
    try {
      await api.restoreBackupFromPath(row.file_path, confirmation);
      await reloadBackups();
      setMessage('Backup restaurado. Feche e abra o app para garantir que banco e arquivos externos recarreguem corretamente.');
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally { setLoading(false); }
  }

  async function restoreExternal() {
    if (runtimeInfo.isWeb) {
      fileInputRef.current?.click();
      return;
    }
    setLoading(true);
    setMessage('');
    setError('');
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
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally { setLoading(false); }
  }

  async function importWebBackup(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const confirmation = askRestoreConfirmation(file.name);
    if (confirmation !== 'RESTAURAR') return;
    setLoading(true);
    setMessage('');
    setError('');
    try {
      const content = await file.text();
      await api.restoreWebBackupContent(content, confirmation);
      await reloadBackups();
      setMessage('Backup web importado com segurança. A importação não apaga dados existentes; ela repõe/atualiza registros compatíveis da loja atual.');
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally { setLoading(false); }
  }

  const title = runtimeInfo.isWeb ? 'Backup Web/Nuvem' : 'Backup e Restauração';
  const description = runtimeInfo.isWeb
    ? 'Exporte um JSON com os dados da loja na nuvem e importe com confirmação dupla. O backup tenta embutir as fotos de produtos; se alguma ficar só por link/caminho, copie também o bucket product-photos ao migrar de projeto.'
    : 'Área crítica de proteção do banco local e dos arquivos externos do sistema, com fluxo seguro para usuário leigo.';

  return (
    <div className="stack">
      <input ref={fileInputRef} type="file" accept="application/json,.json" className="hidden-file-input" onChange={importWebBackup} />
      <div className="page-title">
        <div>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        <div className="hero-status reports-hero-status">
          <span className="status-chip"><AppIcon name={runtimeInfo.isWeb ? 'backup' : 'arquivo_banco_sqlite'} size={16} className="app-icon-button-inline" />{runtimeInfo.isWeb ? 'Nuvem protegida' : 'SQLite protegido'}</span>
          <span className="status-chip"><AppIcon name="relatorios" size={16} className="app-icon-button-inline" />Relatórios incluídos</span>
          <span className="status-chip"><AppIcon name="bloqueio_seguro" size={16} className="app-icon-button-inline" />Confirmação dupla</span>
        </div>
      </div>

      <section className="panel reports-hero-panel">
        <div className="reports-summary-grid">
          <article className="mini-insight-card tone-blue">
            <small>{runtimeInfo.isWeb ? 'Downloads registrados' : 'Total de backups'}</small>
            <strong>{rows.length}</strong>
            <p>{runtimeInfo.isWeb ? 'Histórico local dos JSONs exportados neste navegador.' : rows.length === 1 ? '1 cópia local disponível.' : `${rows.length} cópias locais disponíveis.`}</p>
          </article>
          <article className="mini-insight-card tone-green">
            <small>Backups íntegros</small>
            <strong>{safeCount}</strong>
            <p>{runtimeInfo.isWeb ? 'O arquivo baixado deve ser guardado fora do navegador.' : 'Somente backups válidos podem ser restaurados.'}</p>
          </article>
          <article className="mini-insight-card tone-purple">
            <small>Espaço usado</small>
            <strong>{formatSize(totalSize)}</strong>
            <p>{lastBackup ? `Último backup em ${dateTime(lastBackup.created_at)}.` : 'Nenhum backup criado ainda.'}</p>
          </article>
        </div>
      </section>

      <section className="panel backup-callout backup-callout-premium">
        <div>
          <strong>{runtimeInfo.isWeb ? 'Backup JSON da nuvem' : 'Backup completo'}</strong>
          {!runtimeInfo.isWeb && preferredBackupFolder && <small>Pasta preferida atual: {preferredBackupFolder}</small>}
          <p>{runtimeInfo.isWeb
            ? 'Exporta loja, cadastros, vendas, caixa, crediário, pedidos, comprovantes e estoque em um arquivo JSON. A importação cria um backup antes e não apaga dados existentes.'
            : 'O pacote leva banco SQLite e pasta de relatórios. Antes de restaurar, o sistema cria outra cópia de segurança do estado atual.'}</p>
        </div>
        <div className="backup-action-buttons">
          <button className="primary-btn" onClick={createLocal} disabled={loading}><AppIcon name="backup" size={16} className="app-icon-button-inline" />{loading ? 'Processando backup...' : runtimeInfo.isWeb ? 'Baixar backup JSON' : 'Criar backup local'}</button>
          <button className="secondary-btn" onClick={createElsewhere} disabled={loading}><AppIcon name="backup" size={16} className="app-icon-button-inline" />{runtimeInfo.isWeb ? 'Gerar nova cópia' : 'Salvar em outra pasta'}</button>
        </div>
      </section>

      <section className="backup-tips-grid">
        <article className="panel backup-tip-card">
          <strong>1. Pacote completo</strong>
          <p>{runtimeInfo.isWeb ? 'Inclui os principais dados comerciais da loja atual na nuvem.' : 'Inclui o banco local e toda a pasta de relatórios do aplicativo.'}</p>
        </article>
        <article className="panel backup-tip-card">
          <strong>2. Restauração protegida</strong>
          <p>{runtimeInfo.isWeb ? 'No web, a importação é mesclada: atualiza ou repõe registros sem limpar a loja inteira.' : 'Também dá para restaurar um arquivo externo fora da lista local do sistema.'}</p>
        </article>
        <article className="panel backup-tip-card">
          <strong>3. Confirmar</strong>
          <p>O sistema exige dupla confirmação e cria uma cópia de segurança antes da troca.</p>
        </article>
      </section>

      {error && <div className="error-box reports-notice">{error}</div>}
      {message && <div className="notice reports-notice">{message}</div>}

      <section className="panel backup-external-panel">
        <div className="panel-head panel-head-tight">
          <div>
            <h2>{runtimeInfo.isWeb ? 'Importar backup JSON' : 'Restaurar backup externo'}</h2>
            <p>{runtimeInfo.isWeb ? 'Selecione o arquivo JSON baixado pelo botão Baixar backup JSON. Use somente arquivos confiáveis da mesma loja.' : 'Selecione um `backup-manifest.json` do pacote completo ou um backup legado `.sqlite3`.'}</p>
          </div>
          <button className="secondary-btn" onClick={restoreExternal} disabled={loading}><AppIcon name="backup" size={16} className="app-icon-button-inline" />{runtimeInfo.isWeb ? 'Importar JSON' : 'Escolher arquivo para restaurar'}</button>
        </div>
      </section>

      <section className="panel">
        <div className="panel-head panel-head-tight">
          <div>
            <h2>{runtimeInfo.isWeb ? 'Histórico de backups baixados' : 'Lista de backups locais'}</h2>
            <p>{runtimeInfo.isWeb ? 'O navegador não guarda o conteúdo do backup por segurança; ele mostra apenas o histórico dos arquivos baixados.' : 'Veja o histórico salvo pelo app, confira a integridade e restaure com segurança quando necessário.'}</p>
          </div>
        </div>
        <TableFilters
          query={query}
          onQueryChange={setQuery}
          queryPlaceholder="Buscar por nome do arquivo ou data"
          summary={`${filteredRows.length} de ${rows.length} backups visíveis`}
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
          empty={runtimeInfo.isWeb ? 'Nenhum backup web registrado neste navegador. Clique em Baixar backup JSON para gerar a primeira cópia.' : 'Nenhum backup criado ainda. Clique em Criar backup local para gerar a primeira cópia completa.'}
          columns={[
            { key: 'file', label: 'Arquivo', render: (row) => <div className="backup-file-cell"><strong>{row.file_name}</strong><small>{runtimeInfo.isWeb ? 'Baixado pelo navegador' : row.integrity_ok ? 'Pronto para restauração' : 'Integridade reprovada'}</small></div> },
            { key: 'size', label: 'Tamanho', align: 'right', render: (row) => formatSize(row.size_bytes) },
            { key: 'ok', label: 'Integridade', render: (row) => row.integrity_ok ? <span className="ok-dot">OK</span> : <span className="bad-dot">Falha</span> },
            { key: 'date', label: 'Criado em', render: (row) => dateTime(row.created_at) },
            {
              key: 'action',
              label: 'Ação',
              align: 'right',
              render: (row) => <button type="button" className="secondary-btn small" onClick={() => restoreSaved(row)} disabled={loading}>{runtimeInfo.isWeb ? 'Orientação' : 'Restaurar'}</button>,
            },
          ]}
        />
      </section>
    </div>
  );
}

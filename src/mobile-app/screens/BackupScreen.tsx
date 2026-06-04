import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { api } from '../../lib/api';
import type { BackupInfo } from '../../types';
import { EmptyState } from '../components/EmptyState';
import { InlineIcon } from '../components/InlineIcon';
import { ListCard } from '../components/ListCard';
import { StatCard } from '../components/StatCard';
import { formatDateTime, formatNumber } from '../components/format';

interface BackupScreenProps {
  refreshToken: number;
  onRefresh: () => void;
}

type Feedback = { tone: 'success' | 'error' | 'info'; text: string };

function formatSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}


function backupErrorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  const text = raw || 'Não foi possível concluir o backup agora.';
  if (/cash_sessions\.created_at|created_at does not exist/i.test(text)) {
    return 'O backup encontrou uma diferença antiga na tabela do caixa. Atualize para esta versão e tente novamente. Seus dados não foram apagados.';
  }
  if (/backups_log|auditoria\/sync|migration/i.test(text)) {
    return 'O arquivo foi baixado, mas o histórico do backup não confirmou na nuvem. Aplique as migrations novas no Supabase e tente novamente.';
  }
  if (/permission|row-level security|policy|RLS/i.test(text)) {
    return 'Sua conta não tem permissão para fazer backup desta loja. Entre como dono ou administrador.';
  }
  if (/network|fetch|Failed to fetch|internet/i.test(text)) {
    return 'Falha de conexão ao criar o backup. Confira a internet e tente novamente.';
  }
  return text;
}

function askRestoreConfirmation(fileName: string): string | null {
  const ok = window.confirm(`Restaurar o backup ${fileName}? Use somente arquivo confiável da mesma loja.`);
  if (!ok) return null;
  return window.prompt('Digite RESTAURAR para confirmar. Essa etapa protege contra toque sem querer.') ?? null;
}

export function BackupScreen({ refreshToken, onRefresh }: BackupScreenProps): JSX.Element {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [backups, setBackups] = useState<BackupInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const loadBackups = async () => {
    setLoading(true);
    try {
      const rows = await api.backups();
      setBackups(rows);
      setFeedback(null);
    } catch (error) {
      setFeedback({ tone: 'error', text: backupErrorMessage(error) });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadBackups();
  }, [refreshToken]);

  const safeCount = backups.filter((backup) => backup.integrity_ok).length;
  const totalSize = useMemo(() => backups.reduce((sum, backup) => sum + Number(backup.size_bytes || 0), 0), [backups]);
  const lastBackup = backups[0] ?? null;

  async function createBackup(): Promise<void> {
    setLoading(true);
    try {
      const info = await api.createBackup();
      setFeedback({ tone: 'success', text: `Backup criado/baixado: ${info.file_name}. Guarde esse arquivo fora do navegador.` });
      await loadBackups();
      onRefresh();
    } catch (error) {
      setFeedback({ tone: 'error', text: backupErrorMessage(error) });
    } finally {
      setLoading(false);
    }
  }

  async function restoreFromHistory(backup: BackupInfo): Promise<void> {
    const confirmation = askRestoreConfirmation(backup.file_name);
    if (confirmation !== 'RESTAURAR') return;
    setLoading(true);
    try {
      if (backup.file_path.startsWith('download:')) {
        setFeedback({ tone: 'info', text: 'No navegador, a lista mostra o histórico. Para restaurar, toque em Importar JSON e selecione o arquivo baixado.' });
      } else {
        await api.restoreBackup(backup.id, confirmation);
        setFeedback({ tone: 'success', text: 'Backup restaurado com segurança. Recarregue e confira os dados principais.' });
        onRefresh();
      }
    } catch (error) {
      setFeedback({ tone: 'error', text: backupErrorMessage(error) });
    } finally {
      setLoading(false);
    }
  }

  async function importWebBackup(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const confirmation = askRestoreConfirmation(file.name);
    if (confirmation !== 'RESTAURAR') return;
    setLoading(true);
    try {
      const content = await file.text();
      await api.restoreWebBackupContent(content, confirmation);
      setFeedback({ tone: 'success', text: 'Backup importado. Os dados compatíveis foram repostos/atualizados sem apagar a loja inteira.' });
      await loadBackups();
      onRefresh();
    } catch (error) {
      setFeedback({ tone: 'error', text: backupErrorMessage(error) });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mapp-screen mapp-backup-screen">
      <input ref={fileInputRef} type="file" accept="application/json,.json" className="mapp-hidden-file" onChange={(event) => void importWebBackup(event)} />
      <section className="mapp-mini-stat-grid">
        <StatCard label="Backups" value={formatNumber(backups.length)} detail="histórico" icon="backup" tone="mint" />
        <StatCard label="Íntegros" value={formatNumber(safeCount)} detail="seguros para conferir" icon="bloqueio_seguro" tone="green" />
        <StatCard label="Espaço" value={formatSize(totalSize)} detail="arquivos listados" icon="arquivo_banco_sqlite" tone="blue" />
      </section>

      {loading ? <div className="mapp-inline-status">Processando backup...</div> : null}
      {feedback ? <div className={`mapp-form-feedback mapp-form-feedback-${feedback.tone}`}>{feedback.text}</div> : null}

      <section className="mapp-form-panel mapp-backup-callout">
        <div className="mapp-form-head">
          <span className="mapp-form-icon tone-mint"><InlineIcon name="backup" size={24} /></span>
          <div>
            <strong>Backup da loja</strong>
            <p>Cria um arquivo JSON com dados comerciais importantes. Guarde em local seguro fora do celular.</p>
          </div>
        </div>
        <div className="mapp-check-list">
          <span>✓ Clientes, produtos, vendas, caixa e estoque</span>
          <span>✓ Crediário, pedidos, comprovantes e histórico de movimentações</span>
          <span>✓ Fotos: tenta salvar a imagem dentro do JSON; se não conseguir, mantém link/caminho da nuvem</span>
          <span>✓ Confirmação dupla para restaurar</span>
        </div>
        <div className="mapp-form-actions">
          <button type="button" className="mapp-secondary-button" onClick={() => fileInputRef.current?.click()} disabled={loading}>Importar JSON</button>
          <button type="button" className="mapp-primary-button" onClick={() => void createBackup()} disabled={loading}>{loading ? 'Aguarde...' : 'Criar backup'}</button>
        </div>
      </section>

      <section className="mapp-warning-card">
        <span><InlineIcon name="bloqueio_seguro" size={24} /></span>
        <div>
          <strong>Restauração é ação crítica</strong>
          <p>Use somente backup confiável da mesma loja. O sistema pede a palavra RESTAURAR para evitar toque sem querer. Fotos pequenas entram no backup quando o navegador consegue ler a imagem. Se alguma ficar só por link/caminho, copie também o bucket product-photos ao migrar de projeto.</p>
        </div>
        <button type="button" onClick={() => fileInputRef.current?.click()}>Importar</button>
      </section>

      <section className="mapp-section-block">
        <div className="mapp-section-title"><h2>Histórico</h2><button type="button" onClick={() => void loadBackups()}>Atualizar</button></div>
        {lastBackup ? <div className="mapp-inline-status">Último backup: {lastBackup.file_name} · {formatDateTime(lastBackup.created_at)}</div> : null}
        {backups.length ? (
          <div className="mapp-list-stack">
            {backups.slice(0, 16).map((backup) => (
              <article key={backup.id} className="mapp-backup-row">
                <ListCard icon="backup" title={backup.file_name} subtitle={`${backup.integrity_ok ? 'Íntegro' : 'Revisar'} · ${formatDateTime(backup.created_at)}`} value={formatSize(backup.size_bytes)} tone={backup.integrity_ok ? 'green' : 'orange'} />
                <button type="button" className="mapp-secondary-button" onClick={() => void restoreFromHistory(backup)}>Restaurar</button>
              </article>
            ))}
          </div>
        ) : !loading ? (
          <EmptyState icon="backup" title="Nenhum backup registrado" detail="Crie o primeiro backup antes de vender ou mexer em dados importantes." actionLabel="Criar backup" actionPage="backup" onNavigate={() => void createBackup()} />
        ) : null}
      </section>
    </div>
  );
}

const PDF_FOLDER_KEY = 'smart-loja-facil:pdf-folder';
const BACKUP_FOLDER_KEY = 'smart-loja-facil:backup-folder';

function readPreference(key: string): string | null {
  try {
    const value = window.localStorage.getItem(key);
    return value && value.trim() ? value : null;
  } catch {
    return null;
  }
}

function writePreference(key: string, value: string | null): void {
  try {
    if (value && value.trim()) window.localStorage.setItem(key, value.trim());
    else window.localStorage.removeItem(key);
  } catch {
    // Preferência local não deve bloquear o uso do sistema.
  }
}

export function getPreferredPdfFolder(): string | null {
  return readPreference(PDF_FOLDER_KEY);
}

export function setPreferredPdfFolder(path: string | null): void {
  writePreference(PDF_FOLDER_KEY, path);
}

export function getPreferredBackupFolder(): string | null {
  return readPreference(BACKUP_FOLDER_KEY);
}

export function setPreferredBackupFolder(path: string | null): void {
  writePreference(BACKUP_FOLDER_KEY, path);
}

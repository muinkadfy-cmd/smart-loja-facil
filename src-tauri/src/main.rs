use chrono::{Datelike, Duration, Local, Months, NaiveDate};
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::BTreeMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use tauri::{AppHandle, Manager};
use uuid::Uuid;

type CmdResult<T> = Result<T, String>;

const RECEIPT_A6_WIDTH_MM: i64 = 105;
const RECEIPT_A6_HEIGHT_MM: i64 = 148;

const JAQUE_LOGO_DATA_URI: &str = concat!("data:image/png;base64,", include_str!("../assets/jaque-logo-premium.base64"));
#[derive(Debug, Serialize, Deserialize, Clone)]
struct Settings {
    store_name: String,
    owner_name: String,
    phone: String,
    whatsapp: String,
    address: String,
    receipt_message: String,
    low_stock_limit: i64,
    slow_mode: bool,
    admin_password_enabled: bool,
    receipt_width_mm: i64,
    updated_at: String,
}

#[derive(Debug, Serialize)]
struct AppStatus {
    db_path: String,
    sqlite_ok: bool,
    offline_ready: bool,
    version: String,
    settings: Settings,
    dashboard: DashboardData,
}

#[derive(Debug, Serialize)]
struct DashboardData {
    today_sales_total: f64,
    today_sales_count: i64,
    customers_total: i64,
    orders_open: i64,
    credits_open_total: f64,
    credits_active_customers: i64,
    low_stock_count: i64,
    payment_today: Vec<PaymentSummary>,
    recent_sales: Vec<SaleSummary>,
}

#[derive(Debug, Serialize)]
struct PaymentSummary { method: String, total: f64, count: i64 }

#[derive(Debug, Serialize)]
struct DashboardSalesPoint {
    label: String,
    total: f64,
}

#[derive(Debug, Serialize)]
struct Customer {
    id: String,
    name: String,
    phone: String,
    whatsapp: String,
    address: String,
    credit_limit: f64,
    status: String,
    notes: String,
    created_at: String,
    updated_at: String,
}

#[derive(Debug, Deserialize)]
struct CustomerInput {
    id: Option<String>,
    name: Option<String>,
    phone: Option<String>,
    whatsapp: Option<String>,
    address: Option<String>,
    credit_limit: Option<f64>,
    status: Option<String>,
    notes: Option<String>,
}

#[derive(Debug, Serialize)]
struct Product {
    id: String,
    name: String,
    category: String,
    price: f64,
    promo_price: Option<f64>,
    stock: i64,
    unit: String,
    size: String,
    color: String,
    internal_code: String,
    barcode: String,
    image_data: String,
    status: String,
    created_at: String,
    updated_at: String,
}

#[derive(Debug, Deserialize)]
struct ProductInput {
    id: Option<String>,
    name: Option<String>,
    category: Option<String>,
    price: Option<f64>,
    promo_price: Option<f64>,
    stock: Option<i64>,
    unit: Option<String>,
    size: Option<String>,
    color: Option<String>,
    internal_code: Option<String>,
    barcode: Option<String>,
    image_data: Option<String>,
    status: Option<String>,
}

#[derive(Debug, Serialize, Clone)]
struct SaleSummary {
    id: String,
    number: i64,
    customer_name: String,
    payment_method: String,
    total: f64,
    status: String,
    created_at: String,
}

#[derive(Debug, Deserialize)]
struct SaleInput {
    request_id: String,
    customer_id: Option<String>,
    payment_method: String,
    discount: f64,
    installment_count: Option<i64>,
    first_due_date: Option<String>,
    items: Vec<SaleItemInput>,
}

#[derive(Debug, Deserialize)]
struct SaleItemInput { product_id: String, qty: f64, unit_price: f64 }

#[derive(Debug, Serialize)]
struct CreditSummary {
    id: String,
    customer_name: String,
    customer_phone: String,
    customer_whatsapp: String,
    sale_id: String,
    sale_number: i64,
    total: f64,
    balance: f64,
    status: String,
    created_at: String,
    installments: Vec<CreditInstallment>,
}

#[derive(Debug, Serialize)]
struct CreditInstallment {
    id: String,
    number: i64,
    amount: f64,
    paid_amount: f64,
    due_date: String,
    paid_at: Option<String>,
    status: String,
    payment_method: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ReceiveInput {
    request_id: String,
    credit_id: String,
    installment_id: String,
    amount: f64,
    method: String,
    settle_with_redistribution: Option<bool>,
}

#[derive(Debug, Serialize, Clone)]
struct OrderSummary {
    id: String,
    number: i64,
    customer_name: String,
    total: f64,
    status: String,
    created_at: String,
}

#[derive(Debug, Deserialize)]
struct OrderInput {
    request_id: String,
    customer_id: Option<String>,
    items: Vec<OrderItemInput>,
}

#[derive(Debug, Deserialize)]
struct OrderItemInput { product_id: String, qty: f64 }

#[derive(Debug, Serialize)]
struct ReceiptSummary {
    id: String,
    sale_id: String,
    sale_number: i64,
    customer_name: String,
    customer_whatsapp: String,
    receipt_type: String,
    total: f64,
    status: String,
    created_at: String,
    content: String,
}

#[derive(Debug, Serialize)]
struct BackupInfo {
    id: String,
    file_name: String,
    file_path: String,
    size_bytes: u64,
    integrity_ok: bool,
    created_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct BackupManifest {
    format: String,
    version: u8,
    created_at: String,
    file_name: String,
    db_file_name: String,
    reports_dir_name: String,
    integrity_ok: bool,
}

#[derive(Debug, Serialize)]
struct AuditEvent {
    id: String,
    entity: String,
    entity_id: String,
    action: String,
    details: String,
    created_at: String,
}


#[derive(Debug, Serialize)]
struct CashMovementRow {
    id: String,
    r#type: String,
    method: String,
    amount: f64,
    reason: String,
    created_at: String,
}

#[derive(Debug, Serialize)]
struct CashClosingRow {
    id: String,
    opened_at: String,
    closed_at: Option<String>,
    opening_amount: f64,
    closing_amount: Option<f64>,
    status: String,
    notes: String,
}

#[derive(Debug, Serialize)]
struct CashSummary {
    open_cash: Option<CashClosingRow>,
    today_in: f64,
    today_out: f64,
    expected_total: f64,
    movements: Vec<CashMovementRow>,
}

#[derive(Debug, Serialize)]
struct ReportMetric {
    label: String,
    value: String,
    detail: String,
    tone: String,
}

#[derive(Debug, Serialize)]
struct ReportColumn {
    key: String,
    label: String,
    align: Option<String>,
}

#[derive(Debug, Serialize)]
struct ReportData {
    report: String,
    title: String,
    description: String,
    empty_message: String,
    generated_at: String,
    total_rows: usize,
    summary: Vec<ReportMetric>,
    columns: Vec<ReportColumn>,
    rows: Vec<BTreeMap<String, String>>,
}

fn now_iso() -> String { Local::now().to_rfc3339() }
fn today() -> String { Local::now().date_naive().to_string() }
fn new_id(prefix: &str) -> String { format!("{}-{}", prefix, Uuid::new_v4()) }
fn clean(value: Option<String>) -> String { value.unwrap_or_default().trim().to_string() }
fn to_cents(value: f64) -> i64 { (value.max(0.0) * 100.0).round() as i64 }
fn from_cents(value: i64) -> f64 { value as f64 / 100.0 }
fn format_money_br(value: f64) -> String { format!("R$ {:.2}", value).replace('.', ",") }
fn format_date_time_br(value: &str) -> String {
    chrono::DateTime::parse_from_rfc3339(value)
        .map(|date| date.with_timezone(&Local).format("%d/%m/%Y, %H:%M").to_string())
        .unwrap_or_else(|_| value.to_string())
}
fn report_metric(label: &str, value: String, detail: String, tone: &str) -> ReportMetric {
    ReportMetric { label: label.to_string(), value, detail, tone: tone.to_string() }
}
fn report_column(key: &str, label: &str, align: Option<&str>) -> ReportColumn {
    ReportColumn {
        key: key.to_string(),
        label: label.to_string(),
        align: align.map(|value| value.to_string()),
    }
}

fn dashboard_sales_series(connection: &Connection, period: &str) -> CmdResult<Vec<DashboardSalesPoint>> {
    let end_date = Local::now().date_naive();
    if period == "today" {
        let mut totals = [0.0_f64; 8];
        let mut stmt = connection
            .prepare("SELECT substr(created_at,12,2), total FROM sales WHERE status='finalizada' AND substr(created_at,1,10)=?1")
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map(params![end_date.to_string()], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, f64>(1)?,
                ))
            })
            .map_err(|e| e.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?;
        for (hour_text, total) in rows {
            let hour = hour_text.parse::<usize>().unwrap_or(0).min(23);
            let bucket = (hour / 3).min(7);
            totals[bucket] += total;
        }
        return Ok((0..8)
            .map(|index| DashboardSalesPoint {
                label: format!("{:02}h", index * 3),
                total: totals[index],
            })
            .collect());
    }

    let start_date = match period {
        "7d" => end_date - Duration::days(6),
        "30d" => end_date - Duration::days(29),
        "month" => NaiveDate::from_ymd_opt(end_date.year(), end_date.month(), 1).unwrap_or(end_date),
        _ => return Err("Periodo do grafico invalido".to_string()),
    };

    let mut day_totals = BTreeMap::<String, f64>::new();
    let mut stmt = connection
        .prepare("SELECT substr(created_at,1,10), COALESCE(SUM(total),0) FROM sales WHERE status='finalizada' AND substr(created_at,1,10) BETWEEN ?1 AND ?2 GROUP BY substr(created_at,1,10) ORDER BY substr(created_at,1,10)")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![start_date.to_string(), end_date.to_string()], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, f64>(1)?,
            ))
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    for (day, total) in rows {
        day_totals.insert(day, total);
    }

    let mut points = Vec::<DashboardSalesPoint>::new();
    let mut current = start_date;
    while current <= end_date {
        let key = current.to_string();
        points.push(DashboardSalesPoint {
            label: current.format("%d/%m").to_string(),
            total: *day_totals.get(&key).unwrap_or(&0.0),
        });
        current = current + Duration::days(1);
    }
    Ok(points)
}
fn slug_prefix(value: &str) -> String {
    let raw: String = value
        .chars()
        .filter(|ch| ch.is_ascii_alphanumeric())
        .take(3)
        .collect();
    if raw.is_empty() { "PRD".to_string() } else { raw.to_uppercase() }
}
fn generate_product_internal_code(name: &str, category: &str) -> String {
    let base = if category.trim().is_empty() { name } else { category };
    let token = Uuid::new_v4().simple().to_string()[..6].to_uppercase();
    format!("{}-{}", slug_prefix(base), token)
}
fn safe_file_stem(value: &str) -> String {
    let cleaned: String = value
        .chars()
        .map(|ch| if ch.is_ascii_alphanumeric() { ch } else { '-' })
        .collect();
    cleaned.trim_matches('-').to_lowercase()
}
fn file_uri(path: &PathBuf) -> String {
    let raw = path.display().to_string().replace('\\', "/").replace(' ', "%20");
    format!("file:///{}", raw)
}
fn edge_binary() -> Option<PathBuf> {
    let candidates = [
        "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
        "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    ];
    candidates
        .iter()
        .map(PathBuf::from)
        .find(|path| path.exists())
}
fn open_external_target(target: &str) -> CmdResult<()> {
    Command::new("explorer")
        .arg(target)
        .spawn()
        .map_err(|e| format!("Falha ao abrir destino externo: {e}"))?;
    Ok(())
}

fn db_candidates(app: &AppHandle) -> CmdResult<Vec<PathBuf>> {
    let mut candidates = Vec::new();
    if let Ok(override_path) = std::env::var("SMART_LOJA_DB_PATH") {
        let trimmed = override_path.trim();
        if !trimmed.is_empty() {
            candidates.push(PathBuf::from(trimmed));
        }
    }
    let app_dir = app.path().app_data_dir().map_err(|e| format!("Falha ao localizar AppData: {e}"))?;
    candidates.push(app_dir.join("smart-loja-facil-offline.sqlite3"));
    if cfg!(debug_assertions) {
        if let Ok(current_dir) = std::env::current_dir() {
            candidates.push(current_dir.join("smart-loja-facil-offline-dev.sqlite3"));
        }
    }
    candidates.dedup();
    Ok(candidates)
}

fn open_connection(app: &AppHandle) -> CmdResult<(Connection, PathBuf)> {
    let mut last_error = String::new();
    for path in db_candidates(app)? {
        if let Some(parent) = path.parent() {
            if let Err(err) = fs::create_dir_all(parent) {
                last_error = format!("Falha ao criar pasta de dados {}: {}", parent.display(), err);
                continue;
            }
        }
        match Connection::open(&path) {
            Ok(connection) => {
                match connection.execute_batch(
                    "PRAGMA journal_mode = WAL;
                     PRAGMA synchronous = NORMAL;
                     PRAGMA foreign_keys = ON;"
                ) {
                    Ok(_) => return Ok((connection, path)),
                    Err(err) => {
                        last_error = format!("Falha ao inicializar SQLite em {}: {}", path.display(), err);
                    }
                }
            }
            Err(err) => {
                last_error = format!("Falha ao abrir SQLite em {}: {}", path.display(), err);
            }
        }
    }
    Err(last_error)
}

fn db_file(app: &AppHandle) -> CmdResult<PathBuf> {
    open_connection(app).map(|(_, path)| path)
}

fn storage_root(app: &AppHandle) -> CmdResult<PathBuf> {
    db_file(app)?
        .parent()
        .map(PathBuf::from)
        .ok_or_else(|| "Falha ao localizar pasta raiz do SQLite".to_string())
}

fn backup_dir(app: &AppHandle) -> CmdResult<PathBuf> {
    let dir = storage_root(app)?.join("backups");
    fs::create_dir_all(&dir).map_err(|e| format!("Falha ao criar pasta de backups: {e}"))?;
    Ok(dir)
}

fn report_dir(app: &AppHandle) -> CmdResult<PathBuf> {
    let dir = storage_root(app)?.join("reports");
    fs::create_dir_all(&dir).map_err(|e| format!("Falha ao criar pasta de relatórios: {e}"))?;
    Ok(dir)
}

fn export_dir(app: &AppHandle, destination_dir: Option<String>) -> CmdResult<PathBuf> {
    if let Some(raw_dir) = destination_dir {
        let trimmed = raw_dir.trim();
        if !trimmed.is_empty() {
            let dir = PathBuf::from(trimmed);
            fs::create_dir_all(&dir).map_err(|e| format!("Falha ao criar pasta de exportaÃ§Ã£o: {e}"))?;
            return Ok(dir);
        }
    }
    report_dir(app)
}

fn unique_path(path: PathBuf) -> PathBuf {
    if !path.exists() {
        return path;
    }
    let parent = path.parent().map(PathBuf::from).unwrap_or_default();
    let stem = path
        .file_stem()
        .and_then(|v| v.to_str())
        .unwrap_or("backup")
        .to_string();
    let ext = path
        .extension()
        .and_then(|v| v.to_str())
        .map(|v| v.to_string());
    let mut index = 2usize;
    loop {
        let candidate_name = match &ext {
            Some(extension) => format!("{stem}-{index}.{extension}"),
            None => format!("{stem}-{index}"),
        };
        let candidate = parent.join(candidate_name);
        if !candidate.exists() {
            return candidate;
        }
        index += 1;
    }
}

fn copy_dir_recursive(source: &Path, target: &Path) -> CmdResult<()> {
    fs::create_dir_all(target).map_err(|e| format!("Falha ao preparar pasta {}: {e}", target.display()))?;
    for entry in fs::read_dir(source).map_err(|e| format!("Falha ao ler pasta {}: {e}", source.display()))? {
        let entry = entry.map_err(|e| e.to_string())?;
        let source_path = entry.path();
        let target_path = target.join(entry.file_name());
        if source_path.is_dir() {
            copy_dir_recursive(&source_path, &target_path)?;
        } else {
            if let Some(parent) = target_path.parent() {
                fs::create_dir_all(parent).map_err(|e| format!("Falha ao criar pasta {}: {e}", parent.display()))?;
            }
            fs::copy(&source_path, &target_path)
                .map_err(|e| format!("Falha ao copiar {}: {e}", source_path.display()))?;
        }
    }
    Ok(())
}

fn dir_size(path: &Path) -> CmdResult<u64> {
    let mut total = 0u64;
    for entry in fs::read_dir(path).map_err(|e| format!("Falha ao ler pasta {}: {e}", path.display()))? {
        let entry = entry.map_err(|e| e.to_string())?;
        let entry_path = entry.path();
        if entry_path.is_dir() {
            total += dir_size(&entry_path)?;
        } else {
            total += fs::metadata(&entry_path).map_err(|e| e.to_string())?.len();
        }
    }
    Ok(total)
}

fn backup_manifest_path(package_dir: &Path) -> PathBuf {
    package_dir.join("backup-manifest.json")
}

fn validate_sqlite_backup(path: &Path) -> CmdResult<bool> {
    Connection::open(path)
        .and_then(|c| c.query_row("PRAGMA integrity_check", [], |row| row.get::<_, String>(0)))
        .map(|v| v == "ok")
        .map_err(|e| format!("Falha ao validar backup: {e}"))
}

fn create_backup_package(app: &AppHandle, destination_root: Option<PathBuf>, detail: &str) -> CmdResult<BackupInfo> {
    let connection = conn(app)?;
    init_schema(&connection)?;
    connection.execute_batch("PRAGMA wal_checkpoint(FULL);").map_err(|e| e.to_string())?;

    let timestamp = Local::now().format("%Y%m%d-%H%M%S").to_string();
    let file_name = format!("smart-loja-backup-{timestamp}");
    let root = destination_root.unwrap_or(backup_dir(app)?);
    fs::create_dir_all(&root).map_err(|e| format!("Falha ao criar pasta de destino: {e}"))?;
    let package_dir = unique_path(root.join(&file_name));
    let reports_source = report_dir(app)?;
    if package_dir.starts_with(&reports_source) {
        return Err("Escolha uma pasta fora da área de relatórios do sistema para salvar o backup".to_string());
    }
    fs::create_dir_all(&package_dir).map_err(|e| format!("Falha ao criar pacote de backup: {e}"))?;

    let db_target_name = "database.sqlite3".to_string();
    let db_target = package_dir.join(&db_target_name);
    fs::copy(db_file(app)?, &db_target).map_err(|e| format!("Falha ao copiar banco do backup: {e}"))?;

    let reports_target_name = "reports".to_string();
    let reports_target = package_dir.join(&reports_target_name);
    copy_dir_recursive(&reports_source, &reports_target)?;

    let integrity_ok = validate_sqlite_backup(&db_target).unwrap_or(false);
    let manifest = BackupManifest {
        format: "smart-loja-backup".to_string(),
        version: 2,
        created_at: now_iso(),
        file_name: file_name.clone(),
        db_file_name: db_target_name,
        reports_dir_name: reports_target_name,
        integrity_ok,
    };
    let manifest_path = backup_manifest_path(&package_dir);
    let manifest_json = serde_json::to_string_pretty(&manifest).map_err(|e| e.to_string())?;
    fs::write(&manifest_path, manifest_json).map_err(|e| format!("Falha ao gravar manifesto do backup: {e}"))?;

    let size = dir_size(&package_dir)?;
    let id = new_id("bak");
    connection.execute(
        "INSERT INTO backups_log(id,file_name,file_path,size_bytes,integrity_ok,created_at) VALUES(?1,?2,?3,?4,?5,?6)",
        params![id, file_name, manifest_path.display().to_string(), size as i64, if integrity_ok { 1 } else { 0 }, now_iso()]
    ).map_err(|e| e.to_string())?;
    audit(&connection, "backup", &id, "create", detail).map_err(|e| e.to_string())?;

    Ok(BackupInfo {
        id,
        file_name: manifest.file_name,
        file_path: manifest_path.display().to_string(),
        size_bytes: size,
        integrity_ok,
        created_at: now_iso(),
    })
}

enum BackupSource {
    LegacySqlite {
        label: String,
        db_path: PathBuf,
    },
    FullPackage {
        label: String,
        db_path: PathBuf,
        reports_path: PathBuf,
    },
}

fn resolve_backup_source(path: &Path) -> CmdResult<BackupSource> {
    if !path.exists() {
        return Err("Arquivo de backup não encontrado".to_string());
    }

    if path.is_dir() {
        return resolve_backup_source(&backup_manifest_path(path));
    }

    let file_name = path.file_name().and_then(|v| v.to_str()).unwrap_or_default().to_string();
    let extension = path.extension().and_then(|v| v.to_str()).unwrap_or_default().to_ascii_lowercase();

    if extension == "sqlite3" {
        return Ok(BackupSource::LegacySqlite {
            label: file_name,
            db_path: path.to_path_buf(),
        });
    }

    if extension != "json" {
        return Err("Selecione um arquivo .sqlite3 ou um manifesto backup-manifest.json".to_string());
    }

    let manifest_raw = fs::read_to_string(path).map_err(|e| format!("Falha ao ler manifesto do backup: {e}"))?;
    let manifest: BackupManifest = serde_json::from_str(&manifest_raw).map_err(|e| format!("Manifesto de backup inválido: {e}"))?;
    if manifest.format != "smart-loja-backup" {
        return Err("Arquivo selecionado não é um backup completo do sistema".to_string());
    }
    let package_dir = path.parent().ok_or_else(|| "Falha ao localizar pasta do backup".to_string())?;
    let db_path = package_dir.join(&manifest.db_file_name);
    if !db_path.exists() {
        return Err("Banco do backup completo não foi encontrado".to_string());
    }
    let reports_path = package_dir.join(&manifest.reports_dir_name);
    Ok(BackupSource::FullPackage {
        label: manifest.file_name,
        db_path,
        reports_path,
    })
}

fn restore_backup_from_path(app: &AppHandle, backup_path: &Path, confirmation: &str) -> CmdResult<AppStatus> {
    if confirmation != "RESTAURAR" {
        return Err("Confirmação inválida. Restauração cancelada.".to_string());
    }

    let source = resolve_backup_source(backup_path)?;
    let db_path = match &source {
        BackupSource::LegacySqlite { db_path, .. } => db_path,
        BackupSource::FullPackage { db_path, .. } => db_path,
    };

    let integrity_ok = validate_sqlite_backup(db_path)?;
    if !integrity_ok {
        return Err("Backup não passou no integrity_check".to_string());
    }

    let safety = create_backup_package(app, None, "Backup de segurança criado antes da restauração")?;
    let target_db = db_file(app)?;
    fs::copy(db_path, &target_db).map_err(|e| format!("Falha ao restaurar backup: {e}"))?;

    if let BackupSource::FullPackage { reports_path, .. } = &source {
        let target_reports = report_dir(app)?;
        if target_reports.exists() {
            fs::remove_dir_all(&target_reports).map_err(|e| format!("Falha ao limpar relatórios atuais: {e}"))?;
        }
        fs::create_dir_all(&target_reports).map_err(|e| format!("Falha ao recriar pasta de relatórios: {e}"))?;
        if reports_path.exists() {
            copy_dir_recursive(reports_path, &target_reports)?;
        }
    }

    let connection = conn(app)?;
    init_schema(&connection)?;
    let source_label = match &source {
        BackupSource::LegacySqlite { label, .. } => format!("arquivo externo {label}"),
        BackupSource::FullPackage { label, .. } => format!("pacote completo {label}"),
    };
    audit(
        &connection,
        "backup",
        &source_label,
        "restore",
        &format!("Backup restaurado. Cópia de segurança anterior: {}", safety.file_name),
    ).map_err(|e| e.to_string())?;
    boot(app.clone())
}

fn run_powershell_dialog(script: &str) -> CmdResult<Option<String>> {
    let output = Command::new("powershell")
        .args([
            "-NoProfile",
            "-NonInteractive",
            "-ExecutionPolicy",
            "Bypass",
            "-STA",
            "-WindowStyle",
            "Hidden",
            "-Command",
            script,
        ])
        .output()
        .map_err(|e| format!("Falha ao abrir seletor do Windows: {e}"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        return Err(if stderr.is_empty() {
            "Falha ao abrir seletor do Windows".to_string()
        } else {
            stderr
        });
    }

    let value = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if value.is_empty() {
        Ok(None)
    } else {
        Ok(Some(value))
    }
}

fn conn(app: &AppHandle) -> CmdResult<Connection> {
    open_connection(app).map(|(connection, _)| connection)
}

fn init_schema(connection: &Connection) -> CmdResult<()> {
    connection.execute_batch(r#"
        PRAGMA journal_mode = WAL;
        PRAGMA synchronous = NORMAL;
        PRAGMA foreign_keys = ON;

        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS customers (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            phone TEXT NOT NULL DEFAULT '',
            whatsapp TEXT NOT NULL DEFAULT '',
            address TEXT NOT NULL DEFAULT '',
            credit_limit REAL NOT NULL DEFAULT 0,
            status TEXT NOT NULL DEFAULT 'ativo',
            notes TEXT NOT NULL DEFAULT '',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS products (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            category TEXT NOT NULL DEFAULT '',
            price REAL NOT NULL DEFAULT 0,
            promo_price REAL,
            stock INTEGER NOT NULL DEFAULT 0,
            unit TEXT NOT NULL DEFAULT 'un',
            size TEXT NOT NULL DEFAULT '',
            color TEXT NOT NULL DEFAULT '',
            internal_code TEXT NOT NULL DEFAULT '',
            barcode TEXT NOT NULL DEFAULT '',
            image_data TEXT NOT NULL DEFAULT '',
            status TEXT NOT NULL DEFAULT 'ativo',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS sales (
            id TEXT PRIMARY KEY,
            number INTEGER NOT NULL UNIQUE,
            request_id TEXT NOT NULL UNIQUE,
            customer_id TEXT,
            customer_name TEXT NOT NULL DEFAULT 'Balcão',
            subtotal REAL NOT NULL,
            discount REAL NOT NULL DEFAULT 0,
            total REAL NOT NULL,
            payment_method TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'finalizada',
            created_at TEXT NOT NULL,
            FOREIGN KEY(customer_id) REFERENCES customers(id)
        );
        CREATE TABLE IF NOT EXISTS sale_items (
            id TEXT PRIMARY KEY,
            sale_id TEXT NOT NULL,
            product_id TEXT NOT NULL,
            product_name TEXT NOT NULL,
            qty REAL NOT NULL,
            unit_price REAL NOT NULL,
            total REAL NOT NULL,
            created_at TEXT NOT NULL,
            FOREIGN KEY(sale_id) REFERENCES sales(id),
            FOREIGN KEY(product_id) REFERENCES products(id)
        );
        CREATE TABLE IF NOT EXISTS cash_movements (
            id TEXT PRIMARY KEY,
            request_id TEXT NOT NULL UNIQUE,
            sale_id TEXT,
            payment_id TEXT,
            type TEXT NOT NULL,
            method TEXT NOT NULL,
            amount REAL NOT NULL,
            reason TEXT NOT NULL DEFAULT '',
            created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS credits (
            id TEXT PRIMARY KEY,
            customer_id TEXT,
            customer_name TEXT NOT NULL,
            sale_id TEXT,
            total REAL NOT NULL,
            balance REAL NOT NULL,
            status TEXT NOT NULL DEFAULT 'aberto',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS credit_installments (
            id TEXT PRIMARY KEY,
            credit_id TEXT NOT NULL,
            number INTEGER NOT NULL,
            amount REAL NOT NULL,
            paid_amount REAL NOT NULL DEFAULT 0,
            due_date TEXT NOT NULL,
            paid_at TEXT,
            status TEXT NOT NULL DEFAULT 'aberto',
            payment_method TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY(credit_id) REFERENCES credits(id)
        );
        CREATE TABLE IF NOT EXISTS payments (
            id TEXT PRIMARY KEY,
            request_id TEXT NOT NULL UNIQUE,
            credit_id TEXT,
            installment_id TEXT,
            amount REAL NOT NULL,
            method TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'confirmado',
            created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS orders (
            id TEXT PRIMARY KEY,
            number INTEGER NOT NULL UNIQUE,
            request_id TEXT NOT NULL UNIQUE,
            customer_id TEXT,
            customer_name TEXT NOT NULL DEFAULT 'Balcão',
            total REAL NOT NULL,
            status TEXT NOT NULL DEFAULT 'aberto',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS order_items (
            id TEXT PRIMARY KEY,
            order_id TEXT NOT NULL,
            product_id TEXT NOT NULL,
            product_name TEXT NOT NULL,
            qty REAL NOT NULL,
            unit_price REAL NOT NULL,
            total REAL NOT NULL,
            created_at TEXT NOT NULL,
            FOREIGN KEY(order_id) REFERENCES orders(id),
            FOREIGN KEY(product_id) REFERENCES products(id)
        );
        CREATE TABLE IF NOT EXISTS receipts (
            id TEXT PRIMARY KEY,
            sale_id TEXT NOT NULL,
            receipt_type TEXT NOT NULL,
            total REAL NOT NULL,
            content TEXT NOT NULL,
            created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS stock_movements (
            id TEXT PRIMARY KEY,
            product_id TEXT NOT NULL,
            type TEXT NOT NULL,
            qty REAL NOT NULL,
            before_stock REAL NOT NULL,
            after_stock REAL NOT NULL,
            reason TEXT NOT NULL,
            reference_id TEXT,
            created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS backups_log (
            id TEXT PRIMARY KEY,
            file_name TEXT NOT NULL,
            file_path TEXT NOT NULL,
            size_bytes INTEGER NOT NULL,
            integrity_ok INTEGER NOT NULL,
            created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS audit_log (
            id TEXT PRIMARY KEY,
            entity TEXT NOT NULL,
            entity_id TEXT NOT NULL,
            action TEXT NOT NULL,
            details TEXT NOT NULL,
            created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS cash_closings (
            id TEXT PRIMARY KEY,
            opened_at TEXT NOT NULL,
            closed_at TEXT,
            opening_amount REAL NOT NULL DEFAULT 0,
            closing_amount REAL,
            status TEXT NOT NULL DEFAULT 'aberto',
            notes TEXT NOT NULL DEFAULT ''
        );
        CREATE INDEX IF NOT EXISTS idx_sales_created_at ON sales(created_at);
        CREATE INDEX IF NOT EXISTS idx_products_stock ON products(stock);
        CREATE INDEX IF NOT EXISTS idx_credits_status ON credits(status);
        CREATE INDEX IF NOT EXISTS idx_audit_created_at ON audit_log(created_at);
    "#).map_err(|e| format!("Falha ao aplicar schema SQLite: {e}"))?;
    let _ = connection.execute("ALTER TABLE products ADD COLUMN image_data TEXT NOT NULL DEFAULT ''", []);
    let _ = connection.execute("ALTER TABLE credit_installments ADD COLUMN payment_method TEXT", []);
    seed_settings(connection)?;
    Ok(())
}

fn set_setting(connection: &Connection, key: &str, value: &str) -> rusqlite::Result<()> {
    let now = now_iso();
    connection.execute(
        "INSERT INTO settings(key,value,updated_at) VALUES(?1,?2,?3) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at",
        params![key, value, now]
    )?;
    Ok(())
}

fn get_setting(connection: &Connection, key: &str, default: &str) -> rusqlite::Result<String> {
    Ok(connection.query_row("SELECT value FROM settings WHERE key=?1", params![key], |row| row.get(0)).optional()?.unwrap_or_else(|| default.to_string()))
}

fn seed_settings(connection: &Connection) -> CmdResult<()> {
    let exists: i64 = connection.query_row("SELECT COUNT(*) FROM settings", [], |row| row.get(0)).map_err(|e| e.to_string())?;
    if exists == 0 {
        set_setting(connection, "store_name", "Minha Loja").map_err(|e| e.to_string())?;
        set_setting(connection, "owner_name", "Administrador").map_err(|e| e.to_string())?;
        set_setting(connection, "phone", "").map_err(|e| e.to_string())?;
        set_setting(connection, "whatsapp", "").map_err(|e| e.to_string())?;
        set_setting(connection, "address", "").map_err(|e| e.to_string())?;
        set_setting(connection, "receipt_message", "Obrigado pela preferência!").map_err(|e| e.to_string())?;
        set_setting(connection, "low_stock_limit", "3").map_err(|e| e.to_string())?;
        set_setting(connection, "slow_mode", "false").map_err(|e| e.to_string())?;
        set_setting(connection, "admin_password_enabled", "false").map_err(|e| e.to_string())?;
        set_setting(connection, "receipt_width_mm", "80").map_err(|e| e.to_string())?;
    }
    Ok(())
}

fn read_settings(connection: &Connection) -> CmdResult<Settings> {
    Ok(Settings {
        store_name: get_setting(connection, "store_name", "Minha Loja").map_err(|e| e.to_string())?,
        owner_name: get_setting(connection, "owner_name", "Administrador").map_err(|e| e.to_string())?,
        phone: get_setting(connection, "phone", "").map_err(|e| e.to_string())?,
        whatsapp: get_setting(connection, "whatsapp", "").map_err(|e| e.to_string())?,
        address: get_setting(connection, "address", "").map_err(|e| e.to_string())?,
        receipt_message: get_setting(connection, "receipt_message", "Obrigado pela preferência!").map_err(|e| e.to_string())?,
        low_stock_limit: get_setting(connection, "low_stock_limit", "3").map_err(|e| e.to_string())?.parse().unwrap_or(3),
        slow_mode: get_setting(connection, "slow_mode", "false").map_err(|e| e.to_string())? == "true",
        admin_password_enabled: get_setting(connection, "admin_password_enabled", "false").map_err(|e| e.to_string())? == "true",
        receipt_width_mm: get_setting(connection, "receipt_width_mm", "80").map_err(|e| e.to_string())?.parse().unwrap_or(80),
        updated_at: now_iso(),
    })
}

fn audit(connection: &Connection, entity: &str, entity_id: &str, action: &str, details: &str) -> rusqlite::Result<()> {
    connection.execute("INSERT INTO audit_log(id,entity,entity_id,action,details,created_at) VALUES(?1,?2,?3,?4,?5,?6)", params![new_id("audit"), entity, entity_id, action, details, now_iso()])?;
    Ok(())
}

fn next_number(connection: &Connection, table: &str) -> rusqlite::Result<i64> {
    let sql = format!("SELECT COALESCE(MAX(number), 0) + 1 FROM {}", table);
    connection.query_row(&sql, [], |row| row.get(0))
}

fn receipt_type_label(width_mm: i64) -> &'static str {
    match width_mm {
        58 => "58mm",
        105 => "A6 10,5 x 14,8 cm",
        210 => "A4",
        _ => "A6 10,5 x 14,8 cm",
    }
}

fn split_installments(total: f64, count: i64) -> Vec<f64> {
    let safe_count = count.clamp(1, 24);
    let total_cents = to_cents(total);
    let base = total_cents / safe_count;
    let remainder = total_cents % safe_count;
    (0..safe_count)
        .map(|index| from_cents(base + if index < remainder { 1 } else { 0 }))
        .collect()
}

fn credit_customer(connection: &Connection, customer_id: &str) -> CmdResult<(String, f64)> {
    connection
        .query_row(
            "SELECT name, credit_limit FROM customers WHERE id=?1 AND status='ativo'",
            params![customer_id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .map_err(|_| "Selecione um cliente ativo para vender no crediário".to_string())
}

fn ensure_credit_limit(connection: &Connection, customer_id: &str, sale_total: f64) -> CmdResult<()> {
    let (_, credit_limit) = credit_customer(connection, customer_id)?;
    let open_balance: f64 = connection
        .query_row(
            "SELECT COALESCE(SUM(balance),0) FROM credits WHERE customer_id=?1 AND status='aberto'",
            params![customer_id],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;
    if open_balance + sale_total > credit_limit + 0.009 {
        return Err(format!(
            "Limite de crediário insuficiente. Limite: R$ {:.2} · Em aberto: R$ {:.2} · Nova venda: R$ {:.2}",
            credit_limit, open_balance, sale_total
        ));
    }
    Ok(())
}

fn customer_name(connection: &Connection, id: &Option<String>) -> rusqlite::Result<String> {
    if let Some(customer_id) = id {
        if !customer_id.is_empty() {
            return Ok(connection.query_row("SELECT name FROM customers WHERE id=?1", params![customer_id], |row| row.get(0)).optional()?.unwrap_or_else(|| "Balcão".to_string()));
        }
    }
    Ok("Balcão".to_string())
}

#[tauri::command]
fn boot(app: AppHandle) -> CmdResult<AppStatus> {
    let connection = conn(&app)?;
    init_schema(&connection)?;
    let path = db_file(&app)?;
    let settings = read_settings(&connection)?;
    let dashboard = dashboard_data(&connection)?;
    Ok(AppStatus { db_path: path.display().to_string(), sqlite_ok: true, offline_ready: true, version: env!("CARGO_PKG_VERSION").to_string(), settings, dashboard })
}

#[tauri::command]
fn get_settings(app: AppHandle) -> CmdResult<Settings> {
    let connection = conn(&app)?;
    init_schema(&connection)?;
    read_settings(&connection)
}

#[tauri::command]
fn save_settings(app: AppHandle, settings: Settings) -> CmdResult<Settings> {
    let connection = conn(&app)?;
    init_schema(&connection)?;
    set_setting(&connection, "store_name", &settings.store_name).map_err(|e| e.to_string())?;
    set_setting(&connection, "owner_name", &settings.owner_name).map_err(|e| e.to_string())?;
    set_setting(&connection, "phone", &settings.phone).map_err(|e| e.to_string())?;
    set_setting(&connection, "whatsapp", &settings.whatsapp).map_err(|e| e.to_string())?;
    set_setting(&connection, "address", &settings.address).map_err(|e| e.to_string())?;
    set_setting(&connection, "receipt_message", &settings.receipt_message).map_err(|e| e.to_string())?;
    set_setting(&connection, "low_stock_limit", &settings.low_stock_limit.to_string()).map_err(|e| e.to_string())?;
    set_setting(&connection, "slow_mode", if settings.slow_mode { "true" } else { "false" }).map_err(|e| e.to_string())?;
    set_setting(&connection, "admin_password_enabled", if settings.admin_password_enabled { "true" } else { "false" }).map_err(|e| e.to_string())?;
    set_setting(&connection, "receipt_width_mm", &settings.receipt_width_mm.to_string()).map_err(|e| e.to_string())?;
    audit(&connection, "settings", "global", "update", "Configurações alteradas").map_err(|e| e.to_string())?;
    read_settings(&connection)
}

fn dashboard_data(connection: &Connection) -> CmdResult<DashboardData> {
    let day = today();
    let today_sales_total = connection.query_row("SELECT COALESCE(SUM(total),0) FROM sales WHERE status='finalizada' AND substr(created_at,1,10)=?1", params![day], |row| row.get(0)).map_err(|e| e.to_string())?;
    let today_sales_count = connection.query_row("SELECT COUNT(*) FROM sales WHERE status='finalizada' AND substr(created_at,1,10)=?1", params![day], |row| row.get(0)).map_err(|e| e.to_string())?;
    let customers_total = connection.query_row("SELECT COUNT(*) FROM customers WHERE status='ativo'", [], |row| row.get(0)).map_err(|e| e.to_string())?;
    let orders_open = connection.query_row("SELECT COUNT(*) FROM orders WHERE status IN ('aberto','separado')", [], |row| row.get(0)).map_err(|e| e.to_string())?;
    let credits_open_total = connection.query_row("SELECT COALESCE(SUM(balance),0) FROM credits WHERE status='aberto'", [], |row| row.get(0)).map_err(|e| e.to_string())?;
    let credits_active_customers = connection.query_row("SELECT COUNT(DISTINCT customer_id) FROM credits WHERE status='aberto'", [], |row| row.get(0)).map_err(|e| e.to_string())?;
    let low_limit = get_setting(connection, "low_stock_limit", "3").map_err(|e| e.to_string())?.parse::<i64>().unwrap_or(3);
    let low_stock_count = connection.query_row("SELECT COUNT(*) FROM products WHERE status='ativo' AND stock<=?1", params![low_limit], |row| row.get(0)).map_err(|e| e.to_string())?;
    let mut stmt = connection.prepare("SELECT method, COALESCE(SUM(amount),0), COUNT(*) FROM cash_movements WHERE type='entrada' AND substr(created_at,1,10)=?1 GROUP BY method ORDER BY SUM(amount) DESC").map_err(|e| e.to_string())?;
    let payment_today = stmt.query_map(params![day], |row| Ok(PaymentSummary { method: row.get(0)?, total: row.get(1)?, count: row.get(2)? })).map_err(|e| e.to_string())?.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())?;
    Ok(DashboardData { today_sales_total, today_sales_count, customers_total, orders_open, credits_open_total, credits_active_customers, low_stock_count, payment_today, recent_sales: list_sales_inner(connection, 8)? })
}

#[tauri::command]
fn get_dashboard(app: AppHandle) -> CmdResult<DashboardData> {
    let connection = conn(&app)?;
    init_schema(&connection)?;
    dashboard_data(&connection)
}

#[tauri::command]
fn get_dashboard_sales_series(app: AppHandle, period: String) -> CmdResult<Vec<DashboardSalesPoint>> {
    let connection = conn(&app)?;
    init_schema(&connection)?;
    dashboard_sales_series(&connection, &period)
}

#[tauri::command]
fn list_customers(app: AppHandle) -> CmdResult<Vec<Customer>> {
    let connection = conn(&app)?;
    init_schema(&connection)?;
    let mut stmt = connection.prepare("SELECT id,name,phone,whatsapp,address,credit_limit,status,notes,created_at,updated_at FROM customers ORDER BY name COLLATE NOCASE").map_err(|e| e.to_string())?;
    let rows = stmt.query_map([], |row| Ok(Customer { id: row.get(0)?, name: row.get(1)?, phone: row.get(2)?, whatsapp: row.get(3)?, address: row.get(4)?, credit_limit: row.get(5)?, status: row.get(6)?, notes: row.get(7)?, created_at: row.get(8)?, updated_at: row.get(9)? }))
        .map_err(|e| e.to_string())?;
    let result = rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())?;
    Ok(result)
}

#[tauri::command]
fn upsert_customer(app: AppHandle, customer: CustomerInput) -> CmdResult<Customer> {
    let connection = conn(&app)?;
    init_schema(&connection)?;
    let id = customer.id.filter(|v| !v.is_empty()).unwrap_or_else(|| new_id("cus"));
    let now = now_iso();
    let name = clean(customer.name);
    let status = customer.status.unwrap_or_else(|| "ativo".to_string());
    if name.is_empty() { return Err("Nome do cliente é obrigatório".to_string()); }
    if status == "inativo" {
        let open_credits: i64 = connection.query_row("SELECT COUNT(*) FROM credits WHERE customer_id=?1 AND status='aberto'", params![id.clone()], |row| row.get(0)).map_err(|e| e.to_string())?;
        if open_credits > 0 { return Err("Cliente possui crediario em aberto".to_string()); }
        let open_orders: i64 = connection.query_row("SELECT COUNT(*) FROM orders WHERE customer_id=?1 AND status IN ('aberto','separado')", params![id.clone()], |row| row.get(0)).map_err(|e| e.to_string())?;
        if open_orders > 0 { return Err("Cliente possui pedido em aberto".to_string()); }
    }
    connection.execute("INSERT INTO customers(id,name,phone,whatsapp,address,credit_limit,status,notes,created_at,updated_at) VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9,?10) ON CONFLICT(id) DO UPDATE SET name=excluded.name, phone=excluded.phone, whatsapp=excluded.whatsapp, address=excluded.address, credit_limit=excluded.credit_limit, status=excluded.status, notes=excluded.notes, updated_at=excluded.updated_at",
        params![id, name, clean(customer.phone), clean(customer.whatsapp), clean(customer.address), customer.credit_limit.unwrap_or(0.0), status, clean(customer.notes), now, now]).map_err(|e| e.to_string())?;
    audit(&connection, "customer", &id, "upsert", "Cliente salvo").map_err(|e| e.to_string())?;
    connection.query_row("SELECT id,name,phone,whatsapp,address,credit_limit,status,notes,created_at,updated_at FROM customers WHERE id=?1", params![id], |row| Ok(Customer { id: row.get(0)?, name: row.get(1)?, phone: row.get(2)?, whatsapp: row.get(3)?, address: row.get(4)?, credit_limit: row.get(5)?, status: row.get(6)?, notes: row.get(7)?, created_at: row.get(8)?, updated_at: row.get(9)? })).map_err(|e| e.to_string())
}

#[tauri::command]
fn inactivate_customer(app: AppHandle, customer_id: String) -> CmdResult<Customer> {
    let connection = conn(&app)?;
    init_schema(&connection)?;
    let open_credits: i64 = connection
        .query_row(
            "SELECT COUNT(*) FROM credits WHERE customer_id=?1 AND status='aberto'",
            params![customer_id],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;
    if open_credits > 0 {
        return Err("Cliente possui crediario em aberto".to_string());
    }
    let open_orders: i64 = connection
        .query_row(
            "SELECT COUNT(*) FROM orders WHERE customer_id=?1 AND status IN ('aberto','separado')",
            params![customer_id],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;
    if open_orders > 0 {
        return Err("Cliente possui pedido em aberto".to_string());
    }
    connection
        .execute(
            "UPDATE customers SET status='inativo', updated_at=?1 WHERE id=?2",
            params![now_iso(), customer_id],
        )
        .map_err(|e| e.to_string())?;
    audit(&connection, "customer", &customer_id, "inactivate", "Cliente inativado")
        .map_err(|e| e.to_string())?;
    connection
        .query_row(
            "SELECT id,name,phone,whatsapp,address,credit_limit,status,notes,created_at,updated_at FROM customers WHERE id=?1",
            params![customer_id],
            |row| Ok(Customer {
                id: row.get(0)?,
                name: row.get(1)?,
                phone: row.get(2)?,
                whatsapp: row.get(3)?,
                address: row.get(4)?,
                credit_limit: row.get(5)?,
                status: row.get(6)?,
                notes: row.get(7)?,
                created_at: row.get(8)?,
                updated_at: row.get(9)?,
            }),
        )
        .map_err(|_| "Cliente nao encontrado".to_string())
}

#[tauri::command]
fn list_products(app: AppHandle) -> CmdResult<Vec<Product>> {
    let connection = conn(&app)?;
    init_schema(&connection)?;
    list_products_inner(&connection)
}

fn list_products_inner(connection: &Connection) -> CmdResult<Vec<Product>> {
    let mut stmt = connection.prepare("SELECT id,name,category,price,promo_price,stock,unit,size,color,internal_code,barcode,image_data,status,created_at,updated_at FROM products ORDER BY name COLLATE NOCASE").map_err(|e| e.to_string())?;
    let rows = stmt.query_map([], |row| Ok(Product { id: row.get(0)?, name: row.get(1)?, category: row.get(2)?, price: row.get(3)?, promo_price: row.get(4)?, stock: row.get(5)?, unit: row.get(6)?, size: row.get(7)?, color: row.get(8)?, internal_code: row.get(9)?, barcode: row.get(10)?, image_data: row.get(11)?, status: row.get(12)?, created_at: row.get(13)?, updated_at: row.get(14)? }))
        .map_err(|e| e.to_string())?;
    let result = rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())?;
    Ok(result)
}

#[tauri::command]
fn upsert_product(app: AppHandle, product: ProductInput) -> CmdResult<Product> {
    let connection = conn(&app)?;
    init_schema(&connection)?;
    let id = product.id.filter(|v| !v.is_empty()).unwrap_or_else(|| new_id("prd"));
    let now = now_iso();
    let name = clean(product.name);
    let status = product.status.unwrap_or_else(|| "ativo".to_string());
    let internal_code = {
        let provided = clean(product.internal_code);
        if provided.is_empty() { generate_product_internal_code(&name, &clean(product.category.clone())) } else { provided }
    };
    if name.is_empty() { return Err("Nome do produto é obrigatório".to_string()); }
    if status == "inativo" {
        let open_orders: i64 = connection.query_row("SELECT COUNT(*) FROM order_items oi INNER JOIN orders o ON o.id=oi.order_id WHERE oi.product_id=?1 AND o.status IN ('aberto','separado')", params![id.clone()], |row| row.get(0)).map_err(|e| e.to_string())?;
        if open_orders > 0 { return Err("Produto esta em pedido aberto".to_string()); }
    }
    connection.execute("INSERT INTO products(id,name,category,price,promo_price,stock,unit,size,color,internal_code,barcode,image_data,status,created_at,updated_at) VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15) ON CONFLICT(id) DO UPDATE SET name=excluded.name, category=excluded.category, price=excluded.price, promo_price=excluded.promo_price, stock=excluded.stock, unit=excluded.unit, size=excluded.size, color=excluded.color, internal_code=excluded.internal_code, barcode=excluded.barcode, image_data=excluded.image_data, status=excluded.status, updated_at=excluded.updated_at",
        params![id, name, clean(product.category), product.price.unwrap_or(0.0), product.promo_price, product.stock.unwrap_or(0), clean(product.unit), clean(product.size), clean(product.color), internal_code, clean(product.barcode), clean(product.image_data), status, now, now]).map_err(|e| e.to_string())?;
    audit(&connection, "product", &id, "upsert", "Produto salvo").map_err(|e| e.to_string())?;
    list_products_inner(&connection)?.into_iter().find(|row| row.id == id).ok_or_else(|| "Produto não encontrado após salvar".to_string())
}

#[tauri::command]
fn inactivate_product(app: AppHandle, product_id: String) -> CmdResult<Product> {
    let connection = conn(&app)?;
    init_schema(&connection)?;
    let open_orders: i64 = connection
        .query_row(
            "SELECT COUNT(*) FROM order_items oi INNER JOIN orders o ON o.id=oi.order_id WHERE oi.product_id=?1 AND o.status IN ('aberto','separado')",
            params![product_id],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;
    if open_orders > 0 {
        return Err("Produto esta em pedido aberto".to_string());
    }
    connection
        .execute(
            "UPDATE products SET status='inativo', updated_at=?1 WHERE id=?2",
            params![now_iso(), product_id],
        )
        .map_err(|e| e.to_string())?;
    audit(&connection, "product", &product_id, "inactivate", "Produto inativado")
        .map_err(|e| e.to_string())?;
    list_products_inner(&connection)?
        .into_iter()
        .find(|row| row.id == product_id)
        .ok_or_else(|| "Produto nao encontrado".to_string())
}

#[tauri::command]
fn adjust_stock(app: AppHandle, product_id: String, delta: i64, reason: String) -> CmdResult<Product> {
    if reason.trim().is_empty() { return Err("Motivo é obrigatório para ajuste de estoque".to_string()); }
    let mut connection = conn(&app)?;
    init_schema(&connection)?;
    let tx = connection.transaction().map_err(|e| e.to_string())?;
    let before: i64 = tx.query_row("SELECT stock FROM products WHERE id=?1", params![product_id], |row| row.get(0)).map_err(|_| "Produto não encontrado".to_string())?;
    let after = before + delta;
    if after < 0 { return Err("Estoque não pode ficar negativo".to_string()); }
    tx.execute("UPDATE products SET stock=?1, updated_at=?2 WHERE id=?3", params![after, now_iso(), product_id]).map_err(|e| e.to_string())?;
    tx.execute("INSERT INTO stock_movements(id,product_id,type,qty,before_stock,after_stock,reason,reference_id,created_at) VALUES(?1,?2,?3,?4,?5,?6,?7,NULL,?8)", params![new_id("stk"), product_id, "ajuste", delta, before, after, reason, now_iso()]).map_err(|e| e.to_string())?;
    audit(&tx, "product", &product_id, "stock_adjust", &format!("Ajuste {}: {} -> {}. Motivo: {}", delta, before, after, reason)).map_err(|e| e.to_string())?;
    tx.commit().map_err(|e| e.to_string())?;
    list_products_inner(&connection)?.into_iter().find(|row| row.id == product_id).ok_or_else(|| "Produto não encontrado".to_string())
}

fn list_sales_inner(connection: &Connection, limit: i64) -> CmdResult<Vec<SaleSummary>> {
    let mut stmt = connection.prepare("SELECT id,number,customer_name,payment_method,total,status,created_at FROM sales ORDER BY number DESC LIMIT ?1").map_err(|e| e.to_string())?;
    let rows = stmt.query_map(params![limit], |row| Ok(SaleSummary { id: row.get(0)?, number: row.get(1)?, customer_name: row.get(2)?, payment_method: row.get(3)?, total: row.get(4)?, status: row.get(5)?, created_at: row.get(6)? }))
        .map_err(|e| e.to_string())?;
    let result = rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())?;
    Ok(result)
}

#[tauri::command]
fn list_sales(app: AppHandle) -> CmdResult<Vec<SaleSummary>> {
    let connection = conn(&app)?;
    init_schema(&connection)?;
    list_sales_inner(&connection, 80)
}

#[tauri::command]
fn create_sale(app: AppHandle, payload: SaleInput) -> CmdResult<SaleSummary> {
    if payload.items.is_empty() { return Err("Venda sem itens".to_string()); }
    let mut connection = conn(&app)?;
    init_schema(&connection)?;
    if let Some(existing) = connection.query_row("SELECT id,number,customer_name,payment_method,total,status,created_at FROM sales WHERE request_id=?1", params![payload.request_id], |row| Ok(SaleSummary { id: row.get(0)?, number: row.get(1)?, customer_name: row.get(2)?, payment_method: row.get(3)?, total: row.get(4)?, status: row.get(5)?, created_at: row.get(6)? })).optional().map_err(|e| e.to_string())? { return Ok(existing); }
    let tx = connection.transaction().map_err(|e| e.to_string())?;
    let sale_id = new_id("sale");
    let sale_number = next_number(&tx, "sales").map_err(|e| e.to_string())?;
    let created_at = now_iso();
    let is_credit_sale = payload.payment_method == "crediario";
    let credit_customer_id = if is_credit_sale {
        Some(
            payload
                .customer_id
                .as_deref()
                .map(str::trim)
                .filter(|value| !value.is_empty())
                .ok_or_else(|| "Selecione um cliente para vender no crediário".to_string())?,
        )
    } else {
        None
    };
    let customer_name = if let Some(customer_id) = credit_customer_id {
        let (name, _) = credit_customer(&tx, customer_id)?;
        name
    } else {
        customer_name(&tx, &payload.customer_id).map_err(|e| e.to_string())?
    };
    let mut subtotal = 0.0_f64;
    let mut resolved_items: Vec<(String, String, f64, f64, f64, i64)> = Vec::new();
    for item in &payload.items {
        if item.qty <= 0.0 { return Err("Quantidade inválida".to_string()); }
        let product = tx.query_row("SELECT name, stock, price, COALESCE(promo_price, price) FROM products WHERE id=?1 AND status='ativo'", params![item.product_id], |row| Ok((row.get::<_, String>(0)?, row.get::<_, i64>(1)?, row.get::<_, f64>(2)?, row.get::<_, f64>(3)?))).optional().map_err(|e| e.to_string())?.ok_or_else(|| "Produto inativo ou não encontrado".to_string())?;
        if product.1 < item.qty as i64 { return Err(format!("Estoque insuficiente para {}", product.0)); }
        let unit_price = if item.unit_price > 0.0 { item.unit_price } else { product.3 };
        let total = unit_price * item.qty;
        subtotal += total;
        resolved_items.push((item.product_id.clone(), product.0, item.qty, unit_price, total, product.1));
    }
    let total = (subtotal - payload.discount.max(0.0)).max(0.0);
    if let Some(customer_id) = credit_customer_id {
        ensure_credit_limit(&tx, customer_id, total)?;
    }
    tx.execute("INSERT INTO sales(id,number,request_id,customer_id,customer_name,subtotal,discount,total,payment_method,status,created_at) VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9,'finalizada',?10)", params![sale_id, sale_number, payload.request_id, payload.customer_id, customer_name, subtotal, payload.discount.max(0.0), total, payload.payment_method, created_at]).map_err(|e| e.to_string())?;
    for (product_id, product_name, qty, unit_price, item_total, before_stock) in resolved_items {
        let after_stock = before_stock - qty as i64;
        tx.execute("INSERT INTO sale_items(id,sale_id,product_id,product_name,qty,unit_price,total,created_at) VALUES(?1,?2,?3,?4,?5,?6,?7,?8)", params![new_id("sli"), sale_id, product_id, product_name, qty, unit_price, item_total, created_at]).map_err(|e| e.to_string())?;
        tx.execute("UPDATE products SET stock=?1, updated_at=?2 WHERE id=?3", params![after_stock, created_at, product_id]).map_err(|e| e.to_string())?;
        tx.execute("INSERT INTO stock_movements(id,product_id,type,qty,before_stock,after_stock,reason,reference_id,created_at) VALUES(?1,?2,'saida_venda',?3,?4,?5,'Venda finalizada',?6,?7)", params![new_id("stk"), product_id, qty, before_stock, after_stock, sale_id, created_at]).map_err(|e| e.to_string())?;
    }
    if is_credit_sale {
        let credit_id = new_id("cred");
        tx.execute("INSERT INTO credits(id,customer_id,customer_name,sale_id,total,balance,status,created_at,updated_at) VALUES(?1,?2,?3,?4,?5,?5,'aberto',?6,?6)", params![credit_id, payload.customer_id, customer_name, sale_id, total, created_at]).map_err(|e| e.to_string())?;
        let count = payload.installment_count.unwrap_or(1).clamp(1, 24);
        let first_due_date = match payload.first_due_date.as_deref().map(str::trim).filter(|value| !value.is_empty()) {
            Some(value) => NaiveDate::parse_from_str(value, "%Y-%m-%d").map_err(|_| "Data do primeiro vencimento invalida".to_string())?,
            None => Local::now().date_naive(),
        };
        for (index, amount) in split_installments(total, count).into_iter().enumerate() {
            let installment_number = index as i64 + 1;
            let due_date = first_due_date
                .checked_add_months(Months::new(index as u32))
                .unwrap_or(first_due_date)
                .to_string();
            tx.execute("INSERT INTO credit_installments(id,credit_id,number,amount,paid_amount,due_date,status,payment_method,created_at,updated_at) VALUES(?1,?2,?3,?4,0,?5,'aberto',NULL,?6,?6)", params![new_id("inst"), credit_id, installment_number, amount, due_date, created_at]).map_err(|e| e.to_string())?;
        }
    } else {
        tx.execute("INSERT INTO cash_movements(id,request_id,sale_id,type,method,amount,reason,created_at) VALUES(?1,?2,?3,'entrada',?4,?5,'Venda finalizada',?6)", params![new_id("cash"), format!("cash-{}", payload.request_id), sale_id, payload.payment_method, total, created_at]).map_err(|e| e.to_string())?;
    }
    let receipt_id = new_id("rec");
    let content = build_receipt(&tx, &sale_id).map_err(|e| e.to_string())?;
    let receipt_type = receipt_type_label(read_settings(&tx).map_err(|e| e.to_string())?.receipt_width_mm);
    tx.execute("INSERT INTO receipts(id,sale_id,receipt_type,total,content,created_at) VALUES(?1,?2,?3,?4,?5,?6)", params![receipt_id, sale_id, receipt_type, total, content, created_at]).map_err(|e| e.to_string())?;
    audit(&tx, "sale", &sale_id, "create", &format!("Venda #{} salva com transação", sale_number)).map_err(|e| e.to_string())?;
    tx.commit().map_err(|e| e.to_string())?;
    list_sales_inner(&connection, 1)?.into_iter().next().ok_or_else(|| "Venda não encontrada após salvar".to_string())
}

#[tauri::command]
fn cancel_sale(app: AppHandle, sale_id: String, reason: String) -> CmdResult<SaleSummary> {
    let clean_reason = reason.trim().to_string();
    if clean_reason.is_empty() {
        return Err("Informe o motivo do cancelamento".to_string());
    }
    let mut connection = conn(&app)?;
    init_schema(&connection)?;
    let tx = connection.transaction().map_err(|e| e.to_string())?;
    let sale = tx
        .query_row(
            "SELECT number,payment_method,total,status FROM sales WHERE id=?1",
            params![sale_id.clone()],
            |row| {
                Ok((
                    row.get::<_, i64>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, f64>(2)?,
                    row.get::<_, String>(3)?,
                ))
            },
        )
        .optional()
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "Venda nao encontrada".to_string())?;
    if sale.3 == "cancelada" {
        return Err("Venda ja esta cancelada".to_string());
    }

    let now = now_iso();
    let mut stmt = tx
        .prepare("SELECT product_id,qty FROM sale_items WHERE sale_id=?1")
        .map_err(|e| e.to_string())?;
    let items = stmt
        .query_map(params![sale_id.clone()], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, f64>(1)?))
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    drop(stmt);

    for (product_id, qty) in items {
        let before_stock: i64 = tx
            .query_row(
                "SELECT stock FROM products WHERE id=?1",
                params![product_id.clone()],
                |row| row.get(0),
            )
            .map_err(|_| "Produto da venda nao encontrado".to_string())?;
        let after_stock = before_stock + qty as i64;
        tx.execute(
            "UPDATE products SET stock=?1, updated_at=?2 WHERE id=?3",
            params![after_stock, now, product_id],
        )
        .map_err(|e| e.to_string())?;
        tx.execute(
            "INSERT INTO stock_movements(id,product_id,type,qty,before_stock,after_stock,reason,reference_id,created_at) VALUES(?1,?2,'estorno_venda',?3,?4,?5,?6,?7,?8)",
            params![new_id("stk"), product_id, qty, before_stock, after_stock, clean_reason, sale_id.clone(), now],
        )
        .map_err(|e| e.to_string())?;
    }

    if sale.1 == "crediario" {
        let credit_id: Option<String> = tx
            .query_row(
                "SELECT id FROM credits WHERE sale_id=?1 LIMIT 1",
                params![sale_id.clone()],
                |row| row.get(0),
            )
            .optional()
            .map_err(|e| e.to_string())?;
        if let Some(credit_id) = credit_id {
            let payments_count: i64 = tx
                .query_row(
                    "SELECT COUNT(*) FROM payments WHERE credit_id=?1",
                    params![credit_id.clone()],
                    |row| row.get(0),
                )
                .map_err(|e| e.to_string())?;
            if payments_count > 0 {
                return Err("Nao e possivel cancelar crediario com parcela recebida".to_string());
            }
            tx.execute(
                "DELETE FROM credit_installments WHERE credit_id=?1",
                params![credit_id.clone()],
            )
            .map_err(|e| e.to_string())?;
            tx.execute("DELETE FROM credits WHERE id=?1", params![credit_id])
                .map_err(|e| e.to_string())?;
        }
    } else if sale.2 > 0.0 {
        tx.execute(
            "INSERT INTO cash_movements(id,request_id,sale_id,type,method,amount,reason,created_at) VALUES(?1,?2,?3,'saida',?4,?5,?6,?7)",
            params![
                new_id("cash"),
                format!("cash-cancel-{}", sale_id),
                sale_id.clone(),
                sale.1,
                sale.2,
                format!("Estorno de venda cancelada: {}", clean_reason),
                now
            ],
        )
        .map_err(|e| e.to_string())?;
    }

    tx.execute(
        "UPDATE sales SET status='cancelada' WHERE id=?1",
        params![sale_id.clone()],
    )
    .map_err(|e| e.to_string())?;
    audit(
        &tx,
        "sale",
        &sale_id,
        "cancel",
        &format!("Venda #{} cancelada. Motivo: {}", sale.0, clean_reason),
    )
    .map_err(|e| e.to_string())?;
    tx.commit().map_err(|e| e.to_string())?;
    list_sales_inner(&connection, 80)?
        .into_iter()
        .find(|row| row.id == sale_id)
        .ok_or_else(|| "Venda nao encontrada".to_string())
}


fn format_date_br(value: &str) -> String {
    if let Ok(dt) = chrono::DateTime::parse_from_rfc3339(value) {
        return dt.with_timezone(&Local).format("%d/%m/%Y").to_string();
    }
    if let Ok(date) = chrono::NaiveDate::parse_from_str(value, "%Y-%m-%d") {
        return date.format("%d/%m/%Y").to_string();
    }
    if value.len() >= 10 {
        let raw = &value[..10];
        if let Ok(date) = chrono::NaiveDate::parse_from_str(raw, "%Y-%m-%d") {
            return date.format("%d/%m/%Y").to_string();
        }
    }
    value.to_string()
}

fn payment_method_label(value: &str) -> &'static str {
    match value {
        "pix" => "Pix",
        "dinheiro" => "Dinheiro",
        "cartao" => "Cartão",
        "crediario" => "Crediário",
        _ => "Pagamento",
    }
}

fn build_receipt(connection: &Connection, sale_id: &str) -> rusqlite::Result<String> {
    let settings = read_settings(connection).map_err(|_| rusqlite::Error::InvalidQuery)?;
    let sale = connection.query_row(
        "SELECT s.number,s.customer_name,s.total,s.payment_method,s.created_at,COALESCE(c.phone,''),COALESCE(c.whatsapp,'') FROM sales s LEFT JOIN customers c ON c.id=s.customer_id WHERE s.id=?1",
        params![sale_id],
        |row| Ok((
            row.get::<_, i64>(0)?,
            row.get::<_, String>(1)?,
            row.get::<_, f64>(2)?,
            row.get::<_, String>(3)?,
            row.get::<_, String>(4)?,
            row.get::<_, String>(5)?,
            row.get::<_, String>(6)?,
        )),
    )?;

    let mut stmt = connection.prepare("SELECT product_name,qty,unit_price,total FROM sale_items WHERE sale_id=?1")?;
    let items = stmt.query_map(params![sale_id], |row| {
        Ok((
            row.get::<_, String>(0)?,
            row.get::<_, f64>(1)?,
            row.get::<_, f64>(2)?,
            row.get::<_, f64>(3)?,
        ))
    })?.collect::<Result<Vec<_>, _>>()?;

    let mut rows = String::new();
    for item in items {
        rows.push_str(&format!(
            "<tr><td class='qty'>{:.0}</td><td class='product'>{}</td><td class='money'>R$ {:.2}</td><td class='money'>R$ {:.2}</td></tr>",
            item.1, item.0, item.2, item.3
        ));
    }
    let blank_rows = 4usize.saturating_sub(rows.matches("<tr>").count());
    for _ in 0..blank_rows {
        rows.push_str("<tr><td class='qty'>&nbsp;</td><td class='product'></td><td class='money'></td><td class='money'></td></tr>");
    }

    let contact_line = if !sale.6.trim().is_empty() { sale.6.clone() } else { sale.5.clone() };
    let credit_balance: Option<f64> = connection.query_row(
        "SELECT balance FROM credits WHERE sale_id=?1 ORDER BY created_at DESC LIMIT 1",
        params![sale_id],
        |row| row.get(0),
    ).optional()?;
    let last_credit_payment: Option<(String, String)> = connection.query_row(
        "SELECT method, created_at FROM payments WHERE credit_id IN (SELECT id FROM credits WHERE sale_id=?1) AND status='confirmado' ORDER BY created_at DESC LIMIT 1",
        params![sale_id],
        |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?)),
    ).optional()?;

    let is_fully_paid = if sale.3 == "crediario" {
        credit_balance.map(|v| v <= 0.009).unwrap_or(false)
    } else {
        true
    };

    let paid_method = if sale.3 == "crediario" {
        last_credit_payment.as_ref().map(|value| value.0.as_str())
    } else {
        Some(sale.3.as_str())
    };
    let paid_date = if sale.3 == "crediario" {
        last_credit_payment.as_ref().map(|value| value.1.as_str())
    } else {
        Some(sale.4.as_str())
    };

    let payment_options = ["pix", "dinheiro", "cartao", "crediario"]
        .iter()
        .map(|method| {
            let selected = if is_fully_paid && paid_method == Some(*method) { " selected" } else { "" };
            format!("<span class='pay-option{}'>{}</span>", selected, payment_method_label(method))
        })
        .collect::<Vec<_>>()
        .join("");

    let paid_stamp = if is_fully_paid {
        let stamp_method = payment_method_label(paid_method.unwrap_or(sale.3.as_str()));
        let stamp_date = format_date_br(paid_date.unwrap_or(&sale.4));
        format!(
            "<div class='paid-stamp'><div class='paid-title'>PAGO</div><div class='paid-date'>Em, {}</div><div class='paid-method'>Forma: {}</div></div>",
            stamp_date,
            stamp_method
        )
    } else {
        String::new()
    };

    let notes = if is_fully_paid {
        format!("Pagamento total confirmado via {}.", payment_method_label(paid_method.unwrap_or(&sale.3)))
    } else if sale.3 == "crediario" {
        "Venda lançada no crediário. Comprovante sem quitação total.".to_string()
    } else {
        settings.receipt_message.clone()
    };

    Ok(format!(
        r#"<!doctype html><html><head><meta charset='utf-8'><title>Comprovante</title><style>
        @page{{size:{}mm {}mm;margin:0;}}
        *{{box-sizing:border-box}}
        body{{font-family:'Segoe UI',Arial,sans-serif;margin:0;padding:0;background:#f7f1f4;color:#2b1d24}}
        .paper{{position:relative;width:{}mm;min-height:{}mm;margin:0 auto;border:0.28mm solid #e8c3d2;border-radius:3.2mm;padding:4.3mm 4.6mm 4.4mm;background:#fffdfd;overflow:hidden;display:flex;flex-direction:column}}
        .top-line{{height:0.55mm;background:#d46894;border-radius:999px;margin-bottom:2.2mm}}
        .brand{{display:grid;grid-template-columns:1fr auto;align-items:center;gap:2mm;margin-bottom:2mm}}
        .brand-logo img{{display:block;width:31mm;height:auto;object-fit:contain}}
        .brand-contacts{{display:grid;gap:0.55mm;justify-items:start;color:#c85b88;font-size:8pt;font-weight:700;text-align:left}}
        .meta{{display:grid;gap:0.8mm;margin:1.2mm 0 1.9mm}}
        .meta-row{{display:grid;grid-template-columns:20mm 1fr;gap:1.6mm;align-items:end;font-size:8.9pt}}
        .meta-row strong{{color:#191317;font-size:9pt}}
        .line{{border-bottom:0.28mm solid #454045;min-height:5mm;padding-bottom:0.45mm;font-size:8.2pt;font-weight:600;color:#2f232a}}
        .double-line{{border-top:0.28mm solid #454045;border-bottom:0.28mm solid #454045;height:1.65mm;margin:1.4mm 0 2mm}}
        table{{width:100%;border-collapse:collapse;table-layout:fixed;font-size:7.35pt}}
        th,td{{border:0.28mm solid #454045;padding:1.45mm 1.2mm;height:5.05mm}}
        th{{background:#e8b5c9;color:#4b2a38;font-weight:800;text-align:center}}
        .qty{{width:10mm;text-align:center;font-weight:700}}
        .product{{width:auto}}
        .money{{width:14mm;text-align:right;white-space:nowrap;font-weight:700}}
        .payment-head{{display:grid;grid-template-columns:1fr 16mm;margin-top:0;border:0.28mm solid #454045;border-top:0}}
        .payment-head div{{background:#e8b5c9;color:#4b2a38;font-weight:800;text-align:center;padding:1.9mm 1mm;border-right:0.28mm solid #454045}}
        .payment-head div:last-child{{border-right:0}}
        .payment-body{{display:grid;grid-template-columns:1fr 16mm;border:0.28mm solid #454045;border-top:0}}
        .payment-options{{padding:1.8mm 1.6mm;display:flex;flex-wrap:wrap;gap:1.2mm 1.8mm;align-items:center}}
        .pay-option{{display:inline-flex;align-items:center;justify-content:center;min-width:14mm;padding:0.65mm 1.7mm;border:0.24mm solid transparent;border-radius:999px;font-size:6.7pt;color:#2f232a;font-weight:700}}
        .pay-option.selected{{border-color:#2f232a;background:rgba(233,191,208,0.45)}}
        .payment-total{{border-left:0.28mm solid #454045;display:flex;align-items:center;justify-content:center;text-align:center;font-size:8.6pt;font-weight:900;padding:1mm;color:#241922}}
        .notes{{border:0.28mm solid #454045;border-top:0;min-height:21mm;padding:1.9mm 2.2mm 2.1mm}}
        .notes strong{{display:block;text-align:center;margin-bottom:1.6mm;color:#4b2a38;font-size:8.5pt}}
        .notes p{{margin:0.45mm 0 0;font-size:7.1pt;line-height:1.35;color:#4f4048}}
        .paid-stamp{{position:absolute;right:4.2mm;top:84mm;z-index:2;display:flex;flex-direction:column;align-items:flex-start;gap:0.35mm;width:max-content;max-width:100%;margin:0;padding:1.2mm 1.8mm 1.35mm;border:0.3mm solid rgba(24,18,22,0.88);border-radius:0.9mm;background:rgba(255,255,255,0.72);transform:rotate(-4deg);opacity:0.95;box-shadow:0 0 0 0.16mm rgba(24,18,22,0.12) inset;pointer-events:none}}
        .paid-stamp::after{{content:'';position:absolute;inset:0.65mm;border:0.15mm solid rgba(24,18,22,0.48);border-radius:0.45mm}}
        .paid-title,.paid-date,.paid-method{{position:relative;z-index:1}}
        .paid-title{{font-size:12.8pt;line-height:0.92;font-weight:900;letter-spacing:0.16mm;color:#141114}}
        .paid-date{{font-size:7pt;line-height:1;font-weight:800;color:#141114}}
        .paid-method{{font-size:6.2pt;line-height:1.05;font-weight:800;color:#141114}}
        @media print{{body{{background:#fff}} .paper{{border:none;border-radius:0;margin:0 auto;min-height:{}mm;}}}}
        </style></head><body><div class='paper'>
        <div class='top-line'></div>
        <div class='brand'>
          <div class='brand-logo'><img src='{}' alt='Logo da loja'></div>
          <div class='brand-contacts'>
            <span>{}</span>
            <span>{}</span>
          </div>
        </div>
        <div class='meta'>
          <div class='meta-row'><strong>Cliente:</strong><span class='line'>{}</span></div>
          <div class='meta-row'><strong>Data:</strong><span class='line'>{}</span></div>
          <div class='meta-row'><strong>Contato:</strong><span class='line'>{}</span></div>
        </div>
        <div class='double-line'></div>
        <table>
          <thead><tr><th class='qty'>Qtd.</th><th class='product'>Produto</th><th class='money'>R$ un.</th><th class='money'>Total</th></tr></thead>
          <tbody>{}</tbody>
        </table>
        {}
        <div class='payment-head'><div>Pagamento</div><div>Total</div></div>
        <div class='payment-body'><div class='payment-options'>{}</div><div class='payment-total'>R$ {:.2}</div></div>
        <div class='notes'><strong>Anotações</strong><p>{}</p><p>{}</p></div>
        </div></body></html>"#,
        RECEIPT_A6_WIDTH_MM,
        RECEIPT_A6_HEIGHT_MM,
        RECEIPT_A6_WIDTH_MM,
        RECEIPT_A6_HEIGHT_MM,
        RECEIPT_A6_HEIGHT_MM,
        JAQUE_LOGO_DATA_URI,
        if settings.whatsapp.trim().is_empty() { "(43) 99669-4751".to_string() } else { settings.whatsapp.clone() },
        "@jaqueconfeccoes".to_string(),
        sale.1,
        format_date_br(&sale.4),
        contact_line,
        rows,
        paid_stamp,
        payment_options,
        sale.2,
        notes,
        settings.receipt_message
    ))
}

#[tauri::command]
fn list_credits(app: AppHandle) -> CmdResult<Vec<CreditSummary>> {
    let connection = conn(&app)?;
    init_schema(&connection)?;
    let mut stmt = connection.prepare(
        "SELECT cr.id,cr.customer_name,COALESCE(c.phone,''),COALESCE(c.whatsapp,''),COALESCE(cr.sale_id,''),COALESCE(s.number,0),cr.total,cr.balance,cr.status,cr.created_at
         FROM credits cr
         LEFT JOIN customers c ON c.id=cr.customer_id
         LEFT JOIN sales s ON s.id=cr.sale_id
         ORDER BY cr.created_at DESC"
    ).map_err(|e| e.to_string())?;
    let base = stmt.query_map([], |row| Ok((
        row.get::<_, String>(0)?,
        row.get::<_, String>(1)?,
        row.get::<_, String>(2)?,
        row.get::<_, String>(3)?,
        row.get::<_, String>(4)?,
        row.get::<_, i64>(5)?,
        row.get::<_, f64>(6)?,
        row.get::<_, f64>(7)?,
        row.get::<_, String>(8)?,
        row.get::<_, String>(9)?,
    ))).map_err(|e| e.to_string())?.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())?;
    let mut out = Vec::new();
    for credit in base {
        let mut istmt = connection.prepare("SELECT id,number,amount,paid_amount,due_date,paid_at,status,payment_method FROM credit_installments WHERE credit_id=?1 ORDER BY number").map_err(|e| e.to_string())?;
        let installments = istmt.query_map(params![credit.0], |row| Ok(CreditInstallment { id: row.get(0)?, number: row.get(1)?, amount: row.get(2)?, paid_amount: row.get(3)?, due_date: row.get(4)?, paid_at: row.get(5)?, status: row.get(6)?, payment_method: row.get(7)? })).map_err(|e| e.to_string())?.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())?;
        out.push(CreditSummary {
            id: credit.0,
            customer_name: credit.1,
            customer_phone: credit.2,
            customer_whatsapp: credit.3,
            sale_id: credit.4,
            sale_number: credit.5,
            total: credit.6,
            balance: credit.7,
            status: credit.8,
            created_at: credit.9,
            installments
        });
    }
    Ok(out)
}

#[tauri::command]
fn receive_installment(app: AppHandle, payload: ReceiveInput) -> CmdResult<CreditSummary> {
    let mut connection = conn(&app)?;
    init_schema(&connection)?;
    let tx = connection.transaction().map_err(|e| e.to_string())?;
    let already: Option<String> = tx.query_row("SELECT id FROM payments WHERE request_id=?1", params![payload.request_id], |row| row.get(0)).optional().map_err(|e| e.to_string())?;
    if already.is_some() { return Err("Pagamento duplicado bloqueado pelo request_id".to_string()); }
    let (amount, paid, status): (f64, f64, String) = tx.query_row("SELECT amount, paid_amount, status FROM credit_installments WHERE id=?1 AND credit_id=?2", params![payload.installment_id, payload.credit_id], |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?))).map_err(|_| "Parcela não encontrada".to_string())?;
    if status == "pago" { return Err("Parcela já está paga".to_string()); }
    let to_pay = payload.amount.min(amount - paid).max(0.0);
    if to_pay <= 0.0 { return Err("Valor inválido para recebimento".to_string()); }
    let now = now_iso();
    let new_paid = paid + to_pay;
    let new_status = if new_paid + 0.009 >= amount { "pago" } else { "parcial" };
    tx.execute("UPDATE credit_installments SET paid_amount=?1, status=?2, payment_method=?3, paid_at=CASE WHEN ?2='pago' THEN ?4 ELSE paid_at END, updated_at=?4 WHERE id=?5", params![new_paid, new_status, payload.method, now, payload.installment_id]).map_err(|e| e.to_string())?;
    let balance: f64 = tx.query_row("SELECT COALESCE(SUM(amount-paid_amount),0) FROM credit_installments WHERE credit_id=?1", params![payload.credit_id], |row| row.get(0)).map_err(|e| e.to_string())?;
    let credit_status = if balance <= 0.009 { "quitado" } else { "aberto" };
    tx.execute("UPDATE credits SET balance=?1, status=?2, updated_at=?3 WHERE id=?4", params![balance, credit_status, now, payload.credit_id]).map_err(|e| e.to_string())?;
    let payment_id = new_id("pay");
    tx.execute("INSERT INTO payments(id,request_id,credit_id,installment_id,amount,method,status,created_at) VALUES(?1,?2,?3,?4,?5,?6,'confirmado',?7)", params![payment_id, payload.request_id, payload.credit_id, payload.installment_id, to_pay, payload.method, now]).map_err(|e| e.to_string())?;
    tx.execute("INSERT INTO cash_movements(id,request_id,payment_id,type,method,amount,reason,created_at) VALUES(?1,?2,?3,'entrada',?4,?5,'Recebimento de crediário',?6)", params![new_id("cash"), format!("cash-{}", payload.request_id), payment_id, payload.method, to_pay, now]).map_err(|e| e.to_string())?;
    audit(&tx, "credit", &payload.credit_id, "receive", &format!("Recebimento de parcela: R$ {:.2}", to_pay)).map_err(|e| e.to_string())?;
    tx.commit().map_err(|e| e.to_string())?;
    list_credits(app)?.into_iter().find(|row| row.id == payload.credit_id).ok_or_else(|| "Crediário não encontrado".to_string())
}

#[tauri::command]
fn receive_installment_flex(app: AppHandle, payload: ReceiveInput) -> CmdResult<CreditSummary> {
    let mut connection = conn(&app)?;
    init_schema(&connection)?;
    let tx = connection.transaction().map_err(|e| e.to_string())?;
    let already: Option<String> = tx.query_row("SELECT id FROM payments WHERE request_id=?1", params![payload.request_id], |row| row.get(0)).optional().map_err(|e| e.to_string())?;
    if already.is_some() { return Err("Pagamento duplicado bloqueado pelo request_id".to_string()); }

    let settle_with_redistribution = payload.settle_with_redistribution.unwrap_or(false);
    let amount_to_receive = payload.amount.max(0.0);
    if amount_to_receive <= 0.0 { return Err("Valor inválido para recebimento".to_string()); }

    let now = now_iso();
    let mut stmt = tx.prepare("SELECT id,number,amount,paid_amount,due_date,paid_at,status,payment_method FROM credit_installments WHERE credit_id=?1 ORDER BY number").map_err(|e| e.to_string())?;
    let mut installments = stmt.query_map(params![payload.credit_id.clone()], |row| Ok(CreditInstallment {
        id: row.get(0)?,
        number: row.get(1)?,
        amount: row.get(2)?,
        paid_amount: row.get(3)?,
        due_date: row.get(4)?,
        paid_at: row.get(5)?,
        status: row.get(6)?,
        payment_method: row.get(7)?,
    })).map_err(|e| e.to_string())?.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())?;
    drop(stmt);

    let selected_index = installments.iter().position(|item| item.id == payload.installment_id).ok_or_else(|| "Parcela não encontrada".to_string())?;
    if installments[selected_index].status == "pago" { return Err("Parcela já está paga".to_string()); }

    let posted_amount = if settle_with_redistribution {
        let actual_total_paid = installments[selected_index].paid_amount + amount_to_receive;
        let previous_amount_cents = to_cents(installments[selected_index].amount);
        let new_amount_cents = to_cents(actual_total_paid);
        let delta_cents = previous_amount_cents - new_amount_cents;

        if delta_cents != 0 {
            let next_indices: Vec<usize> = installments
                .iter()
                .enumerate()
                .filter_map(|(index, item)| (index > selected_index && item.status != "pago").then_some(index))
                .collect();
            if next_indices.is_empty() {
                return Err("Não há próxima parcela aberta para redistribuir a diferença".to_string());
            }

            if delta_cents > 0 {
                let next_index = next_indices[0];
                installments[next_index].amount = from_cents(to_cents(installments[next_index].amount) + delta_cents);
            } else {
                let mut extra_cents = -delta_cents;
                for next_index in next_indices {
                    let current_amount_cents = to_cents(installments[next_index].amount);
                    let min_amount_cents = to_cents(installments[next_index].paid_amount);
                    let reducible = (current_amount_cents - min_amount_cents).max(0);
                    let reduce_now = reducible.min(extra_cents);
                    installments[next_index].amount = from_cents(current_amount_cents - reduce_now);
                    extra_cents -= reduce_now;
                    if extra_cents == 0 { break; }
                }
                if extra_cents > 0 {
                    return Err("Valor acima do disponível nas próximas parcelas".to_string());
                }
            }
        }

        installments[selected_index].amount = actual_total_paid;
        installments[selected_index].paid_amount = actual_total_paid;
        installments[selected_index].status = "pago".to_string();
        installments[selected_index].paid_at = Some(now.clone());
        installments[selected_index].payment_method = Some(payload.method.clone());

        for installment in &installments {
            let status = if installment.paid_amount + 0.009 >= installment.amount { "pago" } else if installment.paid_amount > 0.0 { "parcial" } else { "aberto" };
            tx.execute(
                "UPDATE credit_installments SET amount=?1, paid_amount=?2, status=?3, payment_method=?4, paid_at=CASE WHEN ?3='pago' THEN COALESCE(paid_at, ?5) ELSE paid_at END, updated_at=?5 WHERE id=?6",
                params![installment.amount, installment.paid_amount, status, installment.payment_method, now, installment.id],
            ).map_err(|e| e.to_string())?;
        }

        amount_to_receive
    } else {
        let amount = installments[selected_index].amount;
        let paid = installments[selected_index].paid_amount;
        let to_pay = amount_to_receive.min(amount - paid).max(0.0);
        if to_pay <= 0.0 { return Err("Valor inválido para recebimento".to_string()); }
        let new_paid = paid + to_pay;
        let new_status = if new_paid + 0.009 >= amount { "pago" } else { "parcial" };
        tx.execute("UPDATE credit_installments SET paid_amount=?1, status=?2, payment_method=?3, paid_at=CASE WHEN ?2='pago' THEN ?4 ELSE paid_at END, updated_at=?4 WHERE id=?5", params![new_paid, new_status, payload.method, now, payload.installment_id]).map_err(|e| e.to_string())?;
        to_pay
    };

    let balance: f64 = tx.query_row("SELECT COALESCE(SUM(amount-paid_amount),0) FROM credit_installments WHERE credit_id=?1", params![payload.credit_id], |row| row.get(0)).map_err(|e| e.to_string())?;
    let credit_status = if balance <= 0.009 { "quitado" } else { "aberto" };
    tx.execute("UPDATE credits SET balance=?1, status=?2, updated_at=?3 WHERE id=?4", params![balance, credit_status, now, payload.credit_id]).map_err(|e| e.to_string())?;
    let payment_id = new_id("pay");
    tx.execute("INSERT INTO payments(id,request_id,credit_id,installment_id,amount,method,status,created_at) VALUES(?1,?2,?3,?4,?5,?6,'confirmado',?7)", params![payment_id, payload.request_id, payload.credit_id, payload.installment_id, posted_amount, payload.method, now]).map_err(|e| e.to_string())?;
    tx.execute("INSERT INTO cash_movements(id,request_id,payment_id,type,method,amount,reason,created_at) VALUES(?1,?2,?3,'entrada',?4,?5,'Recebimento de crediário',?6)", params![new_id("cash"), format!("cash-{}", payload.request_id), payment_id, payload.method, posted_amount, now]).map_err(|e| e.to_string())?;
    audit(&tx, "credit", &payload.credit_id, "receive", &format!("Recebimento flexível de parcela: R$ {:.2}", posted_amount)).map_err(|e| e.to_string())?;
    tx.commit().map_err(|e| e.to_string())?;
    list_credits(app)?.into_iter().find(|row| row.id == payload.credit_id).ok_or_else(|| "Crediário não encontrado".to_string())
}

fn list_orders_inner(connection: &Connection) -> CmdResult<Vec<OrderSummary>> {
    let mut stmt = connection.prepare("SELECT id,number,customer_name,total,status,created_at FROM orders ORDER BY number DESC").map_err(|e| e.to_string())?;
    let rows = stmt.query_map([], |row| Ok(OrderSummary { id: row.get(0)?, number: row.get(1)?, customer_name: row.get(2)?, total: row.get(3)?, status: row.get(4)?, created_at: row.get(5)? })).map_err(|e| e.to_string())?;
    let result = rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())?;
    Ok(result)
}

fn order_summary_by_id(connection: &Connection, order_id: &str) -> CmdResult<OrderSummary> {
    list_orders_inner(connection)?
        .into_iter()
        .find(|row| row.id == order_id)
        .ok_or_else(|| "Pedido não encontrado".to_string())
}

fn load_order_stock_items(connection: &Connection, order_id: &str) -> CmdResult<Vec<(String, String, f64, i64, String)>> {
    let mut stmt = connection.prepare(
        "SELECT oi.product_id,oi.product_name,oi.qty,p.stock,p.status
         FROM order_items oi
         INNER JOIN products p ON p.id=oi.product_id
         WHERE oi.order_id=?1
         ORDER BY oi.created_at"
    ).map_err(|e| e.to_string())?;
    let rows = stmt.query_map(params![order_id], |row| {
        Ok((
            row.get::<_, String>(0)?,
            row.get::<_, String>(1)?,
            row.get::<_, f64>(2)?,
            row.get::<_, i64>(3)?,
            row.get::<_, String>(4)?,
        ))
    }).map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

fn set_order_status_inner(connection: &mut Connection, order_id: &str, status: &str) -> CmdResult<OrderSummary> {
    let target_status = clean(Some(status.to_string())).to_lowercase();
    if target_status != "aberto" && target_status != "separado" && target_status != "entregue" {
        return Err("Status inválido para o pedido".to_string());
    }

    let tx = connection.transaction().map_err(|e| e.to_string())?;
    let (number, current_status): (i64, String) = tx.query_row(
        "SELECT number,status FROM orders WHERE id=?1",
        params![order_id],
        |row| Ok((row.get(0)?, row.get(1)?)),
    ).optional().map_err(|e| e.to_string())?.ok_or_else(|| "Pedido não encontrado".to_string())?;

    if current_status == "cancelado" {
        return Err("Pedido cancelado não pode mudar de status".to_string());
    }
    if current_status == "entregue" {
        return Err("Pedido entregue não pode voltar de status".to_string());
    }
    if current_status == target_status {
        return order_summary_by_id(&tx, order_id);
    }
    if target_status == "aberto" && current_status != "separado" {
        return Err("Somente pedidos separados podem voltar para aberto".to_string());
    }
    if target_status == "separado" && current_status != "aberto" {
        return Err("Somente pedidos abertos podem ser separados".to_string());
    }

    let items = load_order_stock_items(&tx, order_id)?;
    if items.is_empty() {
        return Err("Pedido sem itens não pode avançar".to_string());
    }

    if target_status == "separado" || target_status == "entregue" {
        for (_, product_name, qty, stock, product_status) in &items {
            if product_status != "ativo" {
                return Err(format!("Produto inativo no pedido: {}", product_name));
            }
            if *stock < *qty as i64 {
                return Err(format!("Estoque insuficiente para {}", product_name));
            }
        }
    }

    let now = now_iso();
    if target_status == "entregue" {
        for (product_id, _, qty, before_stock, _) in items {
            let after_stock = before_stock - qty as i64;
            tx.execute(
                "UPDATE products SET stock=?1, updated_at=?2 WHERE id=?3",
                params![after_stock, now, product_id.clone()],
            ).map_err(|e| e.to_string())?;
            tx.execute(
                "INSERT INTO stock_movements(id,product_id,type,qty,before_stock,after_stock,reason,reference_id,created_at) VALUES(?1,?2,'saida_pedido',?3,?4,?5,'Pedido entregue',?6,?7)",
                params![new_id("stk"), product_id, qty, before_stock, after_stock, order_id, now],
            ).map_err(|e| e.to_string())?;
        }
    }

    tx.execute(
        "UPDATE orders SET status=?1, updated_at=?2 WHERE id=?3",
        params![target_status, now, order_id],
    ).map_err(|e| e.to_string())?;
    audit(&tx, "order", order_id, "status", &format!("Pedido #{} alterado para {}", number, status)).map_err(|e| e.to_string())?;
    tx.commit().map_err(|e| e.to_string())?;
    order_summary_by_id(connection, order_id)
}

#[tauri::command]
fn list_orders(app: AppHandle) -> CmdResult<Vec<OrderSummary>> {
    let connection = conn(&app)?;
    init_schema(&connection)?;
    list_orders_inner(&connection)
}

#[tauri::command]
fn create_order(app: AppHandle, payload: OrderInput) -> CmdResult<OrderSummary> {
    if payload.items.is_empty() { return Err("Pedido sem itens".to_string()); }
    let mut connection = conn(&app)?;
    init_schema(&connection)?;
    if let Some(existing) = connection.query_row("SELECT id,number,customer_name,total,status,created_at FROM orders WHERE request_id=?1", params![payload.request_id], |row| Ok(OrderSummary { id: row.get(0)?, number: row.get(1)?, customer_name: row.get(2)?, total: row.get(3)?, status: row.get(4)?, created_at: row.get(5)? })).optional().map_err(|e| e.to_string())? { return Ok(existing); }
    let tx = connection.transaction().map_err(|e| e.to_string())?;
    let order_id = new_id("ord");
    let number = next_number(&tx, "orders").map_err(|e| e.to_string())?;
    let created_at = now_iso();
    let name = customer_name(&tx, &payload.customer_id).map_err(|e| e.to_string())?;
    let mut total = 0.0;
    let mut items = Vec::new();
    for item in &payload.items {
        let product = tx.query_row("SELECT name, COALESCE(promo_price, price) FROM products WHERE id=?1 AND status='ativo'", params![item.product_id], |row| Ok((row.get::<_, String>(0)?, row.get::<_, f64>(1)?))).optional().map_err(|e| e.to_string())?.ok_or_else(|| "Produto não encontrado".to_string())?;
        let line_total = product.1 * item.qty;
        total += line_total;
        items.push((item.product_id.clone(), product.0, item.qty, product.1, line_total));
    }
    tx.execute("INSERT INTO orders(id,number,request_id,customer_id,customer_name,total,status,created_at,updated_at) VALUES(?1,?2,?3,?4,?5,?6,'aberto',?7,?7)", params![order_id, number, payload.request_id, payload.customer_id, name, total, created_at]).map_err(|e| e.to_string())?;
    for item in items {
        tx.execute("INSERT INTO order_items(id,order_id,product_id,product_name,qty,unit_price,total,created_at) VALUES(?1,?2,?3,?4,?5,?6,?7,?8)", params![new_id("oit"), order_id, item.0, item.1, item.2, item.3, item.4, created_at]).map_err(|e| e.to_string())?;
    }
    audit(&tx, "order", &order_id, "create", &format!("Pedido #{} criado", number)).map_err(|e| e.to_string())?;
    tx.commit().map_err(|e| e.to_string())?;
    order_summary_by_id(&connection, &order_id)
}

#[tauri::command]
fn set_order_status(app: AppHandle, order_id: String, status: String) -> CmdResult<OrderSummary> {
    let mut connection = conn(&app)?;
    init_schema(&connection)?;
    set_order_status_inner(&mut connection, &order_id, &status)
}

#[tauri::command]
fn cancel_order(app: AppHandle, order_id: String, reason: String) -> CmdResult<OrderSummary> {
    let mut connection = conn(&app)?;
    init_schema(&connection)?;
    let tx = connection.transaction().map_err(|e| e.to_string())?;
    let current_status: String = tx.query_row("SELECT status FROM orders WHERE id=?1", params![order_id.clone()], |row| row.get(0)).optional().map_err(|e| e.to_string())?.ok_or_else(|| "Pedido não encontrado".to_string())?;
    if current_status == "cancelado" {
        return order_summary_by_id(&tx, &order_id);
    }
    if current_status == "entregue" {
        return Err("Pedido entregue não pode ser cancelado. Use ajuste de estoque ou nova venda para corrigir.".to_string());
    }
    let now = now_iso();
    tx.execute("UPDATE orders SET status='cancelado', updated_at=?1 WHERE id=?2", params![now, order_id.clone()]).map_err(|e| e.to_string())?;
    audit(&tx, "order", &order_id, "cancel", &reason).map_err(|e| e.to_string())?;
    tx.commit().map_err(|e| e.to_string())?;
    order_summary_by_id(&connection, &order_id)
}


fn cash_summary_inner(connection: &Connection) -> CmdResult<CashSummary> {
    let day = today();
    let open_cash = connection.query_row(
        "SELECT id,opened_at,closed_at,opening_amount,closing_amount,status,notes FROM cash_closings WHERE status='aberto' ORDER BY opened_at DESC LIMIT 1",
        [],
        |row| Ok(CashClosingRow { id: row.get(0)?, opened_at: row.get(1)?, closed_at: row.get(2)?, opening_amount: row.get(3)?, closing_amount: row.get(4)?, status: row.get(5)?, notes: row.get(6)? })
    ).optional().map_err(|e| e.to_string())?;
    let today_in: f64 = connection.query_row("SELECT COALESCE(SUM(amount),0) FROM cash_movements WHERE type='entrada' AND substr(created_at,1,10)=?1", params![day], |row| row.get(0)).map_err(|e| e.to_string())?;
    let today_out: f64 = connection.query_row("SELECT COALESCE(SUM(amount),0) FROM cash_movements WHERE type='saida' AND substr(created_at,1,10)=?1", params![day], |row| row.get(0)).map_err(|e| e.to_string())?;
    let opening = open_cash.as_ref().map(|row| row.opening_amount).unwrap_or(0.0);
    let mut stmt = connection.prepare("SELECT id,type,method,amount,reason,created_at FROM cash_movements WHERE substr(created_at,1,10)=?1 ORDER BY created_at DESC LIMIT 100").map_err(|e| e.to_string())?;
    let movements = stmt.query_map(params![day], |row| Ok(CashMovementRow { id: row.get(0)?, r#type: row.get(1)?, method: row.get(2)?, amount: row.get(3)?, reason: row.get(4)?, created_at: row.get(5)? })).map_err(|e| e.to_string())?.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())?;
    Ok(CashSummary { open_cash, today_in, today_out, expected_total: opening + today_in - today_out, movements })
}

#[tauri::command]
fn get_cash_summary(app: AppHandle) -> CmdResult<CashSummary> {
    let connection = conn(&app)?;
    init_schema(&connection)?;
    cash_summary_inner(&connection)
}

#[tauri::command]
fn open_cash(app: AppHandle, opening_amount: f64, notes: String) -> CmdResult<CashSummary> {
    if opening_amount < 0.0 { return Err("Valor inicial não pode ser negativo".to_string()); }
    let connection = conn(&app)?;
    init_schema(&connection)?;
    let already: Option<String> = connection.query_row("SELECT id FROM cash_closings WHERE status='aberto' LIMIT 1", [], |row| row.get(0)).optional().map_err(|e| e.to_string())?;
    if already.is_some() { return Err("Já existe um caixa aberto".to_string()); }
    let id = new_id("csh");
    let now = now_iso();
    connection.execute("INSERT INTO cash_closings(id,opened_at,opening_amount,status,notes) VALUES(?1,?2,?3,'aberto',?4)", params![id, now, opening_amount, notes]).map_err(|e| e.to_string())?;
    audit(&connection, "cash", &id, "open", &format!("Caixa aberto com R$ {:.2}", opening_amount)).map_err(|e| e.to_string())?;
    cash_summary_inner(&connection)
}

#[tauri::command]
fn close_cash(app: AppHandle, closing_amount: f64, notes: String) -> CmdResult<CashSummary> {
    if closing_amount < 0.0 { return Err("Valor contado não pode ser negativo".to_string()); }
    let connection = conn(&app)?;
    init_schema(&connection)?;
    let open_id: String = connection.query_row("SELECT id FROM cash_closings WHERE status='aberto' ORDER BY opened_at DESC LIMIT 1", [], |row| row.get(0)).map_err(|_| "Nenhum caixa aberto para fechar".to_string())?;
    let now = now_iso();
    connection.execute("UPDATE cash_closings SET closed_at=?1, closing_amount=?2, status='fechado', notes=?3 WHERE id=?4", params![now, closing_amount, notes, open_id]).map_err(|e| e.to_string())?;
    audit(&connection, "cash", &open_id, "close", &format!("Caixa fechado com R$ {:.2}", closing_amount)).map_err(|e| e.to_string())?;
    cash_summary_inner(&connection)
}

#[tauri::command]
fn add_cash_movement(app: AppHandle, movement_type: String, method: String, amount: f64, reason: String) -> CmdResult<CashSummary> {
    let connection = conn(&app)?;
    init_schema(&connection)?;
    add_cash_movement_inner(&connection, &movement_type, &method, amount, &reason)
}

fn add_cash_movement_inner(connection: &Connection, movement_type: &str, method: &str, amount: f64, reason: &str) -> CmdResult<CashSummary> {
    let clean_type = clean(Some(movement_type.to_string())).to_lowercase();
    if clean_type != "entrada" && clean_type != "saida" {
        return Err("Tipo de movimento inválido".to_string());
    }
    if amount <= 0.0 {
        return Err("Valor do movimento deve ser maior que zero".to_string());
    }
    let clean_reason = clean(Some(reason.to_string()));
    if clean_reason.is_empty() {
        return Err("Motivo é obrigatório".to_string());
    }

    let now = now_iso();
    let movement_id = new_id("cash");
    connection.execute(
        "INSERT INTO cash_movements(id,request_id,type,method,amount,reason,created_at) VALUES(?1,?2,?3,?4,?5,?6,?7)",
        params![movement_id.clone(), new_id("cashreq"), clean_type, clean(Some(method.to_string())), amount, clean_reason, now],
    ).map_err(|e| e.to_string())?;
    audit(&connection, "cash", &movement_id, "manual_movement", &format!("Movimento manual lançado: R$ {:.2}", amount)).map_err(|e| e.to_string())?;
    cash_summary_inner(&connection)
}

#[tauri::command]
fn list_receipts(app: AppHandle) -> CmdResult<Vec<ReceiptSummary>> {
    let connection = conn(&app)?;
    init_schema(&connection)?;
    let mut stmt = connection.prepare(
        "SELECT r.id,r.sale_id,COALESCE(s.number,0),COALESCE(s.customer_name,'Balcao'),COALESCE(c.whatsapp,''),r.receipt_type,r.total,
                CASE
                    WHEN COALESCE(s.payment_method,'')='crediario' THEN COALESCE(cr.status, s.status, '')
                    ELSE COALESCE(s.status, '')
                END,
                r.created_at,r.content
         FROM receipts r
         LEFT JOIN sales s ON s.id=r.sale_id
         LEFT JOIN customers c ON c.id=s.customer_id
         LEFT JOIN credits cr ON cr.sale_id=s.id
         ORDER BY r.created_at DESC
         LIMIT 100"
    ).map_err(|e| e.to_string())?;

    let rows = stmt.query_map([], |row| {
        Ok((
            row.get::<_, String>(0)?,
            row.get::<_, String>(1)?,
            row.get::<_, i64>(2)?,
            row.get::<_, String>(3)?,
            row.get::<_, String>(4)?,
            row.get::<_, String>(5)?,
            row.get::<_, f64>(6)?,
            row.get::<_, String>(7)?,
            row.get::<_, String>(8)?,
            row.get::<_, String>(9)?,
        ))
    }).map_err(|e| e.to_string())?;

    let raw = rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())?;
    drop(stmt);

    let mut result = Vec::with_capacity(raw.len());
    for (id, sale_id, sale_number, customer_name, customer_whatsapp, receipt_type, total, status, created_at, stored_content) in raw {
        let content = build_receipt(&connection, &sale_id).unwrap_or(stored_content);
        result.push(ReceiptSummary {
            id,
            sale_id,
            sale_number,
            customer_name,
            customer_whatsapp,
            receipt_type,
            total,
            status,
            created_at,
            content,
        });
    }
    Ok(result)
}

#[tauri::command]
fn export_html_pdf(app: AppHandle, html: String, file_stem: String, open_after: bool, destination_dir: Option<String>) -> CmdResult<String> {
    let reports = export_dir(&app, destination_dir)?;
    let stem = {
        let value = safe_file_stem(&file_stem);
        if value.is_empty() { format!("documento-{}", Local::now().format("%Y%m%d-%H%M%S")) } else { value }
    };
    let html_path = reports.join(format!("{}.html", stem));
    let pdf_path = reports.join(format!("{}.pdf", stem));
    fs::write(&html_path, html).map_err(|e| format!("Falha ao salvar HTML temporário: {e}"))?;

    let edge = edge_binary().ok_or_else(|| "Microsoft Edge não encontrado para gerar PDF".to_string())?;
    let status = Command::new(edge)
        .arg("--headless=new")
        .arg("--disable-gpu")
        .arg("--no-pdf-header-footer")
        .arg("--print-to-pdf-no-header")
        .arg(format!("--print-to-pdf={}", pdf_path.display()))
        .arg(file_uri(&html_path))
        .status()
        .map_err(|e| format!("Falha ao executar Edge para PDF: {e}"))?;
    if !status.success() {
        return Err("Não foi possível gerar o PDF do comprovante".to_string());
    }
    if open_after {
        open_external_target(&pdf_path.display().to_string())?;
    }
    Ok(pdf_path.display().to_string())
}

#[tauri::command]
fn open_external_url(url: String) -> CmdResult<()> {
    open_external_target(&url)
}

#[tauri::command]
fn reveal_file(path: String) -> CmdResult<()> {
    Command::new("explorer")
        .arg(format!("/select,{}", path))
        .spawn()
        .map_err(|e| format!("Falha ao abrir pasta do arquivo: {e}"))?;
    Ok(())
}


fn decode_base64_data(input: &str) -> CmdResult<Vec<u8>> {
    fn value(byte: u8) -> Option<u8> {
        match byte {
            b'A'..=b'Z' => Some(byte - b'A'),
            b'a'..=b'z' => Some(byte - b'a' + 26),
            b'0'..=b'9' => Some(byte - b'0' + 52),
            b'+' => Some(62),
            b'/' => Some(63),
            _ => None,
        }
    }

    let clean: Vec<u8> = input.bytes().filter(|b| !b.is_ascii_whitespace()).collect();
    if clean.is_empty() { return Err("Imagem sem dados para salvar".to_string()); }

    let mut output = Vec::with_capacity(clean.len() * 3 / 4);
    let mut chunk = [0u8; 4];
    let mut chunk_len = 0usize;
    let mut padding = 0usize;

    for byte in clean {
        if byte == b'=' {
            chunk[chunk_len] = 0;
            chunk_len += 1;
            padding += 1;
        } else if let Some(v) = value(byte) {
            chunk[chunk_len] = v;
            chunk_len += 1;
        } else {
            return Err("Imagem em base64 inválida".to_string());
        }

        if chunk_len == 4 {
            output.push((chunk[0] << 2) | (chunk[1] >> 4));
            if padding < 2 { output.push((chunk[1] << 4) | (chunk[2] >> 2)); }
            if padding < 1 { output.push((chunk[2] << 6) | chunk[3]); }
            chunk_len = 0;
            padding = 0;
        }
    }

    if chunk_len != 0 {
        return Err("Imagem em base64 incompleta".to_string());
    }
    Ok(output)
}

fn image_extension_from_data_url(value: &str) -> &'static str {
    if value.starts_with("data:image/png") { "png" }
    else if value.starts_with("data:image/webp") { "webp" }
    else if value.starts_with("data:image/jpeg") || value.starts_with("data:image/jpg") { "jpg" }
    else { "jpg" }
}

#[tauri::command]
fn save_product_image(app: AppHandle, image_data: String, file_stem: String, open_after: bool) -> CmdResult<String> {
    if !image_data.starts_with("data:image/") {
        return Err("Foto do produto inválida. Cadastre uma imagem PNG, JPG ou WEBP.".to_string());
    }
    let comma = image_data.find(',').ok_or_else(|| "Foto do produto sem conteúdo base64".to_string())?;
    let header = &image_data[..comma];
    if !header.contains(";base64") {
        return Err("Foto do produto precisa estar em base64".to_string());
    }
    let raw = decode_base64_data(&image_data[comma + 1..])?;
    let ext = image_extension_from_data_url(&image_data);
    let name = safe_file_stem(&file_stem);
    let stem = if name.is_empty() { format!("produto-{}", Local::now().format("%Y%m%d-%H%M%S")) } else { name };
    let photos_dir = report_dir(&app)?.join("produtos-fotos");
    fs::create_dir_all(&photos_dir).map_err(|e| format!("Falha ao criar pasta de fotos: {e}"))?;
    let path = photos_dir.join(format!("{}.{}", stem.trim_end_matches(&format!(".{ext}")), ext));
    fs::write(&path, raw).map_err(|e| format!("Falha ao salvar foto do produto: {e}"))?;
    if open_after {
        let _ = reveal_file(path.display().to_string());
    }
    Ok(path.display().to_string())
}

#[tauri::command]
fn create_backup(app: AppHandle) -> CmdResult<BackupInfo> {
    create_backup_package(&app, None, "Backup manual completo criado")
}

#[tauri::command]
fn create_backup_to(app: AppHandle, destination_dir: String) -> CmdResult<BackupInfo> {
    let destination = PathBuf::from(destination_dir.trim());
    if destination.as_os_str().is_empty() {
        return Err("Pasta de destino inválida".to_string());
    }
    create_backup_package(&app, Some(destination), "Backup completo salvo em pasta escolhida")
}

#[tauri::command]
fn exit_app(app: AppHandle) -> CmdResult<()> {
    app.exit(0);
    Ok(())
}

#[tauri::command]
fn list_backups(app: AppHandle) -> CmdResult<Vec<BackupInfo>> {
    let connection = conn(&app)?;
    init_schema(&connection)?;
    let mut stmt = connection.prepare("SELECT id,file_name,file_path,size_bytes,integrity_ok,created_at FROM backups_log ORDER BY created_at DESC").map_err(|e| e.to_string())?;
    let rows = stmt.query_map([], |row| Ok(BackupInfo { id: row.get(0)?, file_name: row.get(1)?, file_path: row.get(2)?, size_bytes: row.get::<_, i64>(3)? as u64, integrity_ok: row.get::<_, i64>(4)? == 1, created_at: row.get(5)? })).map_err(|e| e.to_string())?;
    let result = rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())?;
    Ok(result)
}


#[tauri::command]
fn restore_backup(app: AppHandle, backup_id: String, confirmation: String) -> CmdResult<AppStatus> {
    if confirmation != "RESTAURAR" { return Err("Confirmação inválida. Restauração cancelada.".to_string()); }
    let backup_path = {
        let connection = conn(&app)?;
        init_schema(&connection)?;
        let path: String = connection.query_row("SELECT file_path FROM backups_log WHERE id=?1 AND integrity_ok=1", params![backup_id], |row| row.get(0)).map_err(|_| "Backup válido não encontrado".to_string())?;
        let check = Connection::open(&path).and_then(|c| c.query_row("PRAGMA integrity_check", [], |row| row.get::<_, String>(0))).map_err(|e| format!("Falha ao validar backup: {e}"))?;
        if check != "ok" { return Err("Backup não passou no integrity_check".to_string()); }
        path
    };
    let safety = create_backup(app.clone())?;
    let target = db_file(&app)?;
    fs::copy(&backup_path, &target).map_err(|e| format!("Falha ao restaurar backup: {e}"))?;
    let connection = conn(&app)?;
    init_schema(&connection)?;
    audit(&connection, "backup", &backup_id, "restore", &format!("Backup restaurado. Cópia de segurança anterior: {}", safety.file_name)).map_err(|e| e.to_string())?;
    boot(app)
}

#[tauri::command]
fn restore_backup_external(app: AppHandle, backup_path: String, confirmation: String) -> CmdResult<AppStatus> {
    let path = PathBuf::from(backup_path.trim());
    if path.as_os_str().is_empty() {
        return Err("Arquivo de backup externo inválido".to_string());
    }
    restore_backup_from_path(&app, &path, &confirmation)
}

#[tauri::command]
fn pick_backup_folder() -> CmdResult<Option<String>> {
    run_powershell_dialog(r#"
Add-Type -AssemblyName System.Windows.Forms
$dialog = New-Object System.Windows.Forms.FolderBrowserDialog
$dialog.Description = 'Escolha a pasta onde o backup completo será salvo'
if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {
  [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
  Write-Output $dialog.SelectedPath
}
"#)
}

#[tauri::command]
fn pick_export_folder() -> CmdResult<Option<String>> {
    run_powershell_dialog(r#"
Add-Type -AssemblyName System.Windows.Forms
$dialog = New-Object System.Windows.Forms.FolderBrowserDialog
$dialog.Description = 'Escolha a pasta onde os comprovantes e PDFs serÃ£o salvos'
if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {
  [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
  Write-Output $dialog.SelectedPath
}
"#)
}

#[tauri::command]
fn pick_restore_backup_file() -> CmdResult<Option<String>> {
    run_powershell_dialog(r#"
Add-Type -AssemblyName System.Windows.Forms
$dialog = New-Object System.Windows.Forms.OpenFileDialog
$dialog.Title = 'Selecione o backup para restaurar'
$dialog.Filter = 'Backups Smart Loja|backup-manifest.json;*.sqlite3|Manifesto de backup|backup-manifest.json|Backup SQLite legado|*.sqlite3|Arquivos JSON|*.json|Todos os arquivos|*.*'
$dialog.Multiselect = $false
if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {
  [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
  Write-Output $dialog.FileName
}
"#)
}

#[tauri::command]
fn get_report_data(app: AppHandle, report: String, from: String, to: String) -> CmdResult<ReportData> {
    let connection = conn(&app)?;
    init_schema(&connection)?;
    let from_date = NaiveDate::parse_from_str(&from, "%Y-%m-%d").map_err(|_| "Data inicial inválida".to_string())?;
    let to_date = NaiveDate::parse_from_str(&to, "%Y-%m-%d").map_err(|_| "Data final inválida".to_string())?;
    if from_date > to_date {
        return Err("A data inicial não pode ser maior que a data final".to_string());
    }

    let generated_at = now_iso();
    match report.as_str() {
        "vendas" => {
            let mut rows = Vec::<BTreeMap<String, String>>::new();
            let mut sales_total = 0.0_f64;
            let mut finalizadas = 0_i64;
            let mut stmt = connection
                .prepare("SELECT number,customer_name,payment_method,total,status,created_at FROM sales WHERE substr(created_at,1,10) BETWEEN ?1 AND ?2 ORDER BY number DESC")
                .map_err(|e| e.to_string())?;
            let raw = stmt
                .query_map(params![from, to], |row| {
                    Ok((
                        row.get::<_, i64>(0)?,
                        row.get::<_, String>(1)?,
                        row.get::<_, String>(2)?,
                        row.get::<_, f64>(3)?,
                        row.get::<_, String>(4)?,
                        row.get::<_, String>(5)?,
                    ))
                })
                .map_err(|e| e.to_string())?
                .collect::<Result<Vec<_>, _>>()
                .map_err(|e| e.to_string())?;
            for (number, customer_name, payment_method, total, status, created_at) in raw {
                if status == "finalizada" {
                    finalizadas += 1;
                }
                sales_total += total;
                let mut row = BTreeMap::new();
                row.insert("numero".to_string(), format!("#{}", number));
                row.insert("cliente".to_string(), if customer_name.trim().is_empty() { "Balcão".to_string() } else { customer_name });
                row.insert("forma".to_string(), payment_method);
                row.insert("total".to_string(), format_money_br(total));
                row.insert("status".to_string(), status);
                row.insert("data".to_string(), format_date_time_br(&created_at));
                rows.push(row);
            }
            let average = if rows.is_empty() { 0.0 } else { sales_total / rows.len() as f64 };
            Ok(ReportData {
                report,
                title: "Vendas por período".to_string(),
                description: "Todas as vendas do intervalo com conferência de cliente, forma, valor e status.".to_string(),
                empty_message: "Nenhuma venda encontrada nesse período.".to_string(),
                generated_at,
                total_rows: rows.len(),
                summary: vec![
                    report_metric("Vendas no período", rows.len().to_string(), format!("{} finalizadas", finalizadas), "blue"),
                    report_metric("Faturamento", format_money_br(sales_total), "Soma de todas as vendas listadas".to_string(), "green"),
                    report_metric("Ticket médio", format_money_br(average), "Média por venda no período".to_string(), "purple"),
                ],
                columns: vec![
                    report_column("numero", "Venda", None),
                    report_column("cliente", "Cliente", None),
                    report_column("forma", "Forma", None),
                    report_column("total", "Total", Some("right")),
                    report_column("status", "Status", None),
                    report_column("data", "Data", None),
                ],
                rows,
            })
        }
        "caixa" => {
            let mut rows = Vec::<BTreeMap<String, String>>::new();
            let mut entradas = 0.0_f64;
            let mut saidas = 0.0_f64;
            let mut stmt = connection
                .prepare("SELECT type,method,amount,reason,created_at FROM cash_movements WHERE substr(created_at,1,10) BETWEEN ?1 AND ?2 ORDER BY created_at DESC")
                .map_err(|e| e.to_string())?;
            let raw = stmt
                .query_map(params![from, to], |row| {
                    Ok((
                        row.get::<_, String>(0)?,
                        row.get::<_, String>(1)?,
                        row.get::<_, f64>(2)?,
                        row.get::<_, String>(3)?,
                        row.get::<_, String>(4)?,
                    ))
                })
                .map_err(|e| e.to_string())?
                .collect::<Result<Vec<_>, _>>()
                .map_err(|e| e.to_string())?;
            for (movement_type, method, amount, reason, created_at) in raw {
                if movement_type == "entrada" { entradas += amount; } else { saidas += amount; }
                let mut row = BTreeMap::new();
                row.insert("tipo".to_string(), movement_type);
                row.insert("metodo".to_string(), method);
                row.insert("valor".to_string(), format_money_br(amount));
                row.insert("motivo".to_string(), if reason.trim().is_empty() { "-".to_string() } else { reason });
                row.insert("data".to_string(), format_date_time_br(&created_at));
                rows.push(row);
            }
            Ok(ReportData {
                report,
                title: "Caixa por período".to_string(),
                description: "Entradas e saídas do caixa para conferência financeira no próprio sistema.".to_string(),
                empty_message: "Nenhum movimento de caixa encontrado nesse período.".to_string(),
                generated_at,
                total_rows: rows.len(),
                summary: vec![
                    report_metric("Entradas", format_money_br(entradas), "Valores lançados como entrada".to_string(), "green"),
                    report_metric("Saídas", format_money_br(saidas), "Valores lançados como saída".to_string(), "pink"),
                    report_metric("Saldo do período", format_money_br(entradas - saidas), "Entradas menos saídas".to_string(), "blue"),
                ],
                columns: vec![
                    report_column("tipo", "Tipo", None),
                    report_column("metodo", "Método", None),
                    report_column("valor", "Valor", Some("right")),
                    report_column("motivo", "Motivo", None),
                    report_column("data", "Data", None),
                ],
                rows,
            })
        }
        "crediario" => {
            let mut rows = Vec::<BTreeMap<String, String>>::new();
            let mut saldo_total = 0.0_f64;
            let mut stmt = connection
                .prepare(
                    "SELECT c.customer_name,
                            COALESCE((SELECT number FROM sales WHERE id=c.sale_id), 0),
                            c.total,
                            c.balance,
                            c.status,
                            c.created_at
                     FROM credits c
                     WHERE c.status='aberto' AND substr(c.created_at,1,10) BETWEEN ?1 AND ?2
                     ORDER BY c.created_at DESC"
                )
                .map_err(|e| e.to_string())?;
            let raw = stmt
                .query_map(params![from, to], |row| {
                    Ok((
                        row.get::<_, String>(0)?,
                        row.get::<_, i64>(1)?,
                        row.get::<_, f64>(2)?,
                        row.get::<_, f64>(3)?,
                        row.get::<_, String>(4)?,
                        row.get::<_, String>(5)?,
                    ))
                })
                .map_err(|e| e.to_string())?
                .collect::<Result<Vec<_>, _>>()
                .map_err(|e| e.to_string())?;
            for (customer_name, sale_number, total, balance, status, created_at) in raw {
                saldo_total += balance;
                let mut row = BTreeMap::new();
                row.insert("cliente".to_string(), customer_name);
                row.insert("venda".to_string(), if sale_number > 0 { format!("#{}", sale_number) } else { "-".to_string() });
                row.insert("total".to_string(), format_money_br(total));
                row.insert("saldo".to_string(), format_money_br(balance));
                row.insert("status".to_string(), status);
                row.insert("data".to_string(), format_date_time_br(&created_at));
                rows.push(row);
            }
            let overdue_count: i64 = connection
                .query_row(
                    "SELECT COUNT(*)
                     FROM credit_installments ci
                     INNER JOIN credits c ON c.id=ci.credit_id
                     WHERE c.status='aberto'
                       AND ci.status!='pago'
                       AND date(ci.due_date) < date('now', 'localtime')
                       AND substr(c.created_at,1,10) BETWEEN ?1 AND ?2",
                    params![from, to],
                    |row| row.get(0),
                )
                .map_err(|e| e.to_string())?;
            Ok(ReportData {
                report,
                title: "Crediário em aberto".to_string(),
                description: "Lista de contas abertas com saldo pendente para cobrança e acompanhamento.".to_string(),
                empty_message: "Nenhuma conta em aberto encontrada nesse período.".to_string(),
                generated_at,
                total_rows: rows.len(),
                summary: vec![
                    report_metric("Contas abertas", rows.len().to_string(), "Clientes com crediário ainda pendente".to_string(), "pink"),
                    report_metric("Saldo em aberto", format_money_br(saldo_total), "Total ainda a receber".to_string(), "green"),
                    report_metric("Parcelas vencidas", overdue_count.to_string(), "Parcelas em atraso até hoje".to_string(), "orange"),
                ],
                columns: vec![
                    report_column("cliente", "Cliente", None),
                    report_column("venda", "Venda", None),
                    report_column("total", "Total", Some("right")),
                    report_column("saldo", "Saldo", Some("right")),
                    report_column("status", "Status", None),
                    report_column("data", "Criado em", None),
                ],
                rows,
            })
        }
        "estoque_baixo" => {
            let limit = get_setting(&connection, "low_stock_limit", "3").map_err(|e| e.to_string())?.parse::<i64>().unwrap_or(3);
            let mut rows = Vec::<BTreeMap<String, String>>::new();
            let mut zerados = 0_i64;
            let mut stmt = connection
                .prepare("SELECT name,category,stock,price,status FROM products WHERE stock<=?1 ORDER BY stock ASC, name ASC")
                .map_err(|e| e.to_string())?;
            let raw = stmt
                .query_map(params![limit], |row| {
                    Ok((
                        row.get::<_, String>(0)?,
                        row.get::<_, String>(1)?,
                        row.get::<_, i64>(2)?,
                        row.get::<_, f64>(3)?,
                        row.get::<_, String>(4)?,
                    ))
                })
                .map_err(|e| e.to_string())?
                .collect::<Result<Vec<_>, _>>()
                .map_err(|e| e.to_string())?;
            for (name, category, stock, price, status) in raw {
                if stock <= 0 { zerados += 1; }
                let mut row = BTreeMap::new();
                row.insert("produto".to_string(), name);
                row.insert("categoria".to_string(), if category.trim().is_empty() { "-".to_string() } else { category });
                row.insert("estoque".to_string(), stock.to_string());
                row.insert("preco".to_string(), format_money_br(price));
                row.insert("status".to_string(), status);
                rows.push(row);
            }
            Ok(ReportData {
                report,
                title: "Estoque baixo".to_string(),
                description: "Produtos abaixo do limite configurado para reposição mais rápida.".to_string(),
                empty_message: "Nenhum produto com estoque baixo no momento.".to_string(),
                generated_at,
                total_rows: rows.len(),
                summary: vec![
                    report_metric("Produtos críticos", rows.len().to_string(), format!("Abaixo do limite de {}", limit), "orange"),
                    report_metric("Sem estoque", zerados.to_string(), "Produtos zerados no momento".to_string(), "pink"),
                    report_metric("Limite atual", limit.to_string(), "Valor definido nas configurações".to_string(), "blue"),
                ],
                columns: vec![
                    report_column("produto", "Produto", None),
                    report_column("categoria", "Categoria", None),
                    report_column("estoque", "Estoque", Some("right")),
                    report_column("preco", "Preço", Some("right")),
                    report_column("status", "Status", None),
                ],
                rows,
            })
        }
        _ => Err("Relatório inválido".to_string()),
    }
}

#[tauri::command]
fn export_report_csv(app: AppHandle, report: String, from: String, to: String) -> CmdResult<String> {
    let connection = conn(&app)?;
    init_schema(&connection)?;
    let from_date = NaiveDate::parse_from_str(&from, "%Y-%m-%d").map_err(|_| "Data inicial inválida".to_string())?;
    let to_date = NaiveDate::parse_from_str(&to, "%Y-%m-%d").map_err(|_| "Data final inválida".to_string())?;
    if from_date > to_date {
        return Err("A data inicial não pode ser maior que a data final".to_string());
    }
    let mut csv = String::new();
    match report.as_str() {
        "vendas" => {
            csv.push_str("numero,cliente,forma,total,data\n");
            let mut stmt = connection.prepare("SELECT number,customer_name,payment_method,total,created_at FROM sales WHERE substr(created_at,1,10) BETWEEN ?1 AND ?2 ORDER BY number").map_err(|e| e.to_string())?;
            let rows = stmt.query_map(params![from, to], |row| Ok(format!("{},{},{},{:.2},{}\n", row.get::<_, i64>(0)?, row.get::<_, String>(1)?, row.get::<_, String>(2)?, row.get::<_, f64>(3)?, row.get::<_, String>(4)?))).map_err(|e| e.to_string())?.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())?;
            csv.push_str(&rows.concat());
        }
        "caixa" => {
            csv.push_str("tipo,metodo,valor,motivo,data\n");
            let mut stmt = connection.prepare("SELECT type,method,amount,reason,created_at FROM cash_movements WHERE substr(created_at,1,10) BETWEEN ?1 AND ?2 ORDER BY created_at").map_err(|e| e.to_string())?;
            let rows = stmt.query_map(params![from, to], |row| Ok(format!("{},{},{:.2},{},{}\n", row.get::<_, String>(0)?, row.get::<_, String>(1)?, row.get::<_, f64>(2)?, row.get::<_, String>(3)?, row.get::<_, String>(4)?))).map_err(|e| e.to_string())?.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())?;
            csv.push_str(&rows.concat());
        }
        "crediario" => {
            csv.push_str("cliente,total,saldo,status,data\n");
            let mut stmt = connection.prepare("SELECT customer_name,total,balance,status,created_at FROM credits WHERE status='aberto' AND substr(created_at,1,10) BETWEEN ?1 AND ?2 ORDER BY created_at").map_err(|e| e.to_string())?;
            let rows = stmt.query_map(params![from, to], |row| Ok(format!("{},{:.2},{:.2},{},{}\n", row.get::<_, String>(0)?, row.get::<_, f64>(1)?, row.get::<_, f64>(2)?, row.get::<_, String>(3)?, row.get::<_, String>(4)?))).map_err(|e| e.to_string())?.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())?;
            csv.push_str(&rows.concat());
        }
        "estoque_baixo" => {
            csv.push_str("produto,categoria,estoque,preco\n");
            let limit = get_setting(&connection, "low_stock_limit", "3").map_err(|e| e.to_string())?.parse::<i64>().unwrap_or(3);
            let mut stmt = connection.prepare("SELECT name,category,stock,price FROM products WHERE stock<=?1 ORDER BY stock ASC").map_err(|e| e.to_string())?;
            let rows = stmt.query_map(params![limit], |row| Ok(format!("{},{},{},{}\n", row.get::<_, String>(0)?, row.get::<_, String>(1)?, row.get::<_, i64>(2)?, row.get::<_, f64>(3)?))).map_err(|e| e.to_string())?.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())?;
            csv.push_str(&rows.concat());
        }
        _ => return Err("Relatório inválido".to_string()),
    }
    let file_name = format!("relatorio-{}-{}-{}.csv", report, from, to);
    let path = report_dir(&app)?.join(file_name);
    fs::write(&path, csv).map_err(|e| e.to_string())?;
    audit(&connection, "report", &report, "export_csv", &format!("Período {} até {}", from, to)).map_err(|e| e.to_string())?;
    Ok(path.display().to_string())
}

#[tauri::command]
fn list_audit(app: AppHandle) -> CmdResult<Vec<AuditEvent>> {
    let connection = conn(&app)?;
    init_schema(&connection)?;
    let mut stmt = connection.prepare("SELECT id,entity,entity_id,action,details,created_at FROM audit_log ORDER BY created_at DESC LIMIT 200").map_err(|e| e.to_string())?;
    let rows = stmt.query_map([], |row| Ok(AuditEvent { id: row.get(0)?, entity: row.get(1)?, entity_id: row.get(2)?, action: row.get(3)?, details: row.get(4)?, created_at: row.get(5)? })).map_err(|e| e.to_string())?;
    let result = rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())?;
    Ok(result)
}

#[tauri::command]
fn hash_admin_password(password: String) -> CmdResult<String> {
    if password.len() < 6 { return Err("Senha precisa ter no mínimo 6 caracteres".to_string()); }
    let mut hasher = Sha256::new();
    hasher.update(password.as_bytes());
    Ok(format!("{:x}", hasher.finalize()))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_connection() -> Connection {
        let connection = Connection::open_in_memory().expect("in-memory db");
        init_schema(&connection).expect("schema");
        connection
    }

    fn seed_product(connection: &Connection, id: &str, name: &str, stock: i64) {
        let now = now_iso();
        connection.execute(
            "INSERT INTO products(id,name,category,price,promo_price,stock,unit,size,color,barcode,image_data,status,created_at,updated_at) VALUES(?1,?2,'',10,NULL,?3,'un','','','','','ativo',?4,?4)",
            params![id, name, stock, now],
        ).expect("product");
    }

    fn seed_order(connection: &Connection, order_id: &str, product_id: &str, qty: f64, status: &str) {
        let now = now_iso();
        connection.execute(
            "INSERT INTO orders(id,number,request_id,customer_name,total,status,created_at,updated_at) VALUES(?1,1,?2,'Balcao',?3,?4,?5,?5)",
            params![order_id, format!("req-{}", order_id), qty * 10.0, status, now],
        ).expect("order");
        connection.execute(
            "INSERT INTO order_items(id,order_id,product_id,product_name,qty,unit_price,total,created_at) VALUES(?1,?2,?3,'Produto Teste',?4,10,?5,?6)",
            params![new_id("oit"), order_id, product_id, qty, qty * 10.0, now],
        ).expect("order item");
    }

    #[test]
    fn split_installments_preserves_total_in_cents() {
        let installments = split_installments(100.0, 3);
        assert_eq!(installments, vec![33.34, 33.33, 33.33]);
        assert_eq!(to_cents(installments.iter().sum()), 10_000);
    }

    #[test]
    fn split_installments_handles_small_values() {
        let installments = split_installments(10.01, 2);
        assert_eq!(installments, vec![5.01, 5.0]);
        assert_eq!(to_cents(installments.iter().sum()), 1_001);
    }

    #[test]
    fn credit_limit_blocks_over_limit_sale() {
        let connection = Connection::open_in_memory().expect("in-memory db");
        init_schema(&connection).expect("schema");
        let now = now_iso();
        connection.execute("INSERT INTO customers(id,name,credit_limit,status,created_at,updated_at) VALUES(?1,?2,?3,'ativo',?4,?4)", params!["cus-1", "Maria", 100.0_f64, now]).expect("customer");
        connection.execute("INSERT INTO credits(id,customer_id,customer_name,sale_id,total,balance,status,created_at,updated_at) VALUES(?1,?2,?3,'sale-1',?4,?5,'aberto',?6,?6)", params!["cred-1", "cus-1", "Maria", 60.0_f64, 60.0_f64, now]).expect("credit");

        let result = ensure_credit_limit(&connection, "cus-1", 50.0);

        assert!(result.is_err());
    }

    #[test]
    fn credit_limit_allows_sale_within_limit() {
        let connection = test_connection();
        let now = now_iso();
        connection.execute("INSERT INTO customers(id,name,credit_limit,status,created_at,updated_at) VALUES(?1,?2,?3,'ativo',?4,?4)", params!["cus-1", "Maria", 100.0_f64, now]).expect("customer");
        connection.execute("INSERT INTO credits(id,customer_id,customer_name,sale_id,total,balance,status,created_at,updated_at) VALUES(?1,?2,?3,'sale-1',?4,?5,'aberto',?6,?6)", params!["cred-1", "cus-1", "Maria", 40.0_f64, 40.0_f64, now]).expect("credit");

        let result = ensure_credit_limit(&connection, "cus-1", 50.0);

        assert!(result.is_ok());
    }

    #[test]
    fn set_order_status_delivered_lowers_stock_once_and_allows_reopen_from_separated() {
        let mut connection = test_connection();
        seed_product(&connection, "pro-1", "Camiseta", 5);
        seed_order(&connection, "ord-1", "pro-1", 2.0, "aberto");

        let separated = set_order_status_inner(&mut connection, "ord-1", "separado").expect("separate order");
        assert_eq!(separated.status, "separado");

        let reopened = set_order_status_inner(&mut connection, "ord-1", "aberto").expect("reopen order");
        assert_eq!(reopened.status, "aberto");

        let delivered = set_order_status_inner(&mut connection, "ord-1", "entregue").expect("deliver order");
        assert_eq!(delivered.status, "entregue");

        let stock: i64 = connection.query_row("SELECT stock FROM products WHERE id='pro-1'", [], |row| row.get(0)).expect("stock");
        assert_eq!(stock, 3);

        let movement_count: i64 = connection.query_row(
            "SELECT COUNT(*) FROM stock_movements WHERE reference_id='ord-1' AND type='saida_pedido'",
            [],
            |row| row.get(0),
        ).expect("movement count");
        assert_eq!(movement_count, 1);
    }

    #[test]
    fn add_cash_movement_updates_daily_summary() {
        let connection = test_connection();
        let summary = add_cash_movement_inner(&connection, "entrada", "pix", 25.0, "Sangria reversa").expect("cash movement");

        assert!((summary.today_in - 25.0).abs() < 0.001);
        assert_eq!(summary.today_out, 0.0);
        assert!(summary.movements.iter().any(|row| row.reason == "Sangria reversa" && row.method == "pix"));
    }

    #[test]
    fn credit_installment_payment_method_persists_in_sqlite() {
        let connection = test_connection();
        let now = now_iso();
        connection.execute(
            "INSERT INTO credits(id,customer_id,customer_name,sale_id,total,balance,status,created_at,updated_at) VALUES('cred-1',NULL,'Maria',NULL,50,50,'aberto',?1,?1)",
            params![now.clone()],
        ).expect("credit");
        connection.execute(
            "INSERT INTO credit_installments(id,credit_id,number,amount,paid_amount,due_date,status,payment_method,created_at,updated_at) VALUES('inst-1','cred-1',1,50,0,'2026-05-18','aberto',NULL,?1,?1)",
            params![now.clone()],
        ).expect("installment");
        connection.execute(
            "UPDATE credit_installments SET paid_amount=50,status='pago',payment_method='pix',paid_at=?1,updated_at=?1 WHERE id='inst-1'",
            params![now],
        ).expect("update installment");

        let saved_method: Option<String> = connection.query_row(
            "SELECT payment_method FROM credit_installments WHERE id='inst-1'",
            [],
            |row| row.get(0),
        ).expect("saved payment method");
        assert_eq!(saved_method.as_deref(), Some("pix"));
    }
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.maximize();
                let _ = window.set_focus();
            }
            let handle = app.handle().clone();
            let result: CmdResult<()> = (|| {
                let connection = conn(&handle)?;
                init_schema(&connection)?;
                Ok(())
            })();
            result.map_err(|err| Box::new(std::io::Error::new(std::io::ErrorKind::Other, err)) as Box<dyn std::error::Error>)
        })
        .invoke_handler(tauri::generate_handler![
            boot,
            get_dashboard,
            get_dashboard_sales_series,
            list_customers,
            upsert_customer,
            inactivate_customer,
            list_products,
            upsert_product,
            inactivate_product,
            adjust_stock,
            create_sale,
            list_sales,
            cancel_sale,
            get_cash_summary,
            open_cash,
            close_cash,
            add_cash_movement,
            list_credits,
            receive_installment,
            receive_installment_flex,
            list_orders,
            create_order,
            set_order_status,
            cancel_order,
            list_receipts,
            export_html_pdf,
            open_external_url,
            reveal_file,
            save_product_image,
            list_backups,
            create_backup,
            create_backup_to,
            exit_app,
            restore_backup,
            restore_backup_external,
            pick_backup_folder,
            pick_export_folder,
            pick_restore_backup_file,
            get_report_data,
            export_report_csv,
            get_settings,
            save_settings,
            list_audit,
            hash_admin_password
        ])
        .run(tauri::generate_context!())
        .expect("erro ao iniciar Smart Loja Fácil Offline");
}

//! Protocole d'autorité durable des sessions desktop (Politique B).
//!
//! Contrat d'autorité entre le trousseau OS et le fichier de registre :
//! - Un seul registre versionné dans `ItemFabricator/desktop-session.token` :
//!   `pending{generation}` | `secure{generation}` | `fallback{generation,token}` | `none{}`.
//! - Enveloppe trousseau (même service/utilisateur) : `{version:1,generation,token}`.
//! - Verrou interprocessus système sur `ItemFabricator/desktop-session.lock`.
//! - Remplacement atomique durable : temporaire protégée + sync + remplacement natif
//!   + synchronisation du répertoire (plateforme). Aucune fenêtre d'absence.
//! - Lecture d'autorité d'abord : fallback→son jeton ; secure→enveloppe OS de même
//!   génération ; none/pending→aucune session ; absent/corrompu→aucune restauration.
//! - Login : `pending` durable avant toute mutation OS ; commit `secure` si vérifié,
//!   sinon `fallback` ; publication mémoire seulement après le commit durable.
//! - Logout : mémoire vidée ; `none` durable AVANT toute suppression OS ; tombstone conservée.
//!
//! Le module est testable sans trousseau réel : le magasin de credentials est abstrait
//! par `CredentialStore` et les tests injectent un magasin synthétique.

use serde::{Deserialize, Serialize};
use std::error::Error;
use std::fmt;
use std::fs::{self, File, OpenOptions};
use std::io::{Read, Write};
#[cfg(unix)]
use std::os::fd::AsRawFd;
#[cfg(windows)]
use std::os::windows::io::AsRawHandle;
use std::path::{Path, PathBuf};

use getrandom;

const REGISTRY_VERSION: u8 = 1;
const GENERATION_BYTES: usize = 32;
const GENERATION_HEX_LEN: usize = 64;
const MAX_REGISTRY_BYTES: usize = 8 * 1024;
const MAX_ENVELOPE_BYTES: usize = 8 * 1024;
const MAX_TOKEN_BYTES: usize = 8 * 1024;
#[cfg(test)]
const REGISTRY_FILE_NAME: &str = "desktop-session.token";
#[cfg(test)]
const LOCK_FILE_NAME: &str = "desktop-session.lock";

// ---------------------------------------------------------------------------
// Erreurs
// ---------------------------------------------------------------------------

/// Erreurs du magasin de credentials (abstraction trousseau/synthétique).
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum StoreError {
    /// Construction du handle impossible : backend indisponible.
    Unavailable,
    /// Écriture dans le magasin refusée.
    WriteFailed,
    /// Lecture dans le magasin refusée.
    ReadFailed,
    /// Suppression dans le magasin refusée.
    DeleteFailed,
    /// Aucune entrée présente (succès pour une suppression).
    NoEntry,
    Other(String),
}

/// Erreurs du protocole d'autorité.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum AuthorityError {
    Store(StoreError),
    /// Registre absent, legacy, corrompu, version/champs incohérents (aucune restauration).
    Registry(String),
    /// Échec d'E/S sur le registre, le verrou ou un temporaire.
    Io(String),
    /// Garantie de durabilité/atomicité impossible (refus fermé).
    Unavailable(String),
    /// Résultat indéterminé après un remplacement non acquitté.
    Indeterminate(String),
}

impl fmt::Display for StoreError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            StoreError::Unavailable => write!(f, "credential store unavailable"),
            StoreError::WriteFailed => write!(f, "credential store write failed"),
            StoreError::ReadFailed => write!(f, "credential store read failed"),
            StoreError::DeleteFailed => write!(f, "credential store delete failed"),
            StoreError::NoEntry => write!(f, "no entry"),
            StoreError::Other(msg) => write!(f, "credential store: {msg}"),
        }
    }
}

impl fmt::Display for AuthorityError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            AuthorityError::Store(e) => write!(f, "{e}"),
            AuthorityError::Registry(msg) => write!(f, "registry: {msg}"),
            AuthorityError::Io(msg) => write!(f, "io: {msg}"),
            AuthorityError::Unavailable(msg) => write!(f, "unavailable: {msg}"),
            AuthorityError::Indeterminate(msg) => write!(f, "indeterminate: {msg}"),
        }
    }
}

impl Error for StoreError {}
impl Error for AuthorityError {}

impl From<std::io::Error> for AuthorityError {
    fn from(error: std::io::Error) -> Self {
        AuthorityError::Io(error.to_string())
    }
}

fn is_store_unavailable(error: &keyring::Error) -> bool {
    matches!(error, keyring::Error::NoDefaultStore)
}

// ---------------------------------------------------------------------------
// Abstraction du magasin de credentials
// ---------------------------------------------------------------------------

/// Source désignée par l'autorité comme faisant foi pour la session courante.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AuthSource {
    Secure,
    Fallback,
}

pub trait CredentialEntry: Send + Sync {
    fn set_password(&self, value: &str) -> Result<(), StoreError>;
    fn get_password(&self) -> Result<Option<String>, StoreError>;
    fn delete_credential(&self) -> Result<(), StoreError>;
}

pub trait CredentialStore: Send + Sync {
    type Entry: CredentialEntry;
    fn open(&self) -> Result<Self::Entry, StoreError>;
}

/// Implémentation production sur `keyring::Entry` (service `space.itemfab.desktop`,
/// utilisateur `desktop-session`). Jamais utilisée directement par les tests.
pub struct KeyringStore {
    service: String,
    user: String,
}

pub struct KeyringEntry(keyring::Entry);

impl KeyringStore {
    pub fn new(service: &str, user: &str) -> Self {
        Self {
            service: service.to_string(),
            user: user.to_string(),
        }
    }
}

impl CredentialStore for KeyringStore {
    type Entry = KeyringEntry;
    fn open(&self) -> Result<Self::Entry, StoreError> {
        keyring::Entry::new(&self.service, &self.user)
            .map(KeyringEntry)
            .map_err(|e| {
                if is_store_unavailable(&e) {
                    StoreError::Unavailable
                } else {
                    StoreError::Other(e.to_string())
                }
            })
    }
}

impl CredentialEntry for KeyringEntry {
    fn set_password(&self, value: &str) -> Result<(), StoreError> {
        self.0.set_password(value).map_err(|e| {
            if is_store_unavailable(&e) {
                StoreError::Unavailable
            } else {
                StoreError::WriteFailed
            }
        })
    }
    fn get_password(&self) -> Result<Option<String>, StoreError> {
        match self.0.get_password() {
            Ok(value) => Ok(Some(value)),
            Err(keyring::Error::NoEntry) => Ok(None),
            Err(e) => Err(if is_store_unavailable(&e) {
                StoreError::Unavailable
            } else {
                StoreError::ReadFailed
            }),
        }
    }
    fn delete_credential(&self) -> Result<(), StoreError> {
        match self.0.delete_credential() {
            Ok(()) => Ok(()),
            Err(keyring::Error::NoEntry) => Ok(()),
            Err(e) => Err(if is_store_unavailable(&e) {
                StoreError::Unavailable
            } else {
                StoreError::DeleteFailed
            }),
        }
    }
}

// ---------------------------------------------------------------------------
// Registre d'autorité (JSON versionné)
// ---------------------------------------------------------------------------

/// État d'autorité porté par le registre. Un seul jeton secret jamais : il ne
/// voyage en clair que dans la variante `fallback`.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Authority {
    Pending { generation: String },
    Secure { generation: String },
    Fallback { generation: String, token: String },
    None,
}

impl Authority {
    pub fn generation(&self) -> Option<String> {
        match self {
            Authority::Pending { generation }
            | Authority::Secure { generation }
            | Authority::Fallback { generation, .. } => Some(generation.clone()),
            Authority::None => None,
        }
    }
}

/// Enveloppe stockée dans le trousseau OS (même service/utilisateur).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct Envelope {
    version: u8,
    generation: String,
    token: String,
}

/// Représentation sérielle plate du registre (évite les pièges `flatten` + enum
/// taggé internement avec `deny_unknown_fields`).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct AuthorityFile {
    version: u8,
    state: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    generation: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    token: Option<String>,
}

impl AuthorityFile {
    fn from_authority(state: Authority) -> Self {
        let (state, generation, token) = match state {
            Authority::Pending { generation } => ("pending", Some(generation), None),
            Authority::Secure { generation } => ("secure", Some(generation), None),
            Authority::Fallback { generation, token } => {
                ("fallback", Some(generation), Some(token))
            }
            Authority::None => ("none", None, None),
        };
        Self {
            version: REGISTRY_VERSION,
            state: state.to_string(),
            generation,
            token,
        }
    }

    fn into_authority(self) -> Option<Authority> {
        if self.version != REGISTRY_VERSION {
            return None;
        }
        let valid_gen = |g: &str| {
            g.len() == GENERATION_HEX_LEN
                && g.bytes().all(|b| matches!(b, b'0'..=b'9' | b'a'..=b'f'))
        };
        match self.state.as_str() {
            "pending" => {
                let g = self.generation?;
                if !valid_gen(&g) {
                    return None;
                }
                Some(Authority::Pending { generation: g })
            }
            "secure" => {
                let g = self.generation?;
                if !valid_gen(&g) {
                    return None;
                }
                Some(Authority::Secure { generation: g })
            }
            "fallback" => {
                let g = self.generation?;
                let t = self.token?;
                if !valid_gen(&g) {
                    return None;
                }
                validate_token(&t).ok()?;
                Some(Authority::Fallback {
                    generation: g,
                    token: t,
                })
            }
            "none" => {
                if self.generation.is_some() || self.token.is_some() {
                    return None;
                }
                Some(Authority::None)
            }
            _ => None,
        }
    }
}

fn new_generation() -> Result<String, AuthorityError> {
    let mut bytes = [0u8; GENERATION_BYTES];
    getrandom::fill(&mut bytes)
        .map_err(|e| AuthorityError::Unavailable(format!("generation randomness: {e}")))?;
    Ok(hex_encode(&bytes))
}

fn hex_encode(bytes: &[u8]) -> String {
    let mut out = String::with_capacity(bytes.len() * 2);
    for byte in bytes {
        out.push_str(&format!("{byte:02x}"));
    }
    out
}

fn random_bytes(n: usize) -> Result<Vec<u8>, AuthorityError> {
    let mut bytes = vec![0u8; n];
    getrandom::fill(&mut bytes)
        .map_err(|e| AuthorityError::Unavailable(format!("randomness: {e}")))?;
    Ok(bytes)
}

fn validate_token(value: &str) -> Result<&str, AuthorityError> {
    let value = value.trim();
    if value.is_empty()
        || value.len() > MAX_TOKEN_BYTES
        || value.bytes().any(|byte| byte <= b' ' || byte == 0x7f)
    {
        return Err(AuthorityError::Registry(
            "invalid session token".to_string(),
        ));
    }
    Ok(value)
}

fn registry_dir(registry_path: &Path) -> Result<&Path, AuthorityError> {
    registry_path
        .parent()
        .ok_or_else(|| AuthorityError::Registry("session directory unresolvable".to_string()))
}

fn secure_dir_perms(path: &Path) -> Result<(), AuthorityError> {
    let metadata = fs::symlink_metadata(path)
        .map_err(|e| AuthorityError::Io(format!("inspect directory: {e}")))?;
    if metadata.file_type().is_symlink() {
        return Err(AuthorityError::Registry(
            "session directory is a symbolic link".to_string(),
        ));
    }
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        if metadata.file_type().is_dir() {
            fs::set_permissions(path, fs::Permissions::from_mode(0o700))
                .map_err(|e| AuthorityError::Io(format!("secure directory: {e}")))?;
        }
    }
    Ok(())
}

/// Lecture du registre. Aucun secret n'est jamais produit dans un diagnostic d'erreur.
/// Un registre absent, legacy, vide, corrompu, surdimensionné, symlink, de version
/// inconnue ou aux champs incohérents produit `Ok(None)` : aucune restauration.
/// Seuls les échecs d'E/S durs (permissions) produisent une erreur distincte.
fn read_registry(path: &Path) -> Result<Option<Authority>, AuthorityError> {
    let metadata = match fs::symlink_metadata(path) {
        Ok(m) => m,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(None),
        Err(e) => return Err(AuthorityError::Io(format!("inspect registry: {e}"))),
    };
    if metadata.file_type().is_symlink() {
        return Ok(None);
    }
    if !metadata.file_type().is_file() {
        return Ok(None);
    }
    if metadata.len() > MAX_REGISTRY_BYTES as u64 {
        return Ok(None);
    }
    let mut file =
        File::open(path).map_err(|e| AuthorityError::Io(format!("open registry: {e}")))?;
    let mut bytes = Vec::new();
    file.read_to_end(&mut bytes)
        .map_err(|e| AuthorityError::Io(format!("read registry: {e}")))?;
    if bytes.len() > MAX_REGISTRY_BYTES {
        return Ok(None);
    }
    let raw: AuthorityFile = match serde_json::from_slice(&bytes) {
        Ok(r) => r,
        Err(_) => return Ok(None),
    };
    Ok(raw.into_authority())
}

/// Écriture atomique et durable du registre. Aucune fenêtre où le fichier disparaît.
///
/// Toute erreur *avant* le remplacement (`replace_file`) est un echec certain :
/// le registre precedent est intact. Une erreur de `sync_dir` *apres* le
/// remplacement signifie que le nouveau registre est peut-etre installe mais que
/// sa durabilite n'est pas prouvee : resultat `Indeterminate`.
fn write_registry_atomic(
    path: &Path,
    content: &[u8],
    sync_dir_fn: fn(&Path) -> Result<(), AuthorityError>,
) -> Result<(), AuthorityError> {
    let parent = registry_dir(path)?;
    fs::create_dir_all(parent).map_err(|e| AuthorityError::Io(format!("create directory: {e}")))?;
    secure_dir_perms(parent)?;

    let temp_name = format!(".desktop-session-{}.tmp", hex_encode(&random_bytes(12)?));
    let temp_path = parent.join(temp_name);
    let mut file = OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&temp_path)
        .map_err(|e| AuthorityError::Io(format!("create temporary: {e}")))?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        file.set_permissions(fs::Permissions::from_mode(0o600))
            .map_err(|e| AuthorityError::Io(format!("secure temporary: {e}")))?;
    }
    file.write_all(content)
        .map_err(|e| AuthorityError::Io(format!("write temporary: {e}")))?;
    file.sync_all()
        .map_err(|e| AuthorityError::Io(format!("sync temporary: {e}")))?;
    drop(file);

    replace_file(path, &temp_path)?; // remplacement : aucune erreur au-dela = certain
                                     // Apres le remplacement, une perte de synchronisation du repertoire rend le
                                     // commit effectif mais sa durabilite non prouvee : indetermine.
    sync_dir_fn(parent).map_err(|e| {
        AuthorityError::Indeterminate(format!(
            "synchronisation repertoire apres remplacement: {e}"
        ))
    })?;
    let _ = fs::remove_file(&temp_path);
    Ok(())
}

/// Remplacement natif atomique. Unix : `rename` (remplace sur le même FS).
/// Windows : `MoveFileExW` avec `MOVEFILE_REPLACE_EXISTING` (pas de remove-then-rename).
fn replace_file(path: &Path, temp: &Path) -> Result<(), AuthorityError> {
    #[cfg(unix)]
    {
        fs::rename(temp, path).map_err(|e| AuthorityError::Io(format!("replace registry: {e}")))?;
        Ok(())
    }
    #[cfg(windows)]
    {
        replace_file_windows(path, temp)
    }
    #[cfg(not(any(unix, windows)))]
    {
        fs::rename(temp, path).map_err(|e| AuthorityError::Io(format!("replace registry: {e}")))
    }
}

#[cfg(windows)]
fn replace_file_windows(path: &Path, temp: &Path) -> Result<(), AuthorityError> {
    use std::os::windows::ffi::OsStrExt;
    const MOVEFILE_REPLACE_EXISTING: u32 = 0x00000001;
    const MOVEFILE_WRITE_THROUGH: u32 = 0x00000008;
    let mut wide_temp: Vec<u16> = temp.as_os_str().encode_wide().collect();
    wide_temp.push(0);
    let mut wide_path: Vec<u16> = path.as_os_str().encode_wide().collect();
    wide_path.push(0);
    let ok = unsafe {
        windows_sys::Win32::Storage::FileSystem::MoveFileExW(
            wide_temp.as_ptr(),
            wide_path.as_ptr(),
            MOVEFILE_REPLACE_EXISTING | MOVEFILE_WRITE_THROUGH,
        )
    };
    if ok != 0 {
        return Ok(());
    }
    let err = unsafe { windows_sys::Win32::Foundation::GetLastError() };
    Err(AuthorityError::Io(format!(
        "replace registry (windows): {err}"
    )))
}

fn sync_dir(path: &Path) -> Result<(), AuthorityError> {
    #[cfg(unix)]
    {
        let dir =
            fs::File::open(path).map_err(|e| AuthorityError::Io(format!("open directory: {e}")))?;
        dir.sync_all()
            .map_err(|e| AuthorityError::Io(format!("sync directory: {e}")))?;
    }
    #[cfg(not(unix))]
    {
        let _ = path;
    }
    Ok(())
}

// ---------------------------------------------------------------------------
// Verrou interprocessus
// ---------------------------------------------------------------------------

/// Verrou exclusif interprocessus sur le fichier de verrou. Le fichier est stable
/// (jamais supprimé/recréé pour déverrouiller) ; le verrou est relâché à la chute.
pub struct FileLock {
    file: File,
}

impl FileLock {
    pub fn open_and_lock(path: &Path) -> Result<Self, AuthorityError> {
        let parent = path
            .parent()
            .ok_or_else(|| AuthorityError::Registry("lock directory unresolvable".to_string()))?;
        fs::create_dir_all(parent)
            .map_err(|e| AuthorityError::Io(format!("create lock directory: {e}")))?;
        secure_dir_perms(parent)?;
        let file = OpenOptions::new()
            .write(true)
            .create(true)
            .truncate(false)
            .open(path)
            .map_err(|e| AuthorityError::Io(format!("open lock: {e}")))?;
        lock_file(&file)?;
        Ok(Self { file })
    }
}

impl Drop for FileLock {
    fn drop(&mut self) {
        unlock_file(&self.file);
    }
}

fn lock_file(file: &File) -> Result<(), AuthorityError> {
    #[cfg(unix)]
    {
        let rc = unsafe { libc::flock(file.as_raw_fd(), libc::LOCK_EX) };
        if rc != 0 {
            return Err(AuthorityError::Io(format!(
                "flock: {}",
                std::io::Error::last_os_error()
            )));
        }
        Ok(())
    }
    #[cfg(windows)]
    {
        lock_file_windows(file)
    }
    #[cfg(not(any(unix, windows)))]
    {
        Err(AuthorityError::Unavailable(
            "no interprocess lock primitive on this platform".to_string(),
        ))
    }
}

#[cfg(windows)]
fn lock_file_windows(file: &File) -> Result<(), AuthorityError> {
    // `LockFile` échoue immédiatement si la région est déjà verrouillée : on boucle
    // avec sommeil (verrou bloquant, tenu le temps de la transaction locale uniquement).
    // NOTE : sous Windows, `flock` n'est pas disponible ; `LockFile` par descripteur
    // exclut bien les *autres processus*, mais pas deux threads d'un meme processus.
    let handle = file.as_raw_handle() as windows_sys::Win32::Foundation::HANDLE;
    for _ in 0..600 {
        let ok = unsafe {
            windows_sys::Win32::Storage::FileSystem::LockFile(handle, 0, 0, u32::MAX, u32::MAX)
        };
        if ok != 0 {
            return Ok(());
        }
        let err = unsafe { windows_sys::Win32::Foundation::GetLastError() };
        if err == 0x21 {
            // ERROR_LOCK_VIOLATION : un autre processus détient le verrou.
            std::thread::sleep(std::time::Duration::from_millis(50));
            continue;
        }
        return Err(AuthorityError::Io(format!("LockFile: {err}")));
    }
    Err(AuthorityError::Unavailable(
        "could not acquire interprocess lock".to_string(),
    ))
}

#[cfg(windows)]
fn unlock_file(file: &File) {
    let handle = file.as_raw_handle() as windows_sys::Win32::Foundation::HANDLE;
    let _ = unsafe {
        windows_sys::Win32::Storage::FileSystem::UnlockFile(handle, 0, 0, u32::MAX, u32::MAX)
    };
}

#[cfg(not(windows))]
fn unlock_file(file: &File) {
    #[cfg(unix)]
    {
        let _ = unsafe { libc::flock(file.as_raw_fd(), libc::LOCK_UN) };
    }
}

// ---------------------------------------------------------------------------
// SessionAuthority : protocole d'autorité
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ReadResult {
    pub token: Option<String>,
    pub authority: Authority,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CommitResult {
    Secure,
    Fallback,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LogoutResult {
    Durable,
    DurableDeferred,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PurgeResult {
    Purged,
    Skipped,
    Deferred,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct InstallOutcome {
    pub commit: CommitResult,
    pub generation: String,
}

/// Échec d'installation de session avec indication de l'avancement de la
/// transaction : `pending(g)` a-t-il ete ecrit durablement ?
///
/// - `BeforePending` : aucun remplacement n'a ete amorce ; ni le trousseau ni
///   l'etat memoire precedent ne sont mutés.
/// - `AfterPending` : `pending(g)` est durable (ou peut l'etre) ; la memoire
///   doit etre videe et le registre relu (reconciliation) avant toute reprise.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum InstallError {
    BeforePending(AuthorityError),
    AfterPending(AuthorityError),
}

impl fmt::Display for InstallError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            InstallError::BeforePending(e) => write!(f, "avant pending: {e}"),
            InstallError::AfterPending(e) => write!(f, "apres pending: {e}"),
        }
    }
}

impl Error for InstallError {}

impl From<InstallError> for AuthorityError {
    fn from(e: InstallError) -> Self {
        match e {
            InstallError::BeforePending(a) | InstallError::AfterPending(a) => a,
        }
    }
}

#[cfg(test)]
type SyncDirFn = fn(&Path) -> Result<(), AuthorityError>;

/// Instance du protocole d'autorité. `S` est le magasin de credentials (production :
/// `KeyringStore` ; tests : magasin synthétique).
pub struct SessionAuthority<S: CredentialStore> {
    store: S,
    registry_path: PathBuf,
    lock_path: PathBuf,
    #[cfg(test)]
    sync_dir_override: Option<SyncDirFn>,
}

impl<S: CredentialStore> SessionAuthority<S> {
    pub fn new(store: S, registry_path: PathBuf, lock_path: PathBuf) -> Self {
        Self {
            store,
            registry_path,
            lock_path,
            #[cfg(test)]
            sync_dir_override: None,
        }
    }

    #[cfg(test)]
    #[allow(clippy::type_complexity)]
    pub(crate) fn with_sync_dir_override(mut self, override_: Option<SyncDirFn>) -> Self {
        self.sync_dir_override = override_;
        self
    }

    #[cfg(not(test))]
    fn effective_sync_dir(_auth: &SessionAuthority<S>) -> fn(&Path) -> Result<(), AuthorityError> {
        sync_dir
    }

    #[cfg(test)]
    fn effective_sync_dir(auth: &SessionAuthority<S>) -> fn(&Path) -> Result<(), AuthorityError> {
        auth.sync_dir_override.unwrap_or(sync_dir)
    }

    /// Lit l'autorité et décide de la session à restaurer. Lecture seule sur
    /// l'autorité (peut tenter une purge OS différée, non bloquante, sur le chemin
    /// fallback).
    pub fn read_session(&self) -> Result<ReadResult, AuthorityError> {
        let _lock = FileLock::open_and_lock(&self.lock_path)?;
        let registry = read_registry(&self.registry_path)?;
        let Some(authority) = registry else {
            return Ok(ReadResult {
                token: None,
                authority: Authority::None,
            });
        };
        match authority {
            Authority::Fallback { generation, token } => {
                // L'autorité est le jeton fallback. On tente de purger le résidu OS
                // (ancien compte) si un handle redevient disponible ; l'échec est un
                // nettoyage différé, pas un rejet de T2.
                let _ = self.purge_os_locked();
                Ok(ReadResult {
                    token: Some(token.clone()),
                    authority: Authority::Fallback { generation, token },
                })
            }
            Authority::Secure { generation } => match self.read_envelope()? {
                Some(envelope)
                    if envelope.version == 1
                        && envelope.generation == generation
                        && validate_token(&envelope.token).is_ok() =>
                {
                    Ok(ReadResult {
                        token: Some(envelope.token),
                        authority: Authority::Secure { generation },
                    })
                }
                _ => Ok(ReadResult {
                    token: None,
                    authority: Authority::Secure { generation },
                }),
            },
            Authority::None => Ok(ReadResult {
                token: None,
                authority: Authority::None,
            }),
            Authority::Pending { .. } => Ok(ReadResult {
                token: None,
                authority,
            }),
        }
    }

    /// Installe le jeton T2 (login). Retourne le commit et la génération.
    pub fn install_session(&self, token: &str) -> Result<InstallOutcome, InstallError> {
        // Validation avant toute mutation : refus fermé si le jeton est invalide.
        validate_token(token).map_err(InstallError::BeforePending)?;
        let _lock =
            FileLock::open_and_lock(&self.lock_path).map_err(InstallError::BeforePending)?;
        let generation = new_generation().map_err(InstallError::BeforePending)?;

        // 1. `pending(g)` durable AVANT toute mutation du trousseau.
        //    Echec certain avant remplacement : le trousseau n'est pas touche.
        //    Remplacement deja opere avant l'erreur de synchronisation : indetermine.
        match self.write_registry(&Authority::Pending {
            generation: generation.clone(),
        }) {
            Err(AuthorityError::Indeterminate(msg)) => {
                return Err(InstallError::AfterPending(AuthorityError::Indeterminate(
                    msg,
                )))
            }
            Err(e) => return Err(InstallError::BeforePending(e)),
            Ok(()) => {}
        }

        // 2. Mutation du trousseau OS.
        match self.store.open() {
            // Toute erreur de construction du handle (Unavailable, Other, …) mene
            // au repli fallback(g, T2) sans laisser l'etat `pending` en place.
            Err(_) => match self.write_registry(&Authority::Fallback {
                generation: generation.clone(),
                token: token.to_string(),
            }) {
                Ok(()) => Ok(InstallOutcome {
                    commit: CommitResult::Fallback,
                    generation,
                }),
                Err(e) => Err(InstallError::AfterPending(e)),
            },
            Ok(entry) => {
                let envelope = Envelope {
                    version: 1,
                    generation: generation.clone(),
                    token: token.to_string(),
                };
                let payload = serde_json::to_string(&envelope).map_err(|e| {
                    InstallError::AfterPending(AuthorityError::Io(format!(
                        "serialize envelope: {e}"
                    )))
                })?;
                let set_ok = entry.set_password(&payload).is_ok();
                let readback_ok = set_ok
                    && matches!(
                        entry.get_password(),
                        Ok(Some(stored)) if {
                            match serde_json::from_str::<Envelope>(&stored) {
                                Ok(env) => env.version == 1 && env.generation == generation && env.token == token,
                                _ => false,
                            }
                        }
                    );
                if readback_ok {
                    // Trousseau verifie : `secure(g)` devient l'autorite.
                    match self.write_registry(&Authority::Secure {
                        generation: generation.clone(),
                    }) {
                        Ok(()) => Ok(InstallOutcome {
                            commit: CommitResult::Secure,
                            generation,
                        }),
                        Err(e) => Err(InstallError::AfterPending(e)),
                    }
                } else {
                    // Ecriture/read-back echec ou invalide : repli `fallback(g, T2)`.
                    match self.write_registry(&Authority::Fallback {
                        generation: generation.clone(),
                        token: token.to_string(),
                    }) {
                        Ok(()) => {
                            // Nettoyage differe de l'ancien jeton OS si suppression refusee ;
                            // jamais un rejet de T2.
                            let _ = self.purge_os_locked();
                            Ok(InstallOutcome {
                                commit: CommitResult::Fallback,
                                generation,
                            })
                        }
                        Err(e) => Err(InstallError::AfterPending(e)),
                    }
                }
            }
        }
    }

    /// Déconnexion. La mémoire est vidée par l'appelant ; ici on écrit la tombstone
    /// `none` durablement AVANT toute suppression OS.
    pub fn logout(&self) -> Result<LogoutResult, AuthorityError> {
        let _lock = FileLock::open_and_lock(&self.lock_path)?;
        self.write_registry(&Authority::None)?;

        match self.store.open() {
            Err(StoreError::Unavailable) => Ok(LogoutResult::DurableDeferred),
            // Tombstone durable deja ecrite : une ouverture du magasin qui echoue
            // autrement qu'en `Unavailable` ne remet pas en cause la durabilite de
            // la tombstone ; le nettoyage OS est differe et signale explicitement.
            Err(_) => Ok(LogoutResult::DurableDeferred),
            Ok(entry) => match entry.delete_credential() {
                Ok(()) | Err(StoreError::NoEntry) => Ok(LogoutResult::Durable),
                Err(_) => Ok(LogoutResult::DurableDeferred),
            },
        }
    }

    /// Purge du résidu OS sous verrou : relit l'autorité, puis supprime le credential
    /// OS seulement si l'autorité ne le désigne pas (fallback/none). Termine avant de
    /// relâcher le verrou (pas de purge asynchrone détachée).
    pub fn purge_os(&self) -> Result<PurgeResult, AuthorityError> {
        let _lock = FileLock::open_and_lock(&self.lock_path)?;
        self.purge_os_locked()
    }

    fn purge_os_locked(&self) -> Result<PurgeResult, AuthorityError> {
        let authority = read_registry(&self.registry_path)?.unwrap_or(Authority::None);
        let should_purge = matches!(authority, Authority::Fallback { .. } | Authority::None);
        if !should_purge {
            return Ok(PurgeResult::Skipped);
        }
        match self.store.open() {
            Err(StoreError::Unavailable) => Ok(PurgeResult::Deferred),
            Err(e) => Err(AuthorityError::Store(e)),
            Ok(entry) => match entry.delete_credential() {
                Ok(()) | Err(StoreError::NoEntry) => Ok(PurgeResult::Purged),
                Err(_) => Ok(PurgeResult::Deferred),
            },
        }
    }

    /// Revalide le cache mémoire (génération + source) sous verrou avant une nouvelle
    /// émission authentifiée. Retourne `true` si le cache est encore autorisé.
    pub fn revalidate(
        &self,
        token: &str,
        generation: &str,
        _source: AuthSource,
    ) -> Result<bool, AuthorityError> {
        let _lock = FileLock::open_and_lock(&self.lock_path)?;
        let registry = read_registry(&self.registry_path)?;
        let Some(authority) = registry else {
            return Ok(false);
        };
        match authority {
            Authority::Secure { generation: g } if g == generation => {
                match self.read_envelope()? {
                    Some(envelope)
                        if envelope.version == 1
                            && envelope.generation == generation
                            && envelope.token == token =>
                    {
                        Ok(true)
                    }
                    _ => Ok(false),
                }
            }
            Authority::Fallback {
                generation: g,
                token: t,
            } if g == generation && t == token => Ok(true),
            _ => Ok(false),
        }
    }

    // --- internes ---

    pub fn write_registry(&self, authority: &Authority) -> Result<(), AuthorityError> {
        let raw = AuthorityFile::from_authority(authority.clone());
        let content = serde_json::to_string(&raw)
            .map_err(|e| AuthorityError::Io(format!("serialize registry: {e}")))?;
        write_registry_atomic(
            &self.registry_path,
            content.as_bytes(),
            Self::effective_sync_dir(self),
        )
    }

    fn read_envelope(&self) -> Result<Option<Envelope>, AuthorityError> {
        match self.store.open() {
            Err(StoreError::Unavailable) => Ok(None),
            Err(e) => Err(AuthorityError::Store(e)),
            Ok(entry) => match entry.get_password() {
                Ok(Some(value)) => {
                    if value.len() > MAX_ENVELOPE_BYTES {
                        return Err(AuthorityError::Registry("oversized envelope".to_string()));
                    }
                    match serde_json::from_str::<Envelope>(&value) {
                        Ok(envelope) => Ok(Some(envelope)),
                        Err(_) => Ok(None),
                    }
                }
                Ok(None) => Ok(None),
                // Une erreur de lecture ne se confond pas avec un magasin vide :
                // signaler l'indisponibilite, aucune session.
                Err(e) => Err(AuthorityError::Store(e)),
            },
        }
    }
}

// ---------------------------------------------------------------------------
// Tests unitaires (magasin synthétique, aucun credential réel)
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::VecDeque;
    use std::sync::atomic::{AtomicUsize, Ordering};
    use std::sync::{Arc, Mutex};

    // ------------------------------------------------------------------
    // Magasin synthétique (double de test) : aucun credential réel.
    // ------------------------------------------------------------------

    #[derive(Debug, Clone, PartialEq, Eq)]
    enum StoreState {
        Sain,
        Indisponible,
        Recupere,
    }

    #[derive(Debug, Clone, PartialEq, Eq)]
    enum StoreCall {
        Set {
            value: String,
            result: Result<(), StoreError>,
        },
        Get {
            result: Result<Option<String>, StoreError>,
        },
        Delete {
            result: Result<(), StoreError>,
        },
    }

    struct SyntheticEntry {
        value: Mutex<Option<String>>,
        state: Mutex<StoreState>,
        history: Mutex<VecDeque<StoreCall>>,
        fail_set: Mutex<bool>,
        fail_get: Mutex<bool>,
        fail_delete: Mutex<bool>,
        delete_result: Mutex<Result<(), StoreError>>,
        get_override: Mutex<Option<String>>,
    }

    impl SyntheticEntry {
        fn new() -> Arc<Self> {
            Arc::new(Self {
                value: Mutex::new(None),
                state: Mutex::new(StoreState::Sain),
                history: Mutex::new(VecDeque::new()),
                fail_set: Mutex::new(false),
                fail_get: Mutex::new(false),
                fail_delete: Mutex::new(false),
                delete_result: Mutex::new(Ok(())),
                get_override: Mutex::new(None),
            })
        }
    }

    impl CredentialEntry for SyntheticEntry {
        fn set_password(&self, value: &str) -> Result<(), StoreError> {
            let fail = *self.fail_set.lock().unwrap();
            self.history.lock().unwrap().push_back(StoreCall::Set {
                value: value.to_string(),
                result: if fail {
                    Err(StoreError::WriteFailed)
                } else {
                    Ok(())
                },
            });
            if fail {
                return Err(StoreError::WriteFailed);
            }
            *self.value.lock().unwrap() = Some(value.to_string());
            Ok(())
        }
        fn get_password(&self) -> Result<Option<String>, StoreError> {
            if let Some(override_value) = self.get_override.lock().unwrap().as_ref() {
                let result = Ok(Some(override_value.clone()));
                self.history.lock().unwrap().push_back(StoreCall::Get {
                    result: result.clone(),
                });
                return result;
            }
            let fail = *self.fail_get.lock().unwrap();
            let result = if fail {
                Err(StoreError::ReadFailed)
            } else {
                Ok(self.value.lock().unwrap().clone())
            };
            self.history.lock().unwrap().push_back(StoreCall::Get {
                result: result.clone(),
            });
            result
        }
        fn delete_credential(&self) -> Result<(), StoreError> {
            let fail = *self.fail_delete.lock().unwrap();
            let result = if fail {
                self.delete_result.lock().unwrap().clone()
            } else {
                self.value.lock().unwrap().take();
                Ok(())
            };
            self.history.lock().unwrap().push_back(StoreCall::Delete {
                result: result.clone(),
            });
            result
        }
    }

    impl CredentialEntry for Arc<SyntheticEntry> {
        fn set_password(&self, value: &str) -> Result<(), StoreError> {
            self.as_ref().set_password(value)
        }
        fn get_password(&self) -> Result<Option<String>, StoreError> {
            self.as_ref().get_password()
        }
        fn delete_credential(&self) -> Result<(), StoreError> {
            self.as_ref().delete_credential()
        }
    }

    struct SyntheticStoreInner {
        entry: Mutex<Option<Arc<SyntheticEntry>>>,
        state: Mutex<StoreState>,
        open_count: Mutex<u64>,
        open_error: Mutex<Option<StoreError>>,
    }

    /// Partagé par tous les clones du magasin : un `open()` sur une instance
    /// est visible des autres, ce qui modélise la reprise par un autre
    /// processus sur le même stockage synthétique.
    struct SyntheticStore {
        inner: Arc<SyntheticStoreInner>,
    }

    impl Clone for SyntheticStore {
        fn clone(&self) -> Self {
            Self {
                inner: Arc::clone(&self.inner),
            }
        }
    }

    impl SyntheticStore {
        fn new() -> Self {
            Self {
                inner: Arc::new(SyntheticStoreInner {
                    entry: Mutex::new(None),
                    state: Mutex::new(StoreState::Sain),
                    open_count: Mutex::new(0),
                    open_error: Mutex::new(None),
                }),
            }
        }

        /// Force `open()` a renvoyer cette erreur (ex. `StoreError::Other`),
        /// quel que soit l'etat du magasin.
        fn set_open_error(&self, e: StoreError) {
            *self.inner.open_error.lock().unwrap() = Some(e);
        }

        /// Récupère l'entrée existante ou en crée une par défaut héritant de
        /// l'état courant du magasin. Les configurateurs s'en servent pour
        /// appliquer leur configuration même avant le premier `open()`.
        fn ensure_entry(&self) -> Arc<SyntheticEntry> {
            if let Some(e) = self.inner.entry.lock().unwrap().clone() {
                return e;
            }
            let e = SyntheticEntry::new();
            let st = self.inner.state.lock().unwrap().clone();
            *e.state.lock().unwrap() = st;
            *self.inner.entry.lock().unwrap() = Some(Arc::clone(&e));
            e
        }

        fn set_state(&self, state: StoreState) {
            *self.inner.state.lock().unwrap() = state.clone();
            if let Some(e) = self.inner.entry.lock().unwrap().as_ref() {
                *e.state.lock().unwrap() = state.clone();
            }
        }

        fn set_value(&self, value: Option<&str>) {
            let e = self.ensure_entry();
            *e.value.lock().unwrap() = value.map(|v| v.to_string());
        }

        fn value(&self) -> Option<String> {
            self.inner
                .entry
                .lock()
                .unwrap()
                .as_ref()
                .and_then(|e| e.value.lock().unwrap().clone())
        }

        fn history(&self) -> VecDeque<StoreCall> {
            self.inner
                .entry
                .lock()
                .unwrap()
                .as_ref()
                .map(|e| e.history.lock().unwrap().clone())
                .unwrap_or_default()
        }

        fn set_fail_set(&self, v: bool) {
            let e = self.ensure_entry();
            *e.fail_set.lock().unwrap() = v;
        }

        fn set_fail_delete(&self, v: bool, result: Result<(), StoreError>) {
            let e = self.ensure_entry();
            *e.fail_delete.lock().unwrap() = v;
            *e.delete_result.lock().unwrap() = result;
        }

        fn set_get_override(&self, v: Option<String>) {
            let e = self.ensure_entry();
            *e.get_override.lock().unwrap() = v;
        }

        fn open_count(&self) -> u64 {
            *self.inner.open_count.lock().unwrap()
        }
    }

    impl CredentialStore for SyntheticStore {
        type Entry = Arc<SyntheticEntry>;
        fn open(&self) -> Result<Self::Entry, StoreError> {
            *self.inner.open_count.lock().unwrap() += 1;
            // Une erreur forcée sur `open()` l'emporte sur l'état du magasin
            // (injection de panne pour les tests de repli et de déconnexion).
            if let Some(e) = self.inner.open_error.lock().unwrap().clone() {
                return Err(e);
            }
            // Copier l'état avant ensure_entry(), qui reverrouille `state` (Mutex non réentrant).
            let state = self.inner.state.lock().unwrap().clone();
            match state {
                StoreState::Indisponible => Err(StoreError::Unavailable),
                _ => Ok(self.ensure_entry()),
            }
        }
    }

    // ------------------------------------------------------------------
    // Harness : autorité sur stockage synthétique protégé.
    // ------------------------------------------------------------------

    fn make_authority(store: SyntheticStore, root: &Path) -> SessionAuthority<SyntheticStore> {
        let registry_path = root.join(REGISTRY_FILE_NAME);
        let lock_path = root.join(LOCK_FILE_NAME);
        SessionAuthority::new(store, registry_path, lock_path)
    }

    fn registry_state(root: &Path) -> Option<Authority> {
        read_registry(&root.join(REGISTRY_FILE_NAME)).unwrap()
    }

    fn temp_dir() -> PathBuf {
        let dir = std::env::temp_dir().join(format!(
            "mycroft-session-auth-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }

    // ------------------------------------------------------------------
    // R01 : factory échoue avant handle, T1 reste, T2 accepté fallback,
    //       aucun set/get/delete sur handle absent.
    // ------------------------------------------------------------------

    #[test]
    fn r01_factory_fails_before_handle_t1_remains_t2_fallback() {
        let root = temp_dir();
        let store = SyntheticStore::new();
        store.set_state(StoreState::Sain);
        store.set_value(Some("T1-old-account"));
        store.set_state(StoreState::Indisponible);
        let auth = make_authority(store.clone(), &root);

        let outcome = auth.install_session("T2-new-account").unwrap();
        assert_eq!(outcome.commit, CommitResult::Fallback);

        let state = registry_state(&root).unwrap();
        match state {
            Authority::Fallback {
                generation: _,
                token,
            } => assert_eq!(token, "T2-new-account"),
            other => panic!("expected fallback, got {other:?}"),
        }
        assert_eq!(store.value(), Some("T1-old-account".to_string()));
        // Factory réellement appelée une fois ; aucun set/get/delete sur une Entry absente.
        assert_eq!(store.open_count(), 1);
        let history = store.history();
        assert!(history.iter().all(|c| !matches!(
            c,
            StoreCall::Set { .. } | StoreCall::Get { .. } | StoreCall::Delete { .. }
        )));
    }

    #[test]
    fn r01_no_call_on_absent_handle() {
        let root = temp_dir();
        let store = SyntheticStore::new(); // pas d'Entry du tout
        store.set_state(StoreState::Indisponible);
        let auth = make_authority(store.clone(), &root);
        let _ = auth.install_session("T2");
        let history = store.history();
        assert!(history.iter().all(|c| !matches!(
            c,
            StoreCall::Set { .. } | StoreCall::Get { .. } | StoreCall::Delete { .. }
        )));
    }

    // ------------------------------------------------------------------
    // R02 : récupération et autre processus : T2 seul, jamais T1, purge sous
    //       verrou, autorité fallback conservée.
    // ------------------------------------------------------------------

    #[test]
    fn r02_recovery_t2_only_t1_never_purge_under_lock() {
        let root = temp_dir();
        let store = SyntheticStore::new();
        store.set_state(StoreState::Sain);
        store.set_value(Some("T1-old-account"));
        store.set_state(StoreState::Indisponible);
        let auth = make_authority(store.clone(), &root);
        let outcome = auth.install_session("T2-new-account").unwrap();
        assert_eq!(outcome.commit, CommitResult::Fallback);

        store.set_state(StoreState::Sain);
        let auth2 = make_authority(store.clone(), &root);
        let read = auth2.read_session().unwrap();
        assert_eq!(read.token, Some("T2-new-account".to_string()));
        assert!(matches!(read.authority, Authority::Fallback { .. }));

        assert_eq!(store.value(), None);
        let state = registry_state(&root).unwrap();
        match state {
            Authority::Fallback { token, .. } => assert_eq!(token, "T2-new-account"),
            other => panic!("expected fallback conserved, got {other:?}"),
        }
    }

    // ------------------------------------------------------------------
    // R03 : panne persistante : T2 fallback disponible sans dépendance au keyring.
    // ------------------------------------------------------------------

    #[test]
    fn r03_persistent_failure_fallback_without_keyring() {
        let root = temp_dir();
        let store = SyntheticStore::new();
        store.set_state(StoreState::Indisponible);
        let auth = make_authority(store.clone(), &root);
        let outcome = auth.install_session("T2-new-account").unwrap();
        assert_eq!(outcome.commit, CommitResult::Fallback);
        let read = auth.read_session().unwrap();
        assert_eq!(read.token, Some("T2-new-account".to_string()));
        assert_eq!(store.value(), None);
    }

    // ------------------------------------------------------------------
    // R04 : backend sain et vieux fallback : T2 OS vérifié, secure sans token disque,
    //       relance T2.
    // ------------------------------------------------------------------

    #[test]
    fn r04_healthy_backend_secure_no_disk_token() {
        let root = temp_dir();
        let store = SyntheticStore::new();
        store.set_state(StoreState::Sain);
        store.set_value(Some("T1-other-account"));
        let auth = make_authority(store.clone(), &root);
        let outcome = auth.install_session("T2-new-account").unwrap();
        assert_eq!(outcome.commit, CommitResult::Secure);
        let state = registry_state(&root).unwrap();
        assert!(matches!(state, Authority::Secure { .. }));
        let env = store.value().unwrap();
        let env: Envelope = serde_json::from_str(&env).unwrap();
        assert_eq!(env.token, "T2-new-account");
        assert_eq!(env.generation, state.generation().unwrap());
        let auth2 = make_authority(store.clone(), &root);
        let read = auth2.read_session().unwrap();
        assert_eq!(read.token, Some("T2-new-account".to_string()));
    }

    // ------------------------------------------------------------------
    // R05 : set/read-back échoue ou stale/invalide/mauvaise génération -> fallback T2.
    // ------------------------------------------------------------------

    #[test]
    fn r05_set_failed_fallback() {
        let root = temp_dir();
        let store = SyntheticStore::new();
        store.set_state(StoreState::Sain);
        store.set_fail_set(true);
        let auth = make_authority(store.clone(), &root);
        let outcome = auth.install_session("T2-new-account").unwrap();
        assert_eq!(outcome.commit, CommitResult::Fallback);
        assert_eq!(store.value(), None); // T1 purgé (pas de T1 ici)
        match registry_state(&root).unwrap() {
            Authority::Fallback { token, .. } => assert_eq!(token, "T2-new-account"),
            other => panic!("expected fallback, got {other:?}"),
        }
    }

    #[test]
    fn r05_readback_mismatch_fallback() {
        let root = temp_dir();
        let store = SyntheticStore::new();
        store.set_state(StoreState::Sain);
        // set réussit, read-back retourne une valeur incohérente (stale).
        store.set_get_override(Some("stale-not-an-envelope".to_string()));
        let auth = make_authority(store.clone(), &root);
        let outcome = auth.install_session("T2-new-account").unwrap();
        assert_eq!(outcome.commit, CommitResult::Fallback);
        match registry_state(&root).unwrap() {
            Authority::Fallback { token, .. } => assert_eq!(token, "T2-new-account"),
            other => panic!("expected fallback, got {other:?}"),
        }
    }

    #[test]
    fn r05_purge_ok_fallback() {
        let root = temp_dir();
        let store = SyntheticStore::new();
        store.set_state(StoreState::Sain);
        store.set_value(Some("T1-old-account"));
        store.set_fail_set(true); // force fallback, puis purge tente de supprimer T1
        let auth = make_authority(store.clone(), &root);
        let _ = auth.install_session("T2-new-account").unwrap();
        assert_eq!(store.value(), None); // T1 purgé
        match registry_state(&root).unwrap() {
            Authority::Fallback { token, .. } => assert_eq!(token, "T2-new-account"),
            other => panic!("expected fallback, got {other:?}"),
        }
    }

    // ------------------------------------------------------------------
    // R06 : delete refusé : fallback T2 confirmé, nettoyage différé puis reprise,
    //       jamais T1.
    // ------------------------------------------------------------------

    #[test]
    fn r06_delete_refused_deferred_cleanup() {
        let root = temp_dir();
        let store = SyntheticStore::new();
        store.set_value(Some("T1-old-account"));
        store.set_state(StoreState::Sain);
        store.set_fail_set(true);
        store.set_fail_delete(true, Err(StoreError::DeleteFailed));
        let auth = make_authority(store.clone(), &root);
        let outcome = auth.install_session("T2-new-account").unwrap();
        assert_eq!(outcome.commit, CommitResult::Fallback);
        assert_eq!(store.value(), Some("T1-old-account".to_string()));
        match registry_state(&root).unwrap() {
            Authority::Fallback { token, .. } => assert_eq!(token, "T2-new-account"),
            other => panic!("expected fallback, got {other:?}"),
        }
        store.set_fail_delete(false, Ok(()));
        let auth2 = make_authority(store.clone(), &root);
        let result = auth2.purge_os().unwrap();
        assert!(matches!(result, PurgeResult::Purged));
        assert_eq!(store.value(), None);
        let read = auth2.read_session().unwrap();
        assert_eq!(read.token, Some("T2-new-account".to_string()));
    }

    // ------------------------------------------------------------------
    // R07 : secure(g) inaccessible puis récupération : aucune session en panne,
    //       même g ensuite, aucun fallback ancien.
    // ------------------------------------------------------------------

    #[test]
    fn r07_secure_inaccessible_then_recovery() {
        let root = temp_dir();
        let store = SyntheticStore::new();
        store.set_state(StoreState::Sain);
        let auth = make_authority(store.clone(), &root);
        let outcome = auth.install_session("T2-new-account").unwrap();
        assert_eq!(outcome.commit, CommitResult::Secure);
        let generation = registry_state(&root).unwrap().generation().unwrap();

        store.set_state(StoreState::Indisponible);
        let auth2 = make_authority(store.clone(), &root);
        let read = auth2.read_session().unwrap();
        assert_eq!(read.token, None);
        assert!(matches!(read.authority, Authority::Secure { .. }));
        assert!(matches!(
            registry_state(&root).unwrap(),
            Authority::Secure { .. }
        ));

        store.set_state(StoreState::Recupere);
        let auth3 = make_authority(store.clone(), &root);
        let read = auth3.read_session().unwrap();
        assert_eq!(read.token, Some("T2-new-account".to_string()));
        assert_eq!(read.authority, Authority::Secure { generation });
    }

    // ------------------------------------------------------------------
    // R08 : secure(g) avec T1 brut/autre génération : aucune session.
    // ------------------------------------------------------------------

    #[test]
    fn r08_secure_wrong_generation_or_raw_t1_no_session() {
        let root = temp_dir();
        let store = SyntheticStore::new();
        store.set_state(StoreState::Sain);
        store.set_value(Some("T1-raw-token"));
        let auth = make_authority(store.clone(), &root);
        auth.write_registry(&Authority::Secure {
            generation: "a".repeat(GENERATION_HEX_LEN),
        })
        .unwrap();
        let read = auth.read_session().unwrap();
        assert_eq!(read.token, None);
    }

    // ------------------------------------------------------------------
    // R09 : logout backend sain / NoEntry : none avant delete, mémoire vide,
    //       relance sans session.
    // ------------------------------------------------------------------

    #[test]
    fn r09_logout_healthy_backend() {
        let root = temp_dir();
        let store = SyntheticStore::new();
        store.set_value(Some("T2-active"));
        store.set_state(StoreState::Sain);
        let auth = make_authority(store.clone(), &root);
        let result = auth.logout().unwrap();
        assert!(matches!(result, LogoutResult::Durable));
        assert_eq!(store.value(), None);
        assert!(matches!(registry_state(&root).unwrap(), Authority::None));
        let auth2 = make_authority(store.clone(), &root);
        let read = auth2.read_session().unwrap();
        assert_eq!(read.token, None);
    }

    #[test]
    fn r09_logout_noentry() {
        let root = temp_dir();
        let store = SyntheticStore::new();
        store.set_state(StoreState::Sain);
        let auth = make_authority(store.clone(), &root);
        let result = auth.logout().unwrap();
        assert!(matches!(result, LogoutResult::Durable));
        assert!(matches!(registry_state(&root).unwrap(), Authority::None));
    }

    // ------------------------------------------------------------------
    // R10 : logout sans Entry puis récupération : none conservé, jamais T1,
    //       purge différée.
    // ------------------------------------------------------------------

    #[test]
    fn r10_logout_without_entry_none_kept() {
        let root = temp_dir();
        let store = SyntheticStore::new();
        store.set_state(StoreState::Indisponible);
        let auth = make_authority(store.clone(), &root);
        let result = auth.logout().unwrap();
        assert!(matches!(result, LogoutResult::DurableDeferred));
        assert!(matches!(registry_state(&root).unwrap(), Authority::None));
        store.set_value(Some("T1-ghost"));
        store.set_state(StoreState::Sain);
        let auth2 = make_authority(store.clone(), &root);
        let read = auth2.read_session().unwrap();
        assert_eq!(read.token, None);
        assert!(matches!(registry_state(&root).unwrap(), Authority::None));
        let _ = auth2.purge_os().unwrap();
        assert_eq!(store.value(), None);
    }

    // ------------------------------------------------------------------
    // R11 : logout delete refusé : none protège, erreur physique visible.
    // ------------------------------------------------------------------

    #[test]
    fn r11_logout_delete_refused() {
        let root = temp_dir();
        let store = SyntheticStore::new();
        store.set_value(Some("T2-active"));
        store.set_state(StoreState::Sain);
        store.set_fail_delete(true, Err(StoreError::DeleteFailed));
        let auth = make_authority(store.clone(), &root);
        let result = auth.logout().unwrap();
        assert!(matches!(result, LogoutResult::DurableDeferred));
        assert!(matches!(registry_state(&root).unwrap(), Authority::None));
        assert_eq!(store.value(), Some("T2-active".to_string()));
    }

    // ------------------------------------------------------------------
    // R12 : erreurs chemin/permissions/écriture/sync/remplacement distinguées.
    // ------------------------------------------------------------------

    #[test]
    fn r12_path_error_before_replace() {
        let file_parent = temp_dir().join("a_file.txt");
        std::fs::write(&file_parent, "x").unwrap();
        let store = SyntheticStore::new();
        store.set_state(StoreState::Sain);
        let auth = SessionAuthority::new(
            store,
            file_parent.join(REGISTRY_FILE_NAME),
            temp_dir().join(LOCK_FILE_NAME),
        );
        let err = auth.install_session("T2").unwrap_err();
        let err_text = format!("{err}");
        assert!(!err_text.contains("T2"));
        assert!(!matches!(
            err,
            InstallError::BeforePending(AuthorityError::Indeterminate(_))
        ));
        assert!(!matches!(
            err,
            InstallError::AfterPending(AuthorityError::Indeterminate(_))
        ));
    }

    // ------------------------------------------------------------------
    // R13 : crash à chaque frontière : pending/none sans session, jamais T1 opportuniste.
    // ------------------------------------------------------------------

    #[test]
    fn r13_crash_after_pending_no_session() {
        let root = temp_dir();
        let store = SyntheticStore::new();
        store.set_state(StoreState::Sain);
        let auth = make_authority(store.clone(), &root);
        auth.write_registry(&Authority::Pending {
            generation: "d".repeat(GENERATION_HEX_LEN),
        })
        .unwrap();
        let auth2 = make_authority(store.clone(), &root);
        let read = auth2.read_session().unwrap();
        assert_eq!(read.token, None);
        assert!(matches!(read.authority, Authority::Pending { .. }));
        store.set_value(Some("T1-present"));
        let read = auth2.read_session().unwrap();
        assert_eq!(read.token, None);
    }

    #[test]
    fn r13_crash_after_none_no_session() {
        let root = temp_dir();
        let store = SyntheticStore::new();
        store.set_state(StoreState::Sain);
        let auth = make_authority(store.clone(), &root);
        auth.write_registry(&Authority::None).unwrap();
        let auth2 = make_authority(store.clone(), &root);
        let read = auth2.read_session().unwrap();
        assert_eq!(read.token, None);
    }

    // ------------------------------------------------------------------
    // R14 : registre absent/legacy/vide/corrompu/trop grand/symlink/version/champs
    //       incohérents : aucune restauration, aucun secret dans le diagnostic.
    // ------------------------------------------------------------------

    #[test]
    fn r14_registry_absent_no_restore() {
        let root = temp_dir();
        let store = SyntheticStore::new();
        store.set_state(StoreState::Sain);
        store.set_value(Some("T1-readable"));
        let auth = make_authority(store.clone(), &root);
        let read = auth.read_session().unwrap();
        assert_eq!(read.token, None);
        // L'installation doit réussir (créer le registre), pas restaurer T1.
        let outcome = auth.install_session("T2").unwrap();
        assert_eq!(outcome.commit, CommitResult::Secure);
    }

    #[test]
    fn r14_registry_corrupt_no_restore() {
        let root = temp_dir();
        std::fs::create_dir_all(&root).unwrap();
        std::fs::write(root.join(REGISTRY_FILE_NAME), "{not json").unwrap();
        let store = SyntheticStore::new();
        store.set_state(StoreState::Sain);
        store.set_value(Some("T1-readable"));
        let auth = make_authority(store.clone(), &root);
        let read = auth.read_session().unwrap();
        assert_eq!(read.token, None);
        let outcome = auth.install_session("T2").unwrap();
        assert!(matches!(
            outcome.commit,
            CommitResult::Secure | CommitResult::Fallback
        ));
    }

    #[test]
    fn r14_registry_wrong_version_no_restore() {
        let root = temp_dir();
        std::fs::create_dir_all(&root).unwrap();
        let raw = AuthorityFile {
            version: 99,
            state: "secure".to_string(),
            generation: Some("a".repeat(GENERATION_HEX_LEN)),
            token: None,
        };
        let mut buf = Vec::new();
        serde_json::to_writer(&mut buf, &raw).unwrap();
        std::fs::write(root.join(REGISTRY_FILE_NAME), &buf).unwrap();
        let store = SyntheticStore::new();
        store.set_state(StoreState::Sain);
        store.set_value(Some("T1-readable"));
        let auth = make_authority(store.clone(), &root);
        let read = auth.read_session().unwrap();
        assert_eq!(read.token, None);
    }

    #[test]
    fn r14_registry_symlink_no_restore() {
        if cfg!(unix) {
            let root = temp_dir();
            std::fs::create_dir_all(&root).unwrap();
            let target = temp_dir().join("target.txt");
            std::fs::write(&target, "x").unwrap();
            let link = root.join(REGISTRY_FILE_NAME);
            std::os::unix::fs::symlink(&target, &link).unwrap();
            let store = SyntheticStore::new();
            store.set_state(StoreState::Sain);
            let auth = make_authority(store.clone(), &root);
            let read = auth.read_session().unwrap();
            assert_eq!(read.token, None);
        }
    }

    #[test]
    fn r14_registry_empty_no_restore() {
        let root = temp_dir();
        std::fs::create_dir_all(&root).unwrap();
        std::fs::write(root.join(REGISTRY_FILE_NAME), "").unwrap();
        let store = SyntheticStore::new();
        store.set_state(StoreState::Sain);
        store.set_value(Some("T1-readable"));
        let auth = make_authority(store.clone(), &root);
        let read = auth.read_session().unwrap();
        assert_eq!(read.token, None);
    }

    // ------------------------------------------------------------------
    // R15 : deux processus, sérialisation, invalidation, pas de purge tardive.
    // ------------------------------------------------------------------

    #[test]
    fn r15_two_processes_last_commit_wins() {
        let root = temp_dir();
        let auth_a = make_authority(SyntheticStore::new(), &root);
        let _ = auth_a.install_session("T2");
        let auth_b = make_authority(SyntheticStore::new(), &root);
        let outcome_b = auth_b.install_session("T3").unwrap();
        assert_eq!(outcome_b.commit, CommitResult::Secure);
        let read = auth_b.read_session().unwrap();
        assert_eq!(read.token, Some("T3".to_string()));
        // Backend sain : le dernier commit fait autorité en `secure(g_B)`, jamais en fallback.
        assert_eq!(
            registry_state(&root).unwrap(),
            Authority::Secure {
                generation: outcome_b.generation
            }
        );
    }

    #[test]
    fn r15_cache_invalidation_before_emit() {
        let root = temp_dir();
        let store = SyntheticStore::new();
        store.set_state(StoreState::Sain);
        let auth = make_authority(store.clone(), &root);
        let outcome = auth.install_session("T2-new-account").unwrap();
        assert_eq!(outcome.commit, CommitResult::Secure);
        let generation = outcome.generation.clone();
        assert!(auth
            .revalidate("T2-new-account", &generation, AuthSource::Secure)
            .unwrap());
        auth.write_registry(&Authority::Secure {
            generation: "b".repeat(GENERATION_HEX_LEN),
        })
        .unwrap();
        assert!(!auth
            .revalidate("T2-new-account", &generation, AuthSource::Secure)
            .unwrap());
    }

    // ------------------------------------------------------------------
    // R16 : migration legacy -> reconnexion explicite puis format moderne.
    // ------------------------------------------------------------------

    #[test]
    fn r16_migration_explicit_reconnect() {
        let root = temp_dir();
        std::fs::create_dir_all(&root).unwrap();
        std::fs::write(root.join(REGISTRY_FILE_NAME), "raw-legacy-token").unwrap();
        let store = SyntheticStore::new();
        store.set_state(StoreState::Sain);
        store.set_value(Some("T1-legacy"));
        let auth = make_authority(store.clone(), &root);
        let read = auth.read_session().unwrap();
        assert_eq!(read.token, None);
        let outcome = auth.install_session("T2-modern").unwrap();
        assert_eq!(outcome.commit, CommitResult::Secure);
        assert!(matches!(
            registry_state(&root).unwrap(),
            Authority::Secure { .. }
        ));
    }

    // ------------------------------------------------------------------
    // R17 : pas de nouvelle copie permanente en clair, pas de token dans
    //       secure/pending/none/diagnostics, bornes conservées.
    // ------------------------------------------------------------------

    #[test]
    fn r17_no_token_in_non_fallback_states() {
        let root = temp_dir();
        let store = SyntheticStore::new();
        store.set_state(StoreState::Sain);
        let auth = make_authority(store.clone(), &root);
        let _ = auth.install_session("T2-secret-token");
        let state = registry_state(&root).unwrap();
        assert!(matches!(state, Authority::Secure { .. }));
        let content = std::fs::read_to_string(root.join(REGISTRY_FILE_NAME)).unwrap();
        assert!(!content.contains("T2-secret-token"));
        match state {
            Authority::Secure { generation } => {
                assert_eq!(generation.len(), GENERATION_HEX_LEN);
            }
            _ => panic!("expected secure"),
        }
    }

    #[test]
    fn r17_generation_not_derived() {
        let root = temp_dir();
        let store = SyntheticStore::new();
        store.set_state(StoreState::Sain);
        let auth = make_authority(store.clone(), &root);
        let o1 = auth.install_session("T2-token-a").unwrap();
        let _ = auth.logout().unwrap();
        let o2 = auth.install_session("T2-token-b").unwrap();
        assert_ne!(o1.generation, o2.generation);
        assert_eq!(o1.generation.len(), GENERATION_HEX_LEN);
        assert_eq!(o2.generation.len(), GENERATION_HEX_LEN);
    }

    // ------------------------------------------------------------------
    // R12 (suite) : erreurs chemin/permissions distinguées AVANT tout
    //               remplacement certain ; jamais de succès indéterminé.
    // ------------------------------------------------------------------

    #[test]
    fn r12_registre_chemin_est_repertoire_erreur_avant_remplacement() {
        let root = temp_dir();
        let store = SyntheticStore::new();
        store.set_state(StoreState::Sain);
        // La cible du registre est déjà un répertoire : create_new échoue
        // avant toute tentative de remplacement.
        std::fs::create_dir_all(root.join(REGISTRY_FILE_NAME)).unwrap();
        let auth = SessionAuthority::new(
            store,
            root.join(REGISTRY_FILE_NAME),
            temp_dir().join(LOCK_FILE_NAME),
        );
        let err = auth.install_session("T2").unwrap_err();
        let err_text = format!("{err}");
        assert!(
            !err_text.contains("T2"),
            "le diagnostic ne fuite pas le jeton"
        );
        assert!(!matches!(
            err,
            InstallError::BeforePending(AuthorityError::Indeterminate(_))
        ));
        assert!(!matches!(
            err,
            InstallError::AfterPending(AuthorityError::Indeterminate(_))
        ));
        assert!(!matches!(
            err,
            InstallError::BeforePending(AuthorityError::Unavailable(_))
        ));
        assert!(!matches!(
            err,
            InstallError::AfterPending(AuthorityError::Unavailable(_))
        ));
    }

    #[test]
    fn r12_aucun_temporaire_orpelin_apres_echec_installation() {
        let root = temp_dir();
        let store = SyntheticStore::new();
        store.set_state(StoreState::Sain);
        store.set_fail_set(true); // échec après écriture du registre pending
        let auth = make_authority(store.clone(), &root);
        let _ = auth.install_session("T2-echec");
        let leftovers: Vec<_> = std::fs::read_dir(&root)
            .unwrap()
            .filter_map(|e| e.ok())
            .filter(|e| {
                e.file_name()
                    .to_string_lossy()
                    .starts_with(".desktop-session-")
            })
            .collect();
        assert!(
            leftovers.is_empty(),
            "aucun temporaire de registre orphelin après échec"
        );
        // Le registre reste dans un état cohérent, lisible.
        let _ = auth.read_session().unwrap();
    }

    // ------------------------------------------------------------------
    // R13 (suite) : crash à chaque frontière — relire l'état réel, jamais
    //               sélection opportuniste de T1.
    // ------------------------------------------------------------------

    #[test]
    fn r13_crash_apres_set_envelope_valide_registre_encore_pending() {
        // Crash entre l'écriture du trousseau (T2) et le commit du registre :
        // le registre Pending fait encore autorité, l'OS n'est jamais consulté
        // en catimini.
        let root = temp_dir();
        let store = SyntheticStore::new();
        store.set_state(StoreState::Sain);
        let auth = make_authority(store.clone(), &root);
        let generation = "e".repeat(GENERATION_HEX_LEN);
        let envelope = Envelope {
            version: 1,
            generation: generation.clone(),
            token: "T2-crash".to_string(),
        };
        store.set_value(Some(&serde_json::to_string(&envelope).unwrap()));
        auth.write_registry(&Authority::Pending {
            generation: generation.clone(),
        })
        .unwrap();
        let auth2 = make_authority(store.clone(), &root);
        let read = auth2.read_session().unwrap();
        assert_eq!(read.token, None);
        assert!(matches!(read.authority, Authority::Pending { .. }));
        // Un nouveau login repart sur une génération fraîche.
        let outcome = auth2.install_session("T3-apres-crash").unwrap();
        assert_eq!(outcome.commit, CommitResult::Secure);
        assert_ne!(outcome.generation, generation);
    }

    #[test]
    fn r13_crash_apres_commit_secure_os_vide() {
        // Crash après commit secure(g) avec perte de l'enveloppe OS : aucune
        // session, pas de bascule silencieuse sur un fallback plus ancien.
        let root = temp_dir();
        let store = SyntheticStore::new();
        store.set_state(StoreState::Sain);
        let auth = make_authority(store.clone(), &root);
        auth.write_registry(&Authority::Secure {
            generation: "f".repeat(GENERATION_HEX_LEN),
        })
        .unwrap();
        let auth2 = make_authority(store.clone(), &root);
        let read = auth2.read_session().unwrap();
        assert_eq!(read.token, None);
        assert!(matches!(read.authority, Authority::Secure { .. }));
    }

    #[test]
    fn r13_crash_apres_none_purge_quand_store_recupere() {
        let root = temp_dir();
        let store = SyntheticStore::new();
        store.set_state(StoreState::Sain);
        let auth = make_authority(store.clone(), &root);
        auth.write_registry(&Authority::None).unwrap();
        store.set_value(Some("T1-ghost"));
        let auth2 = make_authority(store.clone(), &root);
        let read = auth2.read_session().unwrap();
        assert_eq!(read.token, None);
        assert_eq!(auth2.purge_os().unwrap(), PurgeResult::Purged);
        assert_eq!(store.value(), None);
    }

    // ------------------------------------------------------------------
    // R14 (suite) : surdimensionné / champs incohérents — aucune restauration.
    // ------------------------------------------------------------------

    #[test]
    fn r14_registre_oversized_no_restore() {
        let root = temp_dir();
        std::fs::create_dir_all(&root).unwrap();
        let trop_gros = "x".repeat(MAX_REGISTRY_BYTES + 1);
        std::fs::write(root.join(REGISTRY_FILE_NAME), &trop_gros).unwrap();
        let store = SyntheticStore::new();
        store.set_state(StoreState::Sain);
        store.set_value(Some("T1-readable"));
        let auth = make_authority(store.clone(), &root);
        let read = auth.read_session().unwrap();
        assert_eq!(read.token, None);
    }

    #[test]
    fn r14_registre_fallback_sans_token_no_restore() {
        let root = temp_dir();
        std::fs::create_dir_all(&root).unwrap();
        let raw = AuthorityFile {
            version: REGISTRY_VERSION,
            state: "fallback".to_string(),
            generation: Some("a".repeat(GENERATION_HEX_LEN)),
            token: None,
        };
        let mut buf = Vec::new();
        serde_json::to_writer(&mut buf, &raw).unwrap();
        std::fs::write(root.join(REGISTRY_FILE_NAME), &buf).unwrap();
        let store = SyntheticStore::new();
        store.set_state(StoreState::Sain);
        store.set_value(Some("T1-readable"));
        let auth = make_authority(store.clone(), &root);
        let read = auth.read_session().unwrap();
        assert_eq!(read.token, None);
    }

    #[test]
    fn r14_registre_none_avec_generation_incoherente() {
        let root = temp_dir();
        std::fs::create_dir_all(&root).unwrap();
        let raw = AuthorityFile {
            version: REGISTRY_VERSION,
            state: "none".to_string(),
            generation: Some("a".repeat(GENERATION_HEX_LEN)),
            token: None,
        };
        let mut buf = Vec::new();
        serde_json::to_writer(&mut buf, &raw).unwrap();
        std::fs::write(root.join(REGISTRY_FILE_NAME), &buf).unwrap();
        let store = SyntheticStore::new();
        store.set_state(StoreState::Sain);
        let auth = make_authority(store.clone(), &root);
        let read = auth.read_session().unwrap();
        assert_eq!(read.token, None);
    }

    #[test]
    fn r14_registre_generation_hex_invalide() {
        let root = temp_dir();
        std::fs::create_dir_all(&root).unwrap();
        let raw = AuthorityFile {
            version: REGISTRY_VERSION,
            state: "secure".to_string(),
            generation: Some("g".repeat(GENERATION_HEX_LEN)),
            token: None,
        };
        let mut buf = Vec::new();
        serde_json::to_writer(&mut buf, &raw).unwrap();
        std::fs::write(root.join(REGISTRY_FILE_NAME), &buf).unwrap();
        let store = SyntheticStore::new();
        store.set_state(StoreState::Sain);
        let auth = make_authority(store.clone(), &root);
        let read = auth.read_session().unwrap();
        assert_eq!(read.token, None);
    }

    #[test]
    fn r14_registre_etat_inconnu() {
        let root = temp_dir();
        std::fs::create_dir_all(&root).unwrap();
        let raw = AuthorityFile {
            version: REGISTRY_VERSION,
            state: "archive".to_string(),
            generation: None,
            token: None,
        };
        let mut buf = Vec::new();
        serde_json::to_writer(&mut buf, &raw).unwrap();
        std::fs::write(root.join(REGISTRY_FILE_NAME), &buf).unwrap();
        let store = SyntheticStore::new();
        store.set_state(StoreState::Sain);
        let auth = make_authority(store.clone(), &root);
        let read = auth.read_session().unwrap();
        assert_eq!(read.token, None);
    }

    #[test]
    fn r14_enveloppe_trop_grosse_erreur_pas_de_session() {
        let root = temp_dir();
        let store = SyntheticStore::new();
        store.set_state(StoreState::Sain);
        let auth = make_authority(store.clone(), &root);
        let generation = "a".repeat(GENERATION_HEX_LEN);
        auth.write_registry(&Authority::Secure { generation })
            .unwrap();
        let marqueur = "ENVELOPE-TROP-GROS-NE-PAS-FUIR";
        let contenu = format!("{marqueur}{}", "x".repeat(MAX_ENVELOPE_BYTES));
        assert!(contenu.len() > MAX_ENVELOPE_BYTES);
        store.set_value(Some(&contenu));
        let err = auth.read_session().unwrap_err();
        assert!(matches!(err, AuthorityError::Registry(_)));
        let err_text = format!("{err}");
        assert!(!err_text.contains(marqueur));
    }

    // ------------------------------------------------------------------
    // R17 (suite) : permissions, temporaires, mémoire après erreurs.
    // ------------------------------------------------------------------

    #[test]
    fn r17_registre_fichier_0600_unix() {
        if cfg!(unix) {
            let root = temp_dir();
            let store = SyntheticStore::new();
            store.set_state(StoreState::Sain);
            let auth = make_authority(store.clone(), &root);
            let _ = auth.install_session("T2-perm");
            use std::os::unix::fs::PermissionsExt;
            let mode = std::fs::metadata(root.join(REGISTRY_FILE_NAME))
                .unwrap()
                .permissions()
                .mode()
                & 0o777;
            assert_eq!(mode, 0o600, "le registre doit rester à 0600");
        }
    }

    #[test]
    fn r17_echec_installation_registre_inchange_aucune_session() {
        let root = temp_dir();
        let bloquant = root.join("bloquant");
        std::fs::write(&bloquant, "x").unwrap();
        let store = SyntheticStore::new();
        store.set_state(StoreState::Sain);
        let auth = SessionAuthority::new(
            store,
            bloquant.join(REGISTRY_FILE_NAME),
            temp_dir().join(LOCK_FILE_NAME),
        );
        assert!(auth.install_session("T2-secret-echec").is_err());
        // Aucun registre n'a pu être créé ; la lecture ne restaure aucune session
        // (chemin inaccessible : Ok(None) ou erreur d'E/S, jamais de jeton).
        let read = auth.read_session();
        assert!(
            matches!(read, Ok(ref r) if r.token.is_none()) || read.is_err(),
            "lecture inaccessible ne doit pas restaurer: {read:?}"
        );
        assert!(!bloquant.join(REGISTRY_FILE_NAME).exists());
    }

    #[test]
    fn r17_diagnostic_ne_fuite_pas_le_jeton() {
        let root = temp_dir();
        let bloquant = root.join("bloquant");
        std::fs::write(&bloquant, "x").unwrap();
        let store = SyntheticStore::new();
        store.set_state(StoreState::Sain);
        let auth = SessionAuthority::new(
            store,
            bloquant.join(REGISTRY_FILE_NAME),
            temp_dir().join(LOCK_FILE_NAME),
        );
        let err = auth
            .install_session("JETON-SECRET-NE-PAS-FUIR")
            .unwrap_err();
        assert!(!format!("{err}").contains("JETON-SECRET-NE-PAS-FUIR"));
    }

    // ------------------------------------------------------------------
    // R12 : indéterminé après remplacement (échec de sync_dir / acquittement).
    //       Remplacement déjà opéré : l'état committé est lisible, la
    //       réconciliation lit l'état réellement installé, jamais de T1
    //       opportuniste, aucun temporaire orphelin.
    // ------------------------------------------------------------------

    static SYNC_DIR_CALLS: AtomicUsize = AtomicUsize::new(0);

    fn sync_dir_force_echec_second(_path: &Path) -> Result<(), AuthorityError> {
        let n = SYNC_DIR_CALLS.fetch_add(1, Ordering::Relaxed);
        if n == 0 {
            Ok(())
        } else {
            Err(AuthorityError::Io("synchronisation forcée en échec".into()))
        }
    }

    #[test]
    fn r12_install_sync_dir_echec_apres_remplacement_indeterminate() {
        // Premier appel (pending) réussi ; le second (commit secure) échoue sur
        // sync_dir : le registre est déjà remplacé, sa durabilité n'est pas prouvée.
        SYNC_DIR_CALLS.store(0, Ordering::Relaxed);
        let root = temp_dir();
        let store = SyntheticStore::new();
        store.set_state(StoreState::Sain);
        let auth = make_authority(store.clone(), &root)
            .with_sync_dir_override(Some(sync_dir_force_echec_second));
        let err = auth.install_session("T2-indetermine").unwrap_err();
        assert!(matches!(
            err,
            InstallError::AfterPending(AuthorityError::Indeterminate(_))
        ));
        let state = registry_state(&root).unwrap();
        assert!(matches!(
            state,
            Authority::Secure { .. } | Authority::Fallback { .. }
        ));
        assert!(!matches!(state, Authority::Pending { .. }));
        let leftovers: Vec<_> = std::fs::read_dir(&root)
            .unwrap()
            .filter_map(|e| e.ok())
            .filter(|e| {
                e.file_name()
                    .to_string_lossy()
                    .starts_with(".desktop-session-")
            })
            .collect();
        assert!(
            leftovers.is_empty(),
            "aucun temporaire de registre orphelin"
        );
        // Réconciliation : une nouvelle instance lit l'état réellement installé.
        let auth2 = make_authority(store.clone(), &root);
        let read = auth2.read_session().unwrap();
        assert_eq!(read.token, Some("T2-indetermine".to_string()));
        assert!(matches!(read.authority, Authority::Secure { .. }));
    }

    // ------------------------------------------------------------------
    // R03/R12 : toute erreur de construction `open()` (y compris
    //           `StoreError::Other`) mène au repli `fallback(g, T2)` sans
    //       laisser l'état `pending`.
    // ------------------------------------------------------------------

    #[test]
    fn install_open_error_other_fallback_sans_pending() {
        let root = temp_dir();
        let store = SyntheticStore::new();
        store.set_state(StoreState::Sain);
        store.set_open_error(StoreError::Other("backend verrouille".into()));
        let auth = make_authority(store.clone(), &root);
        let outcome = auth.install_session("T2-autre").unwrap();
        assert_eq!(outcome.commit, CommitResult::Fallback);
        match registry_state(&root).unwrap() {
            Authority::Fallback { token, .. } => assert_eq!(token, "T2-autre"),
            other => panic!("expected fallback, got {other:?}"),
        }
        assert!(!matches!(
            registry_state(&root).unwrap(),
            Authority::Pending { .. }
        ));
        let history = store.history();
        assert!(history.iter().all(|c| {
            !matches!(
                c,
                StoreCall::Set { .. } | StoreCall::Get { .. } | StoreCall::Delete { .. }
            )
        }));
    }

    // ------------------------------------------------------------------
    // R10 : open() != Unavailable après tombstone durable ->
    //       `LogoutResult::DurableDeferred`, tombstone conservée, nettoyage
    //       différé (pas de suppression OS).
    // ------------------------------------------------------------------

    #[test]
    fn logout_open_error_other_durable_deferred() {
        let root = temp_dir();
        let store = SyntheticStore::new();
        store.set_state(StoreState::Sain);
        store.set_open_error(StoreError::Other("ferme".into()));
        let auth = make_authority(store.clone(), &root);
        let result = auth.logout().unwrap();
        assert_eq!(result, LogoutResult::DurableDeferred);
        assert!(matches!(registry_state(&root).unwrap(), Authority::None));
        let history = store.history();
        assert!(history
            .iter()
            .all(|c| !matches!(c, StoreCall::Delete { .. })));
    }
}

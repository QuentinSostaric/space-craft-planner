//! Tests d'intégration du protocole d'autorité durable des sessions desktop.
//!
//! Ces tests simulent plusieurs processus (plusieurs instances de
//! `SessionAuthority` sur le même registre-fichier et le même verrou) avec un
//! magasin de credentials synthétique en mémoire par instance. Aucun credential
//! réel, aucun keyring système, aucun service Secret Service n'est utilisé.

use item_fabricator_lib::session_authority::*;
use std::sync::{Arc, Mutex};
use std::time::SystemTime;

// ---------------------------------------------------------------------------
// Magasin synthétique (double de test) - aucun credential réel.
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, PartialEq, Eq)]
enum St {
    Sain,
    Indisponible,
}

struct Entry {
    value: Mutex<Option<String>>,
    state: Mutex<St>,
    fail_set: Mutex<bool>,
    fail_delete: Mutex<bool>,
    delete_result: Mutex<Result<(), StoreError>>,
}

impl Entry {
    fn new() -> Arc<Self> {
        Arc::new(Self {
            value: Mutex::new(None),
            state: Mutex::new(St::Sain),
            fail_set: Mutex::new(false),
            fail_delete: Mutex::new(false),
            delete_result: Mutex::new(Ok(())),
        })
    }
}

impl CredentialEntry for Entry {
    fn set_password(&self, value: &str) -> Result<(), StoreError> {
        if *self.fail_set.lock().unwrap() {
            return Err(StoreError::WriteFailed);
        }
        *self.value.lock().unwrap() = Some(value.to_string());
        Ok(())
    }
    fn get_password(&self) -> Result<Option<String>, StoreError> {
        match *self.state.lock().unwrap() {
            St::Indisponible => Err(StoreError::Unavailable),
            _ => Ok(self.value.lock().unwrap().clone()),
        }
    }
    fn delete_credential(&self) -> Result<(), StoreError> {
        if *self.fail_delete.lock().unwrap() {
            return self.delete_result.lock().unwrap().clone();
        }
        self.value.lock().unwrap().take();
        Ok(())
    }
}

// Handle partagé : `CredentialEntry` ne peut pas être implémenté pour `Arc<Entry>` ici (règle orpheline).
struct Handle(Arc<Entry>);

impl CredentialEntry for Handle {
    fn set_password(&self, value: &str) -> Result<(), StoreError> {
        self.0.set_password(value)
    }
    fn get_password(&self) -> Result<Option<String>, StoreError> {
        self.0.get_password()
    }
    fn delete_credential(&self) -> Result<(), StoreError> {
        self.0.delete_credential()
    }
}

struct StoreInner {
    entry: Mutex<Option<Arc<Entry>>>,
    state: Mutex<St>,
}

/// Les clones partagent le même stockage synthétique (reprise par un « autre processus »).
#[derive(Clone)]
struct Store(Arc<StoreInner>);

impl Store {
    fn new() -> Self {
        Self(Arc::new(StoreInner {
            entry: Mutex::new(None),
            state: Mutex::new(St::Sain),
        }))
    }
    fn entry(&self) -> Arc<Entry> {
        self.0
            .entry
            .lock()
            .unwrap()
            .get_or_insert_with(Entry::new)
            .clone()
    }
    fn set_state(&self, s: St) {
        *self.0.state.lock().unwrap() = s;
    }
    fn set_value(&self, v: Option<&str>) {
        *self.entry().value.lock().unwrap() = v.map(|s| s.to_string());
    }
    fn value(&self) -> Option<String> {
        self.0
            .entry
            .lock()
            .unwrap()
            .as_ref()
            .and_then(|e| e.value.lock().unwrap().clone())
    }
}

impl CredentialStore for Store {
    type Entry = Handle;
    fn open(&self) -> Result<Self::Entry, StoreError> {
        let state = self.0.state.lock().unwrap().clone();
        match state {
            St::Indisponible => Err(StoreError::Unavailable),
            _ => Ok(Handle(self.entry())),
        }
    }
}

fn auth_for(store: Store, root: &std::path::Path) -> SessionAuthority<Store> {
    SessionAuthority::new(
        store,
        root.join("desktop-session.token"),
        root.join("desktop-session.lock"),
    )
}

fn temp_dir() -> std::path::PathBuf {
    let dir = std::env::temp_dir().join(format!(
        "mycroft-session-integ-{}-{}",
        std::process::id(),
        SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos()
    ));
    std::fs::create_dir_all(&dir).unwrap();
    dir
}

// ---------------------------------------------------------------------------
// R02 : autre processus relance, T2 seul jamais T1, purge sous verrou.
// ---------------------------------------------------------------------------

#[test]
fn integ_recovery_other_process_t2_only() {
    let root = temp_dir();
    let store = Store::new();
    store.set_value(Some("T1-old-account"));
    store.set_state(St::Indisponible);
    let auth_a = auth_for(store.clone(), &root);
    let outcome = auth_a.install_session("T2-new-account").unwrap();
    assert_eq!(outcome.commit, CommitResult::Fallback);

    // "Autre processus" : nouvelle instance sur le même stockage, backend récupéré.
    store.set_state(St::Sain);
    let auth_b = auth_for(store.clone(), &root);
    let read = auth_b.read_session().unwrap();
    assert_eq!(read.token, Some("T2-new-account".to_string()));
    assert!(matches!(read.authority, Authority::Fallback { .. }));
    assert_eq!(store.value(), None); // T1 purgé, jamais restauré
}

// ---------------------------------------------------------------------------
// R10 : logout sans Entry, none conservé, jamais T1, purge différée.
// ---------------------------------------------------------------------------

#[test]
fn integ_logout_without_entry_none_kept() {
    let root = temp_dir();
    let store = Store::new();
    store.set_state(St::Indisponible);
    let auth = auth_for(store.clone(), &root);
    let result = auth.logout().unwrap();
    assert!(matches!(result, LogoutResult::DurableDeferred));
    // Relance : none conservé, T1 ghost jamais restauré.
    store.set_value(Some("T1-ghost"));
    store.set_state(St::Sain);
    let auth_b = auth_for(store.clone(), &root);
    let read = auth_b.read_session().unwrap();
    assert_eq!(read.token, None);
    let _ = auth_b.purge_os().unwrap();
    assert_eq!(store.value(), None);
}

// ---------------------------------------------------------------------------
// R13 : crash après pending puis relance -> aucune session, jamais T1.
// ---------------------------------------------------------------------------

#[test]
fn integ_crash_after_pending_no_session() {
    let root = temp_dir();
    let store = Store::new();
    store.set_state(St::Sain);
    let auth = auth_for(store.clone(), &root);
    auth.write_registry(&Authority::Pending {
        generation: "c".repeat(64),
    })
    .unwrap();
    store.set_value(Some("T1-present"));
    let auth_b = auth_for(store.clone(), &root);
    let read = auth_b.read_session().unwrap();
    assert_eq!(read.token, None);
    assert!(matches!(read.authority, Authority::Pending { .. }));
}

// ---------------------------------------------------------------------------
// R15 : deux processus, dernier commit fait autorité, pas de purge tardive.
// ---------------------------------------------------------------------------

#[test]
fn integ_two_processes_last_commit_wins() {
    let root = temp_dir();
    let auth_a = auth_for(Store::new(), &root);
    let _ = auth_a.install_session("T2");
    let auth_b = auth_for(Store::new(), &root);
    let outcome_b = auth_b.install_session("T3").unwrap();
    assert_eq!(outcome_b.commit, CommitResult::Secure);
    let read = auth_b.read_session().unwrap();
    assert_eq!(read.token, Some("T3".to_string()));
    assert_eq!(
        read.authority,
        Authority::Secure {
            generation: outcome_b.generation
        }
    );
}

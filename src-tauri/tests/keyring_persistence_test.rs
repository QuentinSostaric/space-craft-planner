use keyring::Entry;

const KEYRING_SERVICE: &str = "space.itemfab.desktop";
const KEYRING_SESSION_USER: &str = "desktop-session";

fn main() {
    let args: Vec<String> = std::env::args().collect();
    if args.len() < 2 {
        eprintln!("Usage: {} <write|read|write-read|delete>", args[0]);
        std::process::exit(1);
    }

    match args[1].as_str() {
        "write" => {
            let entry =
                Entry::new(KEYRING_SERVICE, KEYRING_SESSION_USER).expect("Failed to create entry");
            let token = "test-token-cross-process-12345";
            match entry.set_password(token) {
                Ok(_) => println!("SUCCESS: Wrote token to keyring"),
                Err(e) => eprintln!("ERROR: Failed to write: {}", e),
            }
            // Verify immediate read-back in same process
            match entry.get_password() {
                Ok(stored) if stored == token => println!("SUCCESS: Immediate read-back matches"),
                Ok(stored) => eprintln!("ERROR: Read-back mismatch: got '{}'", stored),
                Err(e) => eprintln!("ERROR: Immediate read-back failed: {}", e),
            }
        }
        "read" => {
            let entry =
                Entry::new(KEYRING_SERVICE, KEYRING_SESSION_USER).expect("Failed to create entry");
            match entry.get_password() {
                Ok(token) => println!("SUCCESS: Read token from keyring: {}", token),
                Err(keyring::Error::NoEntry) => println!("INFO: No entry found in keyring"),
                Err(e) => eprintln!("ERROR: Failed to read: {}", e),
            }
        }
        "write-read" => {
            let entry =
                Entry::new(KEYRING_SERVICE, KEYRING_SESSION_USER).expect("Failed to create entry");
            let token = "test-token-same-process-12345";
            match entry.set_password(token) {
                Ok(_) => println!("SUCCESS: Wrote token to keyring"),
                Err(e) => eprintln!("ERROR: Failed to write: {}", e),
            }
            match entry.get_password() {
                Ok(stored) if stored == token => println!("SUCCESS: Read-back matches"),
                Ok(stored) => eprintln!("ERROR: Read-back mismatch: got '{}'", stored),
                Err(e) => eprintln!("ERROR: Read-back failed: {}", e),
            }
        }
        "delete" => {
            let entry =
                Entry::new(KEYRING_SERVICE, KEYRING_SESSION_USER).expect("Failed to create entry");
            match entry.delete_credential() {
                Ok(_) => println!("SUCCESS: Deleted credential"),
                Err(keyring::Error::NoEntry) => println!("INFO: No entry to delete"),
                Err(e) => eprintln!("ERROR: Failed to delete: {}", e),
            }
        }
        _ => eprintln!("Unknown command: {}", args[1]),
    }
}

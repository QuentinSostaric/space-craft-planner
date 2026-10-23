use std::path::PathBuf;

const FONTCONFIG: &str = include_str!("linux-fonts.conf");

/// Must run before GTK/WebKit or any worker threads are initialized.
pub fn configure() {
    // Keep explicit font configuration supplied by the user or a launcher.
    if std::env::var_os("FONTCONFIG_FILE").is_some() {
        return;
    }

    let cache = std::env::var_os("XDG_CACHE_HOME")
        .filter(|path| !path.is_empty())
        .map(PathBuf::from)
        .filter(|path| path.is_absolute())
        .or_else(|| std::env::var_os("HOME").map(|home| PathBuf::from(home).join(".cache")));
    let Some(cache) = cache else {
        return;
    };
    let directory = cache.join("space.itemfab.desktop/fontconfig");
    let config = directory.join("fonts.conf");

    // Chromium can share cached WOFF placeholders without a font family. WebKit's
    // Skia font enumeration loops forever on these (WebKit bug 325185). Filter
    // only installed WOFF wrappers; web fonts and system font settings still work.
    let result = std::fs::create_dir_all(&directory).and_then(|()| {
        if std::fs::read_to_string(&config).ok().as_deref() != Some(FONTCONFIG) {
            let temporary = directory.join(format!("fonts-{}.conf", std::process::id()));
            std::fs::write(&temporary, FONTCONFIG)?;
            std::fs::rename(temporary, &config)?;
        }
        Ok(())
    });
    match result {
        Ok(()) => std::env::set_var("FONTCONFIG_FILE", config),
        Err(error) => eprintln!("Could not configure Linux font compatibility: {error}"),
    }
}

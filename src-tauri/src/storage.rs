//! Configuration paths and persistence shared by every application window.

use std::fs::{self, OpenOptions};
use std::io::{self, Write};
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

pub struct StoragePaths {
    config: PathBuf,
    pub webview: Option<PathBuf>,
    write_lock: Mutex<()>,
}

impl StoragePaths {
    pub fn discover(executable: &Path, config_dir: Option<&Path>) -> io::Result<Self> {
        let root = executable.parent().ok_or_else(|| {
            io::Error::new(
                io::ErrorKind::InvalidInput,
                "Executable has no parent directory",
            )
        })?;
        let marker = root.join("portable.flag");
        let portable = match fs::metadata(&marker) {
            Ok(metadata) if metadata.is_file() => true,
            Ok(_) => {
                return Err(io::Error::new(
                    io::ErrorKind::InvalidInput,
                    "portable.flag must be a file",
                ))
            }
            Err(e) if e.kind() == io::ErrorKind::NotFound => false,
            Err(e) => return Err(e),
        };
        let (config, webview) = if portable {
            let data = root.join("Data");
            (data.join("trguing.json"), Some(data.join("WebView2")))
        } else {
            let dir = config_dir.ok_or_else(|| {
                io::Error::new(
                    io::ErrorKind::NotFound,
                    "Unable to resolve configuration directory",
                )
            })?;
            (dir.join("trguing.json"), None)
        };
        Ok(Self {
            config,
            webview,
            write_lock: Mutex::new(()),
        })
    }

    pub fn prepare(&self) -> io::Result<()> {
        if let Some(webview) = &self.webview {
            fs::create_dir_all(webview)?;
        }
        Ok(())
    }

    pub fn read(&self) -> io::Result<String> {
        fs::read_to_string(&self.config)
    }

    pub fn write(&self, contents: &str) -> io::Result<()> {
        let _guard = self
            .write_lock
            .lock()
            .map_err(|_| io::Error::other("Configuration lock poisoned"))?;
        let parent = self
            .config
            .parent()
            .ok_or_else(|| io::Error::other("Invalid configuration path"))?;
        fs::create_dir_all(parent)?;
        let stamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map_err(io::Error::other)?
            .as_nanos();
        let temporary = parent.join(format!("trguing.json.{}.{stamp}.tmp", std::process::id()));
        let result = (|| {
            let mut file = OpenOptions::new()
                .write(true)
                .create_new(true)
                .open(&temporary)?;
            file.write_all(contents.as_bytes())?;
            file.sync_all()?;
            drop(file);
            fs::rename(&temporary, &self.config)
        })();
        if result.is_err() {
            let _ = fs::remove_file(&temporary);
        }
        result
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicUsize, Ordering};

    static NEXT_FIXTURE: AtomicUsize = AtomicUsize::new(0);

    struct Fixture(PathBuf);
    impl Fixture {
        fn new() -> Self {
            let stamp = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos();
            let path = std::env::temp_dir().join(format!(
                "trguing-portable-{}-{}-{stamp}",
                std::process::id(),
                NEXT_FIXTURE.fetch_add(1, Ordering::Relaxed)
            ));
            fs::create_dir_all(path.join("Aplicação portátil")).unwrap();
            fs::create_dir_all(path.join("Roaming")).unwrap();
            Self(path)
        }
        fn exe(&self) -> PathBuf {
            self.0.join("Aplicação portátil/TrguiNG.exe")
        }
        fn roaming(&self) -> PathBuf {
            self.0.join("Roaming")
        }
    }
    impl Drop for Fixture {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.0);
        }
    }

    #[test]
    fn installed_mode_keeps_existing_configuration() {
        let f = Fixture::new();
        fs::write(f.roaming().join("trguing.json"), "installed").unwrap();
        let paths = StoragePaths::discover(&f.exe(), Some(&f.roaming())).unwrap();
        assert!(paths.webview.is_none());
        assert_eq!(paths.read().unwrap(), "installed");
        paths.write("updated").unwrap();
        assert_eq!(
            fs::read_to_string(f.roaming().join("trguing.json")).unwrap(),
            "updated"
        );
        assert!(!f.exe().parent().unwrap().join("Data").exists());
    }

    #[test]
    fn portable_mode_is_independent_of_roaming_and_survives_relocation() {
        let f = Fixture::new();
        let root = f.exe().parent().unwrap().to_path_buf();
        fs::write(root.join("portable.flag"), "").unwrap();
        fs::write(f.roaming().join("trguing.json"), "original").unwrap();
        let paths = StoragePaths::discover(&f.exe(), None).unwrap();
        paths.prepare().unwrap();
        assert!(paths.webview.as_ref().unwrap().is_dir());
        assert!(paths.read().is_err());
        paths.write("{\"portable\":true}").unwrap();
        paths.write("{\"portable\":\"updated\"}").unwrap();
        assert_eq!(
            fs::read_to_string(f.roaming().join("trguing.json")).unwrap(),
            "original"
        );
        let moved = f.0.join("Outra pasta");
        fs::rename(&root, &moved).unwrap();
        let relocated =
            StoragePaths::discover(&moved.join("TrguiNG.exe"), Some(&f.roaming())).unwrap();
        assert_eq!(relocated.read().unwrap(), "{\"portable\":\"updated\"}");
    }

    #[test]
    fn concurrent_saves_leave_complete_configuration_and_no_temporary_files() {
        let f = Fixture::new();
        let paths =
            std::sync::Arc::new(StoragePaths::discover(&f.exe(), Some(&f.roaming())).unwrap());
        paths.write("initial").unwrap();
        let workers: Vec<_> = (0..4)
            .map(|i| {
                let paths = paths.clone();
                std::thread::spawn(move || {
                    let value = format!("writer-{i}:{}", "x".repeat(8192));
                    for _ in 0..10 {
                        paths.write(&value).unwrap();
                    }
                })
            })
            .collect();
        for worker in workers {
            worker.join().unwrap();
        }
        let value = paths.read().unwrap();
        assert!(value.starts_with("writer-"));
        assert_eq!(value.len(), 9 + 8192);
        assert_eq!(fs::read_dir(f.roaming()).unwrap().count(), 1);
    }

    #[test]
    fn invalid_marker_and_blocked_data_never_fall_back_to_roaming() {
        let f = Fixture::new();
        let root = f.exe().parent().unwrap().to_path_buf();
        fs::create_dir(root.join("portable.flag")).unwrap();
        assert!(StoragePaths::discover(&f.exe(), Some(&f.roaming())).is_err());
        fs::remove_dir(root.join("portable.flag")).unwrap();
        fs::write(root.join("portable.flag"), "").unwrap();
        fs::write(root.join("Data"), "blocked").unwrap();
        let paths = StoragePaths::discover(&f.exe(), Some(&f.roaming())).unwrap();
        assert!(paths.prepare().is_err());
        assert!(paths.write("must not reach Roaming").is_err());
        assert!(!f.roaming().join("trguing.json").exists());
    }
}

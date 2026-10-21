//! Esther's lists and tasks, in the same shape as the Electron app's (`src/data/model.ts`), kept in a JSON file
//! that both apps read and write: `%APPDATA%\Esther\tasks.json` on Windows.
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::time::SystemTime;

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct List {
    pub id: String,
    pub name: String,
    pub color: String,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct Subtask {
    pub id: String,
    pub text: String,
    pub done: bool,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Task {
    pub id: String,
    pub list_id: String,
    pub title: String,
    pub done: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub date: Option<String>,
    #[serde(default)]
    pub subtasks: Vec<Subtask>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub done_at: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct Data {
    pub version: u32,
    pub lists: Vec<List>,
    pub tasks: Vec<Task>,
}

impl Data {
    /// What a first start looks like: two lists, nothing to do yet.
    pub fn starter() -> Data {
        Data {
            version: 1,
            lists: vec![
                List { id: "general".into(), name: "General".into(), color: "#c8553a".into() },
                List { id: "home".into(), name: "Home".into(), color: "#3f9a80".into() },
            ],
            tasks: vec![],
        }
    }
}

/// Where the shared file lives. `ESTHER_DATA` overrides it (the tests use that).
pub fn data_path() -> PathBuf {
    if let Ok(p) = std::env::var("ESTHER_DATA") {
        return PathBuf::from(p);
    }
    let base = std::env::var("APPDATA")
        .map(PathBuf::from)
        .unwrap_or_else(|_| std::env::var("HOME").map(|h| PathBuf::from(h).join(".config")).unwrap_or_else(|_| PathBuf::from(".")));
    base.join("Esther").join("tasks.json")
}

/// The file, plus what we last wrote to it, so our own saves aren't mistaken for changes from the Electron app.
pub struct Store {
    pub path: PathBuf,
    pub data: Data,
    /// False until the file exists. The Esther app writes it; this card never creates it, so a fresh start here
    /// can't overwrite your tasks there.
    pub shared: bool,
    last_text: String,
    last_mtime: Option<SystemTime>,
}

fn mtime(p: &Path) -> Option<SystemTime> {
    std::fs::metadata(p).and_then(|m| m.modified()).ok()
}

impl Store {
    pub fn open(path: PathBuf) -> Store {
        let text = std::fs::read_to_string(&path).unwrap_or_default();
        let data = serde_json::from_str::<Data>(&text).ok().filter(|d| !d.lists.is_empty());
        Store { last_mtime: mtime(&path), path, shared: data.is_some(), data: data.unwrap_or_else(Data::starter), last_text: text }
    }

    /// Write the file (to a temporary file first, then swap it in, so a reader never sees half of it).
    pub fn save(&mut self) {
        if !self.shared {
            return;
        }
        let text = serde_json::to_string_pretty(&self.data).unwrap_or_default();
        if text == self.last_text {
            return;
        }
        if let Some(dir) = self.path.parent() {
            let _ = std::fs::create_dir_all(dir);
        }
        let tmp = self.path.with_extension("json.tmp");
        if std::fs::write(&tmp, &text).is_ok() && std::fs::rename(&tmp, &self.path).is_ok() {
            self.last_text = text;
            self.last_mtime = mtime(&self.path);
        }
    }

    /// Has the Electron app (or anyone) changed the file? Then take its version. Returns true if it did.
    pub fn reload_if_changed(&mut self) -> bool {
        let m = mtime(&self.path);
        if m == self.last_mtime {
            return false;
        }
        self.last_mtime = m;
        let Ok(text) = std::fs::read_to_string(&self.path) else { return false };
        if text == self.last_text {
            return false;
        }
        match serde_json::from_str::<Data>(&text) {
            Ok(d) if !d.lists.is_empty() => {
                self.last_text = text;
                self.data = d;
                self.shared = true;
                true
            }
            _ => false,
        }
    }
}

/// A new id like the Electron app's: a prefix, the time in base 36, and a little randomness.
pub fn new_id(prefix: &str) -> String {
    let now = SystemTime::now().duration_since(SystemTime::UNIX_EPOCH).unwrap_or_default();
    let n = now.as_millis() as u64;
    let r = (now.subsec_nanos() as u64).wrapping_mul(2654435761) % 46656;
    format!("{prefix}-{}{}", base36(n), base36(r))
}

fn base36(mut n: u64) -> String {
    const D: &[u8] = b"0123456789abcdefghijklmnopqrstuvwxyz";
    if n == 0 {
        return "0".into();
    }
    let mut s = Vec::new();
    while n > 0 {
        s.push(D[(n % 36) as usize]);
        n /= 36;
    }
    s.reverse();
    String::from_utf8(s).unwrap()
}

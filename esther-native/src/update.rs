//! Updates, as the Esther app does them: a check a minute after starting and every 4 hours against the "Esther
//! native" release on GitHub; a newer Setup is downloaded, checked against the SHA-256 GitHub gives for it, and then
//! offered ("Restart to update"), which closes Esther, runs the Setup quietly and opens Esther again. A copy that
//! wasn't installed (run straight from the download) can't update itself: it says a new version is out and where.
//!
//! The work happens on a thread of its own (with Windows' own curl.exe for the download); what it finds is handed to
//! the program on Slint's event loop.

use sha2::{Digest, Sha256};
use std::cell::RefCell;
use std::path::PathBuf;

const FEED: &str = "https://api.github.com/repos/FRANKKSONG/Frankk/releases/tags/esther-native";
pub const PAGE: &str = "https://github.com/FRANKKSONG/Frankk/releases/tag/esther-native";

#[derive(Clone, Debug, PartialEq)]
pub enum State {
    /// Not checked yet.
    Idle,
    Checking,
    /// This is the newest.
    Current,
    Downloading(String),
    /// Downloaded and checked: ready to install.
    Ready { version: String, setup: PathBuf },
    /// A newer version is out, but this copy isn't installed, so it can't update itself.
    Portable(String),
    Error(String),
}

impl State {
    /// What Settings → About says.
    pub fn text(&self) -> String {
        match self {
            State::Idle => "Checks for updates a minute after starting, then every 4 hours.".into(),
            State::Checking => "Checking for updates…".into(),
            State::Current => "You have the latest version.".into(),
            State::Downloading(v) => format!("Downloading {v}…"),
            State::Ready { version, .. } => format!("Version {version} is ready to install."),
            State::Portable(v) => format!("Version {v} is out. This copy wasn't installed, so it can't update itself: get the Setup file."),
            State::Error(e) => format!("Couldn't update ({e}). Esther will try again later."),
        }
    }
    /// The button beside it: "check", "restart", "page" or "" (none while busy).
    pub fn action(&self) -> &'static str {
        match self {
            State::Idle | State::Current | State::Error(_) => "check",
            State::Ready { .. } => "restart",
            State::Portable(_) => "page",
            State::Checking | State::Downloading(_) => "",
        }
    }
}

thread_local! {
    static ON_STATE: RefCell<Option<Box<dyn Fn(State)>>> = RefCell::new(None);
}
/// What to do with each new state (on Slint's event loop).
pub fn on_state(f: impl Fn(State) + 'static) {
    ON_STATE.with(|s| *s.borrow_mut() = Some(Box::new(f)));
}
fn send(s: State) {
    let _ = slint::invoke_from_event_loop(move || ON_STATE.with(|f| if let Some(f) = f.borrow().as_ref() { f(s) }));
}

/// Check (and, if there's a newer version, download it), on a thread of its own.
pub fn check_in_background() {
    send(State::Checking);
    std::thread::spawn(|| {
        let s = check(&|s| send(s));
        send(s);
    });
}

/// Was this copy put here by the Setup? (Then the Setup's uninstaller sits beside it.)
pub fn installed() -> bool {
    if let Ok(v) = std::env::var("ESTHER_UPDATE_INSTALLED") { return v == "1"; } // (for the test machine)
    std::env::current_exe().ok().and_then(|e| e.parent().map(|d| d.join("unins000.exe").exists())).unwrap_or(false)
}

fn version_of(v: &str) -> Option<(u32, u32, u32)> {
    let mut p = v.trim_start_matches('v').split('.').map(|x| x.parse::<u32>().ok());
    Some((p.next()??, p.next()??, p.next()??))
}

/// A command with no console window showing.
fn quiet(program: &str) -> std::process::Command {
    #[allow(unused_mut)]
    let mut c = std::process::Command::new(program);
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        c.creation_flags(0x0800_0000); // CREATE_NO_WINDOW
    }
    c
}
fn curl() -> std::process::Command {
    let mut c = quiet(if cfg!(windows) { "curl.exe" } else { "curl" });
    c.args(["-sSfL", "--max-time", "120", "-H", "User-Agent: Esther-native", "-H", "Accept: application/vnd.github+json"]);
    c
}
fn fetch(url: &str) -> Result<Vec<u8>, String> {
    let out = curl().arg(url).output().map_err(|e| format!("no curl: {e}"))?;
    if !out.status.success() {
        let err = String::from_utf8_lossy(&out.stderr).trim().to_string();
        return Err(if err.is_empty() { "no connection".into() } else { err.chars().take(120).collect() });
    }
    Ok(out.stdout)
}

/// Look for a newer version; if there is one and this copy is installed, download and check it. `progress` hears
/// about the download starting.
pub fn check(progress: &dyn Fn(State)) -> State {
    let feed = std::env::var("ESTHER_UPDATE_FEED").unwrap_or_else(|_| FEED.into());
    let body = match fetch(&feed) {
        Ok(b) => b,
        Err(e) => return State::Error(e),
    };
    let release: serde_json::Value = match serde_json::from_slice(&body) {
        Ok(v) => v,
        Err(_) => return State::Error("an answer Esther couldn't read".into()),
    };
    let mine = version_of(env!("CARGO_PKG_VERSION")).unwrap_or((0, 0, 0));
    // The newest Setup in the release: EstherNativeSetup-X.Y.Z.exe.
    let best = release["assets"]
        .as_array()
        .into_iter()
        .flatten()
        .filter_map(|a| {
            let name = a["name"].as_str()?;
            let v = name.strip_prefix("EstherNativeSetup-")?.strip_suffix(".exe")?;
            Some((version_of(v)?, v.to_string(), a.clone()))
        })
        .max_by_key(|(n, _, _)| *n);
    let Some((n, version, asset)) = best else { return State::Error("no Setup in the release".into()) };
    if n <= mine {
        return State::Current;
    }
    if !installed() {
        return State::Portable(version);
    }
    progress(State::Downloading(version.clone()));
    let (Some(url), Some(digest)) = (asset["browser_download_url"].as_str(), asset["digest"].as_str().and_then(|d| d.strip_prefix("sha256:"))) else {
        return State::Error("the release doesn't say what the Setup should be".into());
    };
    let dir = std::env::temp_dir().join("EstherNativeUpdate");
    let _ = std::fs::create_dir_all(&dir);
    let setup = dir.join(format!("EstherNativeSetup-{version}.exe"));
    let data = match fetch(url) {
        Ok(d) => d,
        Err(e) => return State::Error(e),
    };
    // Only a file that is exactly what was published is ever run.
    let got = format!("{:x}", Sha256::digest(&data));
    if !got.eq_ignore_ascii_case(digest) {
        return State::Error("the download didn't match what was published".into());
    }
    if let Err(e) = std::fs::write(&setup, &data) {
        return State::Error(format!("couldn't save it: {e}"));
    }
    State::Ready { version, setup }
}

/// Install the downloaded version: run its Setup quietly (it closes this Esther if it's still open, and opens Esther
/// again when it's done). The caller then quits.
pub fn install(setup: &std::path::Path) -> bool {
    cfg!(windows) && quiet(&setup.to_string_lossy()).args(["/VERYSILENT", "/SUPPRESSMSGBOXES", "/NORESTART", "/update=yes"]).spawn().is_ok()
}

/// Open the release page (for a copy that wasn't installed).
pub fn open_page() {
    if cfg!(windows) {
        let _ = quiet("explorer.exe").arg(PAGE).spawn();
    } else {
        let _ = std::process::Command::new("xdg-open").arg(PAGE).spawn();
    }
}

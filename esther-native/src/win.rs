//! The Windows side: the card sits on the desktop (owned by the desktop window, like the Electron cards), is a
//! tool window (no taskbar button, left alone by window-animation tools), has Windows' rounded corners, and can
//! report how much memory Esther uses.

#[cfg(windows)]
mod imp {
    use windows_sys::Win32::Foundation::HWND;
    use windows_sys::Win32::Graphics::Dwm::DwmSetWindowAttribute;
    use windows_sys::Win32::System::ProcessStatus::{K32GetProcessMemoryInfo, PROCESS_MEMORY_COUNTERS, PROCESS_MEMORY_COUNTERS_EX};
    use windows_sys::Win32::System::Threading::GetCurrentProcess;
    use windows_sys::Win32::UI::WindowsAndMessaging::*;

    const DWMWA_TRANSITIONS_FORCEDISABLED: u32 = 3;
    const DWMWA_WINDOW_CORNER_PREFERENCE: u32 = 33;
    const DWMWCP_ROUND: u32 = 2;

    fn wide(s: &str) -> Vec<u16> {
        s.encode_utf16().chain(std::iter::once(0)).collect()
    }

    /// The window that shows the desktop icons: Progman, or a WorkerW holding SHELLDLL_DefView.
    fn desktop_window() -> HWND {
        unsafe {
            let progman = FindWindowW(wide("Progman").as_ptr(), std::ptr::null());
            if !progman.is_null() && !FindWindowExW(progman, std::ptr::null_mut(), wide("SHELLDLL_DefView").as_ptr(), std::ptr::null()).is_null() {
                return progman;
            }
            let mut w = FindWindowExW(std::ptr::null_mut(), std::ptr::null_mut(), wide("WorkerW").as_ptr(), std::ptr::null());
            let mut i = 0;
            while !w.is_null() && i < 200 {
                if !FindWindowExW(w, std::ptr::null_mut(), wide("SHELLDLL_DefView").as_ptr(), std::ptr::null()).is_null() {
                    return w;
                }
                w = FindWindowExW(std::ptr::null_mut(), w, wide("WorkerW").as_ptr(), std::ptr::null());
                i += 1;
            }
            progman
        }
    }

    /// Make the card a desktop widget: on the desktop, rounded, no taskbar button, no Windows animations.
    pub fn style(hwnd: isize) -> String {
        let hwnd = hwnd as HWND;
        unsafe {
            let one: u32 = 1;
            let a = DwmSetWindowAttribute(hwnd, DWMWA_TRANSITIONS_FORCEDISABLED, &one as *const u32 as _, 4);
            let round = DWMWCP_ROUND;
            let b = DwmSetWindowAttribute(hwnd, DWMWA_WINDOW_CORNER_PREFERENCE, &round as *const u32 as _, 4);
            let ex = GetWindowLongPtrW(hwnd, GWL_EXSTYLE);
            SetWindowLongPtrW(hwnd, GWL_EXSTYLE, (ex | WS_EX_TOOLWINDOW as isize) & !(WS_EX_APPWINDOW as isize));
            let desk = desktop_window();
            SetWindowLongPtrW(hwnd, GWLP_HWNDPARENT, desk as isize);
            SetWindowPos(hwnd, HWND_BOTTOM, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE | SWP_FRAMECHANGED);
            format!("transitions-off {} round-corners {} owner {:?}", a == 0, b == 0, desk)
        }
    }

    /// Memory, in KB: (private, working set).
    pub fn memory_kb() -> (u64, u64) {
        unsafe {
            let mut c: PROCESS_MEMORY_COUNTERS_EX = std::mem::zeroed();
            c.cb = std::mem::size_of::<PROCESS_MEMORY_COUNTERS_EX>() as u32;
            K32GetProcessMemoryInfo(GetCurrentProcess(), &mut c as *mut _ as *mut PROCESS_MEMORY_COUNTERS, c.cb);
            ((c.PrivateUsage / 1024) as u64, (c.WorkingSetSize / 1024) as u64)
        }
    }

    pub fn screen_size() -> (u32, u32) {
        unsafe { (GetSystemMetrics(SM_CXSCREEN) as u32, GetSystemMetrics(SM_CYSCREEN) as u32) }
    }
}

#[cfg(not(windows))]
mod imp {
    pub fn style(_hwnd: isize) -> String {
        "not on Windows".into()
    }
    /// From /proc on Linux (for trying it out); (private ≈ RssAnon, working set = VmRSS), in KB.
    pub fn memory_kb() -> (u64, u64) {
        let s = std::fs::read_to_string("/proc/self/status").unwrap_or_default();
        let get = |k: &str| s.lines().find(|l| l.starts_with(k)).and_then(|l| l.split_whitespace().nth(1)).and_then(|v| v.parse().ok()).unwrap_or(0);
        (get("RssAnon:"), get("VmRSS:"))
    }
    pub fn screen_size() -> (u32, u32) {
        (1920, 1080)
    }
}

pub use imp::*;

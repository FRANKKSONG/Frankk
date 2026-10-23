//! The Windows side: the card sits on the desktop (owned by the desktop window, like the Electron cards), is a
//! tool window (no taskbar button, left alone by window-animation tools), has Windows' rounded corners, and can
//! report how much memory Esther uses.

#[cfg(windows)]
mod imp {
    use windows_sys::Win32::Foundation::HWND;
    use windows_sys::Win32::Foundation::{POINT, RECT};
    use windows_sys::Win32::Graphics::Dwm::{DwmGetWindowAttribute, DwmSetWindowAttribute};
    use windows_sys::Win32::UI::Input::KeyboardAndMouse::*;
    use windows_sys::Win32::System::ProcessStatus::{K32GetProcessMemoryInfo, PROCESS_MEMORY_COUNTERS, PROCESS_MEMORY_COUNTERS_EX2};
    use windows_sys::Win32::System::Threading::GetCurrentProcess;
    use windows_sys::Win32::UI::WindowsAndMessaging::*;

    const DWMWA_TRANSITIONS_FORCEDISABLED: u32 = 3;
    const DWMWA_WINDOW_CORNER_PREFERENCE: u32 = 33;
    const DWMWCP_ROUND: u32 = 2;
    const DWMWCP_DONOTROUND: u32 = 1;
    const DWMWA_BORDER_COLOR: u32 = 34;
    const DWMWA_COLOR_NONE: u32 = 0xFFFF_FFFE;

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

    /// Make the card a desktop widget: on the desktop, rounded, no taskbar button, no Windows animations, and no
    /// border from Windows (Esther draws its own edge). A bare window (the bubble: just the word) isn't rounded either.
    pub fn style(hwnd: isize, bare: bool) -> String {
        let hwnd = hwnd as HWND;
        unsafe {
            let one: u32 = 1;
            let a = DwmSetWindowAttribute(hwnd, DWMWA_TRANSITIONS_FORCEDISABLED, &one as *const u32 as _, 4);
            let round = if bare { DWMWCP_DONOTROUND } else { DWMWCP_ROUND };
            let b = DwmSetWindowAttribute(hwnd, DWMWA_WINDOW_CORNER_PREFERENCE, &round as *const u32 as _, 4);
            // No border from Windows: the cards draw their own edge (a second line beside it looked doubled), and the
            // bubble is just the word.
            let none = DWMWA_COLOR_NONE;
            DwmSetWindowAttribute(hwnd, DWMWA_BORDER_COLOR, &none as *const u32 as _, 4);
            let ex = GetWindowLongPtrW(hwnd, GWL_EXSTYLE);
            SetWindowLongPtrW(hwnd, GWL_EXSTYLE, (ex | WS_EX_TOOLWINDOW as isize) & !(WS_EX_APPWINDOW as isize));
            let desk = desktop_window();
            SetWindowLongPtrW(hwnd, GWLP_HWNDPARENT, desk as isize);
            SetWindowPos(hwnd, HWND_BOTTOM, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE | SWP_FRAMECHANGED);
            format!("transitions-off {} round-corners {} owner {:?}", a == 0, b == 0, desk)
        }
    }

    /// Windows' own acrylic glass behind the window: it blurs whatever is behind the card, live, and Windows does
    /// the work (in its compositor, on the graphics card), so it costs Esther nothing. The card draws only its tint
    /// over it. Windows 11 22H2 and later have a documented way; before that, the way docks and other desktop tools
    /// use. Returns which one took ("" if neither: then Esther paints its own glass).
    pub fn acrylic(hwnd: isize) -> &'static str {
        if accent(hwnd, 4) { "acrylic accent" } else { "" }
    }
    /// No acrylic (Esther's own glass instead).
    pub fn acrylic_off(hwnd: isize) {
        accent(hwnd, 0);
    }
    fn accent(hwnd: isize, state: u32) -> bool {
        // (Windows 11's documented backdrop needs the window's frame stretched over all of it, and on a frameless
        // card Windows then draws its own caption buttons and the card's content goes; so the accent, as docks do.)
        // SetWindowCompositionAttribute with an acrylic accent (Windows 10 1803 and later, Windows 11).
        #[repr(C)]
        struct Accent { state: u32, flags: u32, gradient: u32, animation: u32 }
        #[repr(C)]
        struct Data { attrib: u32, data: *mut core::ffi::c_void, size: usize }
        let h = hwnd as HWND;
        unsafe {
            let user = windows_sys::Win32::System::LibraryLoader::GetModuleHandleW(wide("user32.dll").as_ptr());
            let Some(f) = windows_sys::Win32::System::LibraryLoader::GetProcAddress(user, c"SetWindowCompositionAttribute".as_ptr() as _) else { return false };
            let set: unsafe extern "system" fn(HWND, *mut Data) -> i32 = std::mem::transmute(f);
            // ACCENT_ENABLE_ACRYLICBLURBEHIND (4), with a nearly clear tint (AABBGGRR): Esther draws its own; or
            // ACCENT_DISABLED (0).
            let mut accent = Accent { state, flags: 0, gradient: 0x0113_1619, animation: 0 };
            let mut data = Data { attrib: 19, data: &mut accent as *mut Accent as _, size: std::mem::size_of::<Accent>() };
            set(h, &mut data) != 0
        }
    }

    /// Memory, in KB: (private, working set, private working set). The last is what Task Manager's Processes tab
    /// shows in its Memory column.
    pub fn memory_kb() -> (u64, u64, u64) {
        unsafe {
            let mut c: PROCESS_MEMORY_COUNTERS_EX2 = std::mem::zeroed();
            c.cb = std::mem::size_of::<PROCESS_MEMORY_COUNTERS_EX2>() as u32;
            K32GetProcessMemoryInfo(GetCurrentProcess(), &mut c as *mut _ as *mut PROCESS_MEMORY_COUNTERS, c.cb);
            ((c.PrivateUsage / 1024) as u64, (c.WorkingSetSize / 1024) as u64, (c.PrivateWorkingSetSize / 1024) as u64)
        }
    }

    pub fn screen_size() -> (u32, u32) {
        unsafe { (GetSystemMetrics(SM_CXSCREEN) as u32, GetSystemMetrics(SM_CYSCREEN) as u32) }
    }
    /// The main screen without the taskbar: (x, y, width, height).
    pub fn work_area() -> (i32, i32, i32, i32) {
        unsafe {
            let mut r = RECT { left: 0, top: 0, right: 0, bottom: 0 };
            if SystemParametersInfoW(SPI_GETWORKAREA, 0, &mut r as *mut RECT as _, 0) == 0 {
                let (w, h) = screen_size();
                return (0, 0, w as i32, h as i32);
            }
            (r.left, r.top, r.right - r.left, r.bottom - r.top)
        }
    }
    /// How much bigger than 96 dpi the screen is drawn (1.25 at 125 %).
    pub fn dpi_scale() -> f32 {
        unsafe { windows_sys::Win32::UI::HiDpi::GetDpiForSystem() as f32 / 96.0 }
    }

    // ---- The mouse and keys, for Esther's own moving and resizing (as in the Electron app). ----
    pub fn cursor() -> (i32, i32) {
        unsafe {
            let mut p = POINT { x: 0, y: 0 };
            GetCursorPos(&mut p);
            (p.x, p.y)
        }
    }
    /// Is the main mouse button still held? (The right one for left-handed settings.)
    pub fn button_down() -> bool {
        unsafe {
            let vk = if GetSystemMetrics(SM_SWAPBUTTON) != 0 { VK_RBUTTON } else { VK_LBUTTON };
            (GetAsyncKeyState(vk as i32) as u16 & 0x8000) != 0
        }
    }
    /// (Shift, Alt) held right now.
    pub fn mods() -> (bool, bool) {
        unsafe { ((GetAsyncKeyState(VK_SHIFT as i32) as u16 & 0x8000) != 0, (GetAsyncKeyState(VK_MENU as i32) as u16 & 0x8000) != 0) }
    }

    // ---- For the test machine: what Windows says about the window, and real mouse and keyboard input. ----
    pub fn window_rect(hwnd: isize) -> (i32, i32, i32, i32) {
        unsafe {
            let mut r = RECT { left: 0, top: 0, right: 0, bottom: 0 };
            GetWindowRect(hwnd as HWND, &mut r);
            (r.left, r.top, r.right, r.bottom)
        }
    }
    pub fn facts(hwnd: isize) -> (u32, bool, bool) {
        unsafe {
            let h = hwnd as HWND;
            let mut corner: u32 = 0;
            DwmGetWindowAttribute(h, DWMWA_WINDOW_CORNER_PREFERENCE, &mut corner as *mut u32 as _, 4);
            let tool = (GetWindowLongPtrW(h, GWL_EXSTYLE) as u32 & WS_EX_TOOLWINDOW) != 0;
            let owned = !GetWindow(h, GW_OWNER).is_null();
            (corner, tool, owned)
        }
    }
    /// For the test machine: minimise its console windows (they sit over the desktop), and close any dialog of
    /// another program's that popped up (the test machine's Windows sometimes warns about its page file).
    pub fn clear_consoles() {
        unsafe {
            let me = windows_sys::Win32::System::Threading::GetCurrentProcessId();
            let mut h = FindWindowExW(std::ptr::null_mut(), std::ptr::null_mut(), wide("#32770").as_ptr(), std::ptr::null());
            let mut n = 0;
            while !h.is_null() && n < 50 {
                let mut pid = 0u32;
                GetWindowThreadProcessId(h, &mut pid);
                if pid != me && IsWindowVisible(h) != 0 { PostMessageW(h, WM_CLOSE, 0, 0); }
                h = FindWindowExW(std::ptr::null_mut(), h, wide("#32770").as_ptr(), std::ptr::null());
                n += 1;
            }
            for c in ["CASCADIA_HOSTING_WINDOW_CLASS", "ConsoleWindowClass"] {
                for _ in 0..10 {
                    let h = FindWindowW(wide(c).as_ptr(), std::ptr::null());
                    if h.is_null() || IsIconic(h) != 0 { break; }
                    ShowWindow(h, SW_MINIMIZE);
                }
            }
        }
    }
    /// Which window is under (x, y): ours, or the class name of whatever covers it.
    pub fn under(x: i32, y: i32, hwnd: isize) -> String {
        unsafe {
            let w = GetAncestor(WindowFromPoint(POINT { x, y }), GA_ROOT);
            if w as isize == hwnd { return "card".into(); }
            let mut buf = [0u16; 128];
            let n = GetClassNameW(w, buf.as_mut_ptr(), 128);
            String::from_utf16_lossy(&buf[..n.max(0) as usize])
        }
    }
    /// Move the mouse to (x, y) as a real mouse would (a move in the input queue, so whatever is clicked next is
    /// clicked there; moving the pointer alone doesn't tell the window).
    pub fn set_cursor(x: i32, y: i32) {
        unsafe {
            let (vx, vy) = (GetSystemMetrics(SM_XVIRTUALSCREEN), GetSystemMetrics(SM_YVIRTUALSCREEN));
            let (vw, vh) = (GetSystemMetrics(SM_CXVIRTUALSCREEN).max(2), GetSystemMetrics(SM_CYVIRTUALSCREEN).max(2));
            let mut i: INPUT = std::mem::zeroed();
            i.r#type = INPUT_MOUSE;
            i.Anonymous.mi.dx = ((x - vx) as i64 * 65535 / (vw - 1) as i64) as i32;
            i.Anonymous.mi.dy = ((y - vy) as i64 * 65535 / (vh - 1) as i64) as i32;
            i.Anonymous.mi.dwFlags = MOUSEEVENTF_MOVE | MOUSEEVENTF_ABSOLUTE | MOUSEEVENTF_VIRTUALDESK;
            send(&[i]);
            SetCursorPos(x, y);
        }
    }
    fn send(inputs: &[INPUT]) {
        unsafe { SendInput(inputs.len() as u32, inputs.as_ptr(), std::mem::size_of::<INPUT>() as i32); }
    }
    pub fn mouse(down: bool) {
        let mut i: INPUT = unsafe { std::mem::zeroed() };
        i.r#type = INPUT_MOUSE;
        i.Anonymous.mi.dwFlags = if down { MOUSEEVENTF_LEFTDOWN } else { MOUSEEVENTF_LEFTUP };
        send(&[i]);
    }
    /// A right-click where the mouse is.
    pub fn right_click() {
        let mut v: [INPUT; 2] = unsafe { std::mem::zeroed() };
        for (i, f) in v.iter_mut().zip([MOUSEEVENTF_RIGHTDOWN, MOUSEEVENTF_RIGHTUP]) {
            i.r#type = INPUT_MOUSE;
            i.Anonymous.mi.dwFlags = f;
        }
        send(&v);
    }
    pub fn type_text(s: &str) {
        let mut v = Vec::new();
        for c in s.encode_utf16() {
            for up in [false, true] {
                let mut i: INPUT = unsafe { std::mem::zeroed() };
                i.r#type = INPUT_KEYBOARD;
                i.Anonymous.ki.wScan = c;
                i.Anonymous.ki.dwFlags = KEYEVENTF_UNICODE | if up { KEYEVENTF_KEYUP } else { 0 };
                v.push(i);
            }
        }
        send(&v);
    }
    /// Press keys together (in order) and let them go (in reverse), e.g. Ctrl+Alt+E.
    pub fn keys(vks: &[u16]) {
        let mut v = Vec::new();
        for (vk, up) in vks.iter().map(|k| (*k, false)).chain(vks.iter().rev().map(|k| (*k, true))) {
            let mut i: INPUT = unsafe { std::mem::zeroed() };
            i.r#type = INPUT_KEYBOARD;
            i.Anonymous.ki.wVk = vk;
            // (With its scan code, as a keyboard sends it.)
            i.Anonymous.ki.wScan = unsafe { MapVirtualKeyW(vk as u32, MAPVK_VK_TO_VSC) } as u16;
            i.Anonymous.ki.dwFlags = if up { KEYEVENTF_KEYUP } else { 0 };
            v.push(i);
        }
        send(&v);
    }
    pub fn enter() {
        let mut v = Vec::new();
        for up in [false, true] {
            let mut i: INPUT = unsafe { std::mem::zeroed() };
            i.r#type = INPUT_KEYBOARD;
            i.Anonymous.ki.wVk = VK_RETURN;
            i.Anonymous.ki.dwFlags = if up { KEYEVENTF_KEYUP } else { 0 };
            v.push(i);
        }
        send(&v);
    }
}

#[cfg(not(windows))]
mod imp {
    pub fn style(_hwnd: isize, _bare: bool) -> String {
        "not on Windows".into()
    }
    /// From /proc on Linux (for trying it out); (private ≈ RssAnon, working set = VmRSS, private working set ≈
    /// RssAnon), in KB.
    pub fn memory_kb() -> (u64, u64, u64) {
        let s = std::fs::read_to_string("/proc/self/status").unwrap_or_default();
        let get = |k: &str| s.lines().find(|l| l.starts_with(k)).and_then(|l| l.split_whitespace().nth(1)).and_then(|v| v.parse().ok()).unwrap_or(0);
        (get("RssAnon:"), get("VmRSS:"), get("RssAnon:"))
    }
    pub fn screen_size() -> (u32, u32) {
        (1920, 1080)
    }
    pub fn acrylic(_hwnd: isize) -> &'static str {
        ""
    }
    pub fn acrylic_off(_hwnd: isize) {}
    pub fn work_area() -> (i32, i32, i32, i32) {
        (0, 0, 1920, 1040)
    }
    pub fn dpi_scale() -> f32 {
        1.0
    }
    pub fn cursor() -> (i32, i32) { (0, 0) }
    pub fn button_down() -> bool { false }
    pub fn mods() -> (bool, bool) { (false, false) }
}

pub use imp::*;

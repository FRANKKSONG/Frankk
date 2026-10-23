//! Esther and Windows: the tray icon and its menu (Windows' own menu, light or dark with Windows), the show/hide
//! shortcut (Ctrl+Alt+E), starting with Windows, and what Esther does to its windows directly (showing, hiding,
//! fading, moving and sizing in one step, bringing them forward). Also, for the test machine, a picture of the
//! whole screen and where the tray icon is.
//!
//! The tray and the shortcut talk to a small hidden window of Esther's own; what they ask for is passed to the
//! program through `drain`, run on Slint's event loop.

use std::cell::RefCell;

/// What the tray or the shortcut asked for.
#[derive(Clone, Copy, Debug, PartialEq)]
pub enum Ev {
    /// The shortcut: hide if the cards are in front, otherwise bring them forward.
    Toggle,
    /// A click on the tray icon: hide if they're out, show if they're away.
    #[cfg_attr(not(windows), allow(dead_code))]
    TrayClick,
    /// A tray menu item (one of the `CMD_` numbers).
    Command(u32),
}

pub const CMD_SHOW_HIDE: u32 = 1;
pub const CMD_CARD: u32 = 10; // 10.. one per card, in KINDS order
pub const CMD_PUT_BACK: u32 = 20;
pub const CMD_SNAP: u32 = 21;
pub const CMD_BUBBLE: u32 = 22;
pub const CMD_STARTUP: u32 = 23;
pub const CMD_SETTINGS: u32 = 24;
pub const CMD_QUIT: u32 = 99;

/// What the tray menu shows (kept up to date by the program).
#[derive(Clone, Default)]
#[cfg_attr(not(windows), allow(dead_code))]
pub struct MenuState {
    pub visible: bool,
    pub cards: Vec<(String, bool)>,
    pub snap: bool,
    pub bubble: bool,
    pub startup: bool,
    /// The show/hide shortcut as shown ("Ctrl+Alt+E").
    pub keys: String,
}

/// A string as Windows wants it (UTF-16, ending in 0).
#[allow(dead_code)]
pub fn wide_str(s: &str) -> Vec<u16> {
    s.encode_utf16().chain(std::iter::once(0)).collect()
}

thread_local! {
    static QUEUE: RefCell<Vec<Ev>> = const { RefCell::new(Vec::new()) };
    static HANDLER: RefCell<Option<Box<dyn Fn(Ev)>>> = RefCell::new(None);
    static MENU: RefCell<MenuState> = RefCell::new(MenuState::default());
}

/// What to do with what the tray and the shortcut ask for.
pub fn on_event(f: impl Fn(Ev) + 'static) {
    HANDLER.with(|h| *h.borrow_mut() = Some(Box::new(f)));
}
pub fn set_menu(m: MenuState) {
    MENU.with(|s| *s.borrow_mut() = m);
}
#[allow(dead_code)]
fn push(ev: Ev) {
    QUEUE.with(|q| q.borrow_mut().push(ev));
    let _ = slint::invoke_from_event_loop(drain);
}
/// Run what was asked for (on Slint's event loop, never inside Windows' own message handling).
pub fn drain() {
    let evs: Vec<Ev> = QUEUE.with(|q| std::mem::take(&mut *q.borrow_mut()));
    HANDLER.with(|h| {
        if let Some(f) = h.borrow().as_ref() {
            for e in evs { f(e) }
        }
    });
}
/// Ask for something as if from the tray (the smoke test uses this for what it can't click).
#[allow(dead_code)]
pub fn send(ev: Ev) {
    push(ev)
}

#[cfg(windows)]
mod imp {
    use super::*;
    use windows_sys::Win32::Foundation::*;
    use windows_sys::Win32::Graphics::Gdi::*;
    use windows_sys::Win32::System::LibraryLoader::{GetModuleHandleW, GetProcAddress, LoadLibraryW};
    use windows_sys::Win32::System::Registry::*;
    use windows_sys::Win32::UI::Input::KeyboardAndMouse::{RegisterHotKey, UnregisterHotKey, MOD_NOREPEAT};
    use windows_sys::Win32::UI::Shell::*;
    use windows_sys::Win32::UI::WindowsAndMessaging::*;

    const WM_TRAY: u32 = WM_APP + 1;
    const HOTKEY_ID: i32 = 1;
    const RUN_KEY: &str = "Software\\Microsoft\\Windows\\CurrentVersion\\Run";
    const RUN_NAME: &str = "Esther native";

    pub(super) fn wide(s: &str) -> Vec<u16> {
        s.encode_utf16().chain(std::iter::once(0)).collect()
    }

    thread_local! {
        static HOST: std::cell::Cell<isize> = const { std::cell::Cell::new(0) };
        static TASKBAR_CREATED: std::cell::Cell<u32> = const { std::cell::Cell::new(0) };
        static ICON: std::cell::Cell<isize> = const { std::cell::Cell::new(0) };
        static TIP: RefCell<String> = RefCell::new(String::from("Esther"));
    }

    /// Menus in Windows' own light or dark, following Windows (as Electron does it: uxtheme's
    /// SetPreferredAppMode(AllowDark) and FlushMenuThemes, which have numbers rather than names).
    fn follow_dark_mode() {
        unsafe {
            let ux = LoadLibraryW(wide("uxtheme.dll").as_ptr());
            if ux.is_null() { return; }
            if let Some(f) = GetProcAddress(ux, 135 as *const u8) {
                let set_mode: unsafe extern "system" fn(i32) -> i32 = std::mem::transmute(f);
                set_mode(1);
            }
            if let Some(f) = GetProcAddress(ux, 136 as *const u8) {
                let flush: unsafe extern "system" fn() = std::mem::transmute(f);
                flush();
            }
        }
    }

    /// Is the taskbar light? (Then the tray "E" is dark, and the other way round.)
    fn taskbar_is_light() -> bool {
        let mut v: u32 = 0;
        let mut len: u32 = 4;
        let key = wide("Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize");
        let name = wide("SystemUsesLightTheme");
        unsafe { RegGetValueW(HKEY_CURRENT_USER, key.as_ptr(), name.as_ptr(), RRF_RT_REG_DWORD, std::ptr::null_mut(), &mut v as *mut u32 as _, &mut len) == 0 && v == 1 }
    }

    /// The tray icon: Esther's "E" in Instrument Serif, one colour, at the size Windows uses for it.
    fn tray_icon() -> HICON {
        let px = unsafe { GetSystemMetrics(SM_CXSMICON) };
        let light = !taskbar_is_light();
        let pick = |size: i32| -> &'static [u8] {
            match (light, size) {
                (true, ..=16) => include_bytes!("../ui/tray/e-light-16.png"),
                (true, 17..=20) => include_bytes!("../ui/tray/e-light-20.png"),
                (true, 21..=24) => include_bytes!("../ui/tray/e-light-24.png"),
                (true, 25..=32) => include_bytes!("../ui/tray/e-light-32.png"),
                (true, _) => include_bytes!("../ui/tray/e-light-48.png"),
                (false, ..=16) => include_bytes!("../ui/tray/e-dark-16.png"),
                (false, 17..=20) => include_bytes!("../ui/tray/e-dark-20.png"),
                (false, 21..=24) => include_bytes!("../ui/tray/e-dark-24.png"),
                (false, 25..=32) => include_bytes!("../ui/tray/e-dark-32.png"),
                (false, _) => include_bytes!("../ui/tray/e-dark-48.png"),
            }
        };
        let Ok(img) = image::load_from_memory(pick(px)) else { return std::ptr::null_mut() };
        let img = image::imageops::resize(&img.to_rgba8(), px as u32, px as u32, image::imageops::FilterType::Triangle);
        let (w, h) = img.dimensions();
        unsafe {
            let mut bi: BITMAPINFO = std::mem::zeroed();
            bi.bmiHeader.biSize = std::mem::size_of::<BITMAPINFOHEADER>() as u32;
            bi.bmiHeader.biWidth = w as i32;
            bi.bmiHeader.biHeight = -(h as i32);
            bi.bmiHeader.biPlanes = 1;
            bi.bmiHeader.biBitCount = 32;
            let mut bits: *mut core::ffi::c_void = std::ptr::null_mut();
            let color = CreateDIBSection(std::ptr::null_mut(), &bi, DIB_RGB_COLORS, &mut bits, std::ptr::null_mut(), 0);
            if color.is_null() { return std::ptr::null_mut(); }
            let out = std::slice::from_raw_parts_mut(bits as *mut u8, (w * h * 4) as usize);
            for (o, p) in out.chunks_exact_mut(4).zip(img.pixels()) {
                o.copy_from_slice(&[p.0[2], p.0[1], p.0[0], p.0[3]]);
            }
            let mask = CreateBitmap(w as i32, h as i32, 1, 1, std::ptr::null());
            let info = ICONINFO { fIcon: 1, xHotspot: 0, yHotspot: 0, hbmMask: mask, hbmColor: color };
            let icon = CreateIconIndirect(&info);
            DeleteObject(color as _);
            DeleteObject(mask as _);
            icon
        }
    }

    fn notify(op: NOTIFY_ICON_MESSAGE) -> bool {
        let host = HOST.with(|h| h.get());
        if host == 0 { return false; }
        unsafe {
            let mut nid: NOTIFYICONDATAW = std::mem::zeroed();
            nid.cbSize = std::mem::size_of::<NOTIFYICONDATAW>() as u32;
            nid.hWnd = host as HWND;
            nid.uID = 1;
            nid.uFlags = NIF_MESSAGE | NIF_ICON | NIF_TIP;
            nid.uCallbackMessage = WM_TRAY;
            if ICON.with(|i| i.get()) == 0 { ICON.with(|i| i.set(tray_icon() as isize)); }
            nid.hIcon = ICON.with(|i| i.get()) as HICON;
            let tip: Vec<u16> = TIP.with(|t| t.borrow().encode_utf16().take(127).collect());
            nid.szTip[..tip.len()].copy_from_slice(&tip);
            Shell_NotifyIconW(op, &nid) != 0
        }
    }

    /// Windows' own menu at the mouse, from what the program last said the menu shows. Returns the item picked.
    fn tray_menu(host: HWND) -> u32 {
        let m = MENU.with(|s| s.borrow().clone());
        unsafe {
            let menu = CreatePopupMenu();
            let add = |menu: HMENU, id: u32, text: &str, checked: bool| {
                let t = wide(text);
                AppendMenuW(menu, MF_STRING | if checked { MF_CHECKED } else { MF_UNCHECKED }, id as usize, t.as_ptr());
            };
            add(menu, CMD_SHOW_HIDE, &format!("{} Esther\t{}", if m.visible { "Hide" } else { "Show" }, m.keys), false);
            add(menu, CMD_SETTINGS, "Settings…", false);
            AppendMenuW(menu, MF_SEPARATOR, 0, std::ptr::null());
            let cards = CreatePopupMenu();
            for (i, (name, on)) in m.cards.iter().enumerate() { add(cards, CMD_CARD + i as u32, name, *on); }
            let t = wide("Cards");
            AppendMenuW(menu, MF_POPUP, cards as usize, t.as_ptr());
            add(menu, CMD_PUT_BACK, "Put the cards back", false);
            add(menu, CMD_SNAP, "Snap to the grid and guides", m.snap);
            add(menu, CMD_BUBBLE, "The Esther bubble", m.bubble);
            add(menu, CMD_STARTUP, "Start with Windows", m.startup);
            AppendMenuW(menu, MF_SEPARATOR, 0, std::ptr::null());
            add(menu, CMD_QUIT, "Quit Esther", false);
            let mut p = POINT { x: 0, y: 0 };
            GetCursorPos(&mut p);
            // (Esther's window must be in front while the menu is up, or the menu wouldn't close when you click
            // elsewhere; and a message afterwards, so it closes properly. Windows' own advice.)
            SetForegroundWindow(host);
            let cmd = TrackPopupMenuEx(menu, TPM_RETURNCMD | TPM_RIGHTBUTTON | TPM_BOTTOMALIGN | TPM_RIGHTALIGN, p.x, p.y, host, std::ptr::null());
            PostMessageW(host, WM_NULL, 0, 0);
            DestroyMenu(menu);
            cmd as u32
        }
    }

    unsafe extern "system" fn host_proc(hwnd: HWND, msg: u32, wp: WPARAM, lp: LPARAM) -> LRESULT {
        match msg {
            WM_TRAY => {
                match lp as u32 {
                    WM_LBUTTONUP => push(Ev::TrayClick),
                    WM_RBUTTONUP | WM_CONTEXTMENU => {
                        let cmd = tray_menu(hwnd);
                        if cmd != 0 { push(Ev::Command(cmd)); }
                    }
                    _ => {}
                }
                0
            }
            WM_HOTKEY if wp as i32 == HOTKEY_ID => { push(Ev::Toggle); 0 }
            // Explorer restarted: the tray is new, so put the icon back.
            m if m != 0 && m == TASKBAR_CREATED.with(|t| t.get()) => { notify(NIM_ADD); 0 }
            // The taskbar went light or dark: a new icon to match.
            WM_SETTINGCHANGE => {
                let old = ICON.with(|i| i.replace(0));
                notify(NIM_MODIFY);
                if old != 0 { DestroyIcon(old as HICON); }
                DefWindowProcW(hwnd, msg, wp, lp)
            }
            _ => DefWindowProcW(hwnd, msg, wp, lp),
        }
    }

    /// The show/hide shortcut: `mods` (MOD_ALT 1, MOD_CONTROL 2, MOD_SHIFT 4, MOD_WIN 8) and a virtual key. False
    /// if another app has those keys (then Esther has none: set the old ones again).
    pub fn set_hotkey(mods: u32, vk: u32) -> bool {
        let host = HOST.with(|h| h.get()) as HWND;
        unsafe {
            UnregisterHotKey(host, HOTKEY_ID);
            RegisterHotKey(host, HOTKEY_ID, mods | MOD_NOREPEAT, vk) != 0
        }
    }
    /// No shortcut for now (while new keys are being picked, so pressing the old ones doesn't hide Esther).
    pub fn clear_hotkey() {
        unsafe { UnregisterHotKey(HOST.with(|h| h.get()) as HWND, HOTKEY_ID); }
    }

    /// Make the hidden window, the tray icon and the shortcut (`mods`, `vk`). Returns whether the shortcut was free.
    pub fn start(tip: &str, mods: u32, vk: u32) -> bool {
        follow_dark_mode();
        TIP.with(|t| *t.borrow_mut() = tip.to_string());
        unsafe {
            let inst = GetModuleHandleW(std::ptr::null());
            let class = wide("EstherHost");
            let mut wc: WNDCLASSEXW = std::mem::zeroed();
            wc.cbSize = std::mem::size_of::<WNDCLASSEXW>() as u32;
            wc.lpfnWndProc = Some(host_proc);
            wc.hInstance = inst;
            wc.lpszClassName = class.as_ptr();
            RegisterClassExW(&wc);
            // A real (never shown) top-level window, not a message-only one: the tray menu needs it in front.
            let host = CreateWindowExW(WS_EX_TOOLWINDOW, class.as_ptr(), wide("Esther").as_ptr(), WS_POPUP, 0, 0, 0, 0, std::ptr::null_mut(), std::ptr::null_mut(), inst, std::ptr::null());
            HOST.with(|h| h.set(host as isize));
            TASKBAR_CREATED.with(|t| t.set(RegisterWindowMessageW(wide("TaskbarCreated").as_ptr())));
            notify(NIM_ADD);
            RegisterHotKey(host, HOTKEY_ID, mods | MOD_NOREPEAT, vk) != 0
        }
    }
    pub fn set_tip(tip: &str) {
        TIP.with(|t| *t.borrow_mut() = tip.to_string());
        notify(NIM_MODIFY);
    }
    pub fn stop() {
        notify(NIM_DELETE);
    }
    /// The hidden window the tray talks to.
    pub fn host() -> isize {
        HOST.with(|h| h.get())
    }
    /// What the tray sends when its icon is clicked (`right`: the right button), sent straight to Esther's hidden
    /// window (for the test machine, where Windows may tuck the icon away). From any thread.
    pub fn post_tray_click(host: isize, right: bool) {
        unsafe { PostMessageW(host as HWND, WM_TRAY, 1, if right { WM_RBUTTONUP } else { WM_LBUTTONUP } as LPARAM); }
    }

    // ---- Start with Windows: the "Esther native" value under HKCU\…\Run ----
    pub fn startup() -> bool {
        let (k, n) = (wide(RUN_KEY), wide(RUN_NAME));
        let mut len: u32 = 0;
        unsafe { RegGetValueW(HKEY_CURRENT_USER, k.as_ptr(), n.as_ptr(), RRF_RT_REG_SZ, std::ptr::null_mut(), std::ptr::null_mut(), &mut len) == 0 }
    }
    pub fn set_startup(on: bool) -> bool {
        let (k, n) = (wide(RUN_KEY), wide(RUN_NAME));
        unsafe {
            if on {
                let exe = std::env::current_exe().map(|p| p.display().to_string()).unwrap_or_default();
                let v = wide(&format!("\"{exe}\""));
                RegSetKeyValueW(HKEY_CURRENT_USER, k.as_ptr(), n.as_ptr(), REG_SZ, v.as_ptr() as _, (v.len() * 2) as u32) == 0
            } else {
                RegDeleteKeyValueW(HKEY_CURRENT_USER, k.as_ptr(), n.as_ptr()) == 0
            }
        }
    }

    // ---- The windows ----
    pub fn show(hwnd: isize, on: bool) {
        unsafe { ShowWindow(hwnd as HWND, if on { SW_SHOWNOACTIVATE } else { SW_HIDE }); }
    }
    pub fn is_visible(hwnd: isize) -> bool {
        unsafe { IsWindowVisible(hwnd as HWND) != 0 }
    }
    /// See-through by `alpha` (0–255) while fading; 255 takes the fading off again.
    pub fn set_alpha(hwnd: isize, alpha: u8) {
        unsafe {
            let h = hwnd as HWND;
            let ex = GetWindowLongPtrW(h, GWL_EXSTYLE);
            let layered = ex & WS_EX_LAYERED as isize != 0;
            if alpha == 255 {
                if layered {
                    SetWindowLongPtrW(h, GWL_EXSTYLE, ex & !(WS_EX_LAYERED as isize));
                    RedrawWindow(h, std::ptr::null(), std::ptr::null_mut(), RDW_INVALIDATE | RDW_FRAME | RDW_ALLCHILDREN);
                }
            } else {
                if !layered { SetWindowLongPtrW(h, GWL_EXSTYLE, ex | WS_EX_LAYERED as isize); }
                SetLayeredWindowAttributes(h, 0, alpha, LWA_ALPHA);
            }
        }
    }
    /// Move and size in one step (so the far edge doesn't wobble while you resize from the near one).
    pub fn set_rect(hwnd: isize, x: i32, y: i32, w: i32, h: i32) {
        unsafe { SetWindowPos(hwnd as HWND, std::ptr::null_mut(), x, y, w, h, SWP_NOZORDER | SWP_NOACTIVATE); }
    }
    /// In front of the other windows (still on the desktop layer: they go behind other apps again when you use those).
    pub fn raise(hwnd: isize) {
        unsafe { SetWindowPos(hwnd as HWND, HWND_TOP, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE); }
    }
    pub fn focus(hwnd: isize) {
        unsafe { SetForegroundWindow(hwnd as HWND); }
    }
    pub fn foreground() -> isize {
        unsafe { GetForegroundWindow() as isize }
    }

    // ---- For the test machine ----
    /// Where the tray icon is on the screen, if Windows shows it (not tucked in the overflow).
    pub fn tray_rect() -> Option<(i32, i32, i32, i32)> {
        let host = HOST.with(|h| h.get());
        unsafe {
            let mut id: NOTIFYICONIDENTIFIER = std::mem::zeroed();
            id.cbSize = std::mem::size_of::<NOTIFYICONIDENTIFIER>() as u32;
            id.hWnd = host as HWND;
            id.uID = 1;
            let mut r = RECT { left: 0, top: 0, right: 0, bottom: 0 };
            (Shell_NotifyIconGetRect(&id, &mut r) == 0 && r.right > r.left).then_some((r.left, r.top, r.right, r.bottom))
        }
    }
    /// Where item `index` of the menu that's showing is on the screen (separators count).
    pub fn menu_item_rect(index: u32) -> Option<(i32, i32, i32, i32)> {
        const MN_GETHMENU: u32 = 0x01E1;
        unsafe {
            let w = FindWindowW(wide("#32768").as_ptr(), std::ptr::null());
            if w.is_null() { return None; }
            let menu = SendMessageW(w, MN_GETHMENU, 0, 0) as HMENU;
            if menu.is_null() { return None; }
            let mut r = RECT { left: 0, top: 0, right: 0, bottom: 0 };
            (GetMenuItemRect(std::ptr::null_mut(), menu, index, &mut r) != 0).then_some((r.left, r.top, r.right, r.bottom))
        }
    }
    /// Is a menu (Windows' own, class #32768) showing?
    pub fn menu_open() -> bool {
        unsafe {
            let h = FindWindowW(wide("#32768").as_ptr(), std::ptr::null());
            !h.is_null() && IsWindowVisible(h) != 0
        }
    }
    /// A picture of the whole screen as Windows shows it (with every window, see-through ones too).
    pub fn capture() -> Option<image::RgbaImage> {
        unsafe {
            let (w, h) = (GetSystemMetrics(SM_CXSCREEN), GetSystemMetrics(SM_CYSCREEN));
            let screen = GetDC(std::ptr::null_mut());
            let mem = CreateCompatibleDC(screen);
            let mut bi: BITMAPINFO = std::mem::zeroed();
            bi.bmiHeader.biSize = std::mem::size_of::<BITMAPINFOHEADER>() as u32;
            bi.bmiHeader.biWidth = w;
            bi.bmiHeader.biHeight = -h;
            bi.bmiHeader.biPlanes = 1;
            bi.bmiHeader.biBitCount = 32;
            let mut bits: *mut core::ffi::c_void = std::ptr::null_mut();
            let dib = CreateDIBSection(screen, &bi, DIB_RGB_COLORS, &mut bits, std::ptr::null_mut(), 0);
            let old = SelectObject(mem, dib as _);
            BitBlt(mem, 0, 0, w, h, screen, 0, 0, SRCCOPY | CAPTUREBLT);
            let src = std::slice::from_raw_parts(bits as *const u8, (w * h * 4) as usize);
            let mut out = image::RgbaImage::new(w as u32, h as u32);
            for (o, p) in out.pixels_mut().zip(src.chunks_exact(4)) {
                *o = image::Rgba([p[2], p[1], p[0], 255]);
            }
            SelectObject(mem, old);
            DeleteObject(dib as _);
            DeleteDC(mem);
            ReleaseDC(std::ptr::null_mut(), screen);
            Some(out)
        }
    }
}

#[cfg(not(windows))]
mod imp {
    pub fn start(_tip: &str, _mods: u32, _vk: u32) -> bool { false }
    pub fn set_hotkey(_mods: u32, _vk: u32) -> bool { false }
    pub fn clear_hotkey() {}
    pub fn set_tip(_tip: &str) {}
    pub fn stop() {}
    pub fn host() -> isize { 0 }
    pub fn post_tray_click(_host: isize, _right: bool) {}
    pub fn startup() -> bool { false }
    pub fn set_startup(_on: bool) -> bool { false }
    pub fn show(_hwnd: isize, _on: bool) {}
    pub fn is_visible(_hwnd: isize) -> bool { true }
    pub fn set_alpha(_hwnd: isize, _alpha: u8) {}
    pub fn set_rect(_hwnd: isize, _x: i32, _y: i32, _w: i32, _h: i32) {}
    pub fn raise(_hwnd: isize) {}
    pub fn focus(_hwnd: isize) {}
    pub fn foreground() -> isize { 0 }
    pub fn tray_rect() -> Option<(i32, i32, i32, i32)> { None }
    pub fn menu_open() -> bool { false }
    pub fn menu_item_rect(_index: u32) -> Option<(i32, i32, i32, i32)> { None }
    pub fn capture() -> Option<image::RgbaImage> { None }
}

pub use imp::*;

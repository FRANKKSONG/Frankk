//! The Settings card: what it shows (filled from the program), and what it changes. The looks are the Esther app's
//! own (Gilded, Nocturne, Modern, Illuminated); the panel and highlight colours, how solid the panels are and the
//! glass can be changed on top of a look. The show/hide shortcut can be changed (Windows says whether the keys are
//! free). What's set is kept with the cards' places (`esther-native.json`).

use super::*;
use std::sync::atomic::{AtomicI64, AtomicU32, Ordering};

/// Days a finished task stays crossed out before it clears itself (0: never). Read by `clears` and `clear_old`.
pub static CLEAR_DAYS: AtomicI64 = AtomicI64::new(7);
/// How round the cards' corners are now (logical px, as f32 bits).
static CORNER: AtomicU32 = AtomicU32::new(0);

/// Shape a card's window to its rounded corners (so Windows' glass doesn't show past them).
pub fn shape(w: &Win) {
    if w.kind == "bubble" || w.hwnd.get() <= 0 {
        return;
    }
    let (_, _, pw, ph) = rect_of(w);
    let r = f32::from_bits(CORNER.load(Ordering::Relaxed)) * w.ui.window().scale_factor();
    win::round_window(w.hwnd.get(), pw, ph, r.round() as i32);
}

/// One of the Esther app's looks (its colours as the app has them).
pub struct LookDef {
    pub id: &'static str,
    label: &'static str,
    blurb: &'static str,
    panel: u32,
    panel_2: u32,
    pop: u32,
    text: u32,
    muted: u32,
    faint: u32,
    accent: u32,
    gold: u32,
    light: bool,
    /// How round the cards' corners are (logical px), as in the app.
    radius: f32,
}

pub const LOOKS: [LookDef; 4] = [
    LookDef { id: "gilded", label: "Gilded", blurb: "Readable dashboard, art and gold", panel: 0x191613, panel_2: 0x221e1a, pop: 0x1d1a16, text: 0xf2ede3, muted: 0xb9af9d, faint: 0x82796a, accent: 0xd9a63a, gold: 0xd9a63a, light: false, radius: 16.0 },
    LookDef { id: "nocturne", label: "Nocturne", blurb: "Black ink, bone and red", panel: 0x1a1714, panel_2: 0x221e1a, pop: 0x1d1a16, text: 0xebe3d1, muted: 0xb3a78f, faint: 0x7f7564, accent: 0xc9473b, gold: 0xd9a63a, light: false, radius: 0.0 },
    LookDef { id: "modern", label: "Modern", blurb: "Plain warm charcoal", panel: 0x1f1f1e, panel_2: 0x262625, pop: 0x2a2927, text: 0xece8e1, muted: 0x9a958b, faint: 0x6f6b63, accent: 0xe5935a, gold: 0xe6b04d, light: false, radius: 14.0 },
    LookDef { id: "illuminated", label: "Illuminated", blurb: "Vellum, ink and gold leaf", panel: 0xf2e9d2, panel_2: 0xe7dbbd, pop: 0xf4ecd6, text: 0x2a1e14, muted: 0x5b4733, faint: 0x8a7558, accent: 0xb8382a, gold: 0xc49a33, light: true, radius: 0.0 },
];
/// Panel colours to choose from (after the look's own).
const PANELS: [u32; 7] = [0x121110, 0x1b2230, 0x1c2620, 0x281d24, 0x2b2118, 0xe9e4da, 0xf2e9d2];
/// Highlight colours to choose from (after the look's own).
const ACCENTS: [u32; 9] = [0xd9a63a, 0xe5935a, 0xc8553a, 0xb44a6e, 0x8a4f8f, 0x4c6fb8, 0x5a93c4, 0x3f9a80, 0x6aa452];
/// When finished tasks clear: days (0: never), and how that reads.
const CLEAR: [(i64, &str); 6] = [(1, "1 day"), (3, "3 days"), (7, "A week"), (14, "2 weeks"), (30, "A month"), (0, "Never")];
/// The cards that can be on or off, with a line about each (as in the app).
const CARD_HINTS: [&str; 4] = ["The Esther logo, the greeting and the day’s line.", "Your lists and the task table.", "The month. Pick a day to filter Tasks.", "Monday to Sunday at a glance."];

pub fn look_def(id: &str) -> &'static LookDef {
    LOOKS.iter().find(|l| l.id == id).unwrap_or(&LOOKS[0])
}

fn rgb(c: u32) -> Color {
    Color::from_rgb_u8((c >> 16) as u8, (c >> 8) as u8, c as u8)
}
/// How light a colour looks (0 black, 1 white).
fn lightness(c: u32) -> f32 {
    let ch = |v: u32| {
        let v = (v & 0xff) as f32 / 255.0;
        if v <= 0.04045 { v / 12.92 } else { ((v + 0.055) / 1.055).powf(2.4) }
    };
    0.2126 * ch(c >> 16) + 0.7152 * ch(c >> 8) + 0.0722 * ch(c)
}

/// The colours in use: (panel, its text is dark?).
pub fn panel_of(p: &Prefs) -> (u32, bool) {
    let look = look_def(&p.look);
    let panel = p.panel.unwrap_or(look.panel);
    (panel, if p.panel.is_some() { lightness(panel) > 0.4 } else { look.light })
}

/// The look, the panel and highlight colours and the opacity, on every card.
pub fn apply_look(app: &App) {
    let p = app.prefs.borrow();
    let look = look_def(&p.look);
    let (panel, light) = panel_of(&p);
    // (A panel of your own: the text of a dark or a light look, whichever reads on it.)
    let ink = if p.panel.is_none() { look } else if light { look_def("illuminated") } else { look_def("gilded") };
    let accent = p.accent.unwrap_or(look.accent);
    let pop = if p.panel.is_none() { look.pop } else { panel };
    for w in &app.cards {
        let l = w.ui.global::<Look>();
        l.set_panel(rgb(panel));
        l.set_pop(rgb(pop));
        l.set_text(rgb(ink.text));
        l.set_muted(rgb(ink.muted));
        l.set_faint(rgb(ink.faint));
        l.set_accent(rgb(accent));
        l.set_accent_ink(if lightness(accent) > 0.35 { rgb(0x15110c) } else { rgb(0xf6eedb) });
        l.set_edge(if light { Color::from_argb_u8(0x24, 0, 0, 0) } else { Color::from_argb_u8(0x14, 0xff, 0xff, 0xff) });
        l.set_acrylic_tint(p.opacity);
        l.set_radius(look.radius);
    }
    // The cards' corners: cut smoothly by the renderer, and the window shaped to match (for Windows' glass).
    i_slint_renderer_software::set_window_corner_radius(look.radius);
    CORNER.store(look.radius.to_bits(), Ordering::Relaxed);
    for w in app.cards.iter().filter(|w| w.kind != "bubble") {
        shape(w);
        draw_whole(w);
    }
}

/// Esther's own glass is the blurred wallpaper, which shows through more than Windows' acrylic: a little more tint.
pub fn own_glass_alpha(p: &Prefs) -> f32 {
    (p.opacity + 0.22).min(1.0)
}

/// Windows' acrylic behind the cards, or Esther's own glass.
fn set_glass(app: &App, own: bool) {
    app.prefs.borrow_mut().glass_own = own;
    for w in app.cards.iter().filter(|w| w.kind != "bubble" && w.hwnd.get() > 0) {
        if own {
            win::acrylic_off(w.hwnd.get());
            w.acrylic.set("");
            w.ui.set_acrylic(false);
        } else {
            let a = win::acrylic(w.hwnd.get());
            w.acrylic.set(a);
            w.ui.set_acrylic(!a.is_empty());
            if !a.is_empty() { w.ui.set_has_glass(false); }
        }
    }
    paint_glass(app);
}

// ---- The show/hide shortcut ----
const MOD_ALT: u32 = 1;
const MOD_CONTROL: u32 = 2;
const MOD_SHIFT: u32 = 4;
const MOD_WIN: u32 = 8;

/// "Ctrl+Alt+E" for (mods, virtual key).
pub fn keys_name((mods, vk): (u32, u32)) -> String {
    let mut s = String::new();
    for (m, n) in [(MOD_CONTROL, "Ctrl+"), (MOD_ALT, "Alt+"), (MOD_SHIFT, "Shift+"), (MOD_WIN, "Win+")] {
        if mods & m != 0 { s.push_str(n); }
    }
    match vk {
        0x20 => s.push_str("Space"),
        0x70..=0x87 => s.push_str(&format!("F{}", vk - 0x6f)),
        _ => s.push(char::from_u32(vk).unwrap_or('?')),
    }
    s
}
/// The other way: "Ctrl+Alt+E" to (mods, virtual key).
pub fn parse_keys(s: &str) -> Option<(u32, u32)> {
    let mut mods = 0;
    let mut vk = None;
    for part in s.split('+') {
        match part {
            "Ctrl" => mods |= MOD_CONTROL,
            "Alt" => mods |= MOD_ALT,
            "Shift" => mods |= MOD_SHIFT,
            "Win" => mods |= MOD_WIN,
            "Space" => vk = Some(0x20),
            f if f.len() > 1 && f.starts_with('F') => vk = f[1..].parse::<u32>().ok().filter(|n| (1..=24).contains(n)).map(|n| 0x6f + n),
            c if c.len() == 1 && c.chars().all(|c| c.is_ascii_alphanumeric()) => vk = Some(c.to_ascii_uppercase().chars().next()? as u32),
            _ => return None,
        }
    }
    vk.filter(|_| mods & (MOD_CONTROL | MOD_ALT | MOD_WIN) != 0).map(|vk| (mods, vk))
}
/// A key as Slint gives it (a letter, a digit, Space or F1–F24 as Slint's own characters) to a virtual key.
fn vk_of(text: &str) -> Option<u32> {
    let mut chars = text.chars();
    let c = chars.next()?;
    if chars.next().is_some() { return None; }
    match c {
        'a'..='z' | 'A'..='Z' | '0'..='9' => Some(c.to_ascii_uppercase() as u32),
        ' ' => Some(0x20),
        '\u{F704}'..='\u{F71B}' => Some(0x70 + (c as u32 - 0xF704)),
        _ => None,
    }
}

fn keys_note(app: &App) -> String {
    if !cfg!(windows) { "The shortcut works on Windows.".into() } else if app.hotkey_ok.get() { "Shows or hides every card from anywhere.".into() } else { format!("Another app already uses {}. Pick others.", keys_name(app.prefs.borrow().keys)) }
}

// ---- Opening, closing, filling ----
pub fn open(app: &App) {
    app.settings_open.set(true);
    fill(app);
    let i = app.index("settings");
    let w = &app.cards[i];
    // (Somewhere it can be seen: back in the middle if its place is off the screen, say after a monitor went.)
    let r = rect_of(w);
    let fits = { let (ax, ay, aw, ah) = win::work_area(); r.0 >= ax - 8 && r.1 >= ay - 8 && r.0 + r.2 <= ax + aw + 8 && r.1 + 40 <= ay + ah };
    if !fits { set_rect(w, default_place("settings")); }
    log(&format!("settings: opening at {:?} (was {:?}{}), window {}", rect_of(w), r, if fits { "" } else { ", off the screen" }, w.hwnd.get()));
    if w.hwnd.get() == 0 {
        // (The first time: the window is made now; it fades in once Windows has it, like the cards at the start.)
        let _ = w.ui.show();
    } else {
        fade(app, i, true, 0.0, false);
        shell::raise(w.hwnd.get());
        shell::focus(w.hwnd.get());
    }
}
pub fn close(app: &App) {
    app.settings_open.set(false);
    fade(app, app.index("settings"), false, 0.0, false);
}

/// Memory in use, as Task Manager counts it.
pub fn memory_line() -> String {
    let (_, _, pws) = win::memory_kb();
    if pws == 0 { return "Task Manager’s figure shows here on Windows. Esther keeps under 25 MB.".into(); }
    format!("{:.1} MB now, as Task Manager counts it. Esther keeps under 25 MB.", pws as f64 / 1024.0)
}

/// Everything the Settings card shows, from what's set now.
pub fn fill(app: &App) {
    let s = app.card("settings").ui.global::<Settings>();
    let p = app.prefs.borrow();
    s.set_keys(keys_name(p.keys).into());
    if !s.get_recording() { s.set_keys_note(keys_note(app).into()); }
    s.set_bubble(p.bubble);
    s.set_bubble_size(p.bubble_size);
    s.set_snap(p.snap);
    s.set_startup(shell::startup());
    let cards: Vec<Choice> = KINDS[..4]
        .iter()
        .zip(CARD_NAMES)
        .zip(CARD_HINTS)
        .map(|((k, n), h)| Choice { id: (*k).into(), label: n.into(), hint: h.into(), on: !p.hidden.iter().any(|x| x == k) })
        .collect();
    s.set_cards(model(cards));
    let looks: Vec<LookChoice> = LOOKS
        .iter()
        .map(|l| LookChoice {
            id: l.id.into(),
            label: l.label.into(),
            blurb: l.blurb.into(),
            swatches: model([l.panel, l.panel_2, l.accent, l.gold, l.text].into_iter().map(rgb).collect()),
            on: l.id == look_def(&p.look).id,
        })
        .collect();
    s.set_looks(model(looks));
    let look = look_def(&p.look);
    let panels: Vec<Swatch> = std::iter::once((look.panel, p.panel.is_none()))
        .chain(PANELS.iter().map(|c| (*c, p.panel == Some(*c))))
        .map(|(c, on)| Swatch { color: rgb(c), on })
        .collect();
    s.set_panels(model(panels));
    let accents: Vec<Swatch> = std::iter::once((look.accent, p.accent.is_none()))
        .chain(ACCENTS.iter().filter(|c| **c != look.accent).map(|c| (*c, p.accent == Some(*c))))
        .map(|(c, on)| Swatch { color: rgb(c), on })
        .collect();
    s.set_accents(model(accents));
    s.set_opacity(p.opacity);
    s.set_acrylic_ok(cfg!(windows));
    s.set_glass(if p.glass_own || !cfg!(windows) { "esther" } else { "acrylic" }.into());
    s.set_blur(p.blur);
    let days = CLEAR_DAYS.load(Ordering::Relaxed);
    s.set_clear_choices(model(CLEAR.iter().map(|(d, l)| Choice { id: d.to_string().into(), label: (*l).into(), hint: "".into(), on: *d == days }).collect()));
    if !app.copy_note.borrow().is_empty() {
        s.set_copy_note(app.copy_note.borrow().clone().into());
    } else {
        let st = app.state.borrow();
        let (l, t) = (st.store.data.lists.len(), st.store.data.tasks.len());
        s.set_copy_note(format!("{l} list{} and {t} task{}. Saves a copy in your Documents folder (never over another file).", if l == 1 { "" } else { "s" }, if t == 1 { "" } else { "s" }).into());
    }
    s.set_version(env!("CARGO_PKG_VERSION").into());
    let u = app.update.borrow();
    s.set_update_text(u.text().into());
    s.set_update_action(u.action().into());
    s.set_memory(memory_line().into());
}

/// A copy of your lists and tasks in Documents, as a new file (a number added if one of that name is there).
fn save_copy(app: &App) -> String {
    let dir = std::env::var_os("USERPROFILE").map(|h| std::path::PathBuf::from(h).join("Documents")).filter(|d| d.is_dir()).unwrap_or_else(|| data::data_path().with_file_name(""));
    let day = iso(today());
    let mut path = dir.join(format!("esther-tasks-{day}.json"));
    let mut n = 2;
    while path.exists() {
        path = dir.join(format!("esther-tasks-{day}-{n}.json"));
        n += 1;
    }
    let text = serde_json::to_string_pretty(&app.state.borrow().store.data).unwrap_or_default();
    match std::fs::OpenOptions::new().write(true).create_new(true).open(&path).and_then(|mut f| std::io::Write::write_all(&mut f, text.as_bytes())) {
        Ok(()) => format!("Saved: {}", path.display()),
        Err(e) => format!("Couldn’t save a copy ({e})."),
    }
}

/// What the Settings card asked for.
pub fn set(app: &App, key: &str, value: &str) {
    let num = || value.parse::<f32>().unwrap_or(0.0);
    match key {
        "bubble" => on_shell(app, shell::Ev::Command(shell::CMD_BUBBLE)),
        "bubble-size" => {
            let k = (num().clamp(0.3, 1.5) * 100.0).round() / 100.0;
            app.prefs.borrow_mut().bubble_size = k;
            if app.collapsed.get() && app.prefs.borrow().bubble {
                let b = app.index("bubble");
                stop_anims(app, b);
                set_rect(&app.cards[b], bubble_rect(&app.prefs.borrow(), true));
            }
        }
        "snap" => on_shell(app, shell::Ev::Command(shell::CMD_SNAP)),
        "startup" => on_shell(app, shell::Ev::Command(shell::CMD_STARTUP)),
        "card" => {
            if let Some(i) = KINDS[..4].iter().position(|k| *k == value) { on_shell(app, shell::Ev::Command(shell::CMD_CARD + i as u32)) }
        }
        "put-back" => on_shell(app, shell::Ev::Command(shell::CMD_PUT_BACK)),
        "look" => {
            {
                let mut p = app.prefs.borrow_mut();
                p.look = look_def(value).id.into();
                p.panel = None;
                p.accent = None;
            }
            apply_look(app);
            paint_glass(app);
        }
        "panel" => {
            let i: usize = value.parse().unwrap_or(0);
            app.prefs.borrow_mut().panel = if i == 0 { None } else { PANELS.get(i - 1).copied() };
            apply_look(app);
            paint_glass(app);
        }
        "accent" => {
            let i: usize = value.parse().unwrap_or(0);
            let look = look_def(&app.prefs.borrow().look).accent;
            app.prefs.borrow_mut().accent = if i == 0 { None } else { ACCENTS.iter().filter(|c| **c != look).nth(i - 1).copied() };
            apply_look(app);
        }
        // (While the knob moves, only Windows' acrylic follows; Esther's own glass is made again when it's let go.)
        "opacity" => {
            app.prefs.borrow_mut().opacity = (num().clamp(0.2, 1.0) * 100.0).round() / 100.0;
            apply_look(app);
        }
        "opacity-done" => {
            app.prefs.borrow_mut().opacity = (num().clamp(0.2, 1.0) * 100.0).round() / 100.0;
            apply_look(app);
            paint_glass(app);
        }
        "glass" => set_glass(app, value == "esther"),
        "blur-moving" => app.prefs.borrow_mut().blur = num().clamp(0.0, 60.0).round(),
        "blur" => {
            app.prefs.borrow_mut().blur = num().clamp(0.0, 60.0).round();
            paint_glass(app);
        }
        "reset-look" => {
            {
                let mut p = app.prefs.borrow_mut();
                p.panel = None;
                p.accent = None;
                p.opacity = 0.5;
                p.blur = 28.0;
            }
            apply_look(app);
            set_glass(app, false);
        }
        "clear-days" => {
            CLEAR_DAYS.store(value.parse().unwrap_or(7), Ordering::Relaxed);
            clear_old(&mut app.state.borrow_mut());
            refresh(app);
        }
        "save-copy" => *app.copy_note.borrow_mut() = save_copy(app),
        "quit" => { let _ = slint::quit_event_loop(); }
        "update-check" => {
            // (Not while one is already under way.)
            if !matches!(*app.update.borrow(), update::State::Checking | update::State::Downloading(_)) { update::check_in_background(); }
        }
        "update-restart" => {
            let setup = match &*app.update.borrow() { update::State::Ready { setup, .. } => Some(setup.clone()), _ => None };
            if let Some(setup) = setup {
                if update::install(&setup) {
                    log("update: installing, Esther closes");
                    let _ = slint::quit_event_loop();
                } else {
                    *app.update.borrow_mut() = update::State::Error("the Setup wouldn't start".into());
                }
            }
        }
        "update-page" => update::open_page(),
        _ => {}
    }
    save_places(app);
    update_menu(app);
    fill(app);
}

/// Picking new keys started (`on`) or stopped: meanwhile Esther has no shortcut, so the old keys don't hide it.
pub fn record(app: &App, on: bool) {
    let s = app.card("settings").ui.global::<Settings>();
    s.set_recording(on);
    if on {
        shell::clear_hotkey();
        s.set_keys_note("Press the new keys, with Ctrl, Alt or the Windows key… (Esc keeps the old ones.)".into());
    } else {
        let (mods, vk) = app.prefs.borrow().keys;
        app.hotkey_ok.set(shell::set_hotkey(mods, vk));
        s.set_keys_note(keys_note(app).into());
    }
}
/// A key pressed while picking: once it's a key with Ctrl, Alt or the Windows key, try it.
pub fn keys_pressed(app: &App, text: &str, ctrl: bool, alt: bool, shift: bool, meta: bool) {
    let Some(vk) = vk_of(text) else { return };
    if !(ctrl || alt || meta) { return; }
    let mods = if ctrl { MOD_CONTROL } else { 0 } | if alt { MOD_ALT } else { 0 } | if shift { MOD_SHIFT } else { 0 } | if meta { MOD_WIN } else { 0 };
    let s = app.card("settings").ui.global::<Settings>();
    s.set_recording(false);
    let old = app.prefs.borrow().keys;
    let taken = !shell::set_hotkey(mods, vk);
    if taken {
        app.hotkey_ok.set(shell::set_hotkey(old.0, old.1));
    } else {
        app.prefs.borrow_mut().keys = (mods, vk);
        app.hotkey_ok.set(true);
        save_places(app);
    }
    shell::set_tip(&tray_tip(app));
    update_menu(app);
    fill(app);
    if taken {
        let why = if cfg!(windows) { "is taken by another app" } else { "can only be set on Windows" };
        s.set_keys_note(format!("{} {why}. Kept {}.", keys_name((mods, vk)), keys_name(old)).into());
    }
}

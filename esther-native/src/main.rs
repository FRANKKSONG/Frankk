//! Esther's Tasks card as a native Windows program (Rust + Slint), to see how light Esther can be.
//! It shares its tasks with the Electron app through `%APPDATA%\Esther\tasks.json`, so both can run side by side.
//!
//! `esther-tasks --smoke DIR` is for the Windows test machine: it opens the card on the tasks in DIR/tasks.json,
//! adds a task, saves a picture of the card to DIR/tasks-card.png and its memory to DIR/memory.json, and quits.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod data;
mod glass;
mod win;

use data::{new_id, Store, Task};
use slint::{Color, ComponentHandle, Model, ModelRc, PhysicalPosition, PhysicalSize, SharedString, VecModel};
use std::cell::RefCell;
use std::rc::Rc;
use time::{Date, Duration, OffsetDateTime};

slint::include_modules!();

const GRID: f32 = 8.0;
const MONTHS: [&str; 12] = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

struct State {
    store: Store,
    tab: String,
    show: i32,
    add_list: usize,
}

fn now() -> OffsetDateTime {
    OffsetDateTime::now_local().unwrap_or_else(|_| OffsetDateTime::now_utc())
}
fn today() -> Date {
    if let Ok(d) = std::env::var("ESTHER_TODAY") {
        if let Some(d) = parse_date(&d) {
            return d;
        }
    }
    now().date()
}
fn parse_date(s: &str) -> Option<Date> {
    Date::parse(s, time::macros::format_description!("[year]-[month]-[day]")).ok()
}
fn iso(d: Date) -> String {
    format!("{:04}-{:02}-{:02}", d.year(), d.month() as u8, d.day())
}

/// Today / Tomorrow / Yesterday / "16 Oct" (with the year when it isn't this year), and its kind for the colour.
fn date_label(s: &str, today: Date) -> (String, i32) {
    let Some(d) = parse_date(s) else { return (String::new(), 0) };
    let diff = (d - today).whole_days();
    let label = match diff {
        0 => "Today".to_string(),
        1 => "Tomorrow".to_string(),
        -1 => "Yesterday".to_string(),
        _ if d.year() == today.year() => format!("{} {}", d.day(), MONTHS[d.month() as usize - 1]),
        _ => format!("{} {} {}", d.day(), MONTHS[d.month() as usize - 1], d.year()),
    };
    (label, if diff == 0 { 1 } else if diff < 0 { 2 } else { 3 })
}

fn color(hex: &str) -> Color {
    let h = hex.trim_start_matches('#');
    let v = u32::from_str_radix(h, 16).unwrap_or(0x888888);
    Color::from_rgb_u8((v >> 16) as u8, (v >> 8) as u8, v as u8)
}

/// "clears in 6 days": finished tasks stay crossed out for a week, then clear themselves.
fn clears(t: &Task) -> String {
    if !t.done {
        return String::new();
    }
    let Some(at) = t.done_at.as_deref().and_then(|s| OffsetDateTime::parse(s, &time::format_description::well_known::Rfc3339).ok()) else { return String::new() };
    let left = ((at + Duration::days(7)) - OffsetDateTime::now_utc()).whole_hours() as f64 / 24.0;
    let left = left.ceil() as i64;
    match left {
        i64::MIN..=0 => "clears soon".into(),
        1 => "clears tomorrow".into(),
        n => format!("clears in {n} days"),
    }
}

/// Push the current state into the window: tabs, counts, rows.
fn refresh(ui: &TasksCard, st: &State) {
    let d = &st.store.data;
    let today = today();
    let tab_valid = st.tab == "all" || d.lists.iter().any(|l| l.id == st.tab);
    let tab = if tab_valid { st.tab.clone() } else { "all".to_string() };
    let tabs: Vec<ListTab> = d
        .lists
        .iter()
        .map(|l| ListTab {
            id: l.id.clone().into(),
            name: l.name.clone().into(),
            color: color(&l.color),
            open: d.tasks.iter().filter(|t| !t.done && t.list_id == l.id).count() as i32,
        })
        .collect();
    let in_tab: Vec<&Task> = d.tasks.iter().filter(|t| tab == "all" || t.list_id == tab).collect();
    let rows: Vec<TaskRow> = in_tab
        .iter()
        .filter(|t| st.show == 0 || (st.show == 2) == t.done)
        .map(|t| {
            let list = d.lists.iter().find(|l| l.id == t.list_id);
            let (date, kind) = t.date.as_deref().map(|s| date_label(s, today)).unwrap_or_default();
            let subs_done = t.subtasks.iter().filter(|s| s.done).count();
            TaskRow {
                id: t.id.clone().into(),
                title: t.title.clone().into(),
                done: t.done,
                list_id: t.list_id.clone().into(),
                list_name: list.map(|l| l.name.clone()).unwrap_or_default().into(),
                list_color: list.map(|l| color(&l.color)).unwrap_or(Color::from_rgb_u8(128, 128, 128)),
                date: date.into(),
                date_kind: kind,
                subs: if t.subtasks.is_empty() { SharedString::new() } else { format!("{}/{}", subs_done, t.subtasks.len()).into() },
                clears: clears(t).into(),
            }
        })
        .collect();
    ui.set_tab(tab.clone().into());
    ui.set_show(st.show);
    ui.set_tabs(ModelRc::new(VecModel::from(tabs)));
    ui.set_count_tab_all(d.tasks.iter().filter(|t| !t.done).count() as i32);
    ui.set_count_all(in_tab.len() as i32);
    ui.set_count_open(in_tab.iter().filter(|t| !t.done).count() as i32);
    ui.set_count_done(in_tab.iter().filter(|t| t.done).count() as i32);
    ui.set_empty_text(if !st.store.shared { "Your tasks show here once the Esther app has shared them (open Esther once)." } else if st.show == 2 { "Nothing finished here yet." } else { "Nothing to do here. Add a task above." }.into());
    ui.set_rows(ModelRc::new(VecModel::from(rows)));
    ui.set_can_add(st.store.shared);
    if let Some(l) = d.lists.get(st.add_list % d.lists.len().max(1)) {
        ui.set_add_list_name(l.name.clone().into());
        ui.set_add_list_color(color(&l.color));
    }
}

/// Finished tasks clear themselves a week after they were ticked (as in the Electron app).
fn clear_old(st: &mut State) {
    let cutoff = OffsetDateTime::now_utc() - Duration::days(7);
    let before = st.store.data.tasks.len();
    st.store.data.tasks.retain(|t| {
        !(t.done && t.done_at.as_deref().and_then(|s| OffsetDateTime::parse(s, &time::format_description::well_known::Rfc3339).ok()).is_some_and(|at| at < cutoff))
    });
    if st.store.data.tasks.len() != before {
        st.store.save();
    }
}

// ---- Where the card is: remembered between runs. ----
fn place_path() -> std::path::PathBuf {
    data::data_path().with_file_name("esther-native.json")
}
fn load_place() -> Option<(i32, i32, u32, u32)> {
    let v: serde_json::Value = serde_json::from_str(&std::fs::read_to_string(place_path()).ok()?).ok()?;
    Some((v["x"].as_i64()? as i32, v["y"].as_i64()? as i32, v["width"].as_u64()? as u32, v["height"].as_u64()? as u32))
}
fn save_place(w: &slint::Window) {
    let (p, s) = (w.position(), w.size());
    let _ = std::fs::write(place_path(), serde_json::json!({ "x": p.x, "y": p.y, "width": s.width, "height": s.height }).to_string());
}

/// Line the blurred wallpaper up with the real one behind the window.
fn place_glass(ui: &TasksCard) {
    let w = ui.window();
    let k = w.scale_factor();
    let p = w.position();
    let (sw, sh) = win::screen_size();
    ui.set_glass_x(-(p.x as f32) / k);
    ui.set_glass_y(-(p.y as f32) / k);
    ui.set_glass_w(sw as f32 / k);
    ui.set_glass_h(sh as f32 / k);
    ui.set_compact((w.size().width as f32 / k) < 560.0);
}

/// A move or resize in progress: which edge (None: moving), where the mouse and the window started (physical px).
struct Track {
    edge: Option<String>,
    c0: (i32, i32),
    r0: (f32, f32, f32, f32),
}

/// The new window rect (x, y, w, h) when an edge or corner is dragged by (dx, dy) physical px: the moving edges land
/// on the grid; Alt resizes from the centre, Shift keeps the proportions (like Illustrator, and the Electron cards).
fn resize_rect(r0: (f32, f32, f32, f32), edge: &str, dx: f32, dy: f32, shift: bool, alt: bool, k: f32) -> (f32, f32, f32, f32) {
    let (x0, y0, w0, h0) = r0;
    let g = GRID * k;
    let snap = |v: f32| (v / g).round() * g;
    let (e, w, n, s) = (edge.contains('e'), edge.contains('w'), edge.contains('n'), edge.contains('s'));
    let (mut l, mut t, mut r, mut b) = (x0, y0, x0 + w0, y0 + h0);
    if e { r = snap(r + dx); }
    if w { l = snap(l + dx); }
    if s { b = snap(b + dy); }
    if n { t = snap(t + dy); }
    let (cx, cy) = (x0 + w0 / 2.0, y0 + h0 / 2.0);
    if alt {
        if e { l = 2.0 * cx - r; }
        if w { r = 2.0 * cx - l; }
        if s { t = 2.0 * cy - b; }
        if n { b = 2.0 * cy - t; }
    }
    let (mut ww, mut hh) = (r - l, b - t);
    let (minw, minh) = (300.0 * k, 260.0 * k);
    if shift {
        let ratio = w0 / h0;
        if (e || w) && (n || s) { if (ww / w0 - 1.0).abs() >= (hh / h0 - 1.0).abs() { hh = ww / ratio } else { ww = hh * ratio } }
        else if e || w { hh = ww / ratio } else { ww = hh * ratio }
        let m = f32::max(1.0, f32::max(minw / ww, minh / hh));
        ww *= m;
        hh *= m;
    } else {
        ww = ww.max(minw);
        hh = hh.max(minh);
    }
    let x = if alt || (shift && !e && !w) { cx - ww / 2.0 } else if w { x0 + w0 - ww } else { x0 };
    let y = if alt || (shift && !n && !s) { cy - hh / 2.0 } else if n { y0 + h0 - hh } else { y0 };
    (x.round(), y.round(), ww.round(), hh.round())
}

/// Put the window at (x, y, w, h) physical px, and keep the glass lined up.
fn apply_rect(ui: &TasksCard, (x, y, w, h): (f32, f32, f32, f32)) {
    let win = ui.window();
    let (p, s) = (win.position(), win.size());
    if p.x != x as i32 || p.y != y as i32 { win.set_position(PhysicalPosition::new(x as i32, y as i32)); }
    if s.width != w as u32 || s.height != h as u32 { win.set_size(PhysicalSize::new(w as u32, h as u32)); }
    place_glass(ui);
}

/// A line in esther-native-log.txt next to the tasks file (what happened, for tracking down problems).
fn log(msg: &str) {
    use std::io::Write;
    if let Ok(mut f) = std::fs::OpenOptions::new().create(true).append(true).open(data::data_path().with_file_name("esther-native-log.txt")) {
        let _ = writeln!(f, "{} {msg}", now().format(&time::format_description::well_known::Rfc3339).unwrap_or_default());
    }
}

/// The smoke test, step by step on a timer: resize from the right edge, drag the card, click into "Add a task",
/// type a task and press Enter, all with real input on Windows; then save a picture and the figures, and quit.
fn smoke_run(dir: std::path::PathBuf, ui_w: slint::Weak<TasksCard>, state: Rc<RefCell<State>>, hwnd: Rc<RefCell<isize>>, styled: Rc<RefCell<String>>) -> slint::Timer {
    let t = slint::Timer::default();
    let step = RefCell::new(0u32);
    let rects: RefCell<Vec<(i32, i32, i32, i32)>> = RefCell::new(vec![]);
    let seen: Rc<RefCell<Vec<String>>> = Rc::new(RefCell::new(vec![]));
    let start = std::time::Instant::now();
    t.start(slint::TimerMode::Repeated, std::time::Duration::from_millis(150), move || {
        let Some(ui) = ui_w.upgrade() else { return };
        let h = *hwnd.borrow();
        if h == 0 && start.elapsed().as_secs() < 5 { return; } // wait for the window
        let k = ui.window().scale_factor();
        let real = cfg!(windows) && h > 0;
        let mut st = step.borrow_mut();
        *st += 1;
        #[cfg(windows)]
        let rect = || win::window_rect(h);
        #[cfg(not(windows))]
        let rect = || (0, 0, 0, 0);
        match *st {
            1..=5 => {} // let it settle
            6 if real => { #[cfg(windows)] win::clear_and_front(h); }
            7 if real => { let r = rect(); rects.borrow_mut().push(r); win_input::to(r.2 - 3, (r.1 + r.3) / 2); seen.borrow_mut().push(format!("edge: {}", win_input::under(r.2 - 3, (r.1 + r.3) / 2, h))); }
            8 if real => win_input::down(),
            // (inwards: the test machine's screen is small, and the mouse can't go past its edge)
            9..=14 if real => { let r = rects.borrow()[0]; win_input::to(r.2 - 3 - (*st as i32 - 8) * 12, (r.1 + r.3) / 2); }
            15 if real => win_input::up(),
            17 if real => { let r = rect(); rects.borrow_mut().push(r); let (x, y) = (r.2 - (40.0 * k) as i32, r.1 + (71.0 * k) as i32); win_input::to(x, y); seen.borrow_mut().push(format!("drag: {}", win_input::under(x, y, h))); }
            18 if real => win_input::down(),
            19..=23 if real => { let r = rects.borrow()[1]; let i = *st as i32 - 18; win_input::to(r.2 - (40.0 * k) as i32 + i * 10, r.1 + (71.0 * k) as i32 + i * 6); }
            24 if real => win_input::up(),
            26 if real => {
                let r = rect();
                rects.borrow_mut().push(r);
                let compact = ((r.2 - r.0) as f32 / k) < 560.0;
                let y = if compact { 116.0 } else { 150.0 };
                let (x, y) = (r.0 + (90.0 * k) as i32, r.1 + (y * k) as i32);
                win_input::to(x, y);
                seen.borrow_mut().push(format!("add field: {}", win_input::under(x, y, h)));
            }
            27 if real => win_input::down(),
            28 if real => win_input::up(),
            30 if real => win_input::type_text("Typed on Windows"),
            32 if real => win_input::enter(),
            34 => {
                if !real { ui.invoke_add_task("Typed on Windows".into()); }
                let text = std::fs::read_to_string(&state.borrow().store.path).unwrap_or_default();
                let rs = rects.borrow();
                let (resized, moved) = if real && rs.len() == 3 {
                    ((rs[1].2 - rs[1].0) - (rs[0].2 - rs[0].0), rs[2].0 - rs[1].0)
                } else { (0, 0) };
                let shot = ui.window().take_snapshot().ok().map(|buf| {
                    image::RgbaImage::from_raw(buf.width(), buf.height(), buf.as_bytes().to_vec()).map(|i| i.save(dir.join("tasks-card.png")).is_ok()).unwrap_or(false)
                });
                let (private, ws) = win::memory_kb();
                #[cfg(windows)]
                let (corner, tool, owned) = if h > 0 { win::facts(h) } else { (0, false, false) };
                #[cfg(not(windows))]
                let (corner, tool, owned) = (0u32, false, false);
                let report = serde_json::json!({
                    "private_mb": (private as f64 / 1024.0 * 10.0).round() / 10.0,
                    "working_set_mb": (ws as f64 / 1024.0 * 10.0).round() / 10.0,
                    "rows": ui.get_rows().row_count(),
                    "typed_task_saved": text.contains("Typed on Windows"),
                    "real_input": real,
                    "resized_px": resized,
                    "moved_px": moved,
                    "rounded_corners_asked": corner == 2,
                    "tool_window": tool,
                    "on_the_desktop": owned,
                    "styled": styled.borrow().clone(),
                    "under_the_mouse": seen.borrow().clone(),
                    "rects": rects.borrow().clone(),
                    "screenshot": shot.unwrap_or(false),
                    "renderer": std::env::var("SLINT_BACKEND").unwrap_or_else(|_| "winit-software".into()),
                });
                println!("{report}");
                let _ = std::fs::write(dir.join("memory.json"), report.to_string());
                let _ = slint::quit_event_loop();
            }
            _ => {}
        }
    });
    t
}

#[cfg(windows)]
mod win_input {
    pub fn to(x: i32, y: i32) { crate::win::set_cursor(x, y) }
    pub fn down() { crate::win::mouse(true) }
    pub fn up() { crate::win::mouse(false) }
    pub fn type_text(s: &str) { crate::win::type_text(s) }
    pub fn enter() { crate::win::enter() }
    pub fn under(x: i32, y: i32, h: isize) -> String { crate::win::under(x, y, h) }
}
#[cfg(not(windows))]
mod win_input {
    pub fn to(_x: i32, _y: i32) {}
    pub fn down() {}
    pub fn up() {}
    pub fn type_text(_s: &str) {}
    pub fn enter() {}
    pub fn under(_x: i32, _y: i32, _h: isize) -> String { String::new() }
}

fn main() {
    let args: Vec<String> = std::env::args().collect();
    let smoke = args.iter().position(|a| a == "--smoke").and_then(|i| args.get(i + 1)).map(std::path::PathBuf::from);
    if let Some(dir) = &smoke {
        std::env::set_var("ESTHER_DATA", dir.join("tasks.json"));
    }
    // The light renderer (drawn by the processor) unless asked otherwise with SLINT_BACKEND (e.g. winit-femtovg).
    if std::env::var("SLINT_BACKEND").is_err() {
        let _ = slint::BackendSelector::new().backend_name("winit".into()).renderer_name("software".into()).select();
    }

    let ui = TasksCard::new().expect("the window");
    let state = Rc::new(RefCell::new(State { store: Store::open(data::data_path()), tab: "all".into(), show: 0, add_list: 0 }));
    clear_old(&mut state.borrow_mut());
    refresh(&ui, &state.borrow());

    // Change something, save it, show it.
    let change = {
        let (ui, state) = (ui.as_weak(), state.clone());
        move |f: &dyn Fn(&mut State)| {
            let mut st = state.borrow_mut();
            f(&mut st);
            st.store.save();
            if let Some(ui) = ui.upgrade() {
                refresh(&ui, &st);
            }
        }
    };
    let change = Rc::new(change);

    { let c = change.clone(); ui.on_pick_tab(move |id| c(&|st| st.tab = id.to_string())); }
    { let c = change.clone(); ui.on_pick_show(move |i| c(&|st| st.show = i)); }
    {
        let c = change.clone();
        ui.on_next_add_list(move || c(&|st| st.add_list = (st.add_list + 1) % st.store.data.lists.len().max(1)));
    }
    {
        let c = change.clone();
        ui.on_add_task(move |text| {
            let text = text.trim().to_string();
            if text.is_empty() {
                return;
            }
            c(&|st| {
                if !st.store.shared { return; } // nothing is added until the tasks are shared with the Esther app
                let lists = &st.store.data.lists;
                let list_id = if st.tab != "all" && lists.iter().any(|l| l.id == st.tab) { st.tab.clone() } else { lists[st.add_list % lists.len()].id.clone() };
                st.store.data.tasks.insert(0, Task { id: new_id("t"), list_id, title: text.clone(), done: false, date: None, subtasks: vec![], done_at: None });
            });
        });
    }
    {
        let c = change.clone();
        ui.on_toggle(move |id| {
            c(&|st| {
                if let Some(t) = st.store.data.tasks.iter_mut().find(|t| t.id == id.as_str()) {
                    t.done = !t.done;
                    t.done_at = if t.done { OffsetDateTime::now_utc().format(&time::format_description::well_known::Rfc3339).ok() } else { None };
                }
            })
        });
    }
    {
        let c = change.clone();
        ui.on_rename(move |id, title| {
            let title = title.trim().to_string();
            if title.is_empty() {
                return;
            }
            c(&|st| {
                if let Some(t) = st.store.data.tasks.iter_mut().find(|t| t.id == id.as_str()) {
                    t.title = title.clone();
                }
            })
        });
    }
    {
        let c = change.clone();
        ui.on_set_date(move |id, when| {
            let t0 = today();
            let date = match when.as_str() {
                "today" => Some(iso(t0)),
                "tomorrow" => Some(iso(t0 + Duration::days(1))),
                "next-week" => Some(iso(t0 + Duration::days(7 - t0.weekday().number_days_from_monday() as i64))),
                _ => None,
            };
            c(&|st| {
                if let Some(t) = st.store.data.tasks.iter_mut().find(|t| t.id == id.as_str()) {
                    t.date = date.clone();
                }
            })
        });
    }
    {
        let c = change.clone();
        ui.on_move_to(move |id, list| {
            c(&|st| {
                if let Some(t) = st.store.data.tasks.iter_mut().find(|t| t.id == id.as_str()) {
                    t.list_id = list.to_string();
                }
            })
        });
    }
    { let c = change.clone(); ui.on_delete(move |id| c(&|st| st.store.data.tasks.retain(|t| t.id != id.as_str()))); }

    // Moving and resizing. On Windows Esther follows the real mouse from the press until the button is let go
    // (as the Electron app does), so it's exact even when the mouse runs ahead of the window; elsewhere it uses the
    // movement Slint reports. Both land on the 8 px grid. Resizing: Alt from the centre, Shift in proportion.
    let tracking: Rc<RefCell<Option<Track>>> = Rc::new(RefCell::new(None));
    let tracker = slint::Timer::default();
    {
        let (ui_w, tracking) = (ui.as_weak(), tracking.clone());
        tracker.start(slint::TimerMode::Repeated, std::time::Duration::from_millis(8), move || {
            let Some(ui) = ui_w.upgrade() else { return };
            let mut tr = tracking.borrow_mut();
            let Some(t) = tr.as_ref() else { return };
            if !win::button_down() {
                *tr = None;
                save_place(ui.window());
                return;
            }
            let (cx, cy) = win::cursor();
            let (dx, dy) = ((cx - t.c0.0) as f32, (cy - t.c0.1) as f32);
            let k = ui.window().scale_factor();
            let r = match &t.edge {
                None => { let g = GRID * k; let snap = |v: f32| (v / g).round() * g; (snap(t.r0.0 + dx), snap(t.r0.1 + dy), t.r0.2, t.r0.3) }
                Some(e) => { let (shift, alt) = win::mods(); resize_rect(t.r0, e, dx, dy, shift, alt, k) }
            };
            apply_rect(&ui, r);
        });
    }
    let start_track = {
        let (ui_w, tracking) = (ui.as_weak(), tracking.clone());
        move |edge: Option<String>| {
            if !cfg!(windows) { return; }
            let Some(ui) = ui_w.upgrade() else { return };
            let w = ui.window();
            let (p, s) = (w.position(), w.size());
            *tracking.borrow_mut() = Some(Track { edge, c0: win::cursor(), r0: (p.x as f32, p.y as f32, s.width as f32, s.height as f32) });
        }
    };
    { let st = start_track.clone(); ui.on_drag_start(move || st(None)); }
    { let st = start_track.clone(); ui.on_resize_start(move |e| st(Some(e.to_string()))); }
    {
        let ui_w = ui.as_weak();
        ui.on_drag_by(move |dx, dy| {
            if cfg!(windows) { return; } // followed from the real mouse instead
            let Some(ui) = ui_w.upgrade() else { return };
            let w = ui.window();
            let k = w.scale_factor();
            let (p, s) = (w.position(), w.size());
            let g = GRID * k;
            let snap = |v: f32| (v / g).round() * g;
            apply_rect(&ui, (snap(p.x as f32 + dx * k), snap(p.y as f32 + dy * k), s.width as f32, s.height as f32));
        });
    }
    {
        let ui_w = ui.as_weak();
        ui.on_resize_by(move |edge, dx, dy| {
            if cfg!(windows) { return; }
            let Some(ui) = ui_w.upgrade() else { return };
            let w = ui.window();
            let k = w.scale_factor();
            let (p, s) = (w.position(), w.size());
            let r = resize_rect((p.x as f32, p.y as f32, s.width as f32, s.height as f32), edge.as_str(), dx * k, dy * k, false, false, k);
            apply_rect(&ui, r);
        });
    }
    for end in [0, 1] {
        let ui_w = ui.as_weak();
        let f = move || { if let Some(ui) = ui_w.upgrade() { save_place(ui.window()); } };
        if end == 0 { ui.on_drag_end(f); } else { ui.on_resize_end(f); }
    }

    // Glass from the wallpaper (again whenever the wallpaper changes), and tasks changed by the Electron app.
    let (sw, sh) = win::screen_size();
    let set_glass = {
        let ui_w = ui.as_weak();
        move || {
            if let Some(ui) = ui_w.upgrade() {
                match glass::blurred(sw, sh, 28.0) {
                    Some(img) => { ui.set_glass(img); ui.set_has_glass(true); }
                    None => ui.set_has_glass(false),
                }
                place_glass(&ui);
            }
        }
    };
    set_glass();
    let watch = slint::Timer::default();
    {
        let (ui_w, state) = (ui.as_weak(), state.clone());
        let mut wall = glass::stamp();
        watch.start(slint::TimerMode::Repeated, std::time::Duration::from_millis(1000), move || {
            let mut st = state.borrow_mut();
            if st.store.reload_if_changed() {
                if let Some(ui) = ui_w.upgrade() { refresh(&ui, &st); }
            }
            let now = glass::stamp();
            if now != wall { wall = now; set_glass(); }
        });
    }

    // Where it was last time (or a narrow card at the right of the screen).
    let (px, py, pw, ph) = load_place().unwrap_or(((sw as i32) - 16 - 440, 16 + 128 + 16, 440, 600));
    ui.window().set_position(PhysicalPosition::new(px, py));
    ui.window().set_size(PhysicalSize::new(pw, ph));
    ui.show().expect("show the window");
    place_glass(&ui);

    // The Windows touches (desktop layer, rounded corners, no taskbar button, no animations). The native window only
    // exists once the event loop runs, so this waits for it (doing it straight after show() did nothing).
    let hwnd: Rc<RefCell<isize>> = Rc::new(RefCell::new(0));
    let styled: Rc<RefCell<String>> = Rc::new(RefCell::new(String::from("not yet")));
    let styler = slint::Timer::default();
    {
        let (ui_w, hwnd, styled) = (ui.as_weak(), hwnd.clone(), styled.clone());
        let tries = RefCell::new(0);
        styler.start(slint::TimerMode::Repeated, std::time::Duration::from_millis(50), move || {
            use raw_window_handle::{HasWindowHandle, RawWindowHandle};
            if *hwnd.borrow() != 0 { return; }
            *tries.borrow_mut() += 1;
            let Some(ui) = ui_w.upgrade() else { return };
            match ui.window().window_handle().window_handle().map(|h| h.as_raw()) {
                Ok(RawWindowHandle::Win32(h)) => {
                    *hwnd.borrow_mut() = h.hwnd.get();
                    *styled.borrow_mut() = win::style(h.hwnd.get());
                    log(&format!("window styled: {}", styled.borrow()));
                }
                Ok(_) if *tries.borrow() > 40 => { *hwnd.borrow_mut() = -1; *styled.borrow_mut() = "not a Windows window".into(); }
                _ => {}
            }
        });
    }

    // The test machine: use the card with the real mouse and keyboard (Windows), picture it, measure it, quit.
    let _smoke = smoke.map(|dir| smoke_run(dir, ui.as_weak(), state.clone(), hwnd.clone(), styled.clone()));

    slint::run_event_loop_until_quit().expect("run");
    save_place(ui.window());
}

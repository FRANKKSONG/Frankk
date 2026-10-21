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

    // Moving: follow the mouse, landing on the 8 px grid.
    {
        let ui_w = ui.as_weak();
        ui.on_drag_by(move |dx, dy| {
            let Some(ui) = ui_w.upgrade() else { return };
            let w = ui.window();
            let k = w.scale_factor();
            let p = w.position();
            let g = GRID * k;
            let nx = ((p.x as f32 + dx * k) / g).round() * g;
            let ny = ((p.y as f32 + dy * k) / g).round() * g;
            if nx as i32 != p.x || ny as i32 != p.y {
                w.set_position(PhysicalPosition::new(nx as i32, ny as i32));
                place_glass(&ui);
            }
        });
    }
    {
        let ui_w = ui.as_weak();
        ui.on_drag_end(move || { if let Some(ui) = ui_w.upgrade() { save_place(ui.window()); } });
    }
    // Resizing from an edge or corner: the moving edge lands on the grid.
    {
        let ui_w = ui.as_weak();
        ui.on_resize_by(move |edge, dx, dy| {
            let Some(ui) = ui_w.upgrade() else { return };
            let w = ui.window();
            let k = w.scale_factor();
            let g = GRID * k;
            let (p, s) = (w.position(), w.size());
            let (mut l, mut t, mut r, mut b) = (p.x as f32, p.y as f32, (p.x + s.width as i32) as f32, (p.y + s.height as i32) as f32);
            let snap = |v: f32| (v / g).round() * g;
            if edge.contains('e') { r = snap(r + dx * k); }
            if edge.contains('w') { l = snap(l + dx * k); }
            if edge.contains('s') { b = snap(b + dy * k); }
            if edge.contains('n') { t = snap(t + dy * k); }
            let (minw, minh) = (300.0 * k, 260.0 * k);
            if r - l < minw { if edge.contains('w') { l = r - minw } else { r = l + minw } }
            if b - t < minh { if edge.contains('n') { t = b - minh } else { b = t + minh } }
            w.set_position(PhysicalPosition::new(l as i32, t as i32));
            w.set_size(PhysicalSize::new((r - l) as u32, (b - t) as u32));
            place_glass(&ui);
        });
    }
    {
        let ui_w = ui.as_weak();
        ui.on_resize_end(move || { if let Some(ui) = ui_w.upgrade() { save_place(ui.window()); } });
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

    // The Windows touches (desktop layer, rounded corners, no animations) once the window exists.
    {
        use raw_window_handle::{HasWindowHandle, RawWindowHandle};
        let w = ui.window();
        let report = match w.window_handle().window_handle().map(|h| h.as_raw()) {
            Ok(RawWindowHandle::Win32(h)) => win::style(h.hwnd.get()),
            _ => "no native window".into(),
        };
        eprintln!("window: {report}");
    }

    // The test machine: add a task, picture the card, measure the memory, quit.
    let _smoke_timer = smoke.map(|dir| {
        let t = slint::Timer::default();
        let ui_w = ui.as_weak();
        let state = state.clone();
        t.start(slint::TimerMode::SingleShot, std::time::Duration::from_millis(2500), move || {
            let Some(ui) = ui_w.upgrade() else { return };
            ui.invoke_add_task("Added by the smoke test".into());
            let saved = std::fs::read_to_string(&state.borrow().store.path).unwrap_or_default().contains("Added by the smoke test");
            let shot = ui.window().take_snapshot().ok().map(|buf| {
                let img = image::RgbaImage::from_raw(buf.width(), buf.height(), buf.as_bytes().to_vec());
                img.map(|i| i.save(dir.join("tasks-card.png")).is_ok()).unwrap_or(false)
            });
            let (private, ws) = win::memory_kb();
            let rows = ui.get_rows().row_count();
            let report = serde_json::json!({
                "private_mb": (private as f64 / 1024.0 * 10.0).round() / 10.0,
                "working_set_mb": (ws as f64 / 1024.0 * 10.0).round() / 10.0,
                "rows": rows,
                "saved_to_file": saved,
                "screenshot": shot.unwrap_or(false),
                "renderer": std::env::var("SLINT_BACKEND").unwrap_or_else(|_| "winit-software".into()),
            });
            println!("{report}");
            let _ = std::fs::write(dir.join("memory.json"), report.to_string());
            let _ = slint::quit_event_loop();
        });
        t
    });

    slint::run_event_loop_until_quit().expect("run");
    save_place(ui.window());
}

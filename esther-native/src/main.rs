//! Esther as a native Windows program (Rust + Slint): the header with the greeting, the calendar, This week and
//! Tasks, each its own window on the desktop, all showing the one set of tasks. It shares them with the Electron app
//! through `%APPDATA%\Esther\tasks.json`, so both can run side by side.
//!
//! `esther-native --smoke DIR` is for the Windows test machine: it opens the cards on the tasks in DIR/tasks.json,
//! uses them with the real mouse and keyboard, saves a picture of each card and the figures to DIR/memory.json, and
//! quits.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod data;
mod glass;
mod win;

use data::{new_id, Store, Task};
use slint::{Color, ComponentHandle, Model, ModelRc, PhysicalPosition, PhysicalSize, SharedString, VecModel};
use std::cell::{Cell, RefCell};
use std::rc::Rc;
use time::{Date, Duration, OffsetDateTime};

slint::include_modules!();

const GRID: f32 = 8.0;
const GAP: f32 = 16.0;
const MONTHS: [&str; 12] = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_LONG: [&str; 12] = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAYS: [&str; 7] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/// The cards, in the order they are made (and drawn on top of each other).
const KINDS: [&str; 4] = ["header", "tasks", "calendar", "week"];

/// Your motto and your own sayings, kept exactly as you wrote them, and short old-sounding lines (as in the app).
const MOTTO: &str = "An ancient dreams in a modern land";
const SAYINGS: [&str; 1] = ["The moment you’re disturbed by insult or pleased by praise, you’re still slave"];
const LINES: [&str; 10] = [
    "The lamp burns longest at a low flame.",
    "Slow rivers cut the deepest stone.",
    "One road, walked to its end.",
    "Finish, and only then begin.",
    "The arrow does not look at the other targets.",
    "What is carried today need not be carried tomorrow.",
    "The field that rests bears the fuller grain.",
    "Stillness, too, is a labour.",
    "The vine does not hurry, and yet the wine is made.",
    "Tend the day as a monk tends his garden.",
];

struct State {
    store: Store,
    tab: String,
    show: i32,
    add_list: usize,
    /// The day picked on the calendar: the Tasks card shows only that day.
    day: Option<Date>,
    /// The month the calendar shows (its first day).
    month: Date,
    /// A task picked in This week, pointed out on the Tasks card for a moment.
    highlight: String,
}

/// One card's window, and what Windows made of it.
struct Win {
    kind: &'static str,
    ui: Card,
    hwnd: Cell<isize>,
    styled: RefCell<String>,
}

/// A move or resize in progress: which edge (None: moving), where the mouse and the window started (physical px).
struct Track {
    edge: Option<String>,
    c0: (i32, i32),
    r0: (f32, f32, f32, f32),
}

struct App {
    cards: Vec<Win>,
    state: RefCell<State>,
    /// Which card is being moved or resized, and how.
    tracking: RefCell<Option<(usize, Track)>>,
}

impl App {
    fn card(&self, kind: &str) -> &Win {
        self.cards.iter().find(|w| w.kind == kind).expect("every card exists")
    }
}

// ---- Dates ----
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
fn first_of_month(d: Date) -> Date {
    d.replace_day(1).unwrap_or(d)
}
fn add_months(d: Date, n: i32) -> Date {
    let m = d.year() * 12 + d.month() as i32 - 1 + n;
    Date::from_calendar_date(m.div_euclid(12), time::Month::try_from((m.rem_euclid(12) + 1) as u8).unwrap(), 1).unwrap_or(d)
}
/// "16 Oct" (with the year when it isn't this year).
fn short_date(d: Date, today: Date) -> String {
    if d.year() == today.year() { format!("{} {}", d.day(), MONTHS[d.month() as usize - 1]) } else { format!("{} {} {}", d.day(), MONTHS[d.month() as usize - 1], d.year()) }
}
/// "Wed, 21 Oct 2026".
fn long_date(d: Date) -> String {
    format!("{}, {} {} {}", DAYS[d.weekday().number_days_from_monday() as usize], d.day(), MONTHS[d.month() as usize - 1], d.year())
}
/// "Tue 20".
fn day_short(d: Date) -> String {
    format!("{} {}", DAYS[d.weekday().number_days_from_monday() as usize], d.day())
}
fn week_start(d: Date) -> Date {
    d - Duration::days(d.weekday().number_days_from_monday() as i64)
}

/// Today / Tomorrow / Yesterday / "16 Oct", and its kind for the colour.
fn date_label(s: &str, today: Date) -> (String, i32) {
    let Some(d) = parse_date(s) else { return (String::new(), 0) };
    let diff = (d - today).whole_days();
    let label = match diff {
        0 => "Today".to_string(),
        1 => "Tomorrow".to_string(),
        -1 => "Yesterday".to_string(),
        _ => short_date(d, today),
    };
    (label, if diff == 0 { 1 } else if diff < 0 { 2 } else { 3 })
}

/// Good morning / afternoon / evening, by the clock.
fn greeting() -> &'static str {
    match now().hour() {
        0..=11 => "Good morning",
        12..=17 => "Good afternoon",
        _ => "Good evening",
    }
}

/// One line for the day: the same all day, a different one tomorrow (the app's choice, so both show the same line).
fn line_for(day: &str) -> &'static str {
    let mut h: u32 = 2166136261;
    for c in day.encode_utf16() {
        h ^= c as u32;
        h = h.wrapping_mul(16777619);
    }
    let all: Vec<&str> = LINES.iter().chain(SAYINGS.iter()).copied().chain(std::iter::once(MOTTO)).collect();
    all[h as usize % all.len()]
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

fn task_row(t: &Task, st: &State, today: Date) -> TaskRow {
    let d = &st.store.data;
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
}

fn model<T: Clone + 'static>(v: Vec<T>) -> ModelRc<T> {
    ModelRc::new(VecModel::from(v))
}

// ---- What each card shows ----
fn fill_tasks(g: &Esther, st: &State, today: Date) {
    let d = &st.store.data;
    let tab_valid = st.tab == "all" || d.lists.iter().any(|l| l.id == st.tab);
    let tab = if tab_valid { st.tab.clone() } else { "all".to_string() };
    let day = st.day.map(iso);
    let in_tab: Vec<&Task> = d.tasks.iter().filter(|t| (tab == "all" || t.list_id == tab) && (day.is_none() || t.date == day)).collect();
    let rows: Vec<TaskRow> = in_tab.iter().filter(|t| st.show == 0 || (st.show == 2) == t.done).map(|t| task_row(t, st, today)).collect();
    g.set_tab(tab.into());
    g.set_show(st.show);
    g.set_count_tab_all(d.tasks.iter().filter(|t| !t.done).count() as i32);
    g.set_count_all(in_tab.len() as i32);
    g.set_count_open(in_tab.iter().filter(|t| !t.done).count() as i32);
    g.set_count_done(in_tab.iter().filter(|t| t.done).count() as i32);
    g.set_empty_text(
        if !st.store.shared {
            "Your tasks show here once the Esther app has shared them (open Esther once).".to_string()
        } else if st.show == 2 {
            "Nothing finished here yet.".to_string()
        } else if let Some(d) = st.day {
            format!("Nothing on {}.", short_date(d, today))
        } else {
            "Nothing to do here. Add a task above.".to_string()
        }
        .into(),
    );
    g.set_rows(model(rows));
    g.set_day_label(st.day.map(|d| if d == today { "Today".to_string() } else { long_date(d) }).unwrap_or_default().into());
    g.set_highlight(st.highlight.clone().into());
    if let Some(l) = d.lists.get(st.add_list % d.lists.len().max(1)) {
        g.set_add_list_name(l.name.clone().into());
        g.set_add_list_color(color(&l.color));
    }
}

fn fill_header(g: &Esther, today: Date) {
    let hello = greeting();
    g.set_hello(hello.into());
    g.set_hello_letter(hello[..1].into());
    g.set_long_date(long_date(today).into());
    g.set_line(line_for(&iso(today)).into());
}

/// The month, Monday first, whole weeks; open tasks as dots in their lists' colours (up to three a day).
fn fill_calendar(g: &Esther, st: &State, today: Date) {
    let d = &st.store.data;
    let first = st.month;
    let lead = first.weekday().number_days_from_monday() as i64;
    let in_month = (add_months(first, 1) - first).whole_days();
    let cells = ((lead + in_month + 6) / 7) * 7;
    let start = first - Duration::days(lead);
    let days: Vec<CalDay> = (0..cells)
        .map(|i| {
            let c = start + Duration::days(i);
            let key = iso(c);
            let marks: Vec<Color> = d
                .tasks
                .iter()
                .filter(|t| !t.done && t.date.as_deref() == Some(key.as_str()))
                .take(3)
                .map(|t| d.lists.iter().find(|l| l.id == t.list_id).map(|l| color(&l.color)).unwrap_or(Color::from_rgb_u8(0xd9, 0xa6, 0x3a)))
                .collect();
            CalDay { num: c.day() as i32, iso: key.into(), today: c == today, picked: st.day == Some(c), other: c.month() != first.month(), marks: model(marks) }
        })
        .collect();
    g.set_month_title(format!("{} {}", MONTHS_LONG[first.month() as usize - 1], first.year()).into());
    g.set_days(model(days));
}

/// Monday to Sunday, and anything still open from before Monday.
fn week_days(st: &State, today: Date) -> Vec<WeekDay> {
    let d = &st.store.data;
    let mon = week_start(today);
    let mut out = vec![];
    let mon_iso = iso(mon);
    let late: Vec<TaskRow> = d.tasks.iter().filter(|t| !t.done && t.date.as_deref().is_some_and(|x| x < mon_iso.as_str())).map(|t| task_row(t, st, today)).collect();
    if !late.is_empty() {
        out.push(WeekDay { label: "Still open from before".into(), small: "".into(), today: false, past: false, late: true, tasks: model(late) });
    }
    for i in 0..7 {
        let day = mon + Duration::days(i);
        let key = iso(day);
        let tasks: Vec<TaskRow> = d.tasks.iter().filter(|t| t.date.as_deref() == Some(key.as_str())).map(|t| task_row(t, st, today)).collect();
        out.push(WeekDay {
            label: if day == today { "Today".into() } else { day_short(day).into() },
            small: if day == today { day_short(day).into() } else { "".into() },
            today: day == today,
            past: day < today,
            late: false,
            tasks: model(tasks),
        });
    }
    out
}

fn fill_week(g: &Esther, st: &State, today: Date) {
    let mon = week_start(today);
    g.set_week_range(format!("{} – {}", short_date(mon, today), short_date(mon + Duration::days(6), today)).into());
    g.set_week(model(week_days(st, today)));
}

/// Push the current state into every card.
fn refresh(app: &App) {
    let st = app.state.borrow();
    let today = today();
    let tabs: Vec<ListTab> = st
        .store
        .data
        .lists
        .iter()
        .map(|l| ListTab {
            id: l.id.clone().into(),
            name: l.name.clone().into(),
            color: color(&l.color),
            open: st.store.data.tasks.iter().filter(|t| !t.done && t.list_id == l.id).count() as i32,
        })
        .collect();
    for w in &app.cards {
        let g = w.ui.global::<Esther>();
        g.set_can_add(st.store.shared);
        match w.kind {
            "tasks" => { g.set_tabs(model(tabs.clone())); fill_tasks(&g, &st, today) }
            "header" => fill_header(&g, today),
            "calendar" => fill_calendar(&g, &st, today),
            "week" => { g.set_tabs(model(tabs.clone())); fill_week(&g, &st, today) }
            _ => {}
        }
    }
}

/// Change something, save it, show it on every card.
fn change(app: &App, f: impl FnOnce(&mut State)) {
    {
        let mut st = app.state.borrow_mut();
        f(&mut st);
        st.store.save();
    }
    refresh(app);
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

// ---- Where the cards are: remembered between runs. ----
type Rect = (i32, i32, u32, u32);

fn place_path() -> std::path::PathBuf {
    data::data_path().with_file_name("esther-native.json")
}
/// { "cards": { "tasks": { x, y, width, height }, … } }. (The one-card prototype saved just { x, y, width, height }:
/// that was the Tasks card.)
fn load_places() -> std::collections::HashMap<String, Rect> {
    let mut out = std::collections::HashMap::new();
    let Some(v) = std::fs::read_to_string(place_path()).ok().and_then(|t| serde_json::from_str::<serde_json::Value>(&t).ok()) else { return out };
    let rect = |r: &serde_json::Value| Some((r["x"].as_i64()? as i32, r["y"].as_i64()? as i32, r["width"].as_u64()? as u32, r["height"].as_u64()? as u32));
    if let Some(cards) = v["cards"].as_object() {
        for (k, r) in cards {
            if let Some(r) = rect(r) { out.insert(k.clone(), r); }
        }
    } else if let Some(r) = rect(&v) {
        out.insert("tasks".into(), r);
    }
    out
}
fn save_places(app: &App) {
    let mut cards = serde_json::Map::new();
    for w in &app.cards {
        let (p, s) = (w.ui.window().position(), w.ui.window().size());
        cards.insert(w.kind.into(), serde_json::json!({ "x": p.x, "y": p.y, "width": s.width, "height": s.height }));
    }
    let _ = std::fs::write(place_path(), serde_json::json!({ "cards": cards }).to_string());
}

/// The smallest a card can be, in unscaled px.
fn min_size(kind: &str) -> (f32, f32) {
    match kind {
        "header" => (420.0, 96.0),
        "calendar" => (300.0, 330.0),
        "week" => (280.0, 220.0),
        _ => (300.0, 260.0),
    }
}

/// Where a card starts (as in the Electron app): the header at the top left, Tasks under it, the calendar at the top
/// right and This week under it. Worked out in unscaled px on the screen without the taskbar, then on the grid.
fn default_place(kind: &str) -> Rect {
    let (ax, ay, aw, ah) = win::work_area();
    let k = win::dpi_scale();
    let (w, h, g) = (aw as f32 / k, ah as f32 / k, GAP);
    let (x, y, pw, ph) = match kind {
        "header" => (g, g, (w - 480.0).min(680.0), 112.0),
        "calendar" => (w - g - 360.0, g, 360.0, 400.0),
        "week" => (w - g - 360.0, g + 400.0 + g, 360.0, (h - 400.0 - 3.0 * g).max(240.0)),
        _ => (g, g + 112.0 + g, (w * 0.55).round().min(1000.0), h - 112.0 - 3.0 * g),
    };
    let (mw, mh) = min_size(kind);
    let snap = |v: f32| ((v * k) / GRID).round() as i32 * GRID as i32;
    (ax + snap(x), ay + snap(y), snap(pw.max(mw)) as u32, snap(ph.max(mh)) as u32)
}

/// Is enough of it on the screen to grab? (A monitor may have been unplugged since.)
fn on_screen((x, y, w, _h): Rect) -> bool {
    let (sw, sh) = win::screen_size();
    x < sw as i32 - 60 && x + w as i32 > 60 && y >= -10 && y < sh as i32 - 40
}

fn set_rect(w: &Win, (x, y, pw, ph): Rect) {
    w.ui.window().set_position(PhysicalPosition::new(x, y));
    w.ui.window().set_size(PhysicalSize::new(pw, ph));
    place_glass(w);
}

/// Line the blurred wallpaper up with the real one behind the window (and narrow Tasks goes compact).
fn place_glass(w: &Win) {
    let win = w.ui.window();
    let k = win.scale_factor();
    let p = win.position();
    let (sw, sh) = win::screen_size();
    w.ui.set_glass_x(-(p.x as f32) / k);
    w.ui.set_glass_y(-(p.y as f32) / k);
    w.ui.set_glass_w(sw as f32 / k);
    w.ui.set_glass_h(sh as f32 / k);
    if w.kind == "tasks" {
        w.ui.global::<Esther>().set_compact((win.size().width as f32 / k) < 560.0);
    }
}

/// The new window rect (x, y, w, h) when an edge or corner is dragged by (dx, dy) physical px: the moving edges land
/// on the grid; Alt resizes from the centre, Shift keeps the proportions (like Illustrator, and the Electron cards).
fn resize_rect(r0: (f32, f32, f32, f32), edge: &str, dx: f32, dy: f32, shift: bool, alt: bool, k: f32, min: (f32, f32)) -> (f32, f32, f32, f32) {
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
    let (minw, minh) = (min.0 * k, min.1 * k);
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
fn apply_rect(w: &Win, (x, y, pw, ph): (f32, f32, f32, f32)) {
    let win = w.ui.window();
    let (p, s) = (win.position(), win.size());
    if p.x != x as i32 || p.y != y as i32 { win.set_position(PhysicalPosition::new(x as i32, y as i32)); }
    if s.width != pw as u32 || s.height != ph as u32 { win.set_size(PhysicalSize::new(pw as u32, ph as u32)); }
    place_glass(w);
}

/// A line in esther-native-log.txt next to the tasks file (what happened, for tracking down problems).
fn log(msg: &str) {
    use std::io::Write;
    if let Ok(mut f) = std::fs::OpenOptions::new().create(true).append(true).open(data::data_path().with_file_name("esther-native-log.txt")) {
        let _ = writeln!(f, "{} {msg}", now().format(&time::format_description::well_known::Rfc3339).unwrap_or_default());
    }
}

// ---- What the cards do ----
fn wire(app: &Rc<App>, i: usize) {
    let w = &app.cards[i];
    let g = w.ui.global::<Esther>();
    // (Each callback holds the app weakly: the windows belong to the app, not the other way round.)
    let wk = Rc::downgrade(app);

    { let wk = wk.clone(); g.on_pick_tab(move |id| if let Some(a) = wk.upgrade() { change(&a, |st| st.tab = id.to_string()) }); }
    { let wk = wk.clone(); g.on_pick_show(move |s| if let Some(a) = wk.upgrade() { change(&a, |st| st.show = s) }); }
    g.on_next_add_list(act(app, |a| change(a, |st| st.add_list = (st.add_list + 1) % st.store.data.lists.len().max(1))));
    {
        let wk = wk.clone();
        g.on_add_task(move |text| {
            let text = text.trim().to_string();
            let Some(a) = wk.upgrade() else { return };
            if text.is_empty() { return; }
            change(&a, |st| {
                if !st.store.shared { return; } // nothing is added until the tasks are shared with the Esther app
                let lists = &st.store.data.lists;
                let list_id = if st.tab != "all" && lists.iter().any(|l| l.id == st.tab) { st.tab.clone() } else { lists[st.add_list % lists.len()].id.clone() };
                let date = st.day.map(iso);
                st.store.data.tasks.insert(0, Task { id: new_id("t"), list_id, title: text, done: false, date, subtasks: vec![], done_at: None });
            });
        });
    }
    {
        let wk = wk.clone();
        g.on_toggle(move |id| {
            let Some(a) = wk.upgrade() else { return };
            change(&a, |st| {
                if let Some(t) = st.store.data.tasks.iter_mut().find(|t| t.id == id.as_str()) {
                    t.done = !t.done;
                    t.done_at = if t.done { OffsetDateTime::now_utc().format(&time::format_description::well_known::Rfc3339).ok() } else { None };
                }
            })
        });
    }
    {
        let wk = wk.clone();
        g.on_rename(move |id, title| {
            let title = title.trim().to_string();
            let Some(a) = wk.upgrade() else { return };
            if title.is_empty() { return; }
            change(&a, |st| {
                if let Some(t) = st.store.data.tasks.iter_mut().find(|t| t.id == id.as_str()) { t.title = title; }
            })
        });
    }
    {
        let wk = wk.clone();
        g.on_set_date(move |id, when| {
            let Some(a) = wk.upgrade() else { return };
            let t0 = today();
            let date = match when.as_str() {
                "today" => Some(iso(t0)),
                "tomorrow" => Some(iso(t0 + Duration::days(1))),
                "next-week" => Some(iso(t0 + Duration::days(7 - t0.weekday().number_days_from_monday() as i64))),
                _ => None,
            };
            change(&a, |st| {
                if let Some(t) = st.store.data.tasks.iter_mut().find(|t| t.id == id.as_str()) { t.date = date; }
            })
        });
    }
    {
        let wk = wk.clone();
        g.on_move_to(move |id, list| {
            let Some(a) = wk.upgrade() else { return };
            change(&a, |st| {
                if let Some(t) = st.store.data.tasks.iter_mut().find(|t| t.id == id.as_str()) { t.list_id = list.to_string(); }
            })
        });
    }
    { let wk = wk.clone(); g.on_delete(move |id| if let Some(a) = wk.upgrade() { change(&a, |st| st.store.data.tasks.retain(|t| t.id != id.as_str())) }); }

    // The calendar: a day shows only that day on the Tasks card (again: every day); move between months.
    {
        let wk = wk.clone();
        g.on_pick_day(move |s| {
            let Some(a) = wk.upgrade() else { return };
            let d = parse_date(&s);
            change(&a, |st| st.day = if st.day == d { None } else { d });
        });
    }
    g.on_clear_day(act(app, |a| change(a, |st| st.day = None)));
    {
        let wk = wk.clone();
        g.on_month_step(move |n| {
            let Some(a) = wk.upgrade() else { return };
            change(&a, |st| st.month = if n == 0 { first_of_month(today()) } else { add_months(st.month, n) });
        });
    }
    // This week: a task's name points it out on the Tasks card.
    {
        let wk = wk.clone();
        g.on_reveal(move |id| {
            let Some(a) = wk.upgrade() else { return };
            change(&a, |st| {
                let list = st.store.data.tasks.iter().find(|t| t.id == id.as_str()).map(|t| t.list_id.clone());
                if st.tab != "all" { if let Some(l) = list { st.tab = l; } }
                st.day = None;
                st.show = 0;
                st.highlight = id.to_string();
            });
            let wk = Rc::downgrade(&a);
            let id = id.to_string();
            slint::Timer::single_shot(std::time::Duration::from_millis(2600), move || {
                if let Some(a) = wk.upgrade() {
                    if a.state.borrow().highlight == id { change(&a, |st| st.highlight.clear()); }
                }
            });
        });
    }
    g.on_reset_layout(act(app, |a| {
        for w in &a.cards { set_rect(w, default_place(w.kind)); }
        save_places(a);
    }));
    g.on_quit(|| { let _ = slint::quit_event_loop(); });
    // Closing any card (Alt+F4) quits Esther: until the tray comes, that's the way out.
    w.ui.window().on_close_requested(|| { let _ = slint::quit_event_loop(); slint::CloseRequestResponse::HideWindow });

    // Moving and resizing. On Windows Esther follows the real mouse from the press until the button is let go (as
    // the Electron app does), so it's exact even when the mouse runs ahead of the window; elsewhere it uses the
    // movement Slint reports. Both land on the 8 px grid. Resizing: Alt from the centre, Shift in proportion.
    {
        let wk = wk.clone();
        g.on_drag_start(move || if let Some(a) = wk.upgrade() { start_track(&a, i, None) });
    }
    {
        let wk = wk.clone();
        g.on_resize_start(move |e| if let Some(a) = wk.upgrade() { start_track(&a, i, Some(e.to_string())) });
    }
    {
        let wk = wk.clone();
        g.on_drag_by(move |dx, dy| {
            if cfg!(windows) { return; } // followed from the real mouse instead
            let Some(a) = wk.upgrade() else { return };
            let w = &a.cards[i];
            let win = w.ui.window();
            let k = win.scale_factor();
            let (p, s) = (win.position(), win.size());
            let g = GRID * k;
            let snap = |v: f32| (v / g).round() * g;
            apply_rect(w, (snap(p.x as f32 + dx * k), snap(p.y as f32 + dy * k), s.width as f32, s.height as f32));
        });
    }
    {
        let wk = wk.clone();
        g.on_resize_by(move |edge, dx, dy| {
            if cfg!(windows) { return; }
            let Some(a) = wk.upgrade() else { return };
            let w = &a.cards[i];
            let win = w.ui.window();
            let k = win.scale_factor();
            let (p, s) = (win.position(), win.size());
            let r = resize_rect((p.x as f32, p.y as f32, s.width as f32, s.height as f32), edge.as_str(), dx * k, dy * k, false, false, k, min_size(w.kind));
            apply_rect(w, r);
        });
    }
    g.on_drag_end(act(app, save_places));
    g.on_resize_end(act(app, save_places));
}

/// A callback without arguments that acts on the app, if it's still there.
fn act(app: &Rc<App>, f: impl Fn(&App) + 'static) -> impl Fn() + 'static {
    let wk = Rc::downgrade(app);
    move || if let Some(a) = wk.upgrade() { f(&a) }
}

fn start_track(app: &App, i: usize, edge: Option<String>) {
    if !cfg!(windows) { return; }
    let w = app.cards[i].ui.window();
    let (p, s) = (w.position(), w.size());
    *app.tracking.borrow_mut() = Some((i, Track { edge, c0: win::cursor(), r0: (p.x as f32, p.y as f32, s.width as f32, s.height as f32) }));
}

/// Follow the mouse while a card is moved or resized (Windows), every 8 ms.
fn track_tick(app: &App) {
    let mut tr = app.tracking.borrow_mut();
    let Some((i, t)) = tr.as_ref() else { return };
    let w = &app.cards[*i];
    if !win::button_down() {
        *tr = None;
        drop(tr);
        save_places(app);
        return;
    }
    let (cx, cy) = win::cursor();
    let (dx, dy) = ((cx - t.c0.0) as f32, (cy - t.c0.1) as f32);
    let k = w.ui.window().scale_factor();
    let r = match &t.edge {
        None => { let g = GRID * k; let snap = |v: f32| (v / g).round() * g; (snap(t.r0.0 + dx), snap(t.r0.1 + dy), t.r0.2, t.r0.3) }
        Some(e) => { let (shift, alt) = win::mods(); resize_rect(t.r0, e, dx, dy, shift, alt, k, min_size(w.kind)) }
    };
    apply_rect(w, r);
}

// ---- The smoke test ----

/// Where things are on the cards, in unscaled px from the card's top left (they follow the layout in app.slint).
mod spots {
    /// The middle of a day on the calendar: the grid starts under the month name and the weekday letters.
    pub fn calendar_day(index: usize, cells: usize, w: f32, h: f32) -> (f32, f32) {
        let (top, pad) = (16.0 + 30.0 + 10.0 + 16.0 + 10.0, 16.0);
        let weeks = (cells / 7).max(1) as f32;
        let (cw, ch) = ((w - 2.0 * pad) / 7.0, (h - top - pad) / weeks);
        (pad + ((index % 7) as f32 + 0.5) * cw, top + ((index / 7) as f32 + 0.5) * ch)
    }
    /// The middle of a task's line in This week: (the line's top, for the tick and the name).
    pub fn week_line(blocks: &[(usize, bool)], block: usize, line: usize) -> f32 {
        let mut y = 16.0 + 30.0 + 8.0;
        for (n, roomy) in &blocks[..block] {
            y += if *roomy { 5.0 + 18.0 + *n as f32 * 28.0 + 6.0 } else { 3.0 + 18.0 + 3.0 } + 2.0;
        }
        y + 5.0 + 18.0 + 2.0 + line as f32 * 28.0 + 13.0
    }
}

/// Step by step on a timer, with real input on Windows: resize Tasks from its right edge, drag it, click into "Add a
/// task", type a task and press Enter; pick a day on the calendar (Tasks shows only that day) and pick it again;
/// click a task's name in This week (Tasks points it out) and tick it there (Tasks shows it done). Then save a picture
/// of every card and the figures, and quit.
fn smoke_run(dir: std::path::PathBuf, app: Rc<App>) -> slint::Timer {
    let t = slint::Timer::default();
    let step = Cell::new(0u32);
    let rects: RefCell<Vec<(i32, i32, i32, i32)>> = RefCell::new(vec![]);
    let seen: RefCell<Vec<String>> = RefCell::new(vec![]);
    let checks: RefCell<serde_json::Map<String, serde_json::Value>> = RefCell::new(serde_json::Map::new());
    let start = std::time::Instant::now();
    t.start(slint::TimerMode::Repeated, std::time::Duration::from_millis(150), move || {
        let a = &app;
        let ready = a.cards.iter().all(|w| w.hwnd.get() != 0);
        if !ready && start.elapsed().as_secs() < 8 { return; } // wait for the windows
        let tasks = a.card("tasks");
        let h = tasks.hwnd.get();
        let k = tasks.ui.window().scale_factor();
        let real = cfg!(windows) && a.cards.iter().all(|w| w.hwnd.get() > 0);
        step.set(step.get() + 1);
        let st = step.get();
        let rect = |w: &Win| -> (i32, i32, i32, i32) {
            #[cfg(windows)]
            { win::window_rect(w.hwnd.get()) }
            #[cfg(not(windows))]
            { let (p, s) = (w.ui.window().position(), w.ui.window().size()); (p.x, p.y, p.x + s.width as i32, p.y + s.height as i32) }
        };
        let at = |w: &Win, x: f32, y: f32| { let r = rect(w); (r.0 + (x * k) as i32, r.1 + (y * k) as i32) };
        let look = |label: &str, w: &Win, p: (i32, i32)| { win_input::to(p.0, p.1); seen.borrow_mut().push(format!("{label}: {}", win_input::under(p.0, p.1, w.hwnd.get()))); };
        let rows = || tasks.ui.global::<Esther>().get_rows().row_count();
        let note = |k: &str, v: serde_json::Value| { checks.borrow_mut().insert(k.into(), v); };
        let cal = a.card("calendar");
        let week = a.card("week");
        match st {
            1..=5 => {} // let it settle
            6 if real => { win_input::clear_consoles(); for w in &a.cards { win_input::front(w.hwnd.get()); } win_input::front(h); }
            // Tasks: the right edge, 72 px inwards (the test machine's screen is small; the mouse can't go past it).
            7 if real => { let r = rect(tasks); rects.borrow_mut().push(r); look("edge", tasks, (r.2 - 3, (r.1 + r.3) / 2)); }
            8 if real => win_input::down(),
            9..=14 if real => { let r = rects.borrow()[0]; win_input::to(r.2 - 3 - (st as i32 - 8) * 12, (r.1 + r.3) / 2); }
            15 if real => win_input::up(),
            // Tasks: drag it by the space beside the tabs.
            17 if real => { let r = rect(tasks); rects.borrow_mut().push(r); look("drag", tasks, (r.2 - (40.0 * k) as i32, r.1 + (71.0 * k) as i32)); }
            18 if real => win_input::down(),
            19..=23 if real => { let r = rects.borrow()[1]; let i = st as i32 - 18; win_input::to(r.2 - (40.0 * k) as i32 + i * 10, r.1 + (71.0 * k) as i32 + i * 6); }
            24 if real => win_input::up(),
            // Tasks: click into "Add a task", type, Enter.
            26 if real => {
                let r = rect(tasks);
                rects.borrow_mut().push(r);
                let compact = ((r.2 - r.0) as f32 / k) < 560.0;
                look("add field", tasks, at(tasks, 90.0, if compact { 116.0 } else { 150.0 }));
            }
            27 if real => win_input::down(),
            28 if real => win_input::up(),
            30 if real => win_input::type_text("Typed on Windows"),
            32 if real => win_input::enter(),
            33 if !real => tasks.ui.global::<Esther>().invoke_add_task("Typed on Windows".into()),
            // The calendar: pick the 23rd (one task that day), then pick it again (every day).
            35 => {
                note("rows_before_day", rows().into());
                let s = a.state.borrow();
                let first = s.month;
                let lead = first.weekday().number_days_from_monday() as usize;
                let cells = cal.ui.global::<Esther>().get_days().row_count();
                drop(s);
                let size = cal.ui.window().size();
                let (x, y) = spots::calendar_day(lead + 22, cells, size.width as f32 / k, size.height as f32 / k);
                if real { win_input::front(cal.hwnd.get()); look("calendar 23rd", cal, at(cal, x, y)); }
            }
            36 if real => win_input::down(),
            37 => { if real { win_input::up() } else { cal.ui.global::<Esther>().invoke_pick_day(iso(first_of_month(today()) + Duration::days(22)).into()) } }
            39 => { note("rows_on_the_23rd", rows().into()); note("day_label", tasks.ui.global::<Esther>().get_day_label().to_string().into()); }
            40 if real => win_input::down(),
            41 => { if real { win_input::up() } else { cal.ui.global::<Esther>().invoke_pick_day(iso(first_of_month(today()) + Duration::days(22)).into()) } }
            43 => note("rows_after_day", rows().into()),
            // This week: click the name of Monday's task (Tasks points it out), then tick it there.
            44 => {
                let blocks: Vec<(usize, bool)> = week.ui.global::<Esther>().get_week().iter().map(|d| (d.tasks.row_count(), d.tasks.row_count() > 0 || d.today)).collect();
                let late = week.ui.global::<Esther>().get_week().iter().next().is_some_and(|d| d.late);
                let mon = if late { 1 } else { 0 };
                let y = spots::week_line(&blocks, mon, 0);
                note("week_task", week.ui.global::<Esther>().get_week().row_data(mon).and_then(|d| d.tasks.row_data(0)).map(|t| t.title.to_string()).unwrap_or_default().into());
                rects.borrow_mut().push((0, y as i32, 0, 0));
                if real { win_input::front(week.hwnd.get()); look("week task name", week, at(week, 110.0, y)); }
            }
            45 if real => win_input::down(),
            46 => {
                if real { win_input::up() } else if let Some(t) = week.ui.global::<Esther>().get_week().row_data(1).and_then(|d| d.tasks.row_data(0)) { week.ui.global::<Esther>().invoke_reveal(t.id) }
            }
            48 => note("pointed_out", tasks.ui.global::<Esther>().get_highlight().to_string().into()),
            49 => { let y = rects.borrow().last().unwrap().1 as f32; if real { look("week tick", week, at(week, 16.0 + 6.0 + 4.0 + 7.5, y)); } }
            50 if real => win_input::down(),
            51 => {
                if real { win_input::up() } else if let Some(t) = week.ui.global::<Esther>().get_week().row_data(1).and_then(|d| d.tasks.row_data(0)) { week.ui.global::<Esther>().invoke_toggle(t.id) }
            }
            53 => {
                let id = checks.borrow().get("pointed_out").and_then(|v| v.as_str().map(String::from)).unwrap_or_default();
                let row = tasks.ui.global::<Esther>().get_rows().iter().find(|r| r.id.as_str() == id);
                note("ticked_in_week_done_in_tasks", row.is_some_and(|r| r.done).into());
            }
            // The header: drag it by the empty space at its right (under the right-click menu's area).
            55 if real => { let hd = a.card("header"); let r = rect(hd); rects.borrow_mut().push(r); win_input::front(hd.hwnd.get()); look("header drag", hd, (r.2 - (30.0 * k) as i32, r.1 + (20.0 * k) as i32)); }
            56 if real => win_input::down(),
            57..=61 if real => { let r = *rects.borrow().last().unwrap(); let i = st as i32 - 56; win_input::to(r.2 - (30.0 * k) as i32 + i * 8, r.1 + (20.0 * k) as i32 + i * 8); }
            62 if real => win_input::up(),
            64 if real => { let r0 = *rects.borrow().last().unwrap(); let r = rect(a.card("header")); note("header_moved_px", (r.1 - r0.1).into()); }
            65 => {
                let text = std::fs::read_to_string(&a.state.borrow().store.path).unwrap_or_default();
                let file: serde_json::Value = serde_json::from_str(&text).unwrap_or_default();
                let ticked = checks.borrow().get("pointed_out").and_then(|v| v.as_str().map(String::from)).unwrap_or_default();
                let saved_done = file["tasks"].as_array().is_some_and(|ts| ts.iter().any(|t| t["id"] == ticked.as_str() && t["done"] == true));
                let rs = rects.borrow();
                let (resized, moved) = if real && rs.len() >= 3 { ((rs[1].2 - rs[1].0) - (rs[0].2 - rs[0].0), rs[2].0 - rs[1].0) } else { (0, 0) };
                let mut cards = serde_json::Map::new();
                for w in &a.cards {
                    let file = format!("{}.png", if w.kind == "tasks" { "tasks-card" } else { w.kind });
                    let shot = w.ui.window().take_snapshot().ok().map(|buf| {
                        image::RgbaImage::from_raw(buf.width(), buf.height(), buf.as_bytes().to_vec()).map(|i| i.save(dir.join(&file)).is_ok()).unwrap_or(false)
                    });
                    #[cfg(windows)]
                    let (corner, tool, owned) = if w.hwnd.get() > 0 { win::facts(w.hwnd.get()) } else { (0, false, false) };
                    #[cfg(not(windows))]
                    let (corner, tool, owned) = (0u32, false, false);
                    cards.insert(w.kind.into(), serde_json::json!({
                        "screenshot": shot.unwrap_or(false),
                        "rounded_corners_asked": corner == 2,
                        "tool_window": tool,
                        "on_the_desktop": owned,
                        "rect": rect(w),
                        "styled": w.styled.borrow().clone(),
                    }));
                }
                let (private, ws) = win::memory_kb();
                let mut report = serde_json::json!({
                    "private_mb": (private as f64 / 1024.0 * 10.0).round() / 10.0,
                    "working_set_mb": (ws as f64 / 1024.0 * 10.0).round() / 10.0,
                    "windows": a.cards.len(),
                    "rows": rows(),
                    "typed_task_saved": text.contains("Typed on Windows"),
                    "ticked_task_saved": saved_done,
                    "real_input": real,
                    "resized_px": resized,
                    "moved_px": moved,
                    "header_line": a.card("header").ui.global::<Esther>().get_line().to_string(),
                    "cards": cards,
                    "under_the_mouse": seen.borrow().clone(),
                    "renderer": std::env::var("SLINT_BACKEND").unwrap_or_else(|_| "winit-software".into()),
                });
                for (k, v) in checks.borrow().iter() { report[k] = v.clone(); }
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
    pub fn clear_consoles() { crate::win::clear_consoles() }
    pub fn front(h: isize) { crate::win::front(h) }
}
#[cfg(not(windows))]
mod win_input {
    pub fn to(_x: i32, _y: i32) {}
    pub fn down() {}
    pub fn up() {}
    pub fn type_text(_s: &str) {}
    pub fn enter() {}
    pub fn under(_x: i32, _y: i32, _h: isize) -> String { String::new() }
    pub fn clear_consoles() {}
    pub fn front(_h: isize) {}
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

    let cards: Vec<Win> = KINDS
        .iter()
        .map(|kind| {
            let ui = Card::new().expect("a card window");
            ui.set_kind((*kind).into());
            Win { kind, ui, hwnd: Cell::new(0), styled: RefCell::new("not yet".into()) }
        })
        .collect();
    let mut state = State { store: Store::open(data::data_path()), tab: "all".into(), show: 0, add_list: 0, day: None, month: first_of_month(today()), highlight: String::new() };
    if smoke.is_none() { clear_old(&mut state); } // (the test's tasks are fixed; "a week ago" moves on)
    let app = Rc::new(App { cards, state: RefCell::new(state), tracking: RefCell::new(None) });
    for i in 0..app.cards.len() { wire(&app, i); }
    refresh(&app);

    let tracker = slint::Timer::default();
    {
        let wk = Rc::downgrade(&app);
        tracker.start(slint::TimerMode::Repeated, std::time::Duration::from_millis(8), move || if let Some(a) = wk.upgrade() { track_tick(&a) });
    }

    // Glass from the wallpaper (one picture, shared by every card; again whenever the wallpaper changes), tasks
    // changed by the Electron app, and a new day or a new part of the day (the greeting, today on the calendar).
    let (sw, sh) = win::screen_size();
    let set_glass = {
        let wk = Rc::downgrade(&app);
        move || {
            let Some(a) = wk.upgrade() else { return };
            let img = glass::blurred(sw, sh, 28.0);
            for w in &a.cards {
                match &img {
                    Some(img) => { w.ui.set_glass(img.clone()); w.ui.set_has_glass(true); }
                    None => w.ui.set_has_glass(false),
                }
                place_glass(w);
            }
        }
    };
    set_glass();
    let watch = slint::Timer::default();
    {
        let wk = Rc::downgrade(&app);
        let mut wall = glass::stamp();
        let mut moment = (today(), greeting());
        watch.start(slint::TimerMode::Repeated, std::time::Duration::from_millis(1000), move || {
            let Some(a) = wk.upgrade() else { return };
            let reloaded = a.state.borrow_mut().store.reload_if_changed();
            let m = (today(), greeting());
            if reloaded || m != moment {
                moment = m;
                refresh(&a);
            }
            let now = glass::stamp();
            if now != wall { wall = now; set_glass(); }
        });
    }

    // Where they were last time (or the Electron app's starting layout).
    let places = load_places();
    for w in &app.cards {
        let r = places.get(w.kind).copied().filter(|r| on_screen(*r)).unwrap_or_else(|| default_place(w.kind));
        set_rect(w, r);
        w.ui.show().expect("show a card");
        place_glass(w);
    }

    // The Windows touches (desktop layer, rounded corners, no taskbar button, no animations). The native windows only
    // exist once the event loop runs, so this waits for them (doing it straight after show() did nothing).
    let styler = slint::Timer::default();
    {
        let wk = Rc::downgrade(&app);
        let tries = Cell::new(0);
        styler.start(slint::TimerMode::Repeated, std::time::Duration::from_millis(50), move || {
            use raw_window_handle::{HasWindowHandle, RawWindowHandle};
            let Some(a) = wk.upgrade() else { return };
            tries.set(tries.get() + 1);
            for w in &a.cards {
                if w.hwnd.get() != 0 { continue; }
                match w.ui.window().window_handle().window_handle().map(|h| h.as_raw()) {
                    Ok(RawWindowHandle::Win32(h)) => {
                        w.hwnd.set(h.hwnd.get());
                        *w.styled.borrow_mut() = win::style(h.hwnd.get());
                        log(&format!("{} card styled: {}", w.kind, w.styled.borrow()));
                    }
                    Ok(_) if tries.get() > 40 => { w.hwnd.set(-1); *w.styled.borrow_mut() = "not a Windows window".into(); }
                    _ => {}
                }
            }
        });
    }

    // The test machine: use the cards with the real mouse and keyboard (Windows), picture them, measure, quit.
    let _smoke = smoke.map(|dir| smoke_run(dir, app.clone()));

    slint::run_event_loop_until_quit().expect("run");
    save_places(&app);
}

//! Esther as a native Windows program (Rust + Slint): the header with the greeting, the calendar, This week and
//! Tasks, each its own window on the desktop, all showing the one set of tasks, and the Esther bubble. A tray icon
//! and Ctrl+Alt+E show and hide them. It shares the tasks with the Electron app through
//! `%APPDATA%\Esther\tasks.json`, so both can run side by side.
//!
//! `esther-native --smoke DIR` is for the Windows test machine: it opens the cards on the tasks in DIR/tasks.json,
//! uses them with the real mouse and keyboard, saves pictures and the figures to DIR (memory.json), and quits.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod data;
mod glass;
mod guides;
mod shell;
mod win;

use data::{new_id, List, Store, Subtask, Task};
use guides::{Kind, Line};
use slint::{Color, ComponentHandle, Model, ModelRc, PhysicalPosition, PhysicalSize, SharedString, VecModel};
use std::cell::{Cell, RefCell};
use std::rc::Rc;
use std::time::{Duration as StdDuration, Instant};
use time::{Date, Duration, OffsetDateTime};

slint::include_modules!();

const GRID: f32 = 8.0;
const GAP: f32 = 16.0;
/// How close (unscaled px) a card's edge or centre must come to a guide to snap to it.
const SNAP: f32 = 10.0;
const MONTHS: [&str; 12] = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_LONG: [&str; 12] = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAYS: [&str; 7] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/// The windows, in the order they are made: the four cards, then the bubble.
const KINDS: [&str; 5] = ["header", "tasks", "calendar", "week", "bubble"];
const CARD_NAMES: [&str; 4] = ["Header", "Tasks", "Calendar", "This week"];
/// The order cards come back in.
const CALL_ORDER: [&str; 4] = ["header", "calendar", "week", "tasks"];
/// The bubble: big (in the middle of the screen, × its size) while the cards are tucked away, small at the bottom left.
const BUBBLE_BIG: (f32, f32) = (520.0, 190.0);
const BUBBLE_SMALL: (f32, f32) = (118.0, 43.0);

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
/// The colours a new list gets, in order (the first one no list uses yet), as in the app.
const PIGMENTS: [&str; 12] = ["#c8553a", "#4c6fb8", "#3f9a80", "#d4a03c", "#b44a6e", "#8a4f8f", "#5a93c4", "#6aa452", "#dd7a45", "#b98a3e", "#8c6a4a", "#7f8a96"];

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
    /// The date picker: its month, and the day it marks.
    picker_month: Date,
    picker_day: Option<Date>,
}

/// What you set: which cards are off, snapping, the bubble and its size. Kept with the cards' places.
struct Prefs {
    hidden: Vec<String>,
    snap: bool,
    bubble: bool,
    bubble_size: f32,
}

/// One window, and what Windows made of it.
struct Win {
    kind: &'static str,
    ui: Card,
    hwnd: Cell<isize>,
    styled: RefCell<String>,
}

/// A move or resize in progress: which edge (None: moving), where the mouse and the window started (physical px),
/// whether it has really started (a click isn't a drag), and what the guides last showed.
struct Track {
    edge: Option<String>,
    c0: (i32, i32),
    r0: (f32, f32, f32, f32),
    started: bool,
    shown: Option<(Rect, Vec<Line>)>,
}

/// Esther's own animations: a window fading in or out, the bubble gliding.
enum Anim {
    Fade { i: usize, from: f32, to: f32, start: Instant, ms: f32, hide_after: bool },
    Glide { i: usize, from: Rect, to: Rect, start: Instant, ms: f32 },
}

struct App {
    cards: Vec<Win>,
    state: RefCell<State>,
    prefs: RefCell<Prefs>,
    /// Tucked away (into the bubble).
    collapsed: Cell<bool>,
    /// Which window is being moved or resized, and how.
    tracking: RefCell<Option<(usize, Track)>>,
    anims: RefCell<Vec<Anim>>,
    hotkey_ok: Cell<bool>,
    /// The guides lit up during the last move or resize (for the test).
    lit: RefCell<Vec<Line>>,
}

impl App {
    fn card(&self, kind: &str) -> &Win {
        self.cards.iter().find(|w| w.kind == kind).expect("every card exists")
    }
    fn index(&self, kind: &str) -> usize {
        self.cards.iter().position(|w| w.kind == kind).expect("every card exists")
    }
    fn is_on(&self, kind: &str) -> bool {
        kind != "bubble" && !self.prefs.borrow().hidden.iter().any(|h| h == kind)
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
fn stamp_now() -> Option<String> {
    OffsetDateTime::now_utc().format(&time::format_description::well_known::Rfc3339).ok()
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
fn hex(c: Color) -> String {
    format!("#{:02x}{:02x}{:02x}", c.red(), c.green(), c.blue())
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
        iso: t.date.clone().unwrap_or_default().into(),
        date_kind: kind,
        subs: if t.subtasks.is_empty() { SharedString::new() } else { format!("{}/{}", subs_done, t.subtasks.len()).into() },
        subtasks: model(t.subtasks.iter().map(|s| SubRow { id: s.id.clone().into(), text: s.text.clone().into(), done: s.done }).collect()),
        clears: clears(t).into(),
    }
}

fn model<T: Clone + 'static>(v: Vec<T>) -> ModelRc<T> {
    ModelRc::new(VecModel::from(v))
}

/// The same as what a card already shows? (Then it isn't handed a new list: the rows stay as they are, so a
/// double-click on them still counts, and nothing is drawn again for nothing.)
trait Same {
    fn same(&self, o: &Self) -> bool;
}
fn same_list<T: Same + Clone + 'static>(a: &ModelRc<T>, b: &[T]) -> bool {
    a.row_count() == b.len() && a.iter().zip(b).all(|(x, y)| x.same(y))
}
impl Same for ListTab { fn same(&self, o: &Self) -> bool { self == o } }
impl Same for SubRow { fn same(&self, o: &Self) -> bool { self == o } }
impl Same for Color { fn same(&self, o: &Self) -> bool { self == o } }
impl Same for TaskRow {
    fn same(&self, o: &Self) -> bool {
        let v: Vec<SubRow> = o.subtasks.iter().collect();
        (&self.id, &self.title, self.done, &self.list_id, &self.list_name, self.list_color, &self.date, &self.iso, self.date_kind, &self.subs, &self.clears)
            == (&o.id, &o.title, o.done, &o.list_id, &o.list_name, o.list_color, &o.date, &o.iso, o.date_kind, &o.subs, &o.clears)
            && same_list(&self.subtasks, &v)
    }
}
impl Same for CalDay {
    fn same(&self, o: &Self) -> bool {
        let v: Vec<Color> = o.marks.iter().collect();
        (self.num, &self.iso, self.today, self.picked, self.other) == (o.num, &o.iso, o.today, o.picked, o.other) && same_list(&self.marks, &v)
    }
}
impl Same for WeekDay {
    fn same(&self, o: &Self) -> bool {
        let v: Vec<TaskRow> = o.tasks.iter().collect();
        (&self.label, &self.small, self.today, self.past, self.late) == (&o.label, &o.small, o.today, o.past, o.late) && same_list(&self.tasks, &v)
    }
}
/// Hand a card a new list only if it differs from what it shows.
macro_rules! set_list {
    ($g:expr, $get:ident, $set:ident, $v:expr) => {{
        let v = $v;
        if !same_list(&$g.$get(), &v) { $g.$set(model(v)); }
    }};
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
    set_list!(g, get_rows, set_rows, rows);
    g.set_day_label(st.day.map(|d| if d == today { "Today".to_string() } else { long_date(d) }).unwrap_or_default().into());
    g.set_highlight(st.highlight.clone().into());
    if let Some(l) = d.lists.get(st.add_list % d.lists.len().max(1)) {
        g.set_add_list_name(l.name.clone().into());
        g.set_add_list_color(color(&l.color));
    }
    fill_picker(g, st, today);
}

fn fill_header(g: &Esther, today: Date) {
    let hello = greeting();
    g.set_hello(hello.into());
    g.set_hello_letter(hello[..1].into());
    g.set_long_date(long_date(today).into());
    g.set_line(line_for(&iso(today)).into());
}

/// A month, Monday first, whole weeks; open tasks as dots in their lists' colours (up to three a day).
fn month_days(st: &State, first: Date, picked: Option<Date>, today: Date) -> Vec<CalDay> {
    let d = &st.store.data;
    let lead = first.weekday().number_days_from_monday() as i64;
    let in_month = (add_months(first, 1) - first).whole_days();
    let cells = ((lead + in_month + 6) / 7) * 7;
    let start = first - Duration::days(lead);
    (0..cells)
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
            CalDay { num: c.day() as i32, iso: key.into(), today: c == today, picked: picked == Some(c), other: c.month() != first.month(), marks: model(marks) }
        })
        .collect()
}
fn month_title(first: Date) -> String {
    format!("{} {}", MONTHS_LONG[first.month() as usize - 1], first.year())
}

fn fill_calendar(g: &Esther, st: &State, today: Date) {
    g.set_month_title(month_title(st.month).into());
    set_list!(g, get_days, set_days, month_days(st, st.month, st.day, today));
}
fn fill_picker(g: &Esther, st: &State, today: Date) {
    g.set_picker_title(month_title(st.picker_month).into());
    set_list!(g, get_picker_days, set_picker_days, month_days(st, st.picker_month, st.picker_day, today));
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
    set_list!(g, get_week, set_week, week_days(st, today));
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
            total: st.store.data.tasks.iter().filter(|t| t.list_id == l.id).count() as i32,
        })
        .collect();
    for w in &app.cards {
        let g = w.ui.global::<Esther>();
        g.set_can_add(st.store.shared);
        match w.kind {
            "tasks" => { set_list!(g, get_tabs, set_tabs, tabs.clone()); fill_tasks(&g, &st, today) }
            "header" => fill_header(&g, today),
            "calendar" => fill_calendar(&g, &st, today),
            "week" => { set_list!(g, get_tabs, set_tabs, tabs.clone()); fill_week(&g, &st, today) }
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
/// Change one task (if it's there).
fn change_task(app: &App, id: &str, f: impl FnOnce(&mut Task)) {
    change(app, |st| {
        if let Some(t) = st.store.data.tasks.iter_mut().find(|t| t.id == id) { f(t) }
    })
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

// ---- Where the cards are, and what you set: remembered between runs. ----
type Rect = (i32, i32, i32, i32);

fn place_path() -> std::path::PathBuf {
    data::data_path().with_file_name("esther-native.json")
}
/// { "cards": { "tasks": { x, y, width, height }, … }, "hidden": [], "snap", "bubble", "bubbleSize" }. (The one-card
/// prototype saved just { x, y, width, height }: that was the Tasks card.)
fn load_saved() -> (std::collections::HashMap<String, Rect>, Prefs) {
    let mut places = std::collections::HashMap::new();
    let mut prefs = Prefs { hidden: vec![], snap: true, bubble: true, bubble_size: 0.6 };
    let Some(v) = std::fs::read_to_string(place_path()).ok().and_then(|t| serde_json::from_str::<serde_json::Value>(&t).ok()) else { return (places, prefs) };
    let rect = |r: &serde_json::Value| Some((r["x"].as_i64()? as i32, r["y"].as_i64()? as i32, r["width"].as_i64()? as i32, r["height"].as_i64()? as i32));
    if let Some(cards) = v["cards"].as_object() {
        for (k, r) in cards {
            if let Some(r) = rect(r) { places.insert(k.clone(), r); }
        }
    } else if let Some(r) = rect(&v) {
        places.insert("tasks".into(), r);
    }
    if let Some(h) = v["hidden"].as_array() { prefs.hidden = h.iter().filter_map(|x| x.as_str().map(String::from)).collect(); }
    if let Some(b) = v["snap"].as_bool() { prefs.snap = b; }
    if let Some(b) = v["bubble"].as_bool() { prefs.bubble = b; }
    if let Some(k) = v["bubbleSize"].as_f64() { prefs.bubble_size = (k as f32).clamp(0.3, 1.5); }
    (places, prefs)
}
fn save_places(app: &App) {
    let mut cards = serde_json::Map::new();
    for w in app.cards.iter().filter(|w| w.kind != "bubble") {
        let (x, y, cw, ch) = rect_of(w);
        cards.insert(w.kind.into(), serde_json::json!({ "x": x, "y": y, "width": cw, "height": ch }));
    }
    let p = app.prefs.borrow();
    let _ = std::fs::write(
        place_path(),
        serde_json::json!({ "cards": cards, "hidden": p.hidden, "snap": p.snap, "bubble": p.bubble, "bubbleSize": p.bubble_size }).to_string(),
    );
}

/// The smallest a card can be, in unscaled px.
fn min_size(kind: &str) -> (f32, f32) {
    match kind {
        "header" => (420.0, 96.0),
        "calendar" => (300.0, 330.0),
        "week" => (280.0, 220.0),
        "bubble" => (40.0, 20.0),
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
    (ax + snap(x), ay + snap(y), snap(pw.max(mw)), snap(ph.max(mh)))
}

/// The bubble's place: big in the middle of the screen, or small at the bottom left.
fn bubble_rect(big: bool, size: f32) -> Rect {
    let (ax, ay, aw, ah) = win::work_area();
    let k = win::dpi_scale();
    let (w, h) = if big { (BUBBLE_BIG.0 * size * k, BUBBLE_BIG.1 * size * k) } else { (BUBBLE_SMALL.0 * k, BUBBLE_SMALL.1 * k) };
    let (w, h) = (w.round() as i32, h.round() as i32);
    if big { (ax + (aw - w) / 2, ay + (ah - h) / 2, w, h) } else { (ax + (GAP * k) as i32, ay + ah - h - (GAP * k) as i32, w, h) }
}

/// Is enough of it on the screen to grab? (A monitor may have been unplugged since.)
fn on_screen((x, y, w, _h): Rect) -> bool {
    let (sw, sh) = win::screen_size();
    x < sw as i32 - 60 && x + w > 60 && y >= -10 && y < sh as i32 - 40
}

/// Where a window is (x, y, width, height), as Windows has it.
fn rect_of(w: &Win) -> Rect {
    #[cfg(windows)]
    if w.hwnd.get() > 0 {
        let (l, t, r, b) = win::window_rect(w.hwnd.get());
        return (l, t, r - l, b - t);
    }
    let (p, s) = (w.ui.window().position(), w.ui.window().size());
    (p.x, p.y, s.width as i32, s.height as i32)
}

/// Put a window at (x, y, w, h) physical px, in one step on Windows, and line its glass up.
fn set_rect(w: &Win, r: Rect) {
    let (x, y, pw, ph) = r;
    if cfg!(windows) && w.hwnd.get() > 0 {
        if rect_of(w) != r { shell::set_rect(w.hwnd.get(), x, y, pw, ph); }
    } else {
        w.ui.window().set_position(PhysicalPosition::new(x, y));
        w.ui.window().set_size(PhysicalSize::new(pw as u32, ph as u32));
    }
    place_glass(w, r);
}

/// Line the glass up with the real wallpaper behind the window (and narrow Tasks goes compact).
fn place_glass(w: &Win, (x, y, pw, _ph): Rect) {
    let k = w.ui.window().scale_factor();
    let (sw, sh) = win::screen_size();
    w.ui.set_glass_x(-(x as f32) / k);
    w.ui.set_glass_y(-(y as f32) / k);
    w.ui.set_glass_w(sw as f32 / k);
    w.ui.set_glass_h(sh as f32 / k);
    if w.kind == "tasks" {
        w.ui.global::<Esther>().set_compact((pw as f32 / k) < 560.0);
    }
}

// ---- Snapping: the grid, and guides like Illustrator's smart guides ----

/// The guides a card can snap to: the screen's centre, middle and quarters, and the other cards' edges and centres
/// (and a card's gap away from them).
fn guide_lines(app: &App, moving: usize, area: Rect, k: f32) -> (Vec<Line>, Vec<Line>) {
    let (ax, ay, aw, ah) = area;
    let gap = (GAP * k).round() as i32;
    let mut xs: Vec<Line> = [0.25, 0.5, 0.75].iter().map(|q| Line { x: true, v: ax + (aw as f32 * q).round() as i32, kind: if *q == 0.5 { Kind::Centre } else { Kind::Quarter } }).collect();
    let mut ys: Vec<Line> = [0.25, 0.5, 0.75].iter().map(|q| Line { x: false, v: ay + (ah as f32 * q).round() as i32, kind: if *q == 0.5 { Kind::Middle } else { Kind::Quarter } }).collect();
    for (i, o) in app.cards.iter().enumerate() {
        if i == moving || o.kind == "bubble" || !app.is_on(o.kind) { continue; }
        let (x, y, w, h) = rect_of(o);
        for (v, kind) in [(x, Kind::Card), (x + w / 2, Kind::Card), (x + w, Kind::Card), (x - gap, Kind::Gap), (x + w + gap, Kind::Gap)] { xs.push(Line { x: true, v, kind }); }
        for (v, kind) in [(y, Kind::Card), (y + h / 2, Kind::Card), (y + h, Kind::Card), (y - gap, Kind::Gap), (y + h + gap, Kind::Gap)] { ys.push(Line { x: false, v, kind }); }
    }
    (xs, ys)
}
/// Snap one axis: whichever of `anchors` (offsets from `pos`: an edge or the centre) comes closest to a guide within
/// reach; otherwise onto the grid (counted from `origin`, the screen's corner).
fn snap_axis(pos: f32, anchors: &[f32], lines: &[Line], origin: i32, k: f32) -> (f32, Option<Line>) {
    let mut best: Option<(f32, f32, Line)> = None;
    for a in anchors {
        for l in lines {
            let d = (pos + a - l.v as f32).abs();
            if d <= SNAP * k && best.as_ref().is_none_or(|b| d < b.0) { best = Some((d, l.v as f32 - a, *l)); }
        }
    }
    match best {
        Some((_, p, l)) => (p, Some(l)),
        None => { let g = GRID * k; (origin as f32 + ((pos - origin as f32) / g).round() * g, None) }
    }
}

type SnapFn<'a> = &'a dyn Fn(f32) -> (f32, Option<Line>);

/// The new window rect (x, y, w, h) when an edge or corner is dragged by (dx, dy) physical px, like Illustrator:
/// the moving edges snap (`snap_x`, `snap_y`); Alt resizes from the centre, Shift keeps the proportions, both does
/// both. Also returns the guides that were snapped to.
#[allow(clippy::too_many_arguments)]
fn resize_rect(r0: (f32, f32, f32, f32), edge: &str, dx: f32, dy: f32, shift: bool, alt: bool, k: f32, min: (f32, f32), snap_x: SnapFn, snap_y: SnapFn) -> ((f32, f32, f32, f32), Vec<Line>) {
    let (x0, y0, w0, h0) = r0;
    let (e, w, n, s) = (edge.contains('e'), edge.contains('w'), edge.contains('n'), edge.contains('s'));
    let (mut l, mut t, mut r, mut b) = (x0, y0, x0 + w0, y0 + h0);
    let mut lines = vec![];
    let mut snap = |v: f32, f: SnapFn| { let (p, line) = f(v); if let Some(line) = line { lines.push(line) } p };
    if e { r = snap(r + dx, snap_x); }
    if w { l = snap(l + dx, snap_x); }
    if s { b = snap(b + dy, snap_y); }
    if n { t = snap(t + dy, snap_y); }
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
    ((x.round(), y.round(), ww.round(), hh.round()), lines)
}

/// A line in esther-native-log.txt next to the tasks file (what happened, for tracking down problems).
fn log(msg: &str) {
    use std::io::Write;
    if let Ok(mut f) = std::fs::OpenOptions::new().create(true).append(true).open(data::data_path().with_file_name("esther-native-log.txt")) {
        let _ = writeln!(f, "{} {msg}", now().format(&time::format_description::well_known::Rfc3339).unwrap_or_default());
    }
}

// ---- Showing and hiding: Esther's own fades, and the bubble ----

fn visible(w: &Win) -> bool {
    if cfg!(windows) && w.hwnd.get() > 0 { shell::is_visible(w.hwnd.get()) } else { w.ui.window().is_visible() }
}
fn set_visible(w: &Win, on: bool) {
    if cfg!(windows) && w.hwnd.get() > 0 { shell::show(w.hwnd.get(), on) } else if on { let _ = w.ui.show(); } else { let _ = w.ui.hide(); }
}
fn stop_anims(app: &App, i: usize) {
    app.anims.borrow_mut().retain(|a| match a { Anim::Fade { i: j, .. } | Anim::Glide { i: j, .. } => *j != i });
}
/// Fade a window in (shown, from see-through) or out (then hidden), starting after `delay_ms`.
fn fade(app: &App, i: usize, show: bool, delay_ms: f32) {
    stop_anims(app, i);
    let w = &app.cards[i];
    if !(cfg!(windows) && w.hwnd.get() > 0) {
        set_visible(w, show);
        return;
    }
    let from = if show { 0.0 } else { 1.0 };
    if show {
        shell::set_alpha(w.hwnd.get(), 0);
        shell::show(w.hwnd.get(), true);
        shell::raise(w.hwnd.get());
    }
    app.anims.borrow_mut().push(Anim::Fade { i, from, to: 1.0 - from, start: Instant::now() + StdDuration::from_millis(delay_ms as u64), ms: if show { 170.0 } else { 150.0 }, hide_after: !show });
}
fn glide(app: &App, i: usize, to: Rect, ms: f32) {
    stop_anims(app, i);
    let w = &app.cards[i];
    if !(cfg!(windows) && w.hwnd.get() > 0) {
        set_rect(w, to);
        return;
    }
    app.anims.borrow_mut().push(Anim::Glide { i, from: rect_of(w), to, start: Instant::now(), ms });
}
/// One step of every animation (every 8 ms).
fn anim_tick(app: &App) {
    let now = Instant::now();
    let anims = std::mem::take(&mut *app.anims.borrow_mut());
    let mut keep = vec![];
    for a in anims {
        match &a {
            Anim::Fade { i, from, to, start, ms, hide_after } => {
                if now < *start { keep.push(a); continue; }
                let t = ((now - *start).as_secs_f32() * 1000.0 / ms).min(1.0);
                let e = 1.0 - (1.0 - t).powi(3);
                let h = app.cards[*i].hwnd.get();
                if t >= 1.0 {
                    if *hide_after { shell::show(h, false); }
                    shell::set_alpha(h, 255);
                } else {
                    shell::set_alpha(h, ((from + (to - from) * e) * 255.0).round().clamp(0.0, 254.0) as u8);
                    keep.push(a);
                }
            }
            Anim::Glide { i, from, to, start, ms } => {
                let t = ((now - *start).as_secs_f32() * 1000.0 / ms).min(1.0);
                let e = 1.0 - (1.0 - t).powi(3);
                let lerp = |a: i32, b: i32| (a as f32 + (b - a) as f32 * e).round() as i32;
                set_rect(&app.cards[*i], (lerp(from.0, to.0), lerp(from.1, to.1), lerp(from.2, to.2), lerp(from.3, to.3)));
                if t < 1.0 { keep.push(a); }
            }
        }
    }
    // (Anything started meanwhile stays too.)
    let mut list = app.anims.borrow_mut();
    keep.append(&mut list);
    *list = keep;
}

/// Show every card that's on, in front, one after another; the bubble goes small to its corner.
fn show_all(app: &App) {
    app.collapsed.set(false);
    let bubble = app.index("bubble");
    if app.prefs.borrow().bubble {
        if !visible(&app.cards[bubble]) { set_visible(&app.cards[bubble], true); }
        let to = bubble_rect(false, app.prefs.borrow().bubble_size);
        glide(app, bubble, to, 300.0);
    }
    let mut n = 0.0;
    for kind in CALL_ORDER {
        if !app.is_on(kind) { continue; }
        fade(app, app.index(kind), true, n * 40.0);
        n += 1.0;
    }
    if app.is_on("tasks") { shell::focus(app.card("tasks").hwnd.get()); }
    update_menu(app);
}
/// Tuck the cards away: they fade, and the bubble grows in the middle of the screen.
fn hide_all(app: &App) {
    app.collapsed.set(true);
    for (i, w) in app.cards.iter().enumerate() {
        if w.kind != "bubble" && visible(w) { fade(app, i, false, 0.0); }
    }
    if app.prefs.borrow().bubble {
        let b = app.index("bubble");
        if !visible(&app.cards[b]) { set_visible(&app.cards[b], true); }
        let to = bubble_rect(true, app.prefs.borrow().bubble_size);
        glide(app, b, to, 340.0);
    }
    update_menu(app);
}
/// The shortcut and the tray icon: if the cards are plainly in front, tuck them away; otherwise bring them forward.
fn toggle(app: &App) {
    let fg = shell::foreground();
    let showing = !app.collapsed.get() && app.cards.iter().any(|w| w.kind != "bubble" && visible(w));
    let in_front = showing && fg != 0 && app.cards.iter().any(|w| w.hwnd.get() == fg);
    if in_front { hide_all(app) } else { show_all(app) }
}

fn update_menu(app: &App) {
    let p = app.prefs.borrow();
    shell::set_menu(shell::MenuState {
        visible: !app.collapsed.get(),
        cards: KINDS[..4].iter().zip(CARD_NAMES).map(|(k, n)| (n.to_string(), !p.hidden.iter().any(|h| h == k))).collect(),
        snap: p.snap,
        bubble: p.bubble,
        startup: shell::startup(),
    });
}

fn tray_tip(app: &App) -> String {
    if app.hotkey_ok.get() { "Esther · Ctrl+Alt+E shows and hides".into() } else { "Esther (Ctrl+Alt+E is taken by another app; click here to show and hide)".into() }
}

/// What the tray and the shortcut asked for.
fn on_shell(app: &App, ev: shell::Ev) {
    use shell::*;
    match ev {
        Ev::Toggle => toggle(app),
        Ev::TrayClick => if app.collapsed.get() { show_all(app) } else { hide_all(app) },
        Ev::Command(CMD_SHOW_HIDE) => if app.collapsed.get() { show_all(app) } else { hide_all(app) },
        Ev::Command(c) if (CMD_CARD..CMD_CARD + 4).contains(&c) => {
            let kind = KINDS[(c - CMD_CARD) as usize];
            let on = !app.is_on(kind);
            {
                let mut p = app.prefs.borrow_mut();
                p.hidden.retain(|h| h != kind);
                if !on { p.hidden.push(kind.to_string()); }
            }
            let i = app.index(kind);
            if !on { fade(app, i, false, 0.0) } else if !app.collapsed.get() { fade(app, i, true, 0.0) }
            save_places(app);
            update_menu(app);
        }
        Ev::Command(CMD_PUT_BACK) => { reset_layout(app); show_all(app) }
        Ev::Command(CMD_SNAP) => { let s = !app.prefs.borrow().snap; app.prefs.borrow_mut().snap = s; save_places(app); update_menu(app) }
        Ev::Command(CMD_BUBBLE) => {
            let on = !app.prefs.borrow().bubble;
            app.prefs.borrow_mut().bubble = on;
            let b = app.index("bubble");
            if on {
                let r = bubble_rect(app.collapsed.get(), app.prefs.borrow().bubble_size);
                crate::set_rect(&app.cards[b], r);
                fade(app, b, true, 0.0)
            } else {
                fade(app, b, false, 0.0)
            }
            save_places(app);
            update_menu(app);
        }
        Ev::Command(CMD_STARTUP) => { shell::set_startup(!shell::startup()); update_menu(app) }
        Ev::Command(CMD_QUIT) => { let _ = slint::quit_event_loop(); }
        Ev::Command(_) => {}
    }
}

fn reset_layout(app: &App) {
    for w in app.cards.iter().filter(|w| w.kind != "bubble") { set_rect(w, default_place(w.kind)); }
    save_places(app);
}

// ---- What the cards do ----
fn wire(app: &Rc<App>, i: usize) {
    let w = &app.cards[i];
    let g = w.ui.global::<Esther>();
    // (Each callback holds the app weakly: the windows belong to the app, not the other way round.)
    let wk = Rc::downgrade(app);
    macro_rules! on {
        ($set:ident, |$a:ident $(, $arg:ident)*| $body:expr) => {{
            let wk = wk.clone();
            g.$set(move |$($arg),*| { if let Some($a) = wk.upgrade() { let $a: &App = &$a; $body } });
        }};
    }

    on!(on_pick_tab, |a, id| change(a, |st| st.tab = id.to_string()));
    on!(on_pick_show, |a, s| change(a, |st| st.show = s));
    on!(on_next_add_list, |a| change(a, |st| st.add_list = (st.add_list + 1) % st.store.data.lists.len().max(1)));
    on!(on_add_task, |a, text| {
        let text = text.trim().to_string();
        if !text.is_empty() {
            change(a, |st| {
                if !st.store.shared { return; } // nothing is added until the tasks are shared with the Esther app
                let lists = &st.store.data.lists;
                let list_id = if st.tab != "all" && lists.iter().any(|l| l.id == st.tab) { st.tab.clone() } else { lists[st.add_list % lists.len()].id.clone() };
                let date = st.day.map(iso);
                st.store.data.tasks.insert(0, Task { id: new_id("t"), list_id, title: text, done: false, date, subtasks: vec![], done_at: None });
            });
        }
    });
    on!(on_toggle, |a, id| change_task(a, &id, |t| { t.done = !t.done; t.done_at = if t.done { stamp_now() } else { None }; }));
    on!(on_rename, |a, id, title| {
        let title = title.trim().to_string();
        if !title.is_empty() { change_task(a, &id, |t| t.title = title); }
    });
    on!(on_set_date, |a, id, when| {
        let t0 = today();
        let date = match when.as_str() {
            "today" => Some(iso(t0)),
            "tomorrow" => Some(iso(t0 + Duration::days(1))),
            "next-week" => Some(iso(t0 + Duration::days(7 - t0.weekday().number_days_from_monday() as i64))),
            "none" | "" => None,
            s => parse_date(s).map(iso),
        };
        change_task(a, &id, |t| t.date = date);
    });
    on!(on_move_to, |a, id, list| change_task(a, &id, |t| t.list_id = list.to_string()));
    on!(on_delete, |a, id| change(a, |st| st.store.data.tasks.retain(|t| t.id != id.as_str())));

    // Subtasks.
    on!(on_sub_add, |a, id, text| {
        let text = text.trim().to_string();
        if !text.is_empty() { change_task(a, &id, |t| t.subtasks.push(Subtask { id: new_id("s"), text, done: false })); }
    });
    on!(on_sub_toggle, |a, id, sub| change_task(a, &id, |t| { if let Some(s) = t.subtasks.iter_mut().find(|s| s.id == sub.as_str()) { s.done = !s.done } }));
    on!(on_sub_rename, |a, id, sub, text| {
        let text = text.trim().to_string();
        if !text.is_empty() { change_task(a, &id, |t| { if let Some(s) = t.subtasks.iter_mut().find(|s| s.id == sub.as_str()) { s.text = text } }); }
    });
    on!(on_sub_delete, |a, id, sub| change_task(a, &id, |t| t.subtasks.retain(|s| s.id != sub.as_str())));

    // Lists: a new one (named straight away), rename, colour, delete (its tasks moved to another list, or with it).
    on!(on_add_list, |a| {
        let mut new = String::new();
        change(a, |st| {
            if !st.store.shared { return; }
            let lists = &st.store.data.lists;
            let col = PIGMENTS.iter().find(|p| !lists.iter().any(|l| l.color.eq_ignore_ascii_case(p))).unwrap_or(&PIGMENTS[lists.len() % PIGMENTS.len()]);
            new = new_id("l");
            st.store.data.lists.push(List { id: new.clone(), name: "New list".into(), color: col.to_string() });
            st.tab = new.clone();
        });
        if !new.is_empty() { a.card("tasks").ui.global::<Esther>().set_renaming_list(new.into()); }
    });
    on!(on_rename_list, |a, id, name| {
        let name = name.trim().to_string();
        if !name.is_empty() { change(a, |st| { if let Some(l) = st.store.data.lists.iter_mut().find(|l| l.id == id.as_str()) { l.name = name } }); }
    });
    on!(on_recolor_list, |a, id, c| change(a, |st| { if let Some(l) = st.store.data.lists.iter_mut().find(|l| l.id == id.as_str()) { l.color = hex(c) } }));
    on!(on_delete_list, |a, id, keep| change(a, |st| {
        let d = &mut st.store.data;
        if d.lists.len() < 2 { return; }
        let Some(other) = d.lists.iter().find(|l| l.id != id.as_str()).map(|l| l.id.clone()) else { return };
        if keep { for t in d.tasks.iter_mut().filter(|t| t.list_id == id.as_str()) { t.list_id = other.clone(); } } else { d.tasks.retain(|t| t.list_id != id.as_str()); }
        d.lists.retain(|l| l.id != id.as_str());
        if st.tab == id.as_str() { st.tab = "all".into(); }
        st.add_list %= st.store.data.lists.len();
    }));

    // The date picker.
    on!(on_picker_open, |a, current| change(a, |st| {
        st.picker_day = parse_date(&current);
        st.picker_month = first_of_month(st.picker_day.unwrap_or_else(today));
    }));
    on!(on_picker_step, |a, n| change(a, |st| st.picker_month = add_months(st.picker_month, n)));

    // The calendar: a day shows only that day on the Tasks card (again: every day); move between months.
    on!(on_pick_day, |a, s| {
        let d = parse_date(&s);
        change(a, |st| st.day = if st.day == d { None } else { d });
    });
    on!(on_clear_day, |a| change(a, |st| st.day = None));
    on!(on_month_step, |a, n| change(a, |st| st.month = if n == 0 { first_of_month(today()) } else { add_months(st.month, n) }));
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
            slint::Timer::single_shot(StdDuration::from_millis(2600), move || {
                if let Some(a) = wk.upgrade() {
                    if a.state.borrow().highlight == id { change(&a, |st| st.highlight.clear()); }
                }
            });
        });
    }
    on!(on_reset_layout, |a| { reset_layout(a); show_all(a) });
    on!(on_hide_all, |a| hide_all(a));
    g.on_quit(|| { let _ = slint::quit_event_loop(); });
    on!(on_bubble_click, |a| if a.collapsed.get() { show_all(a) } else { hide_all(a) });
    on!(on_bubble_wheel, |a, dy| {
        if !a.collapsed.get() { return; }
        let k = (a.prefs.borrow().bubble_size + dy / 1200.0).clamp(0.3, 1.5);
        a.prefs.borrow_mut().bubble_size = (k * 100.0).round() / 100.0;
        let b = a.index("bubble");
        stop_anims(a, b);
        set_rect(&a.cards[b], bubble_rect(true, k));
        save_places(a);
    });
    // Closing any card (Alt+F4) hides Esther (the tray and the shortcut bring it back; Quit is in the tray menu).
    {
        let wk = wk.clone();
        w.ui.window().on_close_requested(move || {
            if let Some(a) = wk.upgrade() { hide_all(&a); }
            slint::CloseRequestResponse::KeepWindowShown
        });
    }

    // Moving and resizing. On Windows Esther follows the real mouse from the press until the button is let go (as
    // the Electron app does), so it's exact even when the mouse runs ahead of the window, and shows the guides;
    // elsewhere it uses the movement Slint reports. Resizing: Alt from the centre, Shift in proportion.
    on!(on_drag_start, |a| start_track(a, i, None));
    on!(on_resize_start, |a, e| start_track(a, i, Some(e.to_string())));
    on!(on_drag_by, |a, dx, dy| {
        if cfg!(windows) { return; } // followed from the real mouse instead
        let w = &a.cards[i];
        let k = w.ui.window().scale_factor();
        let (x, y, cw, ch) = rect_of(w);
        let g = GRID * k;
        let snap = |v: f32| ((v / g).round() * g) as i32;
        set_rect(w, (snap(x as f32 + dx * k), snap(y as f32 + dy * k), cw, ch));
    });
    on!(on_resize_by, |a, edge, dx, dy| {
        if cfg!(windows) { return; }
        let w = &a.cards[i];
        let k = w.ui.window().scale_factor();
        let (x, y, cw, ch) = rect_of(w);
        let g = GRID * k;
        let grid = move |v: f32| ((v / g).round() * g, None);
        let (r, _) = resize_rect((x as f32, y as f32, cw as f32, ch as f32), edge.as_str(), dx * k, dy * k, false, false, k, min_size(w.kind), &grid, &grid);
        set_rect(w, (r.0 as i32, r.1 as i32, r.2 as i32, r.3 as i32));
    });
    on!(on_drag_end, |a| save_places(a));
    on!(on_resize_end, |a| save_places(a));
}

fn start_track(app: &App, i: usize, edge: Option<String>) {
    if !cfg!(windows) { return; }
    let (x, y, w, h) = rect_of(&app.cards[i]);
    *app.tracking.borrow_mut() = Some((i, Track { edge, c0: win::cursor(), r0: (x as f32, y as f32, w as f32, h as f32), started: false, shown: None }));
}

/// Follow the mouse while a card is moved or resized (Windows), every 8 ms: snap, place, show the guides.
fn track_tick(app: &App) {
    let mut tr = app.tracking.borrow_mut();
    let Some((i, t)) = tr.as_mut() else { return };
    let i = *i;
    let w = &app.cards[i];
    if !win::button_down() {
        let was = t.started;
        *tr = None;
        drop(tr);
        if was { guides::hide(); save_places(app); }
        return;
    }
    let (cx, cy) = win::cursor();
    let (dx, dy) = ((cx - t.c0.0) as f32, (cy - t.c0.1) as f32);
    if !t.started && dx.abs() + dy.abs() < 4.0 { return; } // a click (or a double-click), not a drag
    let snap_on = app.prefs.borrow().snap;
    let k = w.ui.window().scale_factor();
    let area = win::work_area();
    if !t.started {
        t.started = true;
        if snap_on { guides::show(area); }
    }
    let (xs, ys) = if snap_on { guide_lines(app, i, area, k) } else { (vec![], vec![]) };
    let (r, lines) = match &t.edge {
        None => {
            let (w0, h0) = (t.r0.2, t.r0.3);
            if snap_on {
                let (x, lx) = snap_axis(t.r0.0 + dx, &[0.0, w0 / 2.0, w0], &xs, area.0, k);
                let (y, ly) = snap_axis(t.r0.1 + dy, &[0.0, h0 / 2.0, h0], &ys, area.1, k);
                ((x.round(), y.round(), w0, h0), lx.into_iter().chain(ly).collect())
            } else {
                ((t.r0.0 + dx, t.r0.1 + dy, w0, h0), vec![])
            }
        }
        Some(e) => {
            let (shift, alt) = win::mods();
            let free = |v: f32| (v, None);
            let sx = |v: f32| snap_axis(v, &[0.0], &xs, area.0, k);
            let sy = |v: f32| snap_axis(v, &[0.0], &ys, area.1, k);
            if snap_on { resize_rect(t.r0, e, dx, dy, shift, alt, k, min_size(w.kind), &sx, &sy) } else { resize_rect(t.r0, e, dx, dy, shift, alt, k, min_size(w.kind), &free, &free) }
        }
    };
    let r = (r.0 as i32, r.1 as i32, r.2 as i32, r.3 as i32);
    set_rect(w, r);
    if snap_on && t.shown.as_ref() != Some(&(r, lines.clone())) {
        let others: Vec<Rect> = app.cards.iter().enumerate().filter(|(j, o)| *j != i && o.kind != "bubble" && app.is_on(o.kind)).map(|(_, o)| rect_of(o)).collect();
        guides::draw(r, &others, &lines, (GRID * k).round() as i32, k);
        *app.lit.borrow_mut() = lines.clone();
        t.shown = Some((r, lines));
    }
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
    /// The middle of a task's line in This week.
    pub fn week_line(blocks: &[(usize, bool)], block: usize, line: usize) -> f32 {
        let mut y = 16.0 + 30.0 + 8.0;
        for (n, roomy) in &blocks[..block] {
            y += if *roomy { 5.0 + 18.0 + *n as f32 * 28.0 + 6.0 } else { 3.0 + 18.0 + 3.0 } + 2.0;
        }
        y + 5.0 + 18.0 + 2.0 + line as f32 * 28.0 + 13.0
    }
    /// The Tasks card: where the "Add a task" field is, and the middle of the first task's line.
    pub fn add_field(compact: bool) -> f32 {
        if compact { 116.0 } else { 150.0 }
    }
    pub fn first_row(compact: bool) -> f32 {
        14.0 + 32.0 + 10.0 + 30.0 + 10.0 + if compact { 0.0 } else { 24.0 + 10.0 } + 40.0 + 10.0 + 21.0
    }
}

type Step = (u64, Box<dyn Fn(&Smoke)>);

/// The test machine's run: one step after another, each followed by a pause (ms).
struct Smoke {
    app: Rc<App>,
    dir: std::path::PathBuf,
    real: Cell<bool>,
    notes: RefCell<serde_json::Map<String, serde_json::Value>>,
    seen: RefCell<Vec<String>>,
    marks: RefCell<std::collections::HashMap<&'static str, Rect>>,
    /// What the helper threads found (they work Windows' own menus, which hold up Esther while they're open).
    bg: std::sync::Arc<std::sync::Mutex<serde_json::Map<String, serde_json::Value>>>,
}

impl Smoke {
    /// After `ms`, on a thread of its own: `f` (with a place for its findings and the pictures' folder). For Windows'
    /// own menus: while one is open, Esther (and this test's timer) waits for it to close.
    fn later(&self, ms: u64, f: impl FnOnce(&mut serde_json::Map<String, serde_json::Value>, &std::path::Path) + Send + 'static) {
        let (bg, dir) = (self.bg.clone(), self.dir.clone());
        std::thread::spawn(move || {
            std::thread::sleep(StdDuration::from_millis(ms));
            let mut m = serde_json::Map::new();
            f(&mut m, &dir);
            bg.lock().unwrap().extend(m);
        });
    }
    fn w(&self, kind: &str) -> &Win { self.app.card(kind) }
    fn k(&self) -> f32 { self.w("tasks").ui.window().scale_factor() }
    fn g(&self, kind: &str) -> Esther<'_> { self.w(kind).ui.global::<Esther>() }
    /// A point on a card (unscaled px from its top left) on the screen.
    fn at(&self, kind: &str, x: f32, y: f32) -> (i32, i32) {
        let (rx, ry, _, _) = rect_of(self.w(kind));
        let k = self.k();
        (rx + (x * k) as i32, ry + (y * k) as i32)
    }
    /// A card's size in unscaled px.
    fn size(&self, kind: &str) -> (f32, f32) {
        let (_, _, w, h) = rect_of(self.w(kind));
        (w as f32 / self.k(), h as f32 / self.k())
    }
    fn note(&self, key: &str, v: impl Into<serde_json::Value>) {
        self.notes.borrow_mut().insert(key.into(), v.into());
    }
    fn point(&self, label: &str, kind: &str, p: (i32, i32)) {
        win_input::to(p.0, p.1);
        self.seen.borrow_mut().push(format!("{label}: {}", win_input::under(p.0, p.1, self.w(kind).hwnd.get())));
    }
    fn click(&self, label: &str, kind: &str, p: (i32, i32)) {
        self.point(label, kind, p);
        win_input::down();
        win_input::up();
    }
    fn file(&self) -> serde_json::Value {
        let text = std::fs::read_to_string(&self.app.state.borrow().store.path).unwrap_or_default();
        serde_json::from_str(&text).unwrap_or_default()
    }
    fn first_task(&self) -> serde_json::Value {
        self.file()["tasks"][0].clone()
    }
    fn shot(&self, name: &str) {
        if let Some(img) = shell::capture() { let _ = img.save(self.dir.join(name)); }
    }
    fn first_row_id(&self) -> SharedString {
        self.g("tasks").get_rows().row_data(0).map(|r| r.id).unwrap_or_default()
    }
    fn all_cards(&self, shown: bool) -> bool {
        self.app.cards.iter().filter(|w| w.kind != "bubble").all(|w| visible(w) == shown)
    }
}

/// A picture of the whole screen (from any thread).
fn shot_to(dir: &std::path::Path, name: &str) {
    if let Some(img) = shell::capture() { let _ = img.save(dir.join(name)); }
}
/// Wait (up to 3 s) for one of Windows' own menus to show; true if it did.
fn wait_menu() -> bool {
    for _ in 0..60 {
        if shell::menu_open() { std::thread::sleep(StdDuration::from_millis(150)); return true; }
        std::thread::sleep(StdDuration::from_millis(50));
    }
    false
}
/// Click item `index` of the menu that's showing (from a helper thread). True if it was there to click.
fn click_menu_item(index: u32) -> bool {
    let Some((l, t, r, b)) = shell::menu_item_rect(index) else { return false };
    win_input::to((l + r) / 2, (t + b) / 2);
    std::thread::sleep(StdDuration::from_millis(150));
    win_input::down();
    win_input::up();
    true
}
fn kind_mark(kind: &str) -> &'static str {
    match kind { "tasks" => "tasks-before", "header" => "header-before", _ => "card-before" }
}

/// A drag with the real mouse, from a point (worked out when it starts) by (dx, dy) in `n` moves; `mid` runs just
/// after the last move, before letting go (to look at the guides while they show).
fn drag(s: &mut Vec<Step>, label: &'static str, kind: &'static str, from: fn(&Smoke) -> (i32, i32), by: fn(&Smoke) -> (i32, i32), n: i32, mid: fn(&Smoke)) {
    s.push((80, Box::new(move |x: &Smoke| {
        x.marks.borrow_mut().insert(kind_mark(kind), rect_of(x.w(kind)));
        if !x.real.get() { return; }
        let p = from(x);
        let (dx, dy) = by(x);
        x.marks.borrow_mut().insert(label, (p.0, p.1, dx, dy));
        x.point(label, kind, p);
        win_input::down();
    })));
    for j in 1..=n {
        s.push((40, Box::new(move |x: &Smoke| {
            if !x.real.get() { return; }
            let (px, py, dx, dy) = x.marks.borrow()[label];
            win_input::to(px + dx * j / n, py + dy * j / n);
        })));
    }
    // (Still holding the button, where it ended: look at the guides.)
    s.push((150, Box::new(move |x: &Smoke| { if x.real.get() { mid(x) } })));
    s.push((300, Box::new(|x: &Smoke| { if x.real.get() { win_input::up() } })));
}

fn smoke_steps() -> Vec<Step> {
    let mut s: Vec<Step> = vec![];
    macro_rules! step {
        ($ms:expr, |$x:ident| $body:expr) => { s.push(($ms, Box::new(move |$x: &Smoke| { $body; }))) };
    }
    let row = |x: &Smoke| spots::first_row(x.g("tasks").get_compact());

    // Settle: the windows exist and have faded in. The test machine's console windows go out of the way.
    step!(1200, |x| { if x.real.get() { win_input::clear_consoles(); } });
    step!(300, |x| { for w in &x.app.cards { shell::raise(w.hwnd.get()); } shell::focus(x.w("tasks").hwnd.get()); });

    // ---- Editing on the Tasks card ----
    // Add a task: click into "Add a task", type, Enter.
    step!(200, |x| {
        x.note("compact_at_start", x.g("tasks").get_compact());
        if x.real.get() { x.click("add field", "tasks", x.at("tasks", 90.0, spots::add_field(x.g("tasks").get_compact()))); }
    });
    step!(150, |x| { if x.real.get() { win_input::type_text("Typed on Windows") } });
    step!(400, |x| { if x.real.get() { win_input::enter() } else { x.g("tasks").invoke_add_task("Typed on Windows".into()) } });
    step!(50, |x| x.note("typed_task_saved", x.first_task()["title"] == "Typed on Windows"));
    // Rename it: click its name, type over it, Enter.
    step!(350, |x| { if x.real.get() { x.click("task name", "tasks", x.at("tasks", 104.0, row(x))) } });
    step!(150, |x| { if x.real.get() { win_input::type_text("Renamed on Windows") } });
    step!(400, |x| { if x.real.get() { win_input::enter() } else { x.g("tasks").invoke_rename(x.first_row_id(), "Renamed on Windows".into()) } });
    step!(50, |x| x.note("renamed_by_click", x.first_task()["title"] == "Renamed on Windows"));
    // Its list: click the list pill, pick another list from the menu with the keyboard.
    step!(1800, |x| {
        let (w, _) = x.size("tasks");
        if x.real.get() {
            x.later(100, move |m, dir| { m.insert("list_menu_open".into(), wait_menu().into()); shot_to(dir, "list-menu.png"); m.insert("list_menu_item_clicked".into(), click_menu_item(1).into()); });
            x.click("list pill", "tasks", x.at("tasks", w - 338.0 + 30.0, row(x)));
        } else { x.g("tasks").invoke_move_to(x.first_row_id(), "seround".into()) }
    });
    step!(50, |x| x.note("list_after_pill_menu", x.first_task()["listId"].clone()));
    // Subtasks: click the subtasks column (opens them, the field takes the keyboard), type, Enter; close them again.
    step!(400, |x| { let (w, _) = x.size("tasks"); if x.real.get() { x.click("subtasks", "tasks", x.at("tasks", w - 198.0 + 12.0, row(x))) } });
    step!(150, |x| { if x.real.get() { win_input::type_text("Sub on Windows") } });
    step!(450, |x| { if x.real.get() { win_input::enter() } else { x.g("tasks").invoke_sub_add(x.first_row_id(), "Sub on Windows".into()) } });
    step!(50, |x| { x.note("subtask_added", x.first_task()["subtasks"][0]["text"] == "Sub on Windows"); x.shot("subtasks.png"); });
    step!(600, |x| {
        x.note("open_before_closing", x.g("tasks").get_open_task().to_string());
        let (w, _) = x.size("tasks");
        if x.real.get() { x.click("subtasks again", "tasks", x.at("tasks", w - 198.0 + 12.0, row(x))) } else { x.g("tasks").set_open_task("".into()) }
    });
    step!(50, |x| x.note("subtasks_closed_by_click", x.g("tasks").get_open_task().is_empty()));
    // Its date: click the date column, Down, Enter (Today).
    step!(1800, |x| {
        let (w, _) = x.size("tasks");
        if x.real.get() {
            x.later(100, move |m, dir| { m.insert("date_menu_open".into(), wait_menu().into()); shot_to(dir, "date-menu.png"); m.insert("date_menu_item_clicked".into(), click_menu_item(0).into()); });
            x.click("date", "tasks", x.at("tasks", w - 22.0 - 96.0 + 24.0, row(x)));
        } else { x.g("tasks").invoke_set_date(x.first_row_id(), "today".into()) }
    });
    step!(50, |x| x.note("date_from_menu", x.first_task()["date"].clone()));
    // The date picker: the menu's "Pick a date…", then its Tomorrow.
    step!(1800, |x| {
        let (w, _) = x.size("tasks");
        if x.real.get() {
            x.later(100, move |m, _| { m.insert("date_menu_open_again".into(), wait_menu().into()); m.insert("pick_item_clicked".into(), click_menu_item(3).into()); });
            x.click("date again", "tasks", x.at("tasks", w - 22.0 - 96.0 + 24.0, row(x)));
        }
    });
    step!(100, |x| {
        x.shot("date-picker.png");
        let (w, _) = x.size("tasks");
        let top = row(x) - 21.0 + 37.0;
        if x.real.get() { x.click("picker: Tomorrow", "tasks", x.at("tasks", w - 22.0 - 96.0 - 170.0 + 107.0, top + 274.0)) } else { x.g("tasks").invoke_set_date(x.first_row_id(), "tomorrow".into()) }
    });
    step!(450, |x| x.note("date_from_picker", x.first_task()["date"].clone()));
    // A list tab: double-click to rename, type, Enter.
    step!(300, |x| { if x.real.get() { let p = x.at("tasks", 14.0 + 58.0 + 6.0 + 22.0, 14.0 + 16.0); x.click("list tab", "tasks", p); win_input::down(); win_input::up(); } });
    step!(150, |x| { if x.real.get() { win_input::type_text("Everyday") } });
    step!(450, |x| { if x.real.get() { win_input::enter() } else { x.g("tasks").invoke_rename_list("general".into(), "Everyday".into()) } });
    step!(50, |x| x.note("list_renamed", x.file()["lists"][0]["name"].clone()));
    // A new list: the + at the right of the tabs, type its name, Enter.
    step!(350, |x| { let (w, _) = x.size("tasks"); if x.real.get() { x.click("new list", "tasks", x.at("tasks", w - 14.0 - 15.0, 14.0 + 16.0)) } else { x.g("tasks").invoke_add_list() } });
    step!(150, |x| { if x.real.get() { win_input::type_text("Errands") } });
    step!(450, |x| { if x.real.get() { win_input::enter() } else { let id = x.g("tasks").get_renaming_list(); x.g("tasks").invoke_rename_list(id, "Errands".into()) } });
    step!(50, |x| { x.note("list_added", x.file()["lists"].as_array().and_then(|l| l.last()).map(|l| l["name"].clone()).unwrap_or_default()); x.shot("tasks-edited.png"); });
    // Back to All.
    step!(200, |x| x.g("tasks").invoke_pick_tab("all".into()));

    // ---- The calendar: pick the 23rd (one task that day), then pick it again (every day). ----
    fn day23(x: &Smoke) -> (i32, i32) {
        let first = x.app.state.borrow().month;
        let lead = first.weekday().number_days_from_monday() as usize;
        let cells = x.g("calendar").get_days().row_count();
        let (w, h) = x.size("calendar");
        let (cx, cy) = spots::calendar_day(lead + 22, cells, w, h);
        x.at("calendar", cx, cy)
    }
    let the_23rd = || iso(first_of_month(today()) + Duration::days(22));
    step!(250, |x| { x.note("rows_before_day", x.g("tasks").get_rows().row_count()); shell::focus(x.w("calendar").hwnd.get()); });
    step!(400, |x| { if x.real.get() { x.click("calendar 23rd", "calendar", day23(x)) } else { x.g("calendar").invoke_pick_day(the_23rd().into()) } });
    step!(50, |x| { x.note("rows_on_the_23rd", x.g("tasks").get_rows().row_count()); x.note("day_label", x.g("tasks").get_day_label().to_string()); });
    step!(400, |x| { if x.real.get() { x.click("calendar 23rd again", "calendar", day23(x)) } else { x.g("calendar").invoke_pick_day(the_23rd().into()) } });
    step!(50, |x| x.note("rows_after_day", x.g("tasks").get_rows().row_count()));

    // ---- This week: click the name of Monday's task (Tasks points it out), then tick it there. ----
    fn week_spot(x: &Smoke) -> (f32, usize) {
        let week = x.g("week").get_week();
        let blocks: Vec<(usize, bool)> = week.iter().map(|d| (d.tasks.row_count(), d.tasks.row_count() > 0 || d.today)).collect();
        let mon = if week.row_data(0).is_some_and(|d| d.late) { 1 } else { 0 };
        (spots::week_line(&blocks, mon, 0), mon)
    }
    fn monday_task(x: &Smoke) -> Option<TaskRow> {
        let (_, mon) = week_spot(x);
        x.g("week").get_week().row_data(mon).and_then(|d| d.tasks.row_data(0))
    }
    step!(250, |x| shell::focus(x.w("week").hwnd.get()));
    step!(400, |x| {
        let (y, _) = week_spot(x);
        let t = monday_task(x);
        x.note("week_task", t.as_ref().map(|t| t.title.to_string()).unwrap_or_default());
        x.note("week_task_id", t.as_ref().map(|t| t.id.to_string()).unwrap_or_default());
        if x.real.get() { x.click("week task name", "week", x.at("week", 110.0, y)) } else if let Some(t) = t { x.g("week").invoke_reveal(t.id) }
    });
    step!(700, |x| x.note("pointed_out", x.g("tasks").get_highlight().to_string()));
    step!(400, |x| {
        let (y, _) = week_spot(x);
        if x.real.get() { x.click("week tick", "week", x.at("week", 16.0 + 6.0 + 4.0 + 7.5, y)) } else if let Some(t) = monday_task(x) { x.g("week").invoke_toggle(t.id) }
    });
    step!(50, |x| {
        let id = x.notes.borrow().get("week_task_id").and_then(|v| v.as_str().map(String::from)).unwrap_or_default();
        x.note("ticked_in_week_done_in_tasks", x.g("tasks").get_rows().iter().find(|r| r.id.as_str() == id).is_some_and(|r| r.done));
        x.note("ticked_task_saved", x.file()["tasks"].as_array().is_some_and(|ts| ts.iter().any(|t| t["id"] == id.as_str() && t["done"] == true)));
    });

    // ---- Moving and resizing, with the grid and the guides ----
    step!(200, |x| { shell::raise(x.w("tasks").hwnd.get()); shell::focus(x.w("tasks").hwnd.get()); });
    // The right edge, 72 px inwards (the test machine's screen is small; the mouse can't go past its edge).
    drag(&mut s, "edge", "tasks", |x| { let (l, t, w, h) = rect_of(x.w("tasks")); (l + w - 3, t + h / 2) }, |_| (-72, 0), 6, |x| {
        x.note("guides_while_resizing", guides::visible());
        x.shot("resize-guides.png");
    });
    step!(100, |x| {
        let before = x.marks.borrow().get("tasks-before").copied().unwrap_or_default();
        x.note("resized_px", rect_of(x.w("tasks")).2 - before.2);
        x.note("guides_hidden_after", !guides::visible());
    });
    // Drag it by the space beside All / To do / Done.
    drag(&mut s, "drag", "tasks", |x| { let (l, t, w, _) = rect_of(x.w("tasks")); (l + w - (40.0 * x.k()) as i32, t + (71.0 * x.k()) as i32) }, |_| (50, 30), 5, |x| {
        x.note("guides_while_moving", guides::visible());
        x.shot("drag-guides.png");
    });
    step!(100, |x| { let before = x.marks.borrow()["tasks-before"]; x.note("moved_px", rect_of(x.w("tasks")).0 - before.0); });
    // Snap to the screen's centre: bring the card's middle 3 px short of it; it should land exactly on it.
    drag(&mut s, "centre", "tasks", |x| { let (l, t, w, _) = rect_of(x.w("tasks")); (l + w - (40.0 * x.k()) as i32, t + (71.0 * x.k()) as i32) }, |x| {
        let (l, _, w, _) = rect_of(x.w("tasks"));
        let (ax, _, aw, _) = win::work_area();
        (ax + aw / 2 - 3 - (l + w / 2), 0)
    }, 6, |x| {
        x.note("lit_while_centring", x.app.lit.borrow().iter().map(|l| l.kind.label()).collect::<Vec<_>>());
        x.shot("centre-guide.png");
    });
    step!(100, |x| {
        let (l, _, w, _) = rect_of(x.w("tasks"));
        let (ax, _, aw, _) = win::work_area();
        x.note("centre_off_by_px", (l + w / 2) - (ax + aw / 2));
    });
    // The header, by the empty space at its right.
    drag(&mut s, "header drag", "header", |x| { let (l, t, w, _) = rect_of(x.w("header")); (l + w - (60.0 * x.k()) as i32, t + (20.0 * x.k()) as i32) }, |_| (40, 40), 5, |_| {});
    step!(100, |x| { let before = x.marks.borrow()["header-before"]; x.note("header_moved_px", rect_of(x.w("header")).1 - before.1); });

    // ---- Hiding and showing: Ctrl+Alt+E, the bubble, the tray ----
    step!(300, |x| shell::focus(x.w("tasks").hwnd.get()));
    step!(800, |x| { if x.real.get() { win_input::keys(&[0x11, 0x12, 0x45]) } else { on_shell(&x.app, shell::Ev::Toggle) } }); // Ctrl+Alt+E
    step!(100, |x| {
        x.note("shortcut_registered", x.app.hotkey_ok.get());
        x.note("shortcut_hid_cards", x.all_cards(false));
        let (bx, by, bw, bh) = rect_of(x.w("bubble"));
        let (ax, ay, aw, ah) = win::work_area();
        x.note("bubble_in_the_middle", ((bx + bw / 2) - (ax + aw / 2)).abs() <= 2 && ((by + bh / 2) - (ay + ah / 2)).abs() <= 2);
        x.shot("hidden.png");
    });
    step!(900, |x| {
        let (bx, by, bw, bh) = rect_of(x.w("bubble"));
        if x.real.get() { x.click("bubble", "bubble", (bx + bw / 2, by + bh / 2)) } else { x.g("bubble").invoke_bubble_click() }
    });
    step!(100, |x| {
        x.note("bubble_showed_cards", x.all_cards(true));
        let (bx, by, _, bh) = rect_of(x.w("bubble"));
        let (ax, ay, _, ah) = win::work_area();
        x.note("bubble_in_the_corner", bx - ax < 40 && (ay + ah) - (by + bh) < 40);
        x.shot("shown.png");
    });
    // The tray icon. (The test machine's Windows tucks new icons into the overflow, so the clicks are sent to Esther
    // the way Windows sends them, straight to its hidden window.) Right-click: Windows' own menu shows; click
    // elsewhere and it should close. Left-click hides; left-click again shows.
    step!(2500, |x| {
        x.note("tray_icon_rect", serde_json::json!(shell::tray_rect()));
        if !x.real.get() { return; }
        let host = shell::host();
        x.later(50, move |m, dir| {
            shell::post_tray_click(host, true);
            m.insert("tray_menu_opened".into(), wait_menu().into());
            shot_to(dir, "tray-menu.png");
            let (ax, ay, aw, ah) = win::work_area();
            win_input::to(ax + aw - 8, ay + ah - 8);
            win_input::down();
            win_input::up();
            std::thread::sleep(StdDuration::from_millis(600));
            m.insert("tray_menu_closed_by_clicking_elsewhere".into(), (!shell::menu_open()).into());
        });
    });
    step!(900, |x| { if x.real.get() { shell::post_tray_click(shell::host(), false) } });
    step!(50, |x| { if x.real.get() { x.note("tray_click_hid", x.all_cards(false)); } });
    step!(900, |x| { if x.real.get() { shell::post_tray_click(shell::host(), false) } });
    step!(50, |x| {
        if x.real.get() { x.note("tray_click_showed", x.all_cards(true)); }
        if x.app.collapsed.get() { show_all(&x.app) }
    });
    // Start with Windows (from the tray menu's handler): on, then off again.
    step!(200, |x| { on_shell(&x.app, shell::Ev::Command(shell::CMD_STARTUP)); x.note("startup_on", shell::startup()); });
    step!(200, |x| { on_shell(&x.app, shell::Ev::Command(shell::CMD_STARTUP)); x.note("startup_off", !shell::startup()); });

    // ---- How long a card takes to draw (the Tasks card, whole), and the whole screen as it is ----
    step!(500, |x| {
        let t0 = Instant::now();
        for _ in 0..5 { let _ = x.w("tasks").ui.window().take_snapshot(); }
        x.note("tasks_card_draw_ms", (t0.elapsed().as_secs_f64() * 1000.0 / 5.0 * 10.0).round() / 10.0);
        x.shot("desktop.png");
    });
    s
}

fn smoke_report(x: &Smoke) {
    let a = &x.app;
    let mut cards = serde_json::Map::new();
    for w in &a.cards {
        let file = format!("{}.png", if w.kind == "tasks" { "tasks-card" } else { w.kind });
        let shot = w.ui.window().take_snapshot().ok().map(|buf| {
            image::RgbaImage::from_raw(buf.width(), buf.height(), buf.as_bytes().to_vec()).map(|i| i.save(x.dir.join(&file)).is_ok()).unwrap_or(false)
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
            "visible": visible(w),
            "rect": rect_of(w),
            "styled": w.styled.borrow().clone(),
        }));
    }
    let (private, ws) = win::memory_kb();
    let mut report = serde_json::json!({
        "private_mb": (private as f64 / 1024.0 * 10.0).round() / 10.0,
        "working_set_mb": (ws as f64 / 1024.0 * 10.0).round() / 10.0,
        "windows": a.cards.len(),
        "rows": x.g("tasks").get_rows().row_count(),
        "real_input": x.real.get(),
        "header_line": x.g("header").get_line().to_string(),
        "cards": cards,
        "under_the_mouse": x.seen.borrow().clone(),
        "renderer": std::env::var("SLINT_BACKEND").unwrap_or_else(|_| "winit-software".into()),
    });
    for (k, v) in x.notes.borrow().iter() { report[k] = v.clone(); }
    for (k, v) in x.bg.lock().unwrap().iter() { report[k] = v.clone(); }
    println!("{report}");
    let _ = std::fs::write(x.dir.join("memory.json"), report.to_string());
}

/// Run the test machine's steps on a timer, then report and quit.
fn smoke_run(dir: std::path::PathBuf, app: Rc<App>) -> slint::Timer {
    let x = Smoke { app, dir, real: Cell::new(false), notes: Default::default(), seen: Default::default(), marks: Default::default(), bg: Default::default() };
    let steps = smoke_steps();
    let next = Cell::new(0usize);
    let wait_until = Cell::new(Instant::now());
    let start = Instant::now();
    let t = slint::Timer::default();
    t.start(slint::TimerMode::Repeated, StdDuration::from_millis(20), move || {
        let ready = x.app.cards.iter().all(|w| w.hwnd.get() != 0);
        if !ready && start.elapsed().as_secs() < 8 { return; } // wait for the windows
        if next.get() == 0 { x.real.set(cfg!(windows) && x.app.cards.iter().all(|w| w.hwnd.get() > 0)); }
        if Instant::now() < wait_until.get() { return; }
        let i = next.get();
        if i < steps.len() {
            log(&format!("test step {i}"));
            (steps[i].1)(&x);
            wait_until.set(Instant::now() + StdDuration::from_millis(steps[i].0));
            next.set(i + 1);
        } else if i == steps.len() {
            next.set(i + 1);
            smoke_report(&x);
            let _ = slint::quit_event_loop();
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
    pub fn keys(vks: &[u16]) { crate::win::keys(vks) }
    pub fn under(x: i32, y: i32, h: isize) -> String { crate::win::under(x, y, h) }
    pub fn clear_consoles() { crate::win::clear_consoles() }
}
#[cfg(not(windows))]
mod win_input {
    pub fn to(_x: i32, _y: i32) {}
    pub fn down() {}
    pub fn up() {}
    pub fn type_text(_s: &str) {}
    pub fn enter() {}
    pub fn keys(_vks: &[u16]) {}
    pub fn under(_x: i32, _y: i32, _h: isize) -> String { String::new() }
    pub fn clear_consoles() {}
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
    let t0 = today();
    let mut state = State {
        store: Store::open(data::data_path()),
        tab: "all".into(),
        show: 0,
        add_list: 0,
        day: None,
        month: first_of_month(t0),
        highlight: String::new(),
        picker_month: first_of_month(t0),
        picker_day: None,
    };
    if smoke.is_none() { clear_old(&mut state); } // (the test's tasks are fixed; "a week ago" moves on)
    let (places, prefs) = load_saved();
    let app = Rc::new(App {
        cards,
        state: RefCell::new(state),
        prefs: RefCell::new(prefs),
        collapsed: Cell::new(false),
        tracking: RefCell::new(None),
        anims: RefCell::new(vec![]),
        hotkey_ok: Cell::new(false),
        lit: RefCell::new(vec![]),
    });
    for i in 0..app.cards.len() { wire(&app, i); }
    refresh(&app);

    // Following the mouse, and Esther's animations, every 8 ms.
    let ticker = slint::Timer::default();
    {
        let wk = Rc::downgrade(&app);
        ticker.start(slint::TimerMode::Repeated, StdDuration::from_millis(8), move || {
            if let Some(a) = wk.upgrade() { track_tick(&a); anim_tick(&a); }
        });
    }

    // Glass from the wallpaper (one picture, shared by every card; again whenever the wallpaper changes), tasks
    // changed by the Electron app, and a new day or a new part of the day (the greeting, today on the calendar).
    let (sw, sh) = win::screen_size();
    let set_glass = {
        let wk = Rc::downgrade(&app);
        move || {
            let Some(a) = wk.upgrade() else { return };
            let img = glass::glass(sw, sh, 28.0, [0x19, 0x16, 0x13], 0.72);
            for w in &a.cards {
                match &img {
                    Some(img) => { w.ui.set_glass(img.clone()); w.ui.set_has_glass(true); }
                    None => w.ui.set_has_glass(false),
                }
                place_glass(w, rect_of(w));
            }
        }
    };
    set_glass();
    let watch = slint::Timer::default();
    {
        let wk = Rc::downgrade(&app);
        let mut wall = glass::stamp();
        let mut moment = (today(), greeting());
        watch.start(slint::TimerMode::Repeated, StdDuration::from_millis(1000), move || {
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

    // Where they were last time (or the Electron app's starting layout). The cards that are on show; the bubble sits
    // small in its corner.
    for w in &app.cards {
        let r = if w.kind == "bubble" { bubble_rect(false, app.prefs.borrow().bubble_size) } else { places.get(w.kind).copied().filter(|r| on_screen(*r)).unwrap_or_else(|| default_place(w.kind)) };
        set_rect(w, r);
        if (w.kind == "bubble" && app.prefs.borrow().bubble) || app.is_on(w.kind) {
            w.ui.show().expect("show a card");
        }
        place_glass(w, r);
    }

    // The tray icon and the shortcut.
    app.hotkey_ok.set(shell::start(&tray_tip(&app)));
    shell::set_tip(&tray_tip(&app));
    {
        let wk = Rc::downgrade(&app);
        shell::on_event(move |ev| if let Some(a) = wk.upgrade() { on_shell(&a, ev) });
    }
    update_menu(&app);
    log(&format!("started; shortcut {}", if app.hotkey_ok.get() { "Ctrl+Alt+E" } else { "taken" }));

    // The Windows touches (desktop layer, rounded corners, no taskbar button, no animations). The native windows only
    // exist once the event loop runs, so this waits for them (doing it straight after show() did nothing). Then the
    // cards fade in.
    let styler = slint::Timer::default();
    {
        let wk = Rc::downgrade(&app);
        let tries = Cell::new(0);
        styler.start(slint::TimerMode::Repeated, StdDuration::from_millis(50), move || {
            use raw_window_handle::{HasWindowHandle, RawWindowHandle};
            let Some(a) = wk.upgrade() else { return };
            tries.set(tries.get() + 1);
            let mut fresh = false;
            for w in &a.cards {
                if w.hwnd.get() != 0 || !w.ui.window().is_visible() { continue; }
                match w.ui.window().window_handle().window_handle().map(|h| h.as_raw()) {
                    Ok(RawWindowHandle::Win32(h)) => {
                        w.hwnd.set(h.hwnd.get());
                        *w.styled.borrow_mut() = win::style(h.hwnd.get());
                        if w.kind != "bubble" { shell::set_alpha(h.hwnd.get(), 0); } // (they fade in below)
                        log(&format!("{} styled: {}", w.kind, w.styled.borrow()));
                        fresh = true;
                    }
                    Ok(_) if tries.get() > 40 => { w.hwnd.set(-1); *w.styled.borrow_mut() = "not a Windows window".into(); }
                    _ => {}
                }
            }
            if fresh && a.cards.iter().all(|w| w.hwnd.get() != 0 || !w.ui.window().is_visible()) { show_all(&a); }
        });
    }

    // The test machine: use the cards with the real mouse and keyboard (Windows), picture them, measure, quit.
    let _smoke = smoke.map(|dir| smoke_run(dir, app.clone()));

    slint::run_event_loop_until_quit().expect("run");
    save_places(&app);
    shell::stop();
}

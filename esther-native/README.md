# Esther native: Esther's cards, without Electron

Esther's cards as one native Windows program, written in Rust with the [Slint](https://slint.dev) toolkit, to make
Esther light. The Electron app uses about 250–300 MB; this aims for well under 40 MB.

This is stage 1 of the move: the four cards, each its own window, all showing the one set of tasks. Still to come:
stage 2, the tray, the shortcut, starting with Windows and the bubble; stage 3, Settings; stage 4, the installer and
updater in place of Electron's.

## The cards
- **Header**: Esther's arch emblem and name, the greeting by the time of day, the date and the day's line (the same line
  the Esther app shows that day). Double-click the emblem and name to put every card back where it started; right-click
  the header for that, or for **Quit Esther**.
- **Tasks**: list tabs (All and your lists, with open counts), All / To do / Done, and the task table: tick, name, list,
  subtasks, date. Add a task with Enter (on All, click the list pill to pick its list). Double-click a task to rename it;
  right-click it for Today / Tomorrow / Next week / No date, Move to a list, or Delete. Finished tasks stay crossed out,
  "clears in N days", and clear themselves after a week. Narrower than 560 px it goes compact.
- **Calendar**: the month, Monday first, with open tasks as dots in their lists' colours; today outlined. Click a day
  and the Tasks card shows only that day (a task added then gets that date); click it again, or the × on the Tasks card,
  for every day. ‹ Today › move between months.
- **This week**: Monday to Sunday, and anything still open from before. Tick tasks there; click a task's name to point
  it out on the Tasks card. Right-click a task for the same menu as on the Tasks card.

Every card: drag it by its empty space, resize it from any edge or corner (Alt from the centre, Shift in proportion),
all on the 8 px grid; where each card is is remembered (`esther-native.json` next to the tasks). Esther's glass sits
behind every card: your wallpaper, blurred once and shared by all four, picked up again when the wallpaper changes. On
Windows each card sits on the desktop like the Electron cards (owned by the desktop window), is a tool window (no
taskbar button), has Windows' rounded corners, and no Windows window animations.

Closing a card with Alt+F4 quits Esther native (until the tray comes in stage 2, that and the header's menu are the ways
out).

## Shares your tasks with Esther
Both read and write `%APPDATA%\Esther\tasks.json`. Esther 2.2 or later writes it; this program never creates it, so a
first start here can't overwrite your tasks. Until the file exists, the Tasks card waits (and says so). Changes made in
one show up in the other within a second or so. Running both shows two sets of cards, so close the Electron one (or
turn its cards off in Settings → Cards) while you try this.

## Build and try
- `cargo run` (Linux needs libxkbcommon-x11). `cargo build --release` for the small, fast build: `esther-native.exe`.
- `esther-native --smoke DIR` opens the cards on `DIR/tasks.json` and tries them: resizes and drags the Tasks card,
  types a task, picks a day on the calendar and picks it again, points out and ticks a task from This week, drags the
  header. On Windows all of that is done with the real mouse and keyboard. It then saves a picture of each card
  (`header.png`, `tasks-card.png`, `calendar.png`, `week.png`) and the figures (`memory.json`), and quits. The Windows
  workflow (`.github/workflows/esther-native.yml`) runs this on every push and puts the program, the pictures and the
  figures on the "Esther native" pre-release.
- `SLINT_BACKEND=winit-femtovg` draws with the graphics card (OpenGL) instead of the processor, for comparison.

## Not here yet
The tray, the show/hide shortcut, starting with Windows, the bubble, the guides while moving, Settings (colours,
looks, glass strength), the date picker, opening subtasks, and the drag-to-reorder of lists. Fonts: Instrument Serif
(SIL Open Font License, `ui/fonts/OFL.txt`).

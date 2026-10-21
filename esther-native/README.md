# Esther native: Esther's cards, without Electron

Esther's cards as one native Windows program, written in Rust with the [Slint](https://slint.dev) toolkit, to make
Esther light. The Electron app uses about 250–300 MB; this aims for well under 40 MB.

Stages 1 and 2 of the move are here: the four cards, each its own window, all showing the one set of tasks; the tray,
the shortcut, starting with Windows, the bubble, and the grid and guides while you move and resize. Still to come:
stage 3, Settings; stage 4, the installer and updater in place of Electron's.

## The cards
- **Header**: Esther's arch emblem and name, the greeting by the time of day, the date and the day's line (the same line
  the Esther app shows that day), and × to hide Esther. Double-click the emblem and name to put every card back where
  it started; right-click the header for that, Hide or Quit.
- **Tasks**: list tabs (All and your lists, with open counts), All / To do / Done, and the task table: tick, name, list,
  subtasks, date. Add a task with Enter (on All, click the list pill beside it to pick its list).
  - Click a task's name to edit it (Enter or clicking away saves, Esc cancels).
  - Click its list to move it to another list; click its subtasks (or "+ sub") to open them: tick, click to edit,
    right-click to delete, and "Add a subtask"; click its date for Today / Tomorrow / Next week / No date or the date
    picker. Right-click a task for all of that and Delete.
  - Lists: + (at the right of the tabs) for a new one; double-click a tab to rename it; right-click a tab for Rename,
    its colour, or Delete list (its tasks moved to another list, or deleted with it).
  - Finished tasks stay crossed out, "clears in N days", and clear themselves after a week. Narrower than 560 px it goes
    compact.
- **Calendar**: the month, Monday first, with open tasks as dots in their lists' colours; today outlined. Click a day
  and the Tasks card shows only that day (a task added then gets that date); click it again, or the × on the Tasks card,
  for every day. ‹ Today › move between months.
- **This week**: Monday to Sunday, and anything still open from before. Tick tasks there; click a task's name to point
  it out on the Tasks card. Right-click a task for the same menu as on the Tasks card.

Every card: drag it by its empty space, resize it from any edge or corner (Alt from the centre, Shift in proportion,
both together for both, like Illustrator). While you do, the grid shows (every 8 px, stronger every 32), with the
screen's centre, middle and quarters dashed and the other cards outlined; the card lands on the grid, and near a guide
(the centre, a quarter, another card's edge or centre, or an even gap from it) it snaps to it and the guide lights up
with its name. Where each card is is remembered (`esther-native.json` next to the tasks).

Esther's glass sits behind every card: your wallpaper, blurred, with the panel's tint, made once at the screen's own
size and shared by every card (so it is smooth, and quick to draw), and made again when the wallpaper changes. On
Windows each card sits on the desktop like the Electron cards (owned by the desktop window), is a tool window (no
taskbar button), has Windows' rounded corners, and no Windows window animations: Esther's own fades instead.

## Showing and hiding
- **Ctrl+Alt+E**, or a click on the tray icon (the "E"): if the cards are in front, they fade away into the bubble;
  otherwise they come forward, one after another. Alt+F4 on a card hides Esther too.
- **The bubble**: the word "Esther". While the cards are away it sits big in the middle of the screen (the mouse wheel
  over it makes it bigger or smaller); click it and they come back, and it goes small to the bottom left (click it
  there to hide them again).
- **The tray menu** (right-click the "E"; Windows' own menu, light or dark with Windows): Show / Hide, Cards (which are
  on), Put the cards back, Snap to the grid and guides, The Esther bubble, Start with Windows, Quit Esther.

## Shares your tasks with Esther
Both read and write `%APPDATA%\Esther\tasks.json`. Esther 2.2 or later writes it; this program never creates it, so a
first start here can't overwrite your tasks. Until the file exists, the Tasks card waits (and says so). Changes made in
one show up in the other within a second or so. Running both shows two sets of cards, so close the Electron one (or
turn its cards off in Settings → Cards) while you try this.

## Build and try
- `cargo run` (Linux needs libxkbcommon-x11). `cargo build --release` for the small, fast build: `esther-native.exe`.
- `esther-native --smoke DIR` opens the cards on `DIR/tasks.json` and tries them, on Windows with the real mouse and
  keyboard: adds, renames, moves, dates (menu and picker) a task and gives it a subtask; renames and adds a list; picks a
  day on the calendar; points out and ticks a task from This week; resizes and drags cards with the guides showing and
  snaps one to the screen's centre; hides with Ctrl+Alt+E and comes back with the bubble; opens the tray menu and
  clicks elsewhere to close it; turns Start with Windows on and off. It saves pictures (of each card, and of the whole
  screen at the interesting moments) and the figures (`memory.json`), and quits. The Windows workflow
  (`.github/workflows/esther-native.yml`) runs this on every push and puts the program, the pictures and the figures on
  the "Esther native" pre-release.
- `SLINT_BACKEND=winit-femtovg` draws with the graphics card (OpenGL) instead of the processor, for comparison.

## Not here yet
Settings (colours, looks, glass strength, the shortcut), Esther's undo, dragging to reorder lists and tasks, and the
cards flying into the bubble (they fade instead). Fonts: Instrument Serif
(SIL Open Font License, `ui/fonts/OFL.txt`).

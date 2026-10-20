# Esther 1.5

A simple to-do list for the PC that lives on your desktop, in the Esther looks (Gilded, Illuminated, Nocturne, Modern).
React + TypeScript + Vite. Everything is saved in this browser (`localStorage`, key `esther.todo.v1`); nothing is sent anywhere.

## What it does
Everything is on one page.
- **Top:** a greeting with the date and one line for the day, and the settings menu (gear).
- **Lists as tabs:** All, then each of your lists with its open count. `+` makes a list (name it straight away); double-click a tab to rename it; drag to reorder; right-click for colour and delete (it asks whether to move the tasks or delete them).
- **Task table:** columns Task, List (on All), Subtasks (progress), Date. Click a column to sort, click again to reverse, “Back to my order” to return to your own order (drag ⠿). Open / Done / All toggle. The first row adds a task with Enter. Click a name to rename, the List pill to move, the date chip to set a day, ▸ for subtasks. Right-click a row to move or delete.
- **Beside the table:** the month (dots for days with open tasks; click a day to show only that day in the table) and **This week**, Monday to Sunday, with anything still open from before. Click a task there to open it in the table.
- **Settings menu:** the four looks, window background, highlight colour; save a copy of your tasks as `.json`; start fresh.
- Ctrl+Z undoes the last 50 changes.

## On the desktop (Windows)
Esther lives on the desktop like a set of Rainmeter skins: **every card is its own window** you can drag anywhere, so the desktop works like an operation room. The cards are the header (logo, greeting, gear, hide), Tasks (list tabs and the table), Calendar and This week; Settings opens as its own card from the gear.
- Drag a card by its title area; resize it from its bottom-right corner. Each card remembers where you put it. **Double-click the Esther logo** to put every card back where it started.
- The cards keep each other up to date: a task added in Tasks shows in This week at once, picking a day on the Calendar filters Tasks, clicking a task in This week opens it in Tasks.
- **Sits on the desktop** by default: above the wallpaper and icons, under your apps, like a Rainmeter skin set to *On desktop*. It only steps in when a card has actually fallen under the desktop, so it doesn't flicker when you minimise windows or show the desktop. Gear → *Sits*: on the desktop / like a window / always on top.
- **Ctrl+Alt+E** shows and hides all the cards (or brings them in front of your apps until you click elsewhere). **Esc** or the ✕ hides them. The tray icon has the rest, including *Put the cards back where they started*.
- **Frosted glass** (Windows 11 22H2+): Windows blurs only what's behind each card, never the gaps between them. Gear → *On the desktop* turns it off (restarts to switch).
- Text is always a solid colour; panel colour and opacity in gear → *Panels*. The Esther logo is always set in Instrument Serif.
- Cards can't be maximised, snapped, minimised or made full screen, and come back on screen after a monitor change.
- Finished tasks stay crossed out and clear themselves after a week (gear: a day, a week, a month or never).
- Gear → *On the desktop*: the shortcut, *Start with Windows*, *Quit*.

**Updates itself.** Installed with the Setup file, Esther checks the release a minute after starting and every 4 hours, downloads new versions quietly, and shows *Restart to update* in the top bar (also in the gear menu and tray). If you ignore it, it installs the next time Esther quits. The portable .exe doesn't update itself.

Get it from the **Esther desktop** release on GitHub (built by `.github/workflows/esther-desktop.yml` on every push): `Esther-Setup-<version>.exe` installs it for you (no admin), `Esther-<version>-portable.exe` runs without installing. The app isn't code-signed, so Windows SmartScreen will ask the first time: *More info → Run anyway*.

Desktop development: `npm run desktop` (opens it), `npm run test:desktop` (31 checks, plus window-stack checks on Windows inside Electron; on Linux run it with `xvfb-run`), `npm run build:desktop` (Windows installer, on Windows).

The first time 1.0 opens, tasks from the earlier Esther (key `esther.proto.data.v4`) are brought over: General, Seround, House and B-YOU become lists, steps become subtasks, the plan or due day becomes the date. The old data is left untouched.

## Removed in 1.0
Music projects and stages, notes and the journal, the Library (types, records, views), house bills, Seround brands and reposts, the phone bot and Jev, the smart sentence bar, tags, search and the knight. They are all in the git history (last full build: commit `245dbc3`, 0.3.0).

## Run it
```
npm install
npm run dev        # http://127.0.0.1:5173   (add ?today=2026-10-20 to pin the date)
npm test           # rules: lists, tasks, subtasks, bringing old tasks over
npm run e2e        # browser checks (needs the dev server)
npm run build:site # writes ../docs/index.html for GitHub Pages
npm run desktop    # the desktop widget
```

# Esther 1.0

A simple to-do list for the PC, in the Esther looks (Gilded, Illuminated, Nocturne, Modern).
React + TypeScript + Vite. Everything is saved in this browser (`localStorage`, key `esther.todo.v1`); nothing is sent anywhere.

## What it does
Everything is on one page.
- **Top:** a greeting with the date and one line for the day, and the settings menu (gear).
- **Lists as tabs:** All, then each of your lists with its open count. `+` makes a list (name it straight away); double-click a tab to rename it; drag to reorder; right-click for colour and delete (it asks whether to move the tasks or delete them).
- **Task table:** columns Task, List (on All), Subtasks (progress), Date. Click a column to sort, click again to reverse, “Back to my order” to return to your own order (drag ⠿). Open / Done / All toggle. The first row adds a task with Enter. Click a name to rename, the List pill to move, the date chip to set a day, ▸ for subtasks. Right-click a row to move or delete.
- **Beside the table:** the month (dots for days with open tasks; click a day to show only that day in the table) and **This week**, Monday to Sunday, with anything still open from before. Click a task there to open it in the table.
- **Settings menu:** the four looks, window background, highlight colour; save a copy of your tasks as `.json`; start fresh.
- Ctrl+Z undoes the last 50 changes.

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
```

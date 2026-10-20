# Esther 1.0

A simple to-do list for the PC, in the Esther looks (Gilded, Illuminated, Nocturne, Modern).
React + TypeScript + Vite. Everything is saved in this browser (`localStorage`, key `esther.todo.v1`); nothing is sent anywhere.

## What it does
- **Home:** a greeting with the date and one line for the day, the month calendar (dots for days with tasks; pick a day to see and add its tasks), and **This week**, Monday to Sunday, with anything still open from before.
- **Lists:** make, rename, recolour, reorder and delete your own lists in the sidebar. Deleting a list asks whether to move its tasks or delete them.
- **Tasks:** add with Enter, a date chip, tick, rename by clicking, drag to reorder, **subtasks** under each task. Right-click to move to another list or delete. Finished tasks fold into “Done”.
- **Settings:** the four looks, window background, highlight colour; save a copy of your tasks as `.json`; start fresh.
- Ctrl+Z undoes the last 50 changes. Ctrl+\ collapses the sidebar.

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

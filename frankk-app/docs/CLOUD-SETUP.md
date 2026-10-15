# Esther cloud: phone capture and Jev sorting

About 20 minutes. You need your iPhone (Telegram) and your PC (browser). **Never paste a key or token into a chat**, only into Supabase or your own browser's address bar as shown.

## What you're building
```
Phone (Telegram "Esther" bot) ─┐
                               ├─▶ Supabase function "esther" ──▶ inbox ──▶ Esther app on your PC
Esther app's bar (unsure)  ────┘        │  rules first, Jev when unsure
                                        └─▶ Jev (TypeSafe), only if you add a key
```
Everything is free except Jev (about $0.04 per million tokens read, roughly cents a month for you).

## 1. Telegram bot (phone, 3 min)
1. In Telegram open **@BotFather** → `/newbot` → name `Esther` → a username ending in `bot`.
2. Keep the **token** it gives you somewhere private (password manager). Don't send it to anyone.
3. Open your new bot and press **Start**.
4. Open **@userinfobot** → Start → note your **numeric ID**.

## 2. Supabase project (PC, 3 min)
1. supabase.com → **New project** → name `Esther`, region **Singapore**, plan **Free**. Save the database password.
2. When it's ready: **SQL Editor** → New query → paste `supabase/schema.sql` from this repo → **Run**.

## 3. The function (PC, 5 min)
1. **Edge Functions** → **Deploy a new function** → **Via Editor** → name it exactly `esther`.
2. Replace the example code with the whole of `supabase/functions/esther/index.ts` → **Deploy**.
3. Open the function's **Details/Settings** → turn **off** "Verify JWT" (Esther and Telegram use their own secrets instead) → Save.
4. Copy the function's address. It looks like `https://YOUR-REF.supabase.co/functions/v1/esther`.

## 4. Secrets (PC, 3 min)
**Edge Functions → Secrets** → add each one:

| Name | Value |
|---|---|
| `TELEGRAM_BOT_TOKEN` | the token from BotFather |
| `TELEGRAM_WEBHOOK_SECRET` | make up a long random word (letters/numbers only) |
| `ALLOWED_TELEGRAM_ID` | your numeric ID from @userinfobot |
| `ESTHER_APP_KEY` | make up another long random password (you'll paste it into Esther once) |
| `TIMEZONE` | `Asia/Vientiane` |
| `JEV_API_KEY` | your TypeSafe key (optional; without it, Esther's own rules sort everything) |
| `JEV_MODEL` | optional: the model name from TypeSafe's docs if it isn't `jev-latest` |
| `JEV_URL` | optional: only if TypeSafe gives you a different address than `https://api.typesafe.ai/v1/systemone` |

## 5. Connect Telegram to the function (PC, 1 min)
In your browser's address bar, fill in your own values and press Enter:
```
https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook?url=<FUNCTION_ADDRESS>/telegram&secret_token=<TELEGRAM_WEBHOOK_SECRET>
```
It should answer `"Webhook was set"`.

## 6. Connect Esther (PC, 1 min)
The claude.ai preview page may not be allowed to talk to outside servers, so run Esther on your PC for this:
1. Install **Node.js 22** (nodejs.org) and **Git** (git-scm.com) once.
2. In a terminal: `git clone https://github.com/FRANKKSONG/Frankk.git`, then `cd Frankk/frankk-app`, `git checkout claude/new-session-ynjv6z`, `npm install`, `npm run dev`.
3. Open http://127.0.0.1:5173 in your browser.

Then:
Esther → **Settings → Phone & Jev** → paste the function address and your `ESTHER_APP_KEY` → **Connect & test**.
You should see green dots for Esther cloud, Telegram and (if added) Jev.

## 7. Try it
- In Telegram, send the bot: `record just vocal friday`. It replies with what it kept. Within 20 seconds it appears in Esther (Just's Record stage) and in today's journal.
- Send `/jevtest`. It shows Jev's raw answer. **If it says failed, send me that message** (it contains no keys) and I'll match the code to Jev's real format.
- In Esther's bar, type something with no clear place (`finish the event poster by friday`). The preview says "Jev will place it".

## Good to know
- Only your Telegram ID is listened to; anyone else who finds the bot gets nothing.
- Captures wait in Supabase until Esther takes them, and are deleted a week after. Your vault and journal stay on your devices.
- Voice notes and photos aren't read yet (next step, same approach as the family bot).
- Changing the code: edit `src/cloud/function.ts`, run `npm run test:cloud` (builds and tests it), then paste the new `supabase/functions/esther/index.ts` into the editor again.

import { useState } from 'react';
import { Icon } from './Icons';
import { cloud, cloudCfg, saveCloud, type Health } from '../lib/cloud';

/** Connect Esther to its cloud function: phone capture through Telegram, and Jev sorting. */
export function CloudSettings() {
  const cfg = cloudCfg();
  const [url, setUrl] = useState(cfg?.url ?? '');
  const [key, setKey] = useState(cfg?.key ?? '');
  const [state, setState] = useState<{ h?: Health; err?: string; busy?: boolean }>({});
  const connected = !!cloudCfg();

  const test = async () => {
    const c = { url: url.trim(), key: key.trim() };
    if (!c.url || !c.key) return setState({ err: 'Paste the function address and the app key first.' });
    setState({ busy: true });
    try {
      const h = await cloud.health(c);
      saveCloud(c);
      setState({ h });
      window.dispatchEvent(new Event('esther-cloud'));
    } catch (e) {
      const msg = String((e as Error).message || e);
      const local = /^(127\.0\.0\.1|localhost)$/.test(location.hostname);
      // A browser "Failed to fetch" means the request never left: on claude.ai the preview isn't allowed to call outside servers.
      if (/failed to fetch|load failed|networkerror/i.test(msg) && !local) setState({ err: 'This preview page on claude.ai isn’t allowed to reach outside servers, so it can’t connect from here. Run Esther on your PC (step 5 of the setup page, “If it says Couldn’t reach it”) and connect there.' });
      else if (/^401/.test(msg)) setState({ err: 'The function answered, but the app key doesn’t match. Paste exactly the ESTHER_APP_KEY value you saved in Supabase (not your Jev key).' });
      else if (/^404/.test(msg)) setState({ err: 'Nothing at that address. Copy the function address from Supabase → Edge Functions → esther; it ends in /functions/v1/esther.' });
      else if (/abort/i.test(msg)) setState({ err: 'The function didn’t answer within 25 seconds. Open Supabase → Edge Functions → esther → Logs to see what happened, or open the function address + /health in a new tab: “wrong app key” there means it’s running.' });
      else setState({ err: `Couldn’t reach it (${msg}). Check that the address ends in /functions/v1/esther and the function is deployed.` });
    }
  };

  return (
    <section className="set-card cloud-set">
      <h2>Phone &amp; Jev</h2>
      <p className="lead">Esther cloud is one small function in your own Supabase project. It catches what you send the Esther bot on Telegram, asks Jev to sort what Esther’s own rules aren’t sure about, and hands everything to this app when it’s open.</p>
      <div className="set-grid">
        <label>Function address<input value={url} placeholder="https://YOUR-REF.supabase.co/functions/v1/esther" onChange={(e) => setUrl(e.target.value)} spellCheck={false} /></label>
        <label>App key <small>(the ESTHER_APP_KEY password you made, not your Jev key)</small><input type="password" value={key} placeholder="The same value as ESTHER_APP_KEY in Supabase" onChange={(e) => setKey(e.target.value)} autoComplete="off" /></label>
      </div>
      <div className="cloud-actions">
        <button className="btn primary" onClick={test} disabled={state.busy}><Icon name="plug" size={14} /> {state.busy ? 'Testing… (the first call can take up to 20 seconds)' : connected ? 'Test again' : 'Connect & test'}</button>
        {connected && <button className="btn ghost" onClick={() => { saveCloud(null); setState({}); setUrl(''); setKey(''); }}>Disconnect</button>}
      </div>
      {state.err && <p className="cloud-status bad">{state.err}</p>}
      {state.h && (
        <ul className="cloud-status">
          <li className="ok">Esther cloud answered</li>
          <li className={state.h.telegram ? 'ok' : 'off'}>Telegram bot {state.h.telegram ? 'set up' : 'not set up (add TELEGRAM_BOT_TOKEN)'}</li>
          <li className={state.h.jev ? 'ok' : 'off'}>Jev {state.h.jev ? 'set up · try /jevtest in Telegram' : 'not set up (add JEV_API_KEY): Esther’s own rules sort everything'}</li>
          <li className={state.h.context ? 'ok' : 'off'}>Your brands and projects {state.h.context ? 'shared' : 'will be shared in a moment'}</li>
          <li>{state.h.inbox} capture{state.h.inbox === 1 ? '' : 's'} waiting from your phone</li>
        </ul>
      )}
      {!state.h && !state.err && <p className="hint">{connected ? 'Connected. Esther checks for phone captures every 20 seconds while it’s open.' : 'Not connected. The step-by-step setup is in docs/CLOUD-SETUP.md.'}</p>}
      <p className="hint">The address and app key are kept only in this browser. The app key only opens your own Esther inbox; your Telegram, Jev and database keys stay in Supabase.</p>
    </section>
  );
}

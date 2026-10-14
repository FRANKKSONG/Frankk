import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { StoreProvider } from './data/store';
import { UiProvider } from './ui';
import './styles.css';

// Scrollbars stay hidden until something actually scrolls, then fade away again.
const scrollTimers = new WeakMap<Element, number>();
document.addEventListener('scroll', (e) => {
  const el = e.target instanceof Element ? e.target : document.documentElement;
  el.classList.add('is-scrolling');
  window.clearTimeout(scrollTimers.get(el));
  scrollTimers.set(el, window.setTimeout(() => el.classList.remove('is-scrolling'), 900));
}, { capture: true, passive: true });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StoreProvider>
      <UiProvider>
        <App />
      </UiProvider>
    </StoreProvider>
  </StrictMode>,
);

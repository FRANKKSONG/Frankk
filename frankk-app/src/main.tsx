import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { StoreProvider } from './data/store';
import { UiProvider } from './ui';
import { ContextMenuProvider } from './components/ContextMenu';
// The Esther logo and the calendar dates use Instrument Serif; it ships with the app so it works offline.
import '@fontsource/instrument-serif/400.css';
import '@fontsource/instrument-serif/400-italic.css';
import './styles.css';
import { installOverlayScrollbars } from './lib/overlayScroll';

// Scrollbars are an overlay layer, never part of a box's size (see lib/overlayScroll).
installOverlayScrollbars();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StoreProvider>
      <UiProvider>
        <ContextMenuProvider>
          <App />
        </ContextMenuProvider>
      </UiProvider>
    </StoreProvider>
  </StrictMode>,
);

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { StoreProvider } from './data/store';
import { UiProvider } from './ui';
import { ContextMenuProvider } from './components/ContextMenu';
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

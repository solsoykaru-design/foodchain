import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../index.css';
import { AppProvider } from '../context';
import { OfflineProvider } from '../OfflineProvider';
import { PriceProvider } from '../PriceContext';
import { registerServiceWorker } from '../register-sw';
import ManagerShell from './ManagerShell';

registerServiceWorker();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppProvider>
      <OfflineProvider>
        <PriceProvider>
          <ManagerShell />
        </PriceProvider>
      </OfflineProvider>
    </AppProvider>
  </StrictMode>,
);

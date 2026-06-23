import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../index.css';
import { AppProvider } from '../context';
import WaiterShell from './WaiterShell';
import { OfflineProvider } from '../OfflineProvider';
import { registerServiceWorker } from '../register-sw';
import { PriceProvider } from '../PriceContext';

registerServiceWorker();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppProvider>
      <OfflineProvider>
        <PriceProvider>
          <WaiterShell />
        </PriceProvider>
      </OfflineProvider>
    </AppProvider>
  </StrictMode>
);

import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import {PlatformProvider} from './platform';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PlatformProvider>
      <App />
    </PlatformProvider>
  </StrictMode>,
);

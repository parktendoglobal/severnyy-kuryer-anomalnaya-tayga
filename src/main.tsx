/**
 * Точка входа: браузер открывает index.html, а этот файл запускает в нём игру (компонент App).
 * PlatformProvider запускает SDK площадки (Telegram, VK, MAX) и подтягивает сохранение из облака.
 * StrictMode — режим проверок React во время разработки, на готовую игру не влияет.
 */
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

/**
 * Точка входа: браузер открывает index.html, а этот файл запускает в нём игру (компонент App).
 * StrictMode — режим проверок React во время разработки, на готовую игру не влияет.
 */
import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

/**
 * Настройки сборщика Vite: как собрать игру из исходников в готовые файлы для сайта.
 * Файлы регионов из src/content/regions/ Vite автоматически кладёт в отдельные маленькие
 * файлы, которые браузер скачивает только когда курьер подходит к региону.
 */
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    // GitHub Pages serves project sites from a subpath (github.io/<repo>/),
    // so the built asset URLs must be relative to that subpath.
    base: './',
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // Горячая перезагрузка (HMR) выключается переменной DISABLE_HMR=true (так делает AI Studio),
      // чтобы экран не мигал, пока агент правит файлы.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Заодно выключаем слежение за файлами, чтобы не тратить процессор.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/5b7e6513-6a9d-4ee1-995b-f38340afffef

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Как устроен код

Каждый файл начинается с комментария: что он делает и зачем он нужен в игре. Короткая карта:

| Где | Что там |
| --- | --- |
| `src/App.tsx` | «Дирижёр»: игровой цикл, действия игрока, подгрузка регионов, сохранения, окна интерфейса |
| `src/game/playerPhysics.ts` | Формулы курьера: скорость, баланс груза, тепло, выносливость, батарея, обувь |
| `src/game/weather.ts` | Виды погоды и их смена |
| `src/game/anomalyAI.ts` | Поведение Хладных Теней |
| `src/game/activityZone.ts` | Зона активности: кто «живёт» рядом с курьером, а кто «спит» вдали |
| `src/game/saveSystem.ts` | Сохранения в браузере, версия формата и переходники между версиями |
| `src/game/TaigaRenderer.ts` | Отрисовка мира на холсте |
| `src/content/regionMap.ts` | Список регионов, их границы на карте и какой файл грузить для какого региона |
| `src/content/regions/*.ts` | Контент регионов: NPC и задания, дневник, аномалии, ресурсы, тайники |
| `src/utils/constants.ts` | Общее для всего мира: размер карты, станции, заказы, стартовые инструменты |
| `src/utils/craftingData.ts` | Ресурсы и рецепты крафта |
| `src/components/` | Окна интерфейса (HUD, КПК, дневник, диалоги, крафт, груз, меню) |

**Добавить NPC, задание или запись дневника:** откройте файл нужного региона в `src/content/regions/`
и добавьте объект в список `NPCS` или `JOURNAL` в том же формате, что и остальные записи этого файла.

**Добавить новый регион или поселение:** см. инструкцию в начале `src/content/regionMap.ts`.

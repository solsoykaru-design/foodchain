# Деплой FoodChain на Render.com (единый сервис)

Проект разворачивается как один Docker-сервис `foodchain`, который содержит и бэкенд, и все фронтенды.

## Что уже развёрнуто

В вашем аккаунте Render уже есть сервис:

- **Service Name:** `foodchain`
- **Runtime:** Docker
- **Region:** Oregon
- **Status:** Deployed

После каждого `git push origin master` Render автоматически пересобирает и перезапускает этот сервис.

## URL после деплоя

Если ваш сервис доступен по `https://foodchain.onrender.com`, то:

| Приложение | URL |
|---|---|
| API Health | `https://foodchain.onrender.com/api/health` |
| Admin | `https://foodchain.onrender.com/admin` |
| POS | `https://foodchain.onrender.com/pos` |
| Manager | `https://foodchain.onrender.com/manager` |

## Как обновить сервис

```bash
git add .
git commit -m "обновление"
git push origin master
```

Render увидит изменения и начнёт новый деплой. Статус можно отслеживать в Dashboard.

## Что входит в Docker-образ

Файл `Dockerfile` в корне:
- Устанавливает зависимости.
- Копирует `server/`.
- Копирует собранные фронтенды: `dist-admin`, `dist-pos`, `dist-manager` и другие.
- Запускает `server/index.js` на порту `10000`.
- SQLite и загрузки хранятся в `/data` (диск Render).

## Подключение интеграций

В настройках сервиса `foodchain` на вкладке **Environment** добавьте переменные:

- `TELEGRAM_BOT_TOKEN` — токен бота из @BotFather.
- `VITE_SUPABASE_URL` и `VITE_SUPABASE_ANON_KEY` — если используете Supabase.

Для подключения реальных касс, ЕГАИС, агрегаторов доставки — см. `docs/BETA_DEPLOY.md`.

## Бэкап базы данных

База `foodchain.db` лежит на диске сервиса. Скачать её можно через Render CLI:

```bash
render ssh foodchain
cp /data/foodchain.db /tmp/foodchain-backup.db
exit
render cp foodchain:/tmp/foodchain-backup.db ./foodchain-backup.db
```

## Важные ограничения

- **Бесплатный тариф** засыпает после 15 минут без активности. Первый запрос после сна может занять 30–60 секунд.
- Для продакшена в РФ лучше использовать VPS в российском дата-центре.

## Устранение неполадок

**No open ports detected / сервис не принимает трафик**
- Убедитесь, что тип сервиса — **Web Service**, а не Background Worker.
- В настройках сервиса на вкладке **Environment** должна быть переменная `PORT` со значением `10000`.
- Если меняли порт сервиса в Render, укажите то же значение в переменной `PORT`.
- Сделайте **Manual Deploy** → **Deploy latest commit** (иногда помогает **Clear build cache & deploy**).

**После деплоя /admin или /pos выдают 404**
- Убедитесь, что в репозитории закоммичены папки `dist-admin`, `dist-pos`, `dist-manager`.
- Проверьте логи сборки Docker на Render.

**База не сохраняется**
- Убедитесь, что в сервисе подключён диск, смонтированный в `/data`.
- Проверьте, что `DATA_DIR=/data` задана в Environment.

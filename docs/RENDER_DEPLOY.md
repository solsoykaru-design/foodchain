# Деплой FoodChain на Render.com

Это самый быстрый способ поднять пилот в облаке без настройки VPS.

## Что разворачивается

| Сервис | Тип | Описание |
|---|---|---|
| `foodchain-api` | Web Service | Бэкенд + SQLite на диске |
| `foodchain-admin` | Static Site | Админ-панель |
| `foodchain-pos` | Static Site | POS-терминал |
| `foodchain-manager` | Static Site | Мобильное приложение управляющего |

## Пошаговая инструкция

### 1. Подготовка

- Зарегистрируйтесь на [render.com](https://render.com).
- Подключите GitHub-репозиторий `solsoykaru-design/foodchain`.

### 2. Автоматический деплой через Blueprint

Render увидит файл `render.yaml` в корне и предложит создать все сервисы одной кнопкой.

1. В Dashboard нажмите **New +** → **Blueprint**.
2. Выберите репозиторий.
3. Render создаст 4 сервиса:
   - `foodchain-api` (Node.js)
   - `foodchain-admin` (Static Site)
   - `foodchain-pos` (Static Site)
   - `foodchain-manager` (Static Site)
4. Дождитесь окончания деплоя (5–10 минут).

### 3. Проверка

- API: `https://foodchain-api.onrender.com/api/health` → должен вернуть `{ "status": "ok" }`.
- Admin: `https://foodchain-admin.onrender.com`
- POS: `https://foodchain-pos.onrender.com`
- Manager: `https://foodchain-manager.onrender.com`

### 4. Настройка API-адреса

`render.yaml` автоматически прокидывает URL бэкенда в статические сайты через переменную `VITE_API_URL`.

Если адрес API изменился или нужно переключиться на другой бэкенд:

```js
localStorage.setItem('foodchain_api_url', 'https://foodchain-api.onrender.com');
location.reload();
```

### 5. Подключение интеграций

В настройках сервиса `foodchain-api` добавьте переменные окружения:

- `TELEGRAM_BOT_TOKEN` — токен бота из @BotFather.
- `VITE_SUPABASE_URL` и `VITE_SUPABASE_ANON_KEY` — если используете Supabase.

Для подключения реальных касс, ЕГАИС, агрегаторов — см. `docs/BETA_DEPLOY.md`.

### 6. Обновление

После каждого push в `master` Render автоматически пересоберёт и перезапустит сервисы.

## Важные ограничения Render

- **Бесплатный тариф Web Service** засыпает после 15 минут без активности. Первый запрос после сна может занять 30–60 секунд.
- **Диск** сохраняется между деплоями, но на бесплатном тарифе нет гарантий. Настройте регулярные бэкапы.
- Для продакшена в РФ лучше использовать VPS в российском дата-центре из-за задержек и требований фискализации.

## Резервное копирование

```bash
# Скачать БД с Render (установите render CLI)
render ssh foodchain-api
cp /data/foodchain.db /tmp/foodchain-backup.db
exit
render cp foodchain-api:/tmp/foodchain-backup.db ./foodchain-backup.db
```

Или настройте автобэкап через cron на локальной машине.

## Устранение неполадок

**Статический сайт не видит API**
- Проверьте переменную `VITE_API_URL` в настройках статического сайта.
- Пересоберите сайт вручную: **Manual Deploy** → **Deploy latest commit**.

**База данных не сохраняется**
- Убедитесь, что `DATA_DIR=/data` и диск смонтирован в `/data`.

**Build fails**
- Проверьте логи сборки. Возможно, версия Node ниже 20 — в `package.json` указано `engines.node >=20.0.0`.

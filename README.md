# FoodChain Ecosystem

Полноценная экосистема для ресторанного бизнеса: back-office, POS, кухня, курьер, официант, гость, киоск, сайт и приложения для руководителя.

## Приложения

| Приложение | Описание | Запуск разработки | Сборка |
|------------|----------|-------------------|--------|
| Admin | Back-office для владельцев и управляющих | `npm run dev:admin` | `npm run build:admin` |
| POS | Кассовое рабочее место | `npm run dev:pos` | `npm run build:pos` |
| Manager | Мобильное приложение для руководителя | `npm run dev:manager` | `npm run build:manager` |
| Kitchen | Экран кухни | `npm run dev:kitchen` | `npm run build:kitchen` |
| Waiter | Приложение официанта | `npm run dev:waiter` | `npm run build:waiter` |
| Courier | Приложение курьера | `npm run dev:courier` | `npm run build:courier` |
| Guest | Гостевое приложение | `npm run dev:guest` | `npm run build:guest` |
| Website | Сайт заведения | `npm run dev:website` | `npm run build:website` |
| Kiosk | Киоск самообслуживания | — | `npm run build:kiosk` |
| Techcard | Технологические карты | `npm run dev:techcard` | `npm run build:techcard` |

## Back-office: возможности

- **AI-ассистент** с голосовым вводом для управляющих и администраторов.
- **Сетевая аналитика**: консолидированные отчёты по всем точкам и филиалам.
- **Реферальная программа** для гостей с начислением бонусов.
- **Динамическое ценообразование** по дням недели, времени и сегментам.
- **Автозаказ** и управление закупками: инвентаризация, заявки поставщикам, производство.
- **Honest Sign / ЕГАИС**: маркировка и отчётность.
- **Автоматические триггерные кампании**, CDP-сегменты, RFM- и A/B-кампании.
- **Маркетплейс расширений** с движком вебхуков.
- **Зарплата и премии**: расчёт зарплаты персонала, смены, KPI.
- **Интеграции**: агрегаторы доставки, Yandex.Afisha, Telegram-бот.
- **Offline-режим** и синхронизация для Manager/POS.

## Быстрый старт

```bash
npm install
cd server && npm install && cd ..
npm run build:admin
npm run build:pos
npm run build:manager
npm start
```

Сервер запускается на `http://localhost:3000`.

## Сборка Android-приложения Manager

Требования: Android SDK, Java 17+, `ANDROID_HOME`.

```bash
npm run build:manager
npm run cap:manager:sync
# Windows:
cd android-manager
$env:ANDROID_HOME="C:/Users/<user>/AppData/Local/Android/Sdk"
.\gradlew.bat assembleDebug
# macOS/Linux:
# ANDROID_HOME=$HOME/Library/Android/sdk ./gradlew assembleDebug
```

APK появится в `android-manager/app/build/outputs/apk/debug/app-debug.apk`. Готовый отладочный APK также копируется в `release/FoodChain-Manager-debug.apk`.

## Electron / Windows

```bash
npm run build:exe
```

Инсталлятор появится в папке `release/`.

## Деплой на Render (существующий сервис `foodchain`)

Проект развёрнут как единый Docker-сервис `foodchain`. После push в `master` Render автоматически пересоберёт и перезапустит его.

Доступные пути после деплоя:
- `/admin` — админ-панель
- `/pos` — POS-терминал
- `/manager` — приложение управляющего
- `/api` — API
- `/api/health` — проверка работоспособности

Подробнее — в `docs/RENDER_DEPLOY.md`.

## Документация

- `docs/backoffice-audit-report.md` — аудит back-office и закрытые пробелы.
- `docs/backoffice-comparison.md` — сравнение с iiko, R-Keeper, Poster, 1С:Ресторан.
- `docs/backoffice-roadmap.md` — дорожная карта.
- `RELEASE_NOTES.md` — заметки к релизу.

## Лицензия

Проприетарное ПО FoodChain.

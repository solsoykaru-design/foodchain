# FoodChain Back-office v2.0.0 — Release Notes

**Дата:** 29 июня 2026 г.

## Что нового

### AI и автоматизация
- AI-ассистент с голосовым вводом (`src/admin/AiAssistantPage.tsx`).
- Автоматические триггерные кампании (`server/services/campaign-triggers.service.js`).

### Аналитика и отчётность
- Сетевая аналитика по всем точкам (`src/admin/reports/network/NetworkDashboard.tsx`).
- Филиальные отчёты по продажам, выручке и прибыли (`server/routes/reports.js`).

### Маркетинг и лояльность
- Реферальная программа (`src/admin/ReferralProgramPage.tsx`, `server/services/referral.service.js`).
- Динамическое ценообразование (`src/admin/DynamicPricingPage.tsx`).
- CDP-сегменты, RFM- и A/B-кампании (`src/admin/CdpSegmentsPage.tsx`, `src/admin/CampaignsPage.tsx`).

### Закупки и производство
- Автозаказ и управление закупками.
- Инвентаризация, заявки поставщикам, производственные заказы.

### Комплаенс
- Honest Sign / ЕГАИС (`src/admin/HonestSignPage.tsx`, `server/services/honest-sign.service.js`).

### Персонал
- Расчёт зарплаты, премий и KPI (`src/admin/SalaryPage.tsx`, `server/services/payroll.service.js`).

### Интеграции
- Yandex.Afisha: настройки, тестирование, бронирования, статистика, webhook.
- Синхронизация с агрегаторами доставки.
- Telegram-бот уведомлений.

### Мобильность
- Manager PWA + нативное Android-приложение на Capacitor (`android-manager/`).
- Offline-синхронизация ключевых данных (`/api/offline/sync`).

### Платформа расширений
- Маркетплейс расширений с движком вебхуков (`src/admin/ExtensionsPage.tsx`, `server/services/extensions.service.js`).

### Исправления
- Убраны TypeScript-аннотации из `.js`-файлов сервера (`server/routes/inventory.js`, `server/routes/pos.js`).
- Добавлен недостающий `toggleStatusFilter` в `src/admin/OrdersPage.tsx`.
- Исправлен тип `AdminPage` в `src/types.ts`.

## Артефакты релиза

- `release/FoodChain-Manager-debug.apk` — отладочная Android-сборка Manager.
- `docs/backoffice-audit-report.md` — полный аудит.
- `docs/backoffice-comparison.md` — сравнительная таблица.
- `docs/backoffice-roadmap.md` — дорожная карта.

## Известные ограничения

- iOS-сборка требует macOS и Xcode (`npx cap add ios`).
- В `src/pos/PosApp.tsx` и `src/supabase.ts` остаются предупреждения TypeScript, не влияющие на back-office.

## Версия

`1.0.0` → `2.0.0` (back-office competitive release).

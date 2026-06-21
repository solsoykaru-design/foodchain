# Архитектура экосистемы FoodChain Enterprise

> Версия 2.0 — Полноценная платформа управления ресторанным бизнесом
> Вдохновение: YUMA, iiko, R-Keeper — но современнее, гибче и функциональнее

---

## 1. Обзор экосистемы

```
┌─────────────────────────────────────────────────────────────────────┐
│                      FOODCHAIN ENTERPRISE                          │
│                     ───────────────────────                         │
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌─────────┐ │
│  │   Admin App  │  │  Portal App  │  │  Guest App   │  │ Courier │ │
│  │  (React/TS)  │  │  (React/TS)  │  │  (Flutter)   │  │  (Kotlin)│ │
│  │  :5173       │  │  :5174       │  │  :3001       │  │  :3002  │ │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └────┬─────┘ │
│         │                 │                 │               │       │
│         ▼                 ▼                 ▼               ▼       │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    API Gateway (Nginx)                      │   │
│  │              http://localhost:4000/api/*                    │   │
│  │              ws://localhost:4000/ws                         │   │
│  └─────────────────────────┬───────────────────────────────────┘   │
│                            │                                        │
│         ┌──────────────────┼──────────────────┐                    │
│         ▼                  ▼                  ▼                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐             │
│  │  Main API    │  │  Portal API  │  │  WebSocket   │             │
│  │  Express/JS  │  │  Express/JS  │  │  (ws)        │             │
│  │  :4000       │  │  :4001       │  │  :4000/ws    │             │
│  └──────┬───────┘  └──────┬───────┘  └──────────────┘             │
│         │                 │                                        │
│         ▼                 ▼                                        │
│  ┌──────────────┐  ┌──────────────┐                                │
│  │  SQLite DB   │  │  SQLite DB   │                                │
│  │  (основная)  │  │  (портал)   │                                │
│  └──────────────┘  └──────────────┘                                │
└─────────────────────────────────────────────────────────────────────┘

```

### Текущая архитектура (MVP)

| Компонент | Технологии | Порт | Статус |
|-----------|-----------|------|--------|
| **Main API** | Node.js + Express + better-sqlite3 | 4000 | ✅ Работает |
| **Admin App** | React + TypeScript + Vite | 5173 | ✅ Работает |
| **Portal API** | Node.js + better-sqlite3 | 4001 | 🔧 Требуется настройка |
| **Portal App** | React + TypeScript + Vite | 5174 | 🔧 Разрабатывается |
| **Guest App** | Flutter / Kotlin MP | — | 📋 Планируется |
| **Courier App** | Kotlin + Jetpack Compose | — | 📋 Планируется |

### Целевая архитектура (Production)

| Компонент | Технологии | Назначение |
|-----------|-----------|-----------|
| **API Gateway** | Nginx / Traefik | Маршрутизация, SSL, rate limiting |
| **Auth Service** | Node.js + JWT | Аутентификация, RBAC |
| **Order Service** | Node.js / NestJS | Заказы, статусы, WebSocket |
| **Menu Service** | Node.js / NestJS | Меню, модификаторы, цены |
| **Warehouse Service** | Node.js / NestJS | Склад, документы, техкарты |
| **Finance Service** | Node.js / NestJS | Финансы, зарплата, аналитика |
| **Notification Service** | Node.js | Push, SMS, Email, Telegram |
| **Courier Service** | Node.js + WebSocket | GPS-трекинг, назначения |
| **File Storage** | MinIO / S3 | Фото блюд, аватарки, отчёты |
| **Cache** | Redis | Сессии, кеш, очереди |
| **Message Queue** | RabbitMQ | Асинхронные задачи |
| **Monitoring** | Prometheus + Grafana | Метрики, алерты |

---

## 2. База данных

### 2.1 Основные таблицы (SQLite)

```
Таблиц: 67
Движок: SQLite 3 (WAL mode)
Файл: server/foodchain.db
```

#### 2.1.1 Склад и производство

```sql
-- Технологические карты
tech_cards          (id, itemId, number, name, description, dishName, cookingTime, yield,
                     thermalLossPercent, coldLossPercent, packagingCost, additionalCosts,
                     portions, grossWeight, isActive, kbjuSource, ingredients, instructions,
                     createdAt, updatedAt)

tech_card_ingredients  (id, techCardId, itemId, name, quantity, unit, price, sortOrder)
tech_card_modifiers   (id, techCardId, name, quantity, price, sortOrder)

-- Склад
inventory_items       (id, name, article, barcode, unit, basePrice, currentStock, categoryId,
                       minStock, isActive, alcoholType, beerType, id_1c, createdAt, updatedAt)
stock_categories      (id, name, parentId, tenantId)
warehouses            (id, name, type, address, isActive)
warehouse_bindings    (id, itemId, warehouseId, currentStock, minStock)
workshops             (id, name, type, isActive)
stock_contragents     (id, itemId, contragentName, price, article)
wholesale_prices      (id, itemId, price, supplier, date)

-- Документооборот
documents             (id, type, number, status, date, docDate, typeLabel, warehouseFrom,
                       warehouseTo, total, createdBy, approvedBy, approvedAt, note,
                       createdAt, updatedAt, itemCount)
inventory_transactions (id, documentId, itemId, warehouseId, quantity, price, type, date,
                        createdAt)
batches               (id, itemId, warehouseId, quantity, price, date, documentId)
price_history         (id, itemId, price, date)
packaging             (id, name, type, weight, price, techCardId)
```

#### 2.1.2 Меню и клиенты

```sql
-- Меню
dishes                (id, name, description, price, categoryId, image, isActive, sortOrder,
                       branchId, displayOrder, createdAt, updatedAt)
menu_categories       (id, name, description, image, sortOrder, isActive)
modifiers             (id, name, price, groupId, sortOrder, isActive)
modifier_groups       (id, name, description, minSelect, maxSelect, isRequired, sortOrder)
dish_modifiers        (id, dishId, modifierId, sortOrder)
weekly_menu           (id, dishId, dayOfWeek, price, isActive)
price_lists           (id, name, type, items)
stop_lists            (id, date, reason, isActive)
stop_list_items       (id, stopListId, dishId)
languages             (id, code, name, isActive, translations)

-- Клиенты
users                 (id, name, phone, email, password, role, isActive, createdAt, updatedAt)
user_bonuses          (id, userId, balance, lifetimeEarned, lifetimeSpent)
bonus_transactions    (id, userId, type, amount, description, createdAt)
client_groups         (id, name, description, discount, isActive)
user_notes            (id, userId, text, createdAt)
guest_photos          (id, userId, url, createdAt)
reviews               (id, userId, orderId, rating, text, photos, isPublished, createdAt)
review_questions      (id, reviewId, question, answer, createdAt)
```

#### 2.1.3 Маркетинг

```sql
campaigns             (id, name, type, message, buttonText, segment, sentCount, openCount,
                       status, createdAt)
promo_codes           (id, code, type, value, minOrder, maxUses, usedCount, isActive,
                       expiresAt, createdAt)
discount_rules        (id, name, type, value, targetType, targetId, minOrder, maxDiscount,
                       activeDays, startsAt, endsAt, maxUses, isActive, createdAt)
certificates          (id, code, amount, balance, type, recipientName, recipientPhone,
                       message, isActive, expiresAt, createdAt)
loyalty_levels        (id, name, minPoints, discountPercent, bonusMultiplier, isActive)
system_settings       (key, value, groupName, type)
```

#### 2.1.4 Финансы

```sql
finance_transactions  (id, type, category, amount, description, paymentMethod, date,
                       orderId, createdAt)
salary                (id, staffId, amount, type, period, status, paidAt, createdAt)
salary_log            (id, staffId, amount, type, description, createdAt)
```

#### 2.1.5 Персонал

```sql
staff                 (id, firstName, lastName, role, phone, email, username, password,
                       isActive, salaryType, salaryValue, onlineToday, isOnline,
                       lastSeen, createdAt, updatedAt)
staff_permissions     (id, staffId, section, canView, canEdit, createdAt)
staff_schedule        (id, staffId, dayOfWeek, startTime, endTime, isActive)
staff_shifts          (id, staffId, date, startTime, endTime, breakDuration)
```

### 2.2 Миграции

```javascript
// Все ALTER TABLE обёрнуты в try/catch для идемпотентности
try { db.exec(`ALTER TABLE table_name ADD COLUMN column_name TYPE DEFAULT value`); } catch(e) {}
```

---

## 3. API Endpoints

### 3.1 Authentication
```
POST   /api/login                    # Вход (возвращает JWT)
POST   /api/register                 # Регистрация
POST   /api/refresh                  # Refresh токен
POST   /api/change-password          # Смена пароля
```

### 3.2 Dashboard
```
GET    /api/dashboard/stats          # Статистика (выручка, заказы, курьеры)
GET    /api/dashboard/revenue-chart  # График выручки
GET    /api/dashboard/top-dishes     # Топ блюд
GET    /api/dashboard/latest-orders  # Последние заказы
```

### 3.3 Orders
```
GET    /api/orders                   # Список заказов (с фильтрацией)
POST   /api/orders                   # Создать заказ
GET    /api/orders/:id               # Детали заказа
PATCH  /api/orders/:id/status        # Сменить статус
PUT    /api/orders/:id/assign        # Назначить курьера
POST   /api/orders/bulk-status       # Массовая смена статусов
GET    /api/orders/track             # Отслеживание заказа
```

### 3.4 Kitchen
```
GET    /api/orders?status=confirmed,preparing
PATCH  /api/orders/:id/status        # → ready
```

### 3.5 Tech Cards
```
GET    /api/tech-cards/list          # Список техкарт с фильтрацией
GET    /api/tech-card/:id            # Детали техкарты
POST   /api/tech-card                # Создать техкарту
PUT    /api/tech-card/:id            # Обновить техкарту
DELETE /api/tech-card/:id            # Удалить техкарту
POST   /api/tech-card/:id/calculate-kbju  # Расчёт КБЖУ
POST   /api/tech-card/:id/copy       # Копировать техкарту
GET    /api/tech-cards/export        # Экспорт в XLSX
POST   /api/tech-cards/import        # Импорт из XLSX
GET    /api/tech-card/:id/ingredients     # Ингредиенты техкарты
POST   /api/tech-card/:id/ingredients     # Добавить ингредиент
PUT    /api/tech-card/:id/ingredients/:iId # Обновить ингредиент
DELETE /api/tech-card/:id/ingredients/:iId # Удалить ингредиент
GET    /api/tech-card/:id/modifiers       # Модификаторы техкарты
POST   /api/tech-card/:id/modifiers       # Добавить модификатор
PUT    /api/tech-card/:id/modifiers/:mId  # Обновить модификатор
DELETE /api/tech-card/:id/modifiers/:mId  # Удалить модификатор
```

### 3.6 Inventory
```
GET    /api/inventory-items          # Список товаров (с фильтрацией)
POST   /api/inventory-items          # Создать товар
PUT    /api/inventory-items/:id      # Обновить товар
POST   /api/inventory-items/import   # Импорт из Excel
GET    /api/inventory-items/:id/history     # История движений
GET    /api/stock-item/:id/warehouse-bindings  # Привязки к складам
POST   /api/stock-item/:id/warehouse-bindings/bind-all  # Привязать ко всем
PUT    /api/stock-item/:id/warehouse-bindings/:bId      # Обновить привязку
GET    /api/stock-item/:id/contragents     # Контрагенты товара
POST   /api/stock-item/:id/contragents     # Добавить контрагента
DELETE /api/stock-item/:id/contragents/:cId # Удалить контрагента
```

### 3.7 Documents
```
GET    /api/documents                # Список документов
GET    /api/documents/types          # Типы документов
POST   /api/documents                # Создать документ
PUT    /api/documents/:id            # Обновить документ
DELETE /api/documents/:id            # Удалить документ
POST   /api/documents/import         # Импорт из XLSX
```

### 3.8 Menu
```
GET    /api/dishes                   # Список блюд
POST   /api/dishes                   # Создать блюдо
PUT    /api/dishes/:id               # Обновить блюдо
DELETE /api/dishes/:id               # Удалить блюдо
GET    /api/menu-categories          # Категории меню
POST   /api/menu-categories          # Создать категорию
PUT    /api/menu-categories/:id      # Обновить категорию
DELETE /api/menu-categories/:id      # Удалить категорию
GET    /api/modifiers                # Модификаторы
POST   /api/modifiers                # Создать модификатор
PUT    /api/modifiers/:id            # Обновить модификатор
DELETE /api/modifiers/:id            # Удалить модификатор
GET    /api/modifier-groups          # Группы модификаторов
POST   /api/modifier-groups          # Создать группу
PUT    /api/modifier-groups/:id      # Обновить группу
DELETE /api/modifier-groups/:id      # Удалить группу
GET    /api/weekly-menu              # Недельное меню
GET    /api/stop-lists               # Стоп-листы
```

### 3.9 Clients
```
GET    /api/clients                  # Список клиентов
GET    /api/clients/:id              # Детали клиента
GET    /api/client-groups            # Группы клиентов
GET    /api/reviews                  # Отзывы
POST   /api/reviews                  # Создать отзыв
GET    /api/review-questions         # Вопросы к отзывам
GET    /api/guests/search            # Поиск гостей
```

### 3.10 Marketing
```
GET    /api/campaigns                # Кампании
POST   /api/campaigns                # Создать кампанию
PUT    /api/campaigns/:id            # Обновить кампанию
POST   /api/campaigns/:id/send       # Отправить кампанию
GET    /api/promocodes               # Промокоды
POST   /api/promocodes               # Создать промокод
PUT    /api/promocodes/:id           # Обновить промокод
DELETE /api/promocodes/:id           # Удалить промокод
GET    /api/discounts                # Скидки
POST   /api/discounts                # Создать скидку
PUT    /api/discounts/:id            # Обновить скидку
DELETE /api/discounts/:id            # Удалить скидку
GET    /api/certificates             # Сертификаты
POST   /api/certificates             # Создать сертификат
DELETE /api/certificates/:id         # Удалить сертификат
GET    /api/loyalty-levels           # Уровни лояльности
POST   /api/loyalty-levels           # Создать уровень
PUT    /api/loyalty-levels/:id       # Обновить уровень
DELETE /api/loyalty-levels/:id       # Удалить уровень
GET    /api/marketing/analytics      # Аналитика маркетинга
GET    /api/bonuses                  # Бонусные счета
POST   /api/bonuses/accrue           # Начислить бонусы
```

### 3.11 Finance
```
GET    /api/finance/summary          # Сводка (выручка, расходы, прибыль)
GET    /api/finance/transactions     # Транзакции
POST   /api/finance/transactions     # Создать транзакцию
GET    /api/finance/report           # Отчёт (CSV)
GET    /api/finance/cashflow         # Движение денег
GET    /api/salary                   # Зарплата
```

### 3.12 Staff
```
GET    /api/staff                    # Сотрудники
POST   /api/staff                    # Создать сотрудника
PUT    /api/staff/:id                # Обновить сотрудника
DELETE /api/staff/:id                # Удалить сотрудника
GET    /api/staff/:id/permissions    # Права сотрудника
PUT    /api/staff/:id/permissions    # Обновить права
GET    /api/kpi-targets              # KPI цели
POST   /api/kpi-targets              # Создать KPI
PUT    /api/kpi-targets/:id          # Обновить KPI
DELETE /api/kpi-targets/:id          # Удалить KPI
GET    /api/kpi-results/:staffId     # Результаты KPI
```

### 3.13 Settings
```
GET    /api/settings                 # Все настройки
PUT    /api/settings                 # Обновить настройки
POST   /api/backup                   # Создать бэкап
GET    /api/audit-logs               # Логи аудита
POST   /api/audit-logs               # Записать лог
```

### 3.14 Integrations
```
GET    /api/integrations/:type       # Настройки интеграции
PUT    /api/integrations/:type       # Обновить настройки
GET    /api/integrations/1c/export-products  # Экспорт в 1С
PUT    /api/integrations/egais/mark-product  # Маркировка ЕГАИС
```

### 3.15 Messaging
```
GET    /api/messages                 # Сообщения
POST   /api/messages                 # Отправить сообщение
GET    /api/notifications            # Уведомления
PUT    /api/push-settings            # Push-настройки
```

---

## 4. Дизайн-система

### 4.1 Цветовая палитра

```css
:root {
  /* Основные */
  --primary-50:   #eff6ff;
  --primary-100:  #dbeafe;
  --primary-200:  #bfdbfe;
  --primary-300:  #93c5fd;
  --primary-400:  #60a5fa;
  --primary-500:  #3b82f6;   /* Основной синий */
  --primary-600:  #2563eb;
  --primary-700:  #1d4ed8;
  --primary-800:  #1e40af;
  --primary-900:  #1e3a8a;

  /* Акцентный (оранжевый) */
  --accent-50:    #fff7ed;
  --accent-500:   #f97316;   /* Предупреждения, важные действия */
  --accent-600:   #ea580c;

  /* Успех (зелёный) */
  --success-50:   #f0fdf4;
  --success-500:  #22c55e;   /* Выручка, готово, активно */
  --success-600:  #16a34a;

  /* Ошибка (красный) */
  --danger-50:    #fef2f2;
  --danger-500:   #ef4444;   /* Расходы, ошибки, просрочки */
  --danger-600:   #dc2626;

  /* Нейтральные */
  --gray-50:      #f9fafb;
  --gray-100:     #f3f4f6;
  --gray-200:     #e5e7eb;
  --gray-300:     #d1d5db;
  --gray-400:     #9ca3af;
  --gray-500:     #6b7280;
  --gray-600:     #4b5563;
  --gray-700:     #374151;
  --gray-800:     #1f2937;
  --gray-900:     #111827;
  --gray-950:     #030712;
}
```

### 4.2 Типографика

| Элемент | Шрифт | Размер | Вес |
|---------|-------|--------|-----|
| H1 | Inter | 32px / 2rem | Bold (700) |
| H2 | Inter | 24px / 1.5rem | Bold (600) |
| H3 | Inter | 20px / 1.25rem | Semibold (600) |
| H4 | Inter | 16px / 1rem | Semibold (600) |
| Body | Inter | 14px / 0.875rem | Regular (400) |
| Body Small | Inter | 12px / 0.75rem | Regular (400) |
| Caption | Inter | 11px / 0.6875rem | Medium (500) |
| Mono | JetBrains Mono | 13px / 0.8125rem | Regular (400) |

### 4.3 Компоненты UI

#### 4.3.1 Карточка (Card)
```
┌─────────────────────────────────────────┐
│  Заголовок                    ⋮︎       │
│  ─────────────────────────────────────  │
│  Контент                               │
│                                         │
│  [Кнопка 1]  [Кнопка 2]                │
└─────────────────────────────────────────┘
- Border-radius: 16px (2xl)
- Padding: 20px (p-5)
- Тень: sm
- Фон: white / dark: gray-900
```

#### 4.3.2 Таблица
```
┌──────────┬──────────┬──────────┬──────────┐
│  Заголовок  │  Цена    │  Остаток  │  Действия │
├──────────┼──────────┼──────────┼──────────┤
│  Товар 1  │  100₽    │  50 шт   │  [✎] [🗑]  │
│  Товар 2  │  200₽    │  30 шт   │  [✎] [🗑]  │
└──────────┴──────────┴──────────┴──────────┘
- Header: bg-zinc-50, text-xs, uppercase
- Rows: border-t, hover highlight
- Padding: p-3
```

#### 4.3.3 Модальное окно
```
┌─────────────────────────────────────────┐
│  ✕                                      │
│  ┌────────────────────────────────────┐ │
│  │  Заголовок                         │  │
│  │                                     │  │
│  │  Поля формы...                      │  │
│  │                                     │  │
│  │  [Отмена]  [Сохранить]              │  │
│  └────────────────────────────────────┘ │
└─────────────────────────────────────────┘
- Overlay: bg-black/50, backdrop-blur
- Width: max-w-md (448px)
- Border-radius: 24px (3xl)
```

#### 4.3.4 Кнопки

| Вариант | Стиль | Назначение |
|---------|-------|-----------|
| Primary | bg-blue-500 → hover:bg-blue-600 | Основное действие |
| Success | bg-green-500 → hover:bg-green-600 | Подтверждение |
| Danger | bg-red-500 → hover:bg-red-600 | Удаление |
| Outline | border-2 border-zinc-200 | Второстепенное |
| Ghost | text-zinc-500 → hover:text-blue-500 | Редактирование |

#### 4.3.5 Формы инпутов

```
┌─────────────────────────────────────────┐
│  Название поля                    (help)│
│  ┌─────────────────────────────────┐    │
│  │  Значение                       │    │
│  └─────────────────────────────────┘    │
│  Ошибка валидации (красный)             │
└─────────────────────────────────────────┘
- Border: 2px solid zinc-200/700
- Border-radius: 12px (xl)
- Padding: 10px 16px (px-4 py-2.5)
- Focus: ring-2 ring-blue-500
- Error: border-red-500
```

#### 4.3.6 Переключатель (Toggle)

```
         OFF                  ON
    ┌────────┐           ┌────────┐
    │  ○     │           │     ●  │
    └────────┘           └────────┘
    bg-zinc-300          bg-green-500
    w-12 h-6             w-12 h-6
```

#### 4.3.7 Бейдж (Badge)

```
┌──────┐  ┌──────┐  ┌──────┐
│  12  │  │  Нов  │  │  Активно │
└──────┘  └──────┘  └──────┘
red-500   blue-100   green-100
          text-blue-700 text-green-700
```

### 4.4 Аккордеон меню (Sidebar)

```
┌─────────────────────────────────────────┐
│  F  Название ресторана                  │
│  ─────────────────────────────────────  │
│  ▼ Операции                             │ ← Группа (раскрыта)
│    ● Дашборд                            │ ← Активный пункт
│    ○ Заказы                    [3]      │ ← Бейдж
│    ○ Кухня                              │
│    ○ Бронирования                       │
│  ▶ Склад и производство                │ ← Группа (свёрнута)
│  ▶ Меню и клиенты                      │
│  ▶ Маркетинг и реклама                  │
│  ▶ Финансы и администрирование         │
│  ▶ Справочники                         │
└─────────────────────────────────────────┘
- Width: 256px (w-64)
- Hover: bg-zinc-100
- Active: bg-blue-50 + text-blue-600
- Sub-items: indent ml-3, smaller text
```

### 4.5 Темы

#### Светлая тема
```css
.bg-white        → #ffffff
.bg-zinc-50      → #fafafa (фон страницы)
.bg-zinc-100     → #f4f4f5 (карточки)
.text-zinc-900   → #18181b (основной текст)
.text-zinc-500   → #71717a (второстепенный текст)
.border-zinc-200 → #e4e4e7 (границы)
```

#### Тёмная тема
```css
.bg-zinc-900     → #18181b (фон страницы)
.bg-zinc-800     → #27272a (карточки)
.bg-zinc-950     → #09090b (основной)
.text-white      → #ffffff
.text-zinc-400   → #a1a1aa (второстепенный)
.border-zinc-700 → #3f3f46 (границы)
```

---

## 5. Структура проекта

```
D:\program\
├── src/                          # Admin App (React + TypeScript)
│   ├── admin/                    # Страницы админ-панели
│   │   ├── AdminApp.tsx          # Главный компонент (роутинг + меню)
│   │   ├── DashboardPage.tsx     # Дашборд
│   │   ├── OrdersPage.tsx        # Заказы
│   │   ├── KitchenPage.tsx       # Кухня
│   │   ├── TechCardsPage.tsx     # Техкарты
│   │   ├── DocumentsPage.tsx     # Документооборот
│   │   ├── MenuPage.tsx          # Меню
│   │   ├── FinancePage.tsx       # Финансы
│   │   ├── MarketingPage.tsx     # Маркетинг
│   │   ├── SettingsPage.tsx      # Настройки
│   │   ├── StaffPage.tsx         # Персонал
│   │   ├── ClientsPage.tsx       # Клиенты
│   │   ├── InventoryPage.tsx     # Инвентаризация
│   │   ├── InventoryItemsPage.tsx # Складские элементы
│   │   ├── ...
│   │   └── docStore.ts           # Хранилище типа документа
│   ├── api.ts                    # API клиент (все методы)
│   ├── context.tsx               # React Context (тема, уведомления)
│   ├── types.ts                  # TypeScript типы
│   └── index.css                 # Глобальные стили + Tailwind
│
├── server/                       # Main API Server (Node.js + Express)
│   ├── index.js                  # Все роуты и миграции (5009 строк)
│   └── foodchain.db              # SQLite база данных
│
├── portal/                       # Portal App (React + TypeScript)
│   ├── src/
│   │   └── ...
│   └── server/                   # Portal API
│       └── ...
│
├── docs/                         # Документация
│   └── ARCHITECTURE.md           # Этот файл
│
├── package.json                  # Root package.json
├── vite.config.ts                # Vite конфиг
├── tailwind.config.js            # Tailwind CSS конфиг
└── tsconfig.json                 # TypeScript конфиг
```

---

## 6. Правила кодирования

### 6.1 Общие

```javascript
// ✅ Хорошо: понятные имена
const getOrderById = (id) => { ... }
const userBonuses = await api.getUserBonuses(userId);

// ❌ Плохо: сокращения
const getOrd = (i) => { ... }
const ub = await api.getUB(uid);

// ✅ Всегда async/await (не then/catch)
try {
  const data = await api.getData();
  // обработка
} catch (e) {
  // обработка ошибки
}
```

### 6.2 Обработка ошибок API

```javascript
// ✅ В каждом компоненте — try/catch с graceful degradation
const load = async () => {
  try {
    const data = await api.getOrders();
    setOrders(data);
  } catch {
    // Не показываем модалку с ошибкой — просто пустое состояние
    setOrders([]);
  }
};
```

### 6.3 SQL миграции

```javascript
// ✅ Все ALTER TABLE и CREATE TABLE — идемпотентны
try { db.exec(`ALTER TABLE x ADD COLUMN y TEXT`); } catch(e) {}
try { db.exec(`CREATE TABLE IF NOT EXISTS x (...)`); } catch(e) {}

// ❌ Никогда: DROP TABLE (если только не dev)
// ❌ Никогда: миграции без try/catch
```

### 6.4 Именование маршрутов

```
GET    /api/resource               # Список
POST   /api/resource               # Создать
GET    /api/resource/:id           # Получить
PUT    /api/resource/:id           # Обновить
DELETE /api/resource/:id           # Удалить
POST   /api/resource/:id/action    # Действие
GET    /api/resource/:id/sub       # Вложенный список
```

### 6.5 camelCase ↔ snake_case

```javascript
// Сервер: snake_case (SQLite стиль)
// Клиент: camelCase (JavaScript стиль)

// Конвертация:
function toCamelCase(row) {
  if (!row) return row;
  const result = {};
  for (const [key, value] of Object.entries(row)) {
    result[key.replace(/_([a-z])/g, (_, c) => c.toUpperCase())] = value;
  }
  return result;
}

function toSnakeCase(obj) {
  if (!obj) return obj;
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    result[key.replace(/[A-Z]/g, c => '_' + c.toLowerCase())] = value;
  }
  return result;
}
```

---

## 7. План развития

### Phase 1 — MVP (✅ Завершено)
- [x] Админ-панель с 40+ страницами
- [x] Полный складской учёт (техкарты, документы, остатки)
- [x] Управление меню (блюда, модификаторы, категории)
- [x] Финансы (транзакции, отчёты, зарплата)
- [x] Маркетинг (кампании, промокоды, скидки, бонусы)
- [x] Персонал (сотрудники, роли, права)
- [x] Клиенты (список, отзывы, группы)
- [x] API: 100+ эндпоинтов

### Phase 2 — Portal & Multi-tenant (В процессе)
- [ ] Портал регистрации арендаторов
- [ ] Тарифы и подписки
- [ ] Онлайн-оплата (ЮKassa)
- [ ] Суперадминская панель
- [ ] Разделение БД по tenant_id

### Phase 3 — Mobile Apps (Планируется)
- [ ] Guest App (Flutter): меню, заказ, оплата, отслеживание
- [ ] Courier App (Kotlin): заказы, GPS, навигация
- [ ] WebSocket real-time обновления
- [ ] Push-уведомления (Firebase)

### Phase 4 — Production Ready
- [ ] PostgreSQL миграция
- [ ] Redis кеширование
- [ ] Docker + Kubernetes
- [ ] CI/CD pipeline
- [ ] Мониторинг (Prometheus + Grafana)
- [ ] Нагрузочное тестирование

---

## 8. Метрики и мониторинг

### Ключевые метрики

| Метрика | Где | Описание |
|---------|-----|----------|
| Request latency | API Gateway | P50/P95/P99 latency |
| Active orders | Orders Service | Количество активных заказов |
| DB query time | Database | Медленные запросы (>100ms) |
| WebSocket connections | WS Service | Количество подключений |
| Cache hit rate | Redis | Эффективность кеширования |
| Error rate | All services | 5xx ошибки / всего запросов |
| Stock alerts | Warehouse | Товары ниже minStock |

### Health Checks

```
GET /health          # Базовый (сервер жив)
GET /health/db       # Проверка подключения к БД
GET /health/ws       # Проверка WebSocket
GET /health/cache    # Проверка Redis
GET /health/storage  # Проверка S3/MinIO
```

---

## 9. Безопасность

### 9.1 Аутентификация
- JWT access token (15 min) + refresh token (7 days)
- Хеширование: bcrypt (cost factor 12)
- 2FA: TOTP (RFC 6238)

### 9.2 Авторизация (RBAC)

| Роль | Доступ |
|------|--------|
| superadmin | Всё |
| owner | Всё, кроме управления арендаторами |
| manager | Операции, склад, меню, клиенты, маркетинг |
| accountant | Финансы, зарплата |
| chef | Техкарты, кухня, склад |
| analyst | Дашборд, финансы (только чтение) |
| waiter | Заказы, бронирования |
| courier | Только приложение курьера |

### 9.3 Защита данных
- Все пароли — bcrypt
- SQL-инъекции: параметризованные запросы (никогда не конкатенировать SQL)
- XSS: React экранирует по умолчанию, Content-Security-Policy header
- HTTPS: обязательно в production
- Rate limiting: 100 req/min на IP
- Audit log: все действия администраторов

---

## 10. Интеграции

| Система | Назначение | Статус |
|---------|-----------|--------|
| 1С: Бухгалтерия | Экспорт товаров, синхронизация остатков | ✅ API готов |
| ЕГАИС | Учёт алкогольной продукции | ✅ API готов |
| Telegram Bot | Уведомления о заказах | ✅ API готов |
| ЮKassa / Stripe | Онлайн-оплата подписок | 📋 План |
| СДЭК / Деловые Линии | Доставка заказов | 📋 План |
| Firebase Cloud Messaging | Push-уведомления | 📋 План |
| Яндекс.Карты / Google Maps | Отображение на карте | 📋 План |
| AmoCRM / Bitrix24 | CRM интеграция | 📋 План |

---

*Документ создан 16.06.2026. Версия 2.0.*
*© FoodChain Enterprise — Платформа управления ресторанным бизнесом*

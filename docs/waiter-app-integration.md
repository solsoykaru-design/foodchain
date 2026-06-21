# Приложение официанта — Интеграция

## Архитектура

```
waiter.html → src/waiter/main.tsx → WaiterShell (auth guard)
                                         ├── WaiterAuth (login + tenant selection)
                                         └── WaiterApp (main orchestrator)
                                               ├── HallPlan (схема зала)
                                               ├── TableCard (карточка стола)
                                               ├── MenuGrid (меню + корзина)
                                               ├── ActiveOrders (активные заказы)
                                               ├── PaymentScreen (оплата)
                                               ├── OrderHistory (история)
                                               ├── KitchenChat (чат с кухней)
                                               └── QuickTemplates (шаблоны)
```

- **Платформа**: Web (React 18 + TypeScript + Vite) → Android через Capacitor
- **Стилизация**: Tailwind CSS v4 (dark theme)
- **Стейт-менеджмент**: useState/useCallback (локальный, без внешних библиотек)
- **Сеть**: REST API + WebSocket + Polling (через `api.ts`)

## Файловая структура

```
src/waiter/
  main.tsx                  — точка входа
  WaiterShell.tsx           — guard: проверка авторизации
  WaiterAuth.tsx            — страница логина + выбор ресторана
  WaiterApp.tsx             — главный orchestrator (табы, состояние, сокет)
  components/
    HallPlan.tsx            — интерактивная схема зала (таблицы, зоны, статусы)
    TableCard.tsx           — модалка карточки стола (заказы, перемещение, сплит)
    MenuGrid.tsx            — выбор блюд с категориями, поиском, модификаторами
    ActiveOrders.tsx        — список активных заказов (статусы, таймер, подача)
    PaymentScreen.tsx       — оплата (методы, QR, сплит, чек, закрытие)
    OrderHistory.tsx        — история заказов официанта за смену
    KitchenChat.tsx         — чат с кухней (быстрые сообщения)
    QuickTemplates.tsx      — шаблоны быстрых заказов
  hooks/
    useWaiterSocket.ts      — WebSocket с авто-переподключением
    useOrderTimer.ts        — таймер времени ожидания заказа
```

## API Endpoints

### Авторизация

| Метод | Путь | Описание |
|-------|------|----------|
| POST | `/api/staff/login` | Логин официанта/менеджера. Ответ: `{ token, user, tenants[] }` |

### Столы и зал

| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/api/waiter/tables` | Список столов со статусами и активными чеками |
| POST | `/api/waiter/seated` | Посадка гостей (создание чека) |
| PATCH | `/api/waiter/table/:id/guests` | Изменить количество гостей |
| POST | `/api/waiter/move-guests` | Переместить гостей/объединить столы |
| POST | `/api/waiter/table/:id/request-bill` | Попросить счёт |

### Заказы

| Метод | Путь | Описание |
|-------|------|----------|
| POST | `/api/waiter/orders` | Создать заказ (dine-in, delivery, pickup) |
| GET | `/api/waiter/active-checks?waiterId=` | Активные чеки официанта |
| GET | `/api/waiter/check-orders/:checkId` | Заказы в чеке |
| POST | `/api/orders/:id/serve` | Подать заказ (ready → served) |
| POST | `/api/orders/:id/split` | Разделить заказ по позициям |
| POST | `/api/waiter/split-check/:checkId` | Разделить чек (по dishId) |
| POST | `/api/orders/merge` | Объединить заказы |
| GET | `/api/orders?status=closed` | Закрытые заказы (история) |

### Оплата

| Метод | Путь | Описание |
|-------|------|----------|
| POST | `/api/orders/:id/payment` | Принять оплату |
| POST | `/api/payment/qr` | Сгенерировать QR-код (СБП/Sber) |

### Вызов официанта

| Метод | Путь | Описание |
|-------|------|----------|
| POST | `/api/waiter/call` | Позвать официанта |
| POST | `/api/waiter/call/:id/resolve` | Отметить вызов обработанным |
| GET | `/api/waiter/calls/pending` | Активные вызовы |

### Чат с кухней

| Метод | Путь | Описание |
|-------|------|----------|
| POST | `/api/kitchen/chat` | Отправить сообщение на кухню |

### Меню

| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/api/dishes` | Список блюд |
| GET | `/api/menu-categories` | Категории меню |

## WebSocket-события

| Событие | Направление | Описание |
|---------|-------------|----------|
| `order:update` | Сервер → Клиент | Изменение статуса заказа |
| `order:item:update` | Сервер → Клиент | Изменение статуса блюда |
| `order:new` | Сервер → Клиент | Новый заказ |
| `waiter:call` | Сервер → Клиент | Вызов официанта |
| `waiter:call:resolved` | Сервер → Клиент | Вызов обработан |
| `waiter:seated` | Сервер → Клиент | Гости посажены |
| `table:status` | Сервер → Клиент | Изменение статуса стола |
| `kitchen:chat` | Сервер → Клиент | Сообщение из чата кухни |

## Модель данных (таблицы)

### `dine_in_checks`

| Колонка | Тип | Описание |
|---------|-----|----------|
| id | INTEGER PK | |
| table_id | INTEGER | ID стола |
| table_name | TEXT | Название стола |
| waiter_id | INTEGER | ID официанта |
| waiter_name | TEXT | Имя официанта |
| guest_count | INTEGER | Количество гостей |
| status | TEXT | `open` / `closed` |
| created_at | TEXT | |
| updated_at | TEXT | |

### `orders` (доп. поля для dine-in)

| Колонка | Тип | Описание |
|---------|-----|----------|
| check_id | INTEGER | ID чека (dine_in_checks) |
| waiter_id | INTEGER | ID официанта |
| waiter_name | TEXT | Имя официанта |
| guest_count | INTEGER | Количество гостей |
| table_number | INTEGER | Номер стола |
| payment_method | TEXT | Способ оплаты |
| bonus_used | REAL | Использовано бонусов |
| discount | REAL | Скидка |
| discount_type | TEXT | `percent` / `fixed` |

### `waiter_calls`

| Колонка | Тип | Описание |
|---------|-----|----------|
| id | INTEGER PK | |
| table_id | INTEGER | ID стола |
| table_name | TEXT | Название стола |
| note | TEXT | Примечание |
| created_at | TEXT | |
| resolved_at | TEXT | Когда обработан |
| resolved_by | INTEGER | ID официанта |

### `booking_tables`

| Колонка | Тип | Описание |
|---------|-----|----------|
| id | INTEGER PK | |
| branch_id | INTEGER | ID ресторана |
| name | TEXT | Название (например "Стол 5") |
| capacity | INTEGER | Вместимость |
| zone | TEXT | Зона (Зал, Веранда, VIP) |
| x | REAL | Координата X на схеме |
| y | REAL | Координата Y на схеме |
| status | TEXT | `free` / `occupied` / `reserved` |
| shape | TEXT | `circle` / `rectangle` |
| width | INTEGER | Ширина на схеме |
| height | INTEGER | Высота на схеме |

## Статусы заказов (dine-in flow)

```
new → confirmed → preparing → ready → served → paid → closed
                                      → assigned → en_route → delivered
```

- **new** — только что создан официантом
- **confirmed** — принят системой (автоматически)
- **preparing** — готовится на кухне
- **ready** — все блюда готовы
- **served** — подано официантом гостям
- **paid** — оплачено
- **closed** — закрыт / стол свободен
- **assigned** — назначен курьер (для доставки)
- **en_route** — курьер в пути
- **delivered** — доставлен

## Инструкция по сборке

### Web-версия (для тестирования в браузере)

```bash
# Установка зависимостей
npm install

# Запуск сервера
node server/index.js

# Запуск дев-сервера официанта (отдельный терминал)
npm run dev:waiter
# Открыть http://localhost:5174
```

### Android (Capacitor)

```bash
# 1. Собрать waiter
npm run build:waiter

# 2. Установить Capacitor CLI (если ещё нет)
npm install -g @capacitor/cli

# 3. Инициализировать Capacitor для waiter (если первый раз)
npx cap init --config capacitor.waiter.config.ts

# 4. Добавить Android-платформу
npx cap add android --config capacitor.waiter.config.ts

# 5. Скопировать web-сборку в Android-проект
npx cap copy --config capacitor.waiter.config.ts

# 6. Открыть в Android Studio для сборки APK
npx cap open android --config capacitor.waiter.config.ts

# 7. В Android Studio: Build → Build Bundle(s) / APK(s)
```

### Требования для Android-сборки

- Android Studio Hedgehog (2023.1.1) или новее
- Android SDK 34+
- Gradle 8.2+
- Min SDK: 24 (Android 7.0)
- Target SDK: 34 (Android 14)

### Плагины Capacitor (установить при необходимости)

```bash
npm install @capacitor/local-notifications
npm install @capacitor/splash-screen
npm install @capacitor/filesystem
npx cap sync --config capacitor.waiter.config.ts
```

## Примеры API-запросов

### Логин официанта

```bash
curl -X POST http://localhost:4000/api/staff/login \
  -H "Content-Type: application/json" \
  -d '{"username": "waiter1", "password": "demo123"}'
```

### Получить столы

```bash
curl http://localhost:4000/api/waiter/tables
```

### Посадить гостей

```bash
curl -X POST http://localhost:4000/api/waiter/seated \
  -H "Content-Type: application/json" \
  -d '{"tableId": 5, "waiterId": 1, "waiterName": "Анна", "guestCount": 3}'
```

### Создать заказ (в зале)

```bash
curl -X POST http://localhost:4000/api/waiter/orders \
  -H "Content-Type: application/json" \
  -d '{
    "tableId": 5,
    "waiterId": 1,
    "waiterName": "Анна",
    "items": [
      {"dishId": 10, "name": "Цезарь", "price": 450, "quantity": 2, "options": ["без соуса"]},
      {"dishId": 15, "name": "Борщ", "price": 320, "quantity": 1}
    ],
    "guestCount": 3
  }'
```

### Создать заказ (доставка)

```bash
curl -X POST http://localhost:4000/api/waiter/orders \
  -H "Content-Type: application/json" \
  -d '{
    "tableId": 5,
    "waiterId": 1,
    "waiterName": "Анна",
    "items": [{"dishId": 10, "name": "Пицца", "price": 650, "quantity": 1}],
    "type": "delivery",
    "deliveryName": "Иван",
    "deliveryPhone": "+79991234567",
    "deliveryAddress": "ул. Ленина, д.10, кв.5"
  }'
```

### Принять оплату

```bash
curl -X POST http://localhost:4000/api/orders/42/payment \
  -H "Content-Type: application/json" \
  -d '{"paymentMethod": "card", "amount": 1250, "isPaid": true}'
```

### Разделить заказ

```bash
curl -X POST http://localhost:4000/api/orders/42/split \
  -H "Content-Type: application/json" \
  -d '{"items": [0, 2]}'
```

### Позвать официанта

```bash
curl -X POST http://localhost:4000/api/waiter/call \
  -H "Content-Type: application/json" \
  -d '{"tableId": 5}'
```

### Чат с кухней

```bash
curl -X POST http://localhost:4000/api/kitchen/chat \
  -H "Content-Type: application/json" \
  -d '{"id": 123, "from": "waiter", "text": "Замените картофель на рис", "orderId": 42}'
```

### Переместить гостей

```bash
curl -X POST http://localhost:4000/api/waiter/move-guests \
  -H "Content-Type: application/json" \
  -d '{"fromTableId": 5, "toTableId": 8}'
```

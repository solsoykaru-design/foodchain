# FoodChain — Партнёрский портал

Портал для сдачи системы автоматизации ресторана в аренду (SaaS).
Клиенты регистрируются, выбирают тариф, оплачивают подписку и получают доступ к админ-панели.

## Архитектура

```
portal/
├── backend/          # Node.js + Express API (порт 4001)
│   ├── src/
│   │   ├── index.js          # Точка входа
│   │   ├── config.js         # Конфигурация
│   │   ├── db.js             # Подключение к PostgreSQL
│   │   ├── migrate.js        # Миграции
│   │   ├── middleware/
│   │   │   └── auth.js       # JWT-аутентификация
│   │   ├── routes/
│   │   │   ├── auth.js       # Регистрация, логин, refresh
│   │   │   ├── tariffs.js    # Публичные тарифы
│   │   │   ├── tenants.js    # Управление рестораном
│   │   │   ├── payments.js   # Платежи и счета
│   │   │   ├── staff.js      # Сотрудники ресторана
│   │   │   └── admin.js      # Суперадмин
│   │   └── migrations/
│   │       └── 001_initial.sql
│   ├── Dockerfile
│   └── package.json
├── frontend/         # React + Vite + Tailwind (порт 5175 / 80)
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── api/client.ts     # HTTP-клиент с JWT refresh
│   │   ├── store/auth.tsx    # Auth context
│   │   ├── components/       # Header, Footer, Layout
│   │   └── pages/
│   │       ├── Home.tsx            # Лендинг
│   │       ├── Tariffs.tsx         # Тарифы
│   │       ├── Login.tsx           # Вход
│   │       ├── Register.tsx        # Регистрация
│   │       ├── Dashboard.tsx       # Дашборд партнёра
│   │       ├── StaffAccounts.tsx   # Управление сотрудниками
│   │       ├── Subscription.tsx    # Подписка / смена тарифа
│   │       ├── Payments.tsx        # Платежи и счета
│   │       ├── AdminTenants.tsx    # Суперадмин: рестораны
│   │       └── AdminTariffs.tsx    # Суперадмин: тарифы
│   ├── Dockerfile
│   ├── nginx.conf
│   ├── vite.config.ts
│   └── package.json
├── docker-compose.yml
└── README.md
```

## Быстрый запуск (локально)

### 1. База данных

```bash
# Убедитесь, что PostgreSQL запущен
createdb foodchain_portal

# Применить миграцию
cd portal/backend
npm install
npm run migrate
```

### 2. Backend

```bash
cd portal/backend
npm install
npm run dev
# API на http://localhost:4001
```

### 3. Frontend

```bash
cd portal/frontend
npm install
npm run dev
# Портал на http://localhost:5175
```

### 4. Создать суперадмина

```bash
# Подключитесь к БД и выполните:
INSERT INTO users (email, password_hash, full_name, role, email_verified)
VALUES (
  'admin@foodchain.ru',
  '$2b$12$...',  # сгенерируйте через bcrypt или через API/register
  'Super Admin',
  'superadmin',
  true
);
```

Либо зарегистрируйтесь через форму → поменяйте role вручную в БД.

## Запуск через Docker Compose

```bash
cd portal
docker-compose up -d
# Портал на http://localhost:5175
```

## API эндпоинты

| Метод | Путь | Описание |
|-------|------|----------|
| POST | /api/auth/register | Регистрация нового ресторана |
| POST | /api/auth/login | Вход |
| POST | /api/auth/refresh | Обновление токена |
| POST | /api/auth/logout | Выход |
| GET  | /api/auth/me | Текущий пользователь |
| GET  | /api/tariffs | Список тарифов |
| GET  | /api/tenants/my | Данные ресторана |
| PUT  | /api/tenants/my | Обновление ресторана |
| POST | /api/tenants/my/change-tariff | Смена тарифа |
| GET  | /api/tenants/my/stats | Статистика |
| GET  | /api/payments | Платежи |
| GET  | /api/payments/invoices | Счета |
| POST | /api/payments/create | Создать платёж |
| POST | /api/payments/:id/confirm | Подтвердить платёж |
| GET  | /api/staff | Сотрудники ресторана |
| POST | /api/staff | Создать сотрудника |
| PUT  | /api/staff/:id | Обновить сотрудника |
| DELETE | /api/staff/:id | Удалить сотрудника |
| GET  | /api/admin/tenants | [SUPERADMIN] Список ресторанов |
| GET  | /api/admin/tenants/:id | [SUPERADMIN] Ресторан |
| PATCH | /api/admin/tenants/:id/status | [SUPERADMIN] Статус |
| POST | /api/admin/tenants | [SUPERADMIN] Создать ресторан |
| GET  | /api/admin/stats | [SUPERADMIN] Статистика |
| GET  | /api/admin/audit | [SUPERADMIN] Логи |
| GET  | /api/admin/tariffs | [SUPERADMIN] Тарифы |
| POST | /api/admin/tariffs | [SUPERADMIN] Создать тариф |
| PUT  | /api/admin/tariffs/:id | [SUPERADMIN] Обновить тариф |

## Multi-tenant схема

Каждый ресторан (tenant) изолирован на уровне запросов:
- В JWT-токене хранится `tenantId`
- Middleware проверяет доступ пользователя к своему tenant
- Суперадмин имеет доступ ко всем tenant'ам
- Для tenant-специфичных БД используется отдельная PostgreSQL схема или база данных

# Модуль онлайн-оплаты

## Архитектура

```
server/payment/
├── index.js                  # Главный модуль: инициализация БД, маршруты, webhook
└── providers/
    ├── yookassa.js           # Провайдер ЮKassa (Яндекс.Касса)
    ├── cloudpayments.js      # Провайдер CloudPayments
    └── tbank.js              # Провайдер Т-Банк (Т-Касса)
```

### Поддерживаемые платёжные системы

| Провайдер | Карты | СБП | Apple Pay | Google Pay | Возвраты |
|-----------|-------|-----|-----------|------------|----------|
| **ЮKassa** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **CloudPayments** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Т-Банк (Т-Касса)** | ✅ | ✅ | ❌ | ❌ | ✅ |

### Единый интерфейс провайдера

Каждый провайдер реализует методы:
- `createPayment(params)` — создание платежа, возвращает ссылку на оплату
- `confirmPayment(paymentId, credentials)` — подтверждение платежа
- `getPaymentStatus(paymentId, credentials)` — получение статуса
- `refundPayment(paymentId, amount, credentials)` — возврат
- `verifyWebhookSignature(req, credentials)` — проверка подписи webhook
- `normalizeWebhookEvent(req)` — нормализация входящего события

## Эндпониты API

### Платежи

| Метод | Путь | Описание |
|-------|------|----------|
| POST | `/api/payment/create` | Создание платежа |
| POST | `/api/payment/confirm` | Подтверждение платежа |
| GET | `/api/payment/status/:id` | Статус платежа (по internal или external ID) |
| POST | `/api/payment/refund` | Возврат платежа |
| POST | `/api/webhooks/payment` | Универсальный webhook от платёжных систем |

### Администрирование

| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/api/admin/payment/settings` | Настройки платёжных провайдеров |
| PUT | `/api/admin/payment/settings/:provider` | Обновление настроек провайдера |
| GET | `/api/admin/payments` | Список всех платежей (с фильтрами и пагинацией) |
| GET | `/api/active-payment-methods` | Активные методы оплаты для гостевого приложения |

### Тарифы и подписки

| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/api/tariffs` | Список активных тарифов |
| POST | `/api/admin/tariffs` | Создание тарифа |
| PUT | `/api/admin/tariffs/:id` | Редактирование тарифа |
| DELETE | `/api/admin/tariffs/:id` | Удаление тарифа |
| GET | `/api/subscriptions` | Подписки арендатора |
| POST | `/api/subscriptions/create` | Создание подписки |
| PUT | `/api/subscriptions/:id` | Обновление подписки |

## Поток оплаты заказа

1. Гость оформляет заказ, выбирает `Онлайн-оплата (карта)` или `Онлайн-оплата (СБП)`
2. Система создаёт заказ (POST `/api/orders`), затем создаёт платёж (POST `/api/payment/create`)
3. Платёжная система возвращает `confirmationUrl` — ссылку на виджет оплаты
4. Гостя перенаправляют на страницу оплаты (iframe/redirect)
5. После оплаты платёжная система отправляет webhook на `POST /api/webhooks/payment`
6. Система обновляет статус платежа и, при успехе, меняет статус заказа на `paid`
7. Гость перенаправляется на страницу успеха

## Примеры запросов

### Создание платежа (ЮKassa)

```json
POST /api/payment/create
Content-Type: application/json

{
  "orderId": 123,
  "amount": 1500.00,
  "description": "Заказ #123",
  "returnUrl": "https://myrestaurant.ru/order-success",
  "paymentMethod": "card",
  "provider": "yookassa",
  "tenantId": 1
}
```

**Ответ:**
```json
{
  "ok": true,
  "paymentId": "pay_abc123...",
  "externalPaymentId": "2a3b4c5d-...",
  "confirmationUrl": "https://yookassa.ru/payment/...",
  "status": "pending",
  "error": null
}
```

### Создание платежа (СБП через Т-Банк)

```json
POST /api/payment/create
Content-Type: application/json

{
  "orderId": 124,
  "amount": 890.00,
  "description": "Заказ #124",
  "returnUrl": "https://myrestaurant.ru/order-success",
  "paymentMethod": "sbp",
  "provider": "tbank",
  "tenantId": 1
}
```

## Примеры webhook-запросов

### ЮKassa — уведомление об успешной оплате

```json
POST /api/webhooks/payment
X-Provider: yookassa
Content-Type: application/json

{
  "event": "payment.succeeded",
  "object": {
    "id": "2a3b4c5d-...",
    "status": "succeeded",
    "amount": {
      "value": "1500.00",
      "currency": "RUB"
    },
    "metadata": {
      "paymentId": "pay_abc123...",
      "orderId": 123
    }
  }
}
```

### CloudPayments — уведомление об оплате

```json
POST /api/webhooks/payment
X-Provider: cloudpayments
Content-Type: application/json
Content-Hmac: <sha256-signature>

{
  "EventType": "Completed",
  "Data": {
    "TransactionId": 123456,
    "Amount": 1500.00,
    "Currency": "RUB",
    "JsonData": {
      "paymentId": "pay_def456...",
      "orderId": 125
    }
  }
}
```

### Т-Банк — уведомление об оплате

```json
POST /api/webhooks/payment
X-Provider: tbank
Content-Type: application/json

{
  "PaymentId": 987654,
  "Status": "CONFIRMED",
  "Amount": 150000,
  "OrderId": "126",
  "Success": true,
  "DATA": {
    "paymentId": "pay_ghi789...",
    "orderId": 126
  }
}
```

## Настройка провайдеров

### ЮKassa

1. Зарегистрируйтесь в [ЮKassa](https://yookassa.ru/)
2. В личном кабинете создайте магазин, получите `shopId` и `secretKey`
3. В админ-панели FoodChain: «Финансы» → «Платежи онлайн» → настройте ЮKassa
4. Укажите webhook URL: `https://your-server.com/api/webhooks/payment` с заголовком `X-Provider: yookassa`

### CloudPayments

1. Зарегистрируйтесь в [CloudPayments](https://cloudpayments.ru/)
2. Получите `PublicId` и `ApiSecret`
3. В админ-панели настройте CloudPayments
4. Укажите webhook URL: `https://your-server.com/api/webhooks/payment` с заголовком `X-Provider: cloudpayments`

### Т-Банк (Т-Касса)

1. Подключите [Т-Кассу](https://www.tbank.ru/kassa/) в личном кабинете Т-Банка
2. Получите `TerminalKey` и `SecretKey`
3. В админ-панели настройте Т-Банк
4. Укажите webhook URL: `https://your-server.com/api/webhooks/payment` с заголовком `X-Provider: tbank`

### Тестовый режим

Все провайдеры поддерживают тестовый режим (песочницу). В админ-панели переключатель `test_mode` включает его. В тестовом режиме используются тестовые API-URL и платёжные данные провайдеров.

## Маппинг статусов

| Внутренний статус | ЮKassa | CloudPayments | Т-Банк |
|-------------------|--------|---------------|--------|
| `pending` | `waiting_for_capture` | `Authorized` | `AUTHORIZED` |
| `succeeded` | `succeeded` | `Completed` | `CONFIRMED` |
| `canceled` | `canceled` | `Cancelled` | `CANCELED` |
| `refunded` | `refunded` | `Refund` | `REVERSED` / `REFUNDED` |

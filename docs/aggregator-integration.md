# Модуль интеграции с агрегаторами доставки

## Архитектура

```
server/aggregator-integration/
├── index.js                 # Главный модуль: инициализация БД, маршруты, webhook
└── providers/
    ├── yandex.js            # Провайдер Яндекс Еда
    ├── delivery-club.js     # Провайдер Delivery Club
    └── sbermarket.js        # Провайдер СберМаркет
```

### Принцип работы

1. **Синхронизация меню**: При вызове `POST /api/admin/integrations/aggregators/:provider/sync-menu` система собирает все блюда, категории и модификаторы из БД, формирует JSON по спецификации агрегатора и отправляет через API.

2. **Приём заказов**: Агрегаторы отправляют webhook на `POST /api/webhooks/aggregator`. Заголовок `X-Provider` определяет, какой провайдер обрабатывает запрос. Система парсит заказ и создаёт его во внутренней БД с `source = 'external'`.

3. **Обновление статусов**: При изменении статуса заказа в системе (через `PATCH /api/orders/:id/status`) автоматически отправляется PUT-запрос агрегатору, если заказ внешний.

4. **Модульность**: Каждый провайдер реализует единый интерфейс:
   - `testConnection(credentials)` — проверка соединения
   - `syncMenu(tenantId, credentials, db)` — выгрузка меню
   - `parseOrder(payload)` — парсинг входящего webhook
   - `updateStatus(order, externalOrderId, status, credentials)` — обновление статуса
   - `mapStatusFromExternal(externalStatus)` — маппинг внешнего статуса во внутренний

## Эндпоинты API

### Управление интеграцией (админ-панель)

| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/api/admin/integrations/aggregators` | Список всех провайдеров с настройками |
| GET | `/api/admin/integrations/aggregators/:provider` | Настройки конкретного провайдера |
| PUT | `/api/admin/integrations/aggregators/:provider` | Сохранение настроек провайдера |
| POST | `/api/admin/integrations/aggregators/:provider/test` | Проверка соединения |
| POST | `/api/admin/integrations/aggregators/:provider/sync-menu` | Выгрузка меню |
| POST | `/api/admin/integrations/aggregators/:provider/sync-statuses` | Принудительная синхронизация статусов |
| GET | `/api/admin/integrations/aggregators/:provider/logs` | Лог операций (пагинация, фильтры) |

### Webhook

| Метод | Путь | Описание |
|-------|------|----------|
| POST | `/api/webhooks/aggregator` | Универсальный webhook от агрегаторов |

## Примеры webhook-запросов

### Яндекс Еда — новый заказ

```json
POST /api/webhooks/aggregator
X-Provider: yandex
Content-Type: application/json

{
  "event": "order",
  "order": {
    "id": "12345-abcde",
    "total": 199000,
    "delivery_fee": 9900,
    "comment": "Побыстрее, пожалуйста",
    "customer": {
      "name": "Иван Иванов",
      "phone": "+79001234567"
    },
    "address": {
      "city": "Москва",
      "street": "Тверская",
      "house": "1",
      "apartment": "42",
      "entrance": "2",
      "floor": "5"
    },
    "items": [
      {
        "id": "menu_item_001",
        "name": "Бургер с говядиной",
        "price": 89000,
        "quantity": 2
      },
      {
        "id": "menu_item_002",
        "name": "Картошка фри",
        "price": 49000,
        "quantity": 1,
        "modifiers": [
          { "name": "Большая порция" }
        ]
      }
    ]
  }
}
```

### Delivery Club — новый заказ

```json
POST /api/webhooks/aggregator
X-Provider: delivery_club
Content-Type: application/json

{
  "event": "order:new",
  "order": {
    "id": "DC-98765",
    "total": 1250,
    "productsCost": 990,
    "deliveryCost": 260,
    "comment": "",
    "client": {
      "name": "Пётр Петров",
      "phone": "+79123456789"
    },
    "deliveryAddress": {
      "city": "Москва",
      "street": "Арбат",
      "house": "10",
      "apartment": "15"
    },
    "items": [
      {
        "id": "prod_001",
        "name": "Пицца Маргарита",
        "price": 650,
        "quantity": 1
      }
    ],
    "paymentType": "card"
  }
}
```

### СберМаркет — новый заказ

```json
POST /api/webhooks/aggregator
X-Provider: sbermarket
Content-Type: application/json

{
  "event": "order",
  "order": {
    "id": "SM-555000",
    "total": 2340,
    "itemsCost": 2100,
    "deliveryCost": 240,
    "note": "Позвонить за 15 минут",
    "customer": {
      "name": "Сергей Сергеев",
      "phone": "+79223334455"
    },
    "deliveryAddress": {
      "city": "Москва",
      "street": "Ленина",
      "house": "20",
      "apartment": "7"
    },
    "items": [
      {
        "id": "ext_prod_333",
        "title": "Салат Цезарь",
        "price": 580,
        "quantity": 1,
        "modifications": [
          { "title": "Добавить креветки" }
        ]
      }
    ],
    "paymentMethod": "card"
  }
}
```

### Обновление статуса заказа (от агрегатора)

```json
POST /api/webhooks/aggregator
X-Provider: yandex
Content-Type: application/json

{
  "event": "order:status",
  "orderId": "12345-abcde",
  "status": "DELIVERED"
}
```

## Ответы системы

### Успешный приём заказа

```json
HTTP/1.1 201 Created

{
  "ok": true,
  "orderId": 150,
  "externalOrderId": "12345-abcde"
}
```

### Ошибка (неизвестный провайдер)

```json
HTTP/1.1 400 Bad Request

{
  "error": "Провайдер \"unknown\" не поддерживается"
}
```

### Ошибка (интеграция не активна)

```json
HTTP/1.1 403 Forbidden

{
  "error": "Интеграция не активна"
}
```

## Маппинг статусов

### Яндекс Еда

| Внутренний статус | Внешний статус |
|-------------------|----------------|
| `confirmed` | `CONFIRMED` |
| `preparing` | `COOKING` |
| `ready` | `READY` |
| `assigned` | `DELIVERING` |
| `en_route` | `DELIVERING` |
| `delivered` | `DELIVERED` |
| `cancelled` | `CANCELLED` |

### Delivery Club

| Внутренний статус | Внешний статус |
|-------------------|----------------|
| `confirmed` | `ACCEPTED` |
| `preparing` | `PREPARING` |
| `ready` | `READY_FOR_DELIVERY` |
| `assigned` | `WITH_COURIER` |
| `en_route` | `DELIVERING` |
| `delivered` | `DELIVERED` |
| `cancelled` | `CANCELLED` |

### СберМаркет

| Внутренний статус | Внешний статус |
|-------------------|----------------|
| `confirmed` | `ACCEPTED` |
| `preparing` | `COOKING` |
| `ready` | `PACKED` |
| `assigned` | `TRANSFERRED_TO_DELIVERY` |
| `en_route` | `DELIVERING` |
| `delivered` | `DELIVERED` |
| `cancelled` | `CANCELLED` |

## Настройка агрегаторов

### Яндекс Еда

1. Зайдите в личный кабинет партнёра Яндекс Еды https://partner.eda.yandex.ru/
2. Получите API-ключ в разделе «Интеграция» → «API»
3. В админ-панели FoodChain: «Настройки» → «Агрегаторы доставки» → «Яндекс Еда»
4. Введите:
   - **API Key**: ключ из личного кабинета
   - **API Secret**: секретный ключ
   - **ID ресторана (Place ID)**: ID вашего заведения
   - **ID кампании**: ID рекламной кампании

### Delivery Club

1. Зайдите в личный кабинет Delivery Club https://partner.delivery-club.ru/
2. Получите API-ключ в разделе «Настройки API»
3. В админ-панели FoodChain: «Настройки» → «Агрегаторы доставки» → «Delivery Club»
4. Введите:
   - **API Key**: ключ из личного кабинета
   - **API Secret**: секретный ключ
   - **ID ресторана**: ID вашего заведения

### СберМаркет

1. Зайдите в личный кабинет СберМаркет https://partner.sbermarket.ru/
2. Получите API-ключ в разделе «Разработчикам»
3. В админ-панели FoodChain: «Настройки» → «Агрегаторы доставки» → «СберМаркет»
4. Введите:
   - **API Key**: ключ из личного кабинета
   - **Client ID**: идентификатор клиента
   - **ID магазина**: ID вашего магазина

### Настройка webhook

Для получения заказов от агрегатора, укажите в личном кабинете агрегатора URL webhook:

```
http://your-server.com/api/webhooks/aggregator
```

Для каждого агрегатора укажите соответствующий заголовок:
- Яндекс Еда: `X-Provider: yandex`
- Delivery Club: `X-Provider: delivery_club`
- СберМаркет: `X-Provider: sbermarket`

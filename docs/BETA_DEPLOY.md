# Развёртывание FoodChain для бета-тестирования

Это руководство позволяет поднять бета-стенд FoodChain на VPS за 15 минут.

## Что понадобится

- VPS: 2 CPU / 4 GB RAM / 40 GB SSD (Ubuntu 22.04/24.04).
- Домен, направленный на сервер.
- Docker + Docker Compose на сервере.
- Git репозиторий с текущим кодом.

## Быстрый старт

### 1. Клонирование и сборка

```bash
git clone <repo-url> foodchain-beta
cd foodchain-beta
npm install
cd server && npm install && cd ..

# Собрать фронтенды
npm run build:admin
npm run build:pos
npm run build:manager
npm run build:kitchen
npm run build:waiter
npm run build:courier
npm run build:guest
npm run build:website
npm run build:kiosk
npm run build:techcard
```

### 2. Запуск Docker Compose

```bash
docker compose up -d --build
```

По умолчанию:
- API: `http://<ip>:4000`
- Admin/POS/Manager static: `http://<ip>:80`

### 3. Первая настройка

Откройте Admin по адресу сервера:
- Создайте первый тенант/филиал.
- Настройте ставки НДС, валюту, способы оплаты.
- Добавьте меню, сотрудников, столы.

### 4. HTTPS (рекомендуется)

Используйте Nginx + Certbot:

```bash
sudo apt install nginx certbot python3-certbot-nginx
```

Пример конфига `/etc/nginx/sites-available/foodchain`:

```nginx
server {
    listen 80;
    server_name beta.foodchain.example;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name beta.foodchain.example;

    ssl_certificate /etc/letsencrypt/live/beta.foodchain.example/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/beta.foodchain.example/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:80;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:4000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/foodchain /etc/nginx/sites-enabled/
sudo certbot --nginx -d beta.foodchain.example
sudo systemctl reload nginx
```

### 5. Резервное копирование

База данных и загрузки хранятся в `server/foodchain.db` и `server/uploads/`.

```bash
# Ежедневный бэкап через cron
0 3 * * * /usr/bin/docker cp foodchain-beta-api-1:/app/foodchain.db /backup/foodchain-$(date +\%Y\%m\%d).db
```

### 6. Обновление бета-стенда

```bash
cd foodchain-beta
git pull origin master
npm install
cd server && npm install && cd ..

# Пересобрать фронтенды
npm run build:admin
npm run build:pos
npm run build:manager
# ... остальные при необходимости

docker compose down
docker compose up -d --build
```

## Окружение

При необходимости создайте файл `.env` в корне:

```env
# Supabase (необязательно для локальной бета-версии)
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=

# Telegram-бот (необязательно)
TELEGRAM_BOT_TOKEN=
```

## Что тестировать в бете

1. **POS**: открытие смены, создание заказа, оплата, фискализация.
2. **Кухня**: приём заказов, статусы блюд, экран готовности.
3. **Склад**: инвентаризация, списание, заказ поставщику.
4. **Manager**: вход, дашборд, уведомления, offline-режим.
5. **Аналитика**: сетевые отчёты, P&L, фудкост.
6. **Маркетинг**: реферальная программа, промокоды, рассылки.

## Рекомендации по безопасности

- Закройте порты 4000 и 80 для внешнего мира, оставьте только 443.
- Используйте сложные пароли для администраторов.
- Включите автообновление ОС.
- Храните бэкапы на отдельном диске/S3.

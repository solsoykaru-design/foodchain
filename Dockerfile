FROM node:20-alpine AS build
WORKDIR /app

# Install build dependencies
RUN apk add --no-cache python3 make g++

# Root package
COPY package*.json ./
RUN npm install

# Server package
COPY server/package*.json ./server/
WORKDIR /app/server
RUN npm install --production
WORKDIR /app

# Portal-backend package
COPY server/portal-backend/package*.json ./server/portal-backend/
WORKDIR /app/server/portal-backend
RUN npm install --production
WORKDIR /app

# Copy source
COPY server/ ./server/
COPY main.cjs ./

# Copy frontend builds (skip if not exists)
RUN for dir in dist-admin dist-manager dist-guest dist-waiter dist-courier dist-kitchen dist-techcard dist-kiosk dist-website portal; do \
      if [ -d "$dir" ]; then mkdir -p /app/$dir && cp -r $dir/* /app/$dir/ 2>/dev/null || true; fi; \
    done

# Runtime image
FROM node:20-alpine
WORKDIR /app

ENV DATA_DIR=/data
ENV PORT=10000
ENV NODE_ENV=production

COPY --from=build /app /app

# Create data directory for persistent storage
RUN mkdir -p /data

EXPOSE 10000

CMD ["node", "server/index.js"]

FROM node:22-alpine AS builder
WORKDIR /app

# Install system deps for native modules
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package*.json ./
COPY server/package.json server/
COPY portal/backend/package.json portal/backend/
COPY portal/frontend/package.json portal/frontend/

# Install all dependencies
RUN npm install
RUN cd server && npm install
RUN cd portal/frontend && npm install
RUN cd portal/backend && npm install

# Copy source code for SPAs
COPY vite.config.ts tsconfig*.json ./
COPY index.html ./
COPY src/ src/
COPY public/ public/

# Build all SPAs (use ENV because 'set' is Windows-only)
RUN VITE_APP=website npm run build:website
RUN VITE_APP=guest npm run build:guest
RUN VITE_APP=courier npm run build:courier
RUN VITE_APP=admin npm run build:admin
RUN VITE_APP=waiter npm run build:waiter
RUN VITE_APP=kitchen npm run build:kitchen

# Build portal frontend
COPY portal/frontend/ portal/frontend/
RUN cd portal/frontend && npm run build

FROM node:22-alpine
WORKDIR /app
RUN apk add --no-cache tini

# Copy node_modules (production only)
COPY --from=builder /app/node_modules node_modules/
COPY --from=builder /app/server/node_modules server/node_modules/
COPY --from=builder /app/portal/backend/node_modules portal/backend/node_modules/

# Copy server code
COPY server/ server/

# Copy portal backend code & migrations
COPY portal/backend/src/ portal/backend/src/
COPY portal/backend/package.json portal/backend/

# Copy built dists
COPY --from=builder /app/dist-website dist-website/
COPY --from=builder /app/dist-guest dist-guest/
COPY --from=builder /app/dist-courier dist-courier/
COPY --from=builder /app/dist-admin dist-admin/
COPY --from=builder /app/dist-waiter dist-waiter/
COPY --from=builder /app/dist-kitchen dist-kitchen/
COPY --from=builder /app/portal/frontend/dist portal/frontend/dist/

# .env example (user must mount real .env or set env vars)
COPY .env.example .env

EXPOSE 4000
ENV NODE_ENV=production
ENV PORTAL_MOUNTED=true

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "server/index.js"]

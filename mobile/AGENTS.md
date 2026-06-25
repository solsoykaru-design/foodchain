# Expo v56

Read the exact versioned docs at https://docs.expo.dev/versions/v56.0.0/ before writing any code.

## Production Build & Deploy

### 1. Environment Setup
```bash
# Copy env and configure
cp .env.example .env
# Edit .env with your server URL
```

### 2. Install Dependencies
```bash
npm install --legacy-peer-deps
```

### 3. Build APK (Android)
```bash
# For development
npx expo start

# Build Android APK
npx expo run:android

# For production release
npx eas build --platform android --profile production
```

### 4. Build IPA (iOS)
```bash
# Build iOS
npx expo run:ios

# Production release
npx eas build --platform ios --profile production
```

### 5. Payment Integration (СБП)
1. Register as a merchant with a bank that supports SBP (Сбербанк, Т-Банк, Точка)
2. Get merchant ID and API credentials
3. Update `.env` variables
4. For QR generation, integrate `@qrexpress/sbp-c2b` or bank's native SDK

### 6. Push Notifications (Firebase)
```bash
npm install expo-notifications
# Configure Firebase project and add google-services.json (Android)
# Add GoogleService-Info.plist (iOS)
```

### 7. Voice Recognition
```bash
npm install @react-native-voice/voice
# Add permissions to AndroidManifest.xml and Info.plist
```

### 8. App Store Metadata
Use the marketing texts in `docs/mobile-store.md` for App Store and Google Play descriptions.

## Project Structure
```
mobile/
├── app/
│   ├── (auth)/          # Login, SMS verify, profile setup
│   ├── (tabs)/          # Home, Catalog, Profile
│   ├── card/[id].tsx    # Tech card detail + PDF/print/share
│   ├── create/          # Voice, by-name, manual creation
│   ├── payment/         # SBP payment with QR
│   ├── subscription/    # Tariff selection
│   ├── save.tsx         # Edit & save tech card
│   └── _layout.tsx      # Root + AuthProvider
├── components/          # Reusable UI components
├── services/
│   ├── api.ts           # HTTP client + auth token
│   ├── auth.tsx         # Auth context + token persistence
│   ├── pdf.ts           # PDF generation (expo-print)
│   ├── share.ts         # Share/print via system dialog
│   ├── voice.ts         # Voice recognition (native + web fallback)
│   ├── payment.ts       # SBP payment helpers
│   └── notifications.ts # Push notifications
└── AGENTS.md
```

## API Endpoints (Backend)
All mobile endpoints are prefixed with `/api/mobile/`:
- `POST /auth/send-code` - Send SMS code
- `POST /auth/verify` - Login/register with code
- `GET|PUT /profile` - User profile
- `GET /tariffs` - Available tariffs
- `GET /check-access` - Check subscription status
- `POST /trial` - Activate 7-day trial
- `POST /payments/create` - Create SBP payment
- `GET /payments/:id/status` - Check payment status
- `POST /payments/webhook` - Payment confirmation
- `GET|POST /tech-cards` - CRUD tech cards
- `POST /ai-generate` - AI tech card generation
- `POST /push/register` - Register push token

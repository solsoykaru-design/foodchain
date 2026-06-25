import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.foodchain.techcard',
  appName: 'AI Техкарты',
  webDir: 'dist-techcard',
  server: {
    androidScheme: 'https',
  },
};

export default config;

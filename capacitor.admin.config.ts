import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.foodchain.admin',
  appName: 'FoodChain Admin',
  webDir: 'dist-admin',
  server: {
    androidScheme: 'https'
  }
};

export default config;

import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.foodchain.guest',
  appName: 'FoodChain',
  webDir: 'dist-guest',
  server: {
    androidScheme: 'https'
  }
};

export default config;

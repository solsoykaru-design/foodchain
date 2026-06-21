import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.foodchain.courier',
  appName: 'FoodChain Курьер',
  webDir: 'dist-courier',
  server: {
    androidScheme: 'https'
  }
};

export default config;

import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.foodchain.admin',
  appName: 'FoodChain Admin',
  webDir: 'dist-admin',
  server: {
    url: 'http://192.168.0.144:4000/admin',
    cleartext: true
  }
};

export default config;

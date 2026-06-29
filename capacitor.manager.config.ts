import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.foodchain.manager',
  appName: 'FoodChain Manager',
  webDir: 'dist-manager',
  server: {
    url: 'http://192.168.0.144:4000/manager',
    cleartext: true
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#2563EB',
      androidScaleType: 'CENTER_CROP',
    },
  },
};

export default config;

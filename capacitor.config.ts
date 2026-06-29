import { CapacitorConfig } from '@capacitor/cli';

const target = process.env.CAPACITOR_TARGET || 'guest';

const configs: Record<string, CapacitorConfig> = {
  guest: {
    appId: 'com.foodchain.guest',
    appName: 'FoodChain',
    webDir: 'dist-guest',
    server: { androidScheme: 'https' },
  },
  manager: {
    appId: 'com.foodchain.manager',
    appName: 'FoodChain Manager',
    webDir: 'dist-manager',
    android: { path: 'android-manager' },
    ios: { path: 'ios-manager' },
    server: {
      url: 'http://192.168.0.144:4000/manager',
      cleartext: true,
    },
    plugins: {
      SplashScreen: {
        launchShowDuration: 2000,
        backgroundColor: '#2563EB',
        androidScaleType: 'CENTER_CROP',
      },
    },
  },
};

export default configs[target] || configs.guest;

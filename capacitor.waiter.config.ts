import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.foodchain.waiter',
  appName: 'FoodChain Терминал',
  webDir: 'dist-waiter',
  server: {
    androidScheme: 'https',
    allowNavigation: ['*'],
  },
  android: {
    allowMixedContent: true,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#09090b',
    },
    LocalNotifications: {
      smallIcon: 'ic_stat_waiter',
      iconColor: '#f97316',
    },
  },
};

export default config;

import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'fit.motionhive.app',
  appName: 'MotionHive',
  webDir: 'dist/mobile/browser',
  plugins: {
    SplashScreen: {
      launchAutoHide: false,
    },
    Keyboard: {
      resize: 'body',
    },
  },
};

export default config;

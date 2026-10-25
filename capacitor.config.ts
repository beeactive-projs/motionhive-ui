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
    // The rest timer alert. Same icon and accent as pushes, set in the
    // Android manifest: android/app/src/main/res/drawable/ic_stat_motionhive.xml.
    LocalNotifications: {
      smallIcon: 'ic_stat_motionhive',
      iconColor: '#1e3a5f',
    },
    // The app icon number. The server sets it on every push and the app
    // resets it from live counts (AppBadgeService); a counter the plugin
    // restores on its own after a restart would only be a stale third copy.
    Badge: {
      persist: false,
    },
    // Google sign-in only. The others would bundle their SDKs (Facebook's
    // adds its own permissions); turning one on needs a `cap sync`.
    SocialLogin: {
      providers: {
        google: true,
        facebook: false,
        apple: false,
        twitter: false,
      },
    },
  },
};

export default config;

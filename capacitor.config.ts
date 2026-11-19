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
    // Google, Apple on iPhone, and Facebook. A flag decides whether the
    // provider's SDK is bundled, so changing one needs a `cap sync` (the
    // plugin's sync hook rewrites its Package.swift and gradle.properties).
    // Apple on iOS is the system's own framework, and the app offers it on
    // iOS only (AppleSignInService); on Android this flag only bundles
    // androidx.browser, which the plugin already compiles against.
    // Facebook bundles Meta's SDK on both platforms (FacebookSignInService).
    // Its native setup lives in ios/App/App/Info.plist, AppDelegate.swift,
    // SceneDelegate.swift and android/app/src/main/AndroidManifest.xml +
    // res/values/strings.xml, with event logging and the advertising id off;
    // turning it off again means taking the FBSDKCoreKit calls out of
    // AppDelegate.swift and SceneDelegate.swift, or the iOS build fails.
    SocialLogin: {
      providers: {
        google: true,
        facebook: true,
        apple: true,
        twitter: false,
      },
    },
  },
};

export default config;

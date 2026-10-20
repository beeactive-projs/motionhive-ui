/**
 * Mobile (Capacitor) staging environment: a production build against the
 * dev API. This is what the Play testing track ships (the `staging`
 * configuration, built by .github/workflows/android-play-internal.yml), so
 * testers exercise `develop` end to end without touching production data.
 *
 * `production: true` on purpose. Push registration only runs in production
 * builds (see PushRegistrationService), and the Play build has the Firebase
 * config it needs.
 *
 * A store release builds `production` instead (environment.mobile.ts).
 */
export const environment = {
  production: true,
  appUrl: 'https://dev.app.motionhive.fit',
  googleClientId: '119425399334-29l3eq2mo162t0vlh8qfoqgi2cg0djfp.apps.googleusercontent.com',
  // The mobile app's iOS OAuth client. Empty until it exists; the iOS app hides
  // its Google button without it.
  googleIosClientId: '',
  apiUrl: 'https://dev-motionhive-api-production.up.railway.app',
  // The dev web app, which reads the same dev database: a group invite or a
  // profile link made here only resolves there.
  webAppUrl: 'https://dev.app.motionhive.fit',
  websiteUrl: 'https://dev.motionhive.fit',
  facebookAppId: '888056193830836',
  primeUiLicenseKey:
    'eyJpZCI6IjhkZGJlNTZjLTY0YmYtNGM0YS1hZDEyLWE1NjYzYjU4YzdjOCIsInByb2R1Y3QiOiJwcmltZXVpIiwidGllciI6ImNvbW11bml0eSIsInR5cGUiOiJkZXYiLCJpYXQiOjE3ODU4MjY4MTEsImV4cCI6MTgxNzM2MjgxMX0.TUGio97ZwSoIbJ6rQN9HSAkM1TWMF2o0kTclcnb6hXOLHmSDzta2HVHU8X3yd-uTqYTXIcNGhY9ry9ZrsIEtCA',
};

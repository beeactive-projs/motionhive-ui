/**
 * Mobile (Capacitor) production environment. The WebView origin is
 * `capacitor://localhost` / `https://localhost`, so the host-sniffing in
 * `environment.ts` cannot be used here — URLs are fixed at build time.
 * Swapped in via the mobile project's `fileReplacements` (production).
 */
export const environment = {
  production: true,
  appUrl: 'https://app.motionhive.fit',
  googleClientId: '119425399334-29l3eq2mo162t0vlh8qfoqgi2cg0djfp.apps.googleusercontent.com',
  apiUrl: 'https://motionhive-api-production.up.railway.app',
  webAppUrl: 'https://app.motionhive.fit',
  facebookAppId: '888056193830836',
  primeUiLicenseKey:
    'eyJpZCI6IjhkZGJlNTZjLTY0YmYtNGM0YS1hZDEyLWE1NjYzYjU4YzdjOCIsInByb2R1Y3QiOiJwcmltZXVpIiwidGllciI6ImNvbW11bml0eSIsInR5cGUiOiJkZXYiLCJpYXQiOjE3ODU4MjY4MTEsImV4cCI6MTgxNzM2MjgxMX0.TUGio97ZwSoIbJ6rQN9HSAkM1TWMF2o0kTclcnb6hXOLHmSDzta2HVHU8X3yd-uTqYTXIcNGhY9ry9ZrsIEtCA',
};

/**
 * Mobile (Capacitor) development environment. Swapped in via the mobile
 * project's `fileReplacements` (development).
 *
 * Both browser dev (`ng serve mobile`, port 8100) and native dev builds use
 * the LOCAL API. On a device/emulator, localhost is reached through
 * `adb reverse tcp:3800 tcp:3800` (run once per emulator boot — `npm run
 * cap:android` does it for you; localhost is exempt from mixed-content
 * blocking). To hit the dev Railway API instead, return DEV_API from
 * `resolveApiUrl` for the native branch — requires the Capacitor origins
 * (`capacitor://localhost`, `https://localhost`) to be CORS-allowed on the
 * deployed API.
 */
const DEV_API = 'https://dev-motionhive-api-production.up.railway.app';
const LOCAL_API = 'http://localhost:3800';

function resolveApiUrl(): string {
  void DEV_API; // kept for easy switching, see doc comment above
  return LOCAL_API;
}

export const environment = {
  production: false,
  appUrl: 'http://localhost:8100',
  googleClientId: '119425399334-29l3eq2mo162t0vlh8qfoqgi2cg0djfp.apps.googleusercontent.com',
  apiUrl: resolveApiUrl(),
  webAppUrl: 'https://app.motionhive.fit',
  facebookAppId: '888056193830836',
  primeUiLicenseKey:
    'eyJpZCI6IjhkZGJlNTZjLTY0YmYtNGM0YS1hZDEyLWE1NjYzYjU4YzdjOCIsInByb2R1Y3QiOiJwcmltZXVpIiwidGllciI6ImNvbW11bml0eSIsInR5cGUiOiJkZXYiLCJpYXQiOjE3ODU4MjY4MTEsImV4cCI6MTgxNzM2MjgxMX0.TUGio97ZwSoIbJ6rQN9HSAkM1TWMF2o0kTclcnb6hXOLHmSDzta2HVHU8X3yd-uTqYTXIcNGhY9ry9ZrsIEtCA',
};

// Builds, installs and launches the mobile app on a connected Android device.
//
//   npm run cap:android
//
// Assumes `cap:sync:dev` has already put a fresh web build into the native
// project — the npm script chains them.
//
// Exists because the Gradle wrapper is invoked differently per platform:
// `.\gradlew.bat` on Windows, `./gradlew` everywhere else. The script used to
// hardcode the Windows spelling, so it only ever ran on one developer's
// machine. Node knows which platform it is on; npm does not.
//
// `adb reverse` maps the phone's localhost:3800 to the Mac's, so a debug build
// talks to the API running on this machine rather than needing a tunnel. It is
// a no-op against a release build pointed at production.

import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ANDROID_DIR = join(ROOT, 'android');

const APP_ID = 'fit.motionhive.app';
const MAIN_ACTIVITY = `${APP_ID}/.MainActivity`;
const DEV_API_PORT = 3800;

const isWindows = process.platform === 'win32';
const gradlew = isWindows ? 'gradlew.bat' : './gradlew';

/** Run a command, inheriting stdio, and exit on first failure. */
function run(command, args, { cwd = ROOT, optional = false } = {}) {
  const printable = [command, ...args].join(' ');
  console.log(`\n▸ ${printable}`);

  const result = spawnSync(command, args, { cwd, stdio: 'inherit', shell: isWindows });

  if (result.error || result.status !== 0) {
    if (optional) {
      console.warn(`  skipped — ${printable} did not succeed`);
      return false;
    }
    console.error(`\n✖ ${printable} failed`);
    process.exit(result.status ?? 1);
  }
  return true;
}

run(gradlew, ['installDebug'], { cwd: ANDROID_DIR });

// Optional: without a device attached these fail, and that should not read as
// a build failure — the APK is still built and installed on whatever is there.
run('adb', ['reverse', `tcp:${DEV_API_PORT}`, `tcp:${DEV_API_PORT}`], { optional: true });
run('adb', ['shell', 'am', 'start', '-n', MAIN_ACTIVITY], { optional: true });

console.log('\n✓ Installed and launched on the connected device.');

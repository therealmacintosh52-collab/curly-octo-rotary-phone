# Cali Tints for Clover

The Cali Tints web app, installed on the company's Clover devices (Flex in the hand, Mini or Station on the counter) from the Clover App Market. It is a WebView shell with two things the browser cannot give the page on a Clover:

- **The Clover barcode scanner** for *Scan barcode* (VIN sticker, stock tag), through `window.CaliClover.scan()`.
- **The camera** for before/after photos: the page's `getUserMedia` is granted once Android has the CAMERA permission, and the in-app shutter (`camera-capture.tsx`) is used because the Flex has no photo gallery for a file input.

It takes **no payments** and touches no Clover orders, inventory or customers. Everything else (sign-in, jobs, offline queue, who sees money) is the web app at `APP_URL`.

```
app/src/main/kotlin/com/calitints/clover/
  MainActivity.kt        WebView, camera permission, file chooser, downloads, offline page, cookies
  CaliCloverBridge.kt    window.CaliClover: info() · scan(requestId) · stopScan() · requestCamera()
  CloverScanner.kt       Clover SDK BarcodeScanner + BarcodeResult broadcast, 60 s timeout
  BridgeJson.kt          the JSON that crosses the bridge (unit-tested)
app/src/main/assets/offline.html   "No connection · Try again"
```

Page side: `apps/cali-tints/src/lib/native/clover.ts` (`scanWithClover()`, `useCloverBridge()`), used by `vin-scanner.tsx`; `photo-picker.tsx` switches to the in-app camera when `window.CaliClover` exists; `install-prompt.tsx` stays hidden in the app.

## Build

The APK is built by GitHub Actions (`.github/workflows/cali-tints-clover.yml`) on every push that touches this folder, and on demand from the Actions tab (*Run workflow*: web app URL, version name, version code). Download `cali-tints-clover-release` from the run's artifacts.

Locally (JDK 17 + Android SDK with platform 35):

```bash
cd apps/cali-tints-clover
./gradlew test                                   # JVM tests (bridge JSON)
./gradlew assembleDebug                          # app/build/outputs/apk/debug/app-debug.apk
./gradlew assembleRelease -PappUrl=https://app.calitints.com -PversionName=1.0.0 -PversionCode=1
```

Build properties: `-PappUrl` (the web app; default is the demo host), `-PdemoKey` (opens `/demo?key=…` on launch; demo builds only), `-PversionName`, `-PversionCode`.

## Signing (once)

Clover needs every upload of the same app signed with the same key. Make one keystore, keep it safe, never commit it.

```bash
keytool -genkeypair -v -keystore cali-tints-clover.keystore -alias calitints -keyalg RSA -keysize 2048 -validity 10000
```

- Locally: `keystore.properties` next to this README with `storeFile=…`, `storePassword=…`, `keyAlias=calitints`, `keyPassword=…` (gitignored).
- CI: repository secrets `ANDROID_KEYSTORE_BASE64` (`base64 -w0 cali-tints-clover.keystore`), `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`. Without them the release APK is debug-signed (fine for Dev Kit testing, not for the App Market).

## Clover App Market (private app)

1. **Developer account**: [clover.com/developers](https://www.clover.com/developers) → create a developer account (sandbox first, then request production access). The merchant (Mike) does not need this; the developer does.
2. **Create the app**: Developer Dashboard → *Create new app* → Android. Package name `com.calitints.clover`. Permissions: none of the Clover data permissions (no Orders, Payments, Customers, Inventory, Merchant). Fill in the listing: name *Cali Tints*, tagline, description (see `SUBMISSION.md`), icon (`app/src/main/res/mipmap-xxxhdpi/ic_launcher.png`, upload the 512 px one from `apps/cali-tints/public/icons/icon-512.png`), screenshots (phone screenshots of New job, Jobs, a job page), **Privacy policy URL** `https://<your-app>/privacy`, **Terms URL** `https://<your-app>/terms`, support email.
3. **Distribution**: choose **Private** (only merchants you approve can install it) so it never appears publicly. Add the merchant's Clover merchant id when the app is approved.
4. **Upload the APK**: *Android app* tab → upload the release APK built with `-PappUrl=<production URL>`. The version code must go up with every upload.
5. **Test on a Dev Kit**: order a Clover Dev Kit (a Flex or Mini in developer mode) from the dashboard, or use a sandbox merchant on a Dev Kit, install the app and run through `SUBMISSION.md`'s checklist. Clover will not approve an app that has not been tested on hardware.
6. **Submit for approval**: Clover reviews private apps too (a few business days). Provide the demo video (`SUBMISSION.md`) and a test login.
7. **Install on each Flex**: once approved, the merchant opens *More Tools* on the device (or the web dashboard → App Market) → the private app shows up for the approved merchant → *Install* on every device. Updates: upload a new APK with a higher version code; devices update themselves.

Clover requires `targetSdk 25` and a portrait-capable layout on the Flex; both are set. The app runs on any Android 7+ phone too (without the Clover scanner), which is handy for testing without a Dev Kit: `adb install app/build/outputs/apk/debug/app-debug.apk`.

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| Camera asks every time or never opens | The permission was denied: Settings → Apps → Cali Tints → Permissions → Camera. The page only requests it for `APP_URL`'s origin. |
| *Scan barcode* says "only available on a Clover device" | `com.clover.engine` is not installed (a phone or emulator). The web camera scanner is used on phones through the browser instead. |
| Signed out after every launch | Cookies are flushed on pause; check the device clock and that `APP_URL` is `https`. |
| White screen on launch | `APP_URL` unreachable → the offline page should show. Check the URL baked into the build (`-PappUrl`). |

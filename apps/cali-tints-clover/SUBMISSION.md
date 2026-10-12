# Clover App Market submission notes

Everything the Developer Dashboard asks for, ready to paste.

## Listing

- **Name**: Cali Tints
- **Tagline**: Log every car you detail; it lands in QuickBooks by itself.
- **Description**: Cali Tints is the private job log for a detailing company. Detailers log each car on the Flex in seconds (stock number, scan the VIN, tap the services, a photo). Dealership cars go straight onto that dealership's open QuickBooks invoice for the month; walk-in customers at the shop pay at the counter, where the job opens Clover's own payment screen for the total. Only the owner sees money; the team sees jobs. This app is the company's own tool and is distributed privately.
- **Category**: Operations / Business management
- **Pricing**: Free (private app)
- **Privacy policy**: `https://<your-app>/privacy`
- **Terms of service**: `https://<your-app>/terms`
- **Support**: the company's billing email (Settings → Company)

## Permissions requested (Clover)

**Payments: write**, only to open Clover's own payment screen (Secure Pay) for a walk-in customer's job at the shop and read back the result of that one sale. The app does not read merchants, employees, orders, other payments, customers or inventory, and never handles card data itself.

Android permissions, with the justification Clover asks for:

| Permission | Why |
|---|---|
| `INTERNET` | The app is the company's web app. |
| `CAMERA` | Photos of the car being detailed and the VIN barcode scan. Used only when the user taps Take a photo or Scan barcode. Nothing is recorded in the background. |

## Demo video script (2 to 3 minutes)

1. Open Cali Tints on the Flex. Sign in as a detailer (test account provided).
2. Dashboard: today's cars, no money shown.
3. Tap **New**. Type a stock number. Tap **Scan barcode**: the Clover scanner opens; scan a VIN barcode; year, make and model fill in.
4. Tap **Used** and **PDI**. Pick year, make, model and color. Tap **Take a photo**: the camera opens in the app; take a photo; **Use photo**.
5. **Save & next**: the green card shows the car; the form clears.
6. Tap **Jobs**: the car is at the top under Today with its photo count and the QuickBooks number. Open it: the photo, the services, where it stands.
7. Turn off Wi-Fi, save another car: "Queued on this device". Turn Wi-Fi on: it syncs.
8. Log a car at the shop location (retail). Open it: **Collect on this Clover** opens Clover's payment screen for the total; pay with a test card; the job shows Paid.
9. (On a laptop) sign in as the owner: the same jobs, the month so far, and the QuickBooks invoice each dealership's cars sit on.

## Test accounts for the reviewer

Create them under Settings → Users on a sandbox deployment (never the production company) and put them in the submission notes:

- Detailer: `review-detailer@…` / password
- Owner (read-only walkthrough of invoices): `review-owner@…` / password

## Hardware checklist before submitting

- [ ] Installs and opens on a Flex Dev Kit (portrait, no cut-off buttons, bottom tab bar visible above the Clover navigation bar).
- [ ] Scan barcode reads a Code 39 VIN sticker and a QR code; cancel returns to the form.
- [ ] Before/After open the in-app camera; the first time Android asks for the camera and the page's request is granted after that.
- [ ] Photos upload and show on the job page; Add photos works from the job page.
- [ ] Offline: saving with no connection queues the job; it syncs when the connection returns; the offline page shows on cold start without a connection and **Try again** recovers.
- [ ] Sign-in survives an app restart and a device reboot.
- [ ] Invoice PDF download (owner) lands in Downloads.
- [ ] Back button goes back in the app, then exits.

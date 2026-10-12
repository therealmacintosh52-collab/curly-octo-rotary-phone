# Clover App Market submission notes

Everything the Developer Dashboard asks for, ready to paste.

## Listing

- **Name**: Cali Tints
- **Tagline**: Log every car you detail; the month becomes one invoice.
- **Description**: Cali Tints is the private job log for a dealership detailing company. Detailers log each car on the Flex in seconds (stock number, scan the VIN, tap the services, before/after photos). On the 1st of the month every dealership's cars become one invoice, emailed to the dealership and created in QuickBooks. Only the owner sees prices and money; the team sees jobs. This app is the company's own tool and is distributed privately; it does not take payments on the Clover.
- **Category**: Operations / Business management
- **Pricing**: Free (private app)
- **Privacy policy**: `https://<your-app>/privacy`
- **Terms of service**: `https://<your-app>/terms`
- **Support**: the company's billing email (Settings → Company)

## Permissions requested (Clover)

None of the Clover data permissions. The app does not read merchants, employees, orders, payments, customers or inventory.

Android permissions, with the justification Clover asks for:

| Permission | Why |
|---|---|
| `INTERNET` | The app is the company's web app. |
| `CAMERA` | Before/after photos of the car being detailed and the VIN barcode scan. Used only when the user taps Before, After or Scan barcode. Nothing is recorded in the background. |

## Demo video script (2 to 3 minutes)

1. Open Cali Tints on the Flex. Sign in as a detailer (test account provided).
2. Dashboard: today's cars, no money shown.
3. Tap **New**. Type a stock number. Tap **Scan barcode**: the Clover scanner opens; scan a VIN barcode; year, make and model fill in.
4. Tap **Used** and **PDI**. Tap **Before**: the camera opens in the app; take a photo; **Use photo**. Tap **After**, take another.
5. **Save & next**: the green card shows the car; the form clears.
6. Tap **Jobs**: the car is at the top under Today with its photos count. Open it: the photos, the services, "Not invoiced yet".
7. Turn off Wi-Fi, save another car: "Queued on this device". Turn Wi-Fi on: it syncs.
8. (On a laptop) sign in as the owner: the same jobs, the month so far, and the invoice that will be made on the 1st, with QuickBooks connected.

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

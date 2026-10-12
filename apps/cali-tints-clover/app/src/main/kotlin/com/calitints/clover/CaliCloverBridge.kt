package com.calitints.clover

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import android.webkit.JavascriptInterface
import android.webkit.WebView
import androidx.core.content.ContextCompat

/**
 * `window.CaliClover` inside the page. Calls arrive on a WebView thread;
 * replies go back on the UI thread as `window.__caliCloverReply(id, json)`
 * (see apps/cali-tints/src/lib/native/clover.ts for the page side).
 */
class CaliCloverBridge(private val activity: MainActivity, private val web: WebView, private val scanner: CloverScanner) {

    /** Who am I: app version, device model, whether this is a Clover and whether the camera is allowed. */
    @JavascriptInterface
    fun info(): String {
        val camera = ContextCompat.checkSelfPermission(activity, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED
        return BridgeJson.info(BuildConfig.VERSION_NAME, Build.MODEL ?: "Android", scanner.isClover, camera)
    }

    /** Open the Clover barcode scanner; the result comes back under `requestId`. */
    @JavascriptInterface
    fun scan(requestId: String) {
        activity.runOnUiThread {
            scanner.start { json -> reply(requestId, json) }
        }
    }

    @JavascriptInterface
    fun stopScan() {
        activity.runOnUiThread { scanner.stop() }
    }

    /** Ask for the camera permission ahead of time (the page may call this when the photo picker opens). */
    @JavascriptInterface
    fun requestCamera() {
        activity.runOnUiThread { activity.ensureCameraPermission(null) }
    }

    /** Take a card payment on this Clover (a retail job at the counter): opens Clover's own payment screen. */
    @JavascriptInterface
    fun pay(requestId: String, amountCents: String, externalId: String, note: String) {
        val cents = amountCents.toLongOrNull()
        if (cents == null || cents <= 0L) {
            reply(requestId, BridgeJson.payError("Amount must be positive", "error"))
            return
        }
        activity.runOnUiThread { activity.startPayment(requestId, cents, externalId, note) }
    }

    /** Also used by the activity for payment results. */
    fun reply(requestId: String, json: String) {
        web.post {
            web.evaluateJavascript("window.__caliCloverReply && window.__caliCloverReply(${BridgeJson.str(requestId)}, $json);", null)
        }
    }
}

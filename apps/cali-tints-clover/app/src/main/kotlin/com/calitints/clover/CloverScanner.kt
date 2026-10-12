package com.calitints.clover

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import com.clover.sdk.v1.Intents
import com.clover.sdk.v3.scanner.BarcodeResult
import com.clover.sdk.v3.scanner.BarcodeScanner

/**
 * The Clover device's own barcode scanner (the camera-based one on the Flex,
 * with Clover's preview UI). One scan at a time: start() opens the scanner,
 * the device broadcasts the result, the callback gets the barcode text.
 */
class CloverScanner(private val context: Context) {
    private val scanner = BarcodeScanner(context)
    private val handler = Handler(Looper.getMainLooper())
    private var onResult: ((String) -> Unit)? = null
    private var registered = false
    private val timeout = Runnable { finish(BridgeJson.scanError("No barcode read in 60 seconds", "timeout")) }

    /** True on a Clover device (the Clover engine is installed); false on a plain Android phone or emulator. */
    val isClover: Boolean = try {
        context.packageManager.getPackageInfo("com.clover.engine", 0)
        true
    } catch (_: PackageManager.NameNotFoundException) {
        false
    }

    private val receiver = object : BroadcastReceiver() {
        override fun onReceive(c: Context, intent: Intent) {
            val result = BarcodeResult(intent)
            if (result.isBarcodeAction) {
                val text = result.barcode ?: return
                finish(BridgeJson.scanOk(text))
            }
        }
    }

    /** Open the scanner; `callback` receives one JSON message (scanOk or scanError). */
    fun start(callback: (String) -> Unit) {
        stop(silent = true)
        onResult = callback
        if (!isClover) {
            finish(BridgeJson.scanError("The Clover scanner is only available on a Clover device", "unavailable"))
            return
        }
        try {
            context.registerReceiver(receiver, IntentFilter(BarcodeResult.INTENT_ACTION))
            registered = true
            val extras = Bundle().apply {
                putBoolean(Intents.EXTRA_SCAN_QR_CODE, true)
                putBoolean(Intents.EXTRA_SCAN_1D_CODE, true)
                putBoolean(Intents.EXTRA_SHOW_PREVIEW, true)
                putBoolean(Intents.EXTRA_SHOW_MERCHANT_PREVIEW, true)
                putBoolean(Intents.EXTRA_SHOW_CLOSE_BUTTON, true)
                putBoolean(Intents.EXTRA_LED_ON, false)
            }
            scanner.startScan(extras)
            handler.postDelayed(timeout, 60_000)
        } catch (e: Exception) {
            finish(BridgeJson.scanError(e.message ?: "Could not start the Clover scanner", "error"))
        }
    }

    /** Close the scanner. Reports a cancel to the page unless `silent`. */
    fun stop(silent: Boolean = false) {
        handler.removeCallbacks(timeout)
        if (registered) {
            try {
                context.unregisterReceiver(receiver)
            } catch (_: IllegalArgumentException) {
            }
            registered = false
            try {
                scanner.stopScan(Bundle())
            } catch (_: Exception) {
            }
        }
        val cb = onResult
        onResult = null
        if (!silent && cb != null) cb(BridgeJson.scanError("Scan cancelled", "cancelled"))
    }

    private fun finish(json: String) {
        val cb = onResult
        stop(silent = true)
        cb?.invoke(json)
    }
}

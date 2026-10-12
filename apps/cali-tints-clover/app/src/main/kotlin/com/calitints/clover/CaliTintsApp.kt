package com.calitints.clover

import android.app.Application
import android.webkit.WebView

class CaliTintsApp : Application() {
    override fun onCreate() {
        super.onCreate()
        // chrome://inspect on a connected computer shows the page in debug builds.
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG)
    }
}

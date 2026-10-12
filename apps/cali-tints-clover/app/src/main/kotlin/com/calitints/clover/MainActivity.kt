package com.calitints.clover

import android.Manifest
import android.annotation.SuppressLint
import android.app.DownloadManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Bundle
import android.os.Environment
import android.view.ViewGroup
import android.webkit.CookieManager
import android.webkit.PermissionRequest
import android.webkit.URLUtil
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat

/**
 * The whole app is the web app in a WebView, plus:
 *  - the Clover barcode scanner and camera permission through `window.CaliClover`;
 *  - the camera for getUserMedia (before/after photos) once Android allows it;
 *  - an offline page with Try again when the site cannot be reached;
 *  - downloads (invoice PDFs) through the system download manager;
 *  - cookies kept across launches so nobody signs in twice.
 */
class MainActivity : AppCompatActivity() {
    private lateinit var web: WebView
    private lateinit var scanner: CloverScanner
    private val appUrl: Uri = Uri.parse(BuildConfig.APP_URL)
    private var pendingCamera: PermissionRequest? = null
    private var fileCallback: ValueCallback<Array<Uri>>? = null

    private val cameraPermission = registerForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        val req = pendingCamera
        pendingCamera = null
        if (req != null) {
            if (granted) req.grant(arrayOf(PermissionRequest.RESOURCE_VIDEO_CAPTURE)) else req.deny()
        }
        if (!granted) Toast.makeText(this, R.string.camera_denied, Toast.LENGTH_LONG).show()
    }

    private val filePicker = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
        val cb = fileCallback
        fileCallback = null
        cb?.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(result.resultCode, result.data))
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        scanner = CloverScanner(this)
        web = WebView(this)
        setContentView(web, ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
        web.setBackgroundColor(ContextCompat.getColor(this, R.color.background))

        with(web.settings) {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            mediaPlaybackRequiresUserGesture = false
            allowFileAccess = false
            allowContentAccess = false
            mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
            cacheMode = WebSettings.LOAD_DEFAULT
            setSupportMultipleWindows(false)
            setSupportZoom(false)
            useWideViewPort = true
            loadWithOverviewMode = true
            userAgentString = "$userAgentString CaliTintsClover/${BuildConfig.VERSION_NAME}"
        }
        CookieManager.getInstance().apply {
            setAcceptCookie(true)
            setAcceptThirdPartyCookies(web, false)
        }
        web.addJavascriptInterface(CaliCloverBridge(this, web, scanner), "CaliClover")

        web.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                val url = request.url
                val sameSite = url.host.equals(appUrl.host, ignoreCase = true)
                if (sameSite && (url.scheme == "https" || url.scheme == "http")) return false
                // mailto:, tel:, Intuit's sign-in, a dealership's portal: hand it to the system.
                return try {
                    startActivity(Intent(Intent.ACTION_VIEW, url))
                    true
                } catch (_: Exception) {
                    false
                }
            }

            override fun onReceivedError(view: WebView, request: WebResourceRequest, error: WebResourceError) {
                if (request.isForMainFrame) showOffline()
            }
        }

        web.webChromeClient = object : WebChromeClient() {
            override fun onPermissionRequest(request: PermissionRequest) {
                val wantsCamera = request.resources.contains(PermissionRequest.RESOURCE_VIDEO_CAPTURE)
                val ours = request.origin?.host.equals(appUrl.host, ignoreCase = true)
                if (!wantsCamera || !ours) {
                    request.deny()
                    return
                }
                ensureCameraPermission(request)
            }

            override fun onShowFileChooser(webView: WebView, filePathCallback: ValueCallback<Array<Uri>>, fileChooserParams: FileChooserParams): Boolean {
                fileCallback?.onReceiveValue(null)
                fileCallback = filePathCallback
                return try {
                    filePicker.launch(fileChooserParams.createIntent())
                    true
                } catch (_: Exception) {
                    fileCallback = null
                    false
                }
            }
        }

        // Invoice PDFs and exports: the system download manager, with the signed-in cookies.
        web.setDownloadListener { url, userAgent, contentDisposition, mimeType, _ ->
            try {
                val request = DownloadManager.Request(Uri.parse(url))
                    .addRequestHeader("Cookie", CookieManager.getInstance().getCookie(url) ?: "")
                    .addRequestHeader("User-Agent", userAgent)
                    .setMimeType(mimeType)
                    .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
                    .setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, URLUtil.guessFileName(url, contentDisposition, mimeType))
                (getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager).enqueue(request)
                Toast.makeText(this, "Downloading…", Toast.LENGTH_SHORT).show()
            } catch (_: Exception) {
                startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
            }
        }

        if (savedInstanceState != null) web.restoreState(savedInstanceState) else loadStart()
    }

    private fun loadStart() {
        // A build with a guest key opens the demo straight away; otherwise the app's own sign-in.
        val start = if (BuildConfig.DEMO_KEY.isNotEmpty()) appUrl.buildUpon().path("/demo").appendQueryParameter("key", BuildConfig.DEMO_KEY).build() else appUrl
        web.loadUrl(start.toString())
    }

    private fun showOffline() {
        val html = assets.open("offline.html").bufferedReader().use { it.readText() }.replace("__APP_URL__", BuildConfig.APP_URL)
        web.loadDataWithBaseURL(BuildConfig.APP_URL, html, "text/html", "utf-8", BuildConfig.APP_URL)
    }

    /** Grant the page's camera request once Android has given us the permission (asking the first time). */
    fun ensureCameraPermission(request: PermissionRequest?) {
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) {
            request?.grant(arrayOf(PermissionRequest.RESOURCE_VIDEO_CAPTURE))
            return
        }
        pendingCamera = request
        cameraPermission.launch(Manifest.permission.CAMERA)
    }

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        if (web.canGoBack()) web.goBack() else @Suppress("DEPRECATION") super.onBackPressed()
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        web.saveState(outState)
    }

    override fun onPause() {
        super.onPause()
        CookieManager.getInstance().flush()
        web.onPause()
    }

    override fun onResume() {
        super.onResume()
        web.onResume()
    }

    override fun onDestroy() {
        scanner.stop(silent = true)
        web.destroy()
        super.onDestroy()
    }
}

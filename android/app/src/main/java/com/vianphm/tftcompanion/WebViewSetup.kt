package com.vianphm.tftcompanion

import android.annotation.SuppressLint
import android.webkit.WebView

/**
 * Cau hinh chung cho moi WebView trong app.
 * Trang web nam trong assets cua chinh app (khong tai tu Internet), nen bat
 * localStorage va cho phep goi ra dia chi LAN cua app tren PC.
 */
object WebViewSetup {

    const val APP_URL = "file:///android_asset/mobile/index.html"
    const val COMPACT_URL = "file:///android_asset/mobile/index.html?compact=1"

    @SuppressLint("SetJavaScriptEnabled")
    fun apply(web: WebView) {
        web.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            allowFileAccess = true
            allowContentAccess = false
            // Cho phep trang file:// goi fetch() toi may chu LAN cua app PC
            allowUniversalAccessFromFileURLs = true
            cacheMode = android.webkit.WebSettings.LOAD_DEFAULT
            useWideViewPort = true
            loadWithOverviewMode = false
            textZoom = 100
        }
        web.setBackgroundColor(0xFF0D1117.toInt())
        web.isVerticalScrollBarEnabled = true
    }
}

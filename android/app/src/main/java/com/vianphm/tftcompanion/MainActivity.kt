package com.vianphm.tftcompanion

import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.webkit.WebView
import android.widget.Button
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat

/**
 * Man hinh chinh: chay ban web day du trong WebView, kem nut bat cua so noi
 * de dat len tren game TFT Mobile.
 */
class MainActivity : AppCompatActivity() {

    private lateinit var web: WebView
    private lateinit var overlayButton: Button
    private lateinit var permissionHint: TextView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        web = findViewById(R.id.web)
        overlayButton = findViewById(R.id.overlayButton)
        permissionHint = findViewById(R.id.permissionHint)

        WebViewSetup.apply(web)
        web.loadUrl(WebViewSetup.APP_URL)

        overlayButton.setOnClickListener {
            if (canDrawOverlays()) startOverlay() else requestOverlayPermission()
        }
    }

    override fun onResume() {
        super.onResume()
        refreshPermissionState()
    }

    private fun refreshPermissionState() {
        val granted = canDrawOverlays()
        overlayButton.text = getString(if (granted) R.string.start_overlay else R.string.grant_overlay)
        permissionHint.text = getString(
            if (granted) R.string.overlay_ready else R.string.overlay_permission_needed
        )
    }

    private fun canDrawOverlays(): Boolean =
        Build.VERSION.SDK_INT < Build.VERSION_CODES.M || Settings.canDrawOverlays(this)

    private fun requestOverlayPermission() {
        startActivity(
            Intent(
                Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                Uri.parse("package:$packageName")
            )
        )
    }

    private fun startOverlay() {
        ContextCompat.startForegroundService(this, Intent(this, OverlayService::class.java))
        moveTaskToBack(true)
    }
}

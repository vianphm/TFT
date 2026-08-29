package com.vianphm.tftcompanion

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.graphics.PixelFormat
import android.os.Build
import android.os.IBinder
import android.view.Gravity
import android.view.KeyEvent
import android.view.LayoutInflater
import android.view.MotionEvent
import android.view.View
import android.view.WindowManager
import android.webkit.WebView
import kotlin.math.abs

/**
 * Cua so noi de len game.
 *
 * Hai trang thai:
 *  - Bong bong nho: luon noi tren cung, keo di duoc, cham vao thi mo bang.
 *  - Bang tro thu: WebView chay dung ban web trong assets (che do gon).
 *
 * Dich vu chay nen kem thong bao de he thong khong tat giua chung khi dang choi game.
 */
class OverlayService : Service() {

    private lateinit var windowManager: WindowManager
    private var bubble: View? = null
    private var panel: View? = null
    private var panelWeb: WebView? = null

    private lateinit var bubbleParams: WindowManager.LayoutParams
    private lateinit var panelParams: WindowManager.LayoutParams

    companion object {
        const val ACTION_STOP = "com.vianphm.tftcompanion.STOP"
        private const val CHANNEL_ID = "tft_overlay"
        private const val NOTIFICATION_ID = 42
        private const val PREFS = "overlay"
        private const val KEY_X = "bubbleX"
        private const val KEY_Y = "bubbleY"
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        windowManager = getSystemService(Context.WINDOW_SERVICE) as WindowManager
        startForeground(NOTIFICATION_ID, buildNotification())
        showBubble()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_STOP) {
            stopSelf()
            return START_NOT_STICKY
        }
        return START_STICKY
    }

    override fun onDestroy() {
        removeView(panel)
        removeView(bubble)
        panelWeb?.destroy()
        panelWeb = null
        panel = null
        bubble = null
        super.onDestroy()
    }

    // ------------------------------------------------------------------ bubble

    private fun showBubble() {
        if (bubble != null) return
        val prefs = getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val view = LayoutInflater.from(this).inflate(R.layout.overlay_bubble, null)

        bubbleParams = WindowManager.LayoutParams(
            WindowManager.LayoutParams.WRAP_CONTENT,
            WindowManager.LayoutParams.WRAP_CONTENT,
            overlayType(),
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
            PixelFormat.TRANSLUCENT
        ).apply {
            gravity = Gravity.TOP or Gravity.START
            x = prefs.getInt(KEY_X, 0)
            y = prefs.getInt(KEY_Y, 240)
        }

        view.setOnTouchListener(DragListener(bubbleParams) { moved ->
            if (!moved) expand()
            else prefs.edit()
                .putInt(KEY_X, bubbleParams.x)
                .putInt(KEY_Y, bubbleParams.y)
                .apply()
        })

        windowManager.addView(view, bubbleParams)
        bubble = view
    }

    // ------------------------------------------------------------------- panel

    private fun expand() {
        if (panel != null) return
        val view = LayoutInflater.from(this).inflate(R.layout.overlay_panel, null)

        panelParams = WindowManager.LayoutParams(
            resources.getDimensionPixelSize(R.dimen.panel_width),
            resources.getDimensionPixelSize(R.dimen.panel_height),
            overlayType(),
            WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL,
            PixelFormat.TRANSLUCENT
        ).apply {
            gravity = Gravity.TOP or Gravity.START
            x = bubbleParams.x
            y = bubbleParams.y
        }

        val web = view.findViewById<WebView>(R.id.panelWeb)
        WebViewSetup.apply(web)
        web.loadUrl(WebViewSetup.COMPACT_URL)
        panelWeb = web

        view.findViewById<View>(R.id.panelHandle)
            .setOnTouchListener(DragListener(panelParams) { })
        view.findViewById<View>(R.id.panelCollapse).setOnClickListener { collapse() }
        view.findViewById<View>(R.id.panelClose).setOnClickListener { stopSelf() }

        // Nut Back cua he thong thu lai bang thay vi thoat game
        view.isFocusableInTouchMode = true
        view.setOnKeyListener { _, keyCode, event ->
            if (keyCode == KeyEvent.KEYCODE_BACK && event.action == KeyEvent.ACTION_UP) {
                collapse()
                true
            } else {
                false
            }
        }

        windowManager.addView(view, panelParams)
        panel = view
        removeView(bubble)
        bubble = null
    }

    private fun collapse() {
        // Nho lai cho dat bang de bong bong hien dung cho do
        panel?.let {
            val prefs = getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            prefs.edit().putInt(KEY_X, panelParams.x).putInt(KEY_Y, panelParams.y).apply()
        }
        removeView(panel)
        panelWeb?.destroy()
        panelWeb = null
        panel = null
        showBubble()
    }

    private fun removeView(view: View?) {
        if (view == null) return
        try {
            windowManager.removeView(view)
        } catch (ignored: IllegalArgumentException) {
            // view da bi go truoc do
        }
    }

    private fun overlayType(): Int =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
        } else {
            @Suppress("DEPRECATION")
            WindowManager.LayoutParams.TYPE_PHONE
        }

    /** Keo tha cua so noi; bao lai co phai la cham nhanh (khong keo) hay khong. */
    private inner class DragListener(
        private val params: WindowManager.LayoutParams,
        private val onRelease: (moved: Boolean) -> Unit
    ) : View.OnTouchListener {

        private var startX = 0
        private var startY = 0
        private var touchX = 0f
        private var touchY = 0f
        private var moved = false

        override fun onTouch(view: View, event: MotionEvent): Boolean {
            when (event.action) {
                MotionEvent.ACTION_DOWN -> {
                    startX = params.x
                    startY = params.y
                    touchX = event.rawX
                    touchY = event.rawY
                    moved = false
                    return true
                }
                MotionEvent.ACTION_MOVE -> {
                    val dx = (event.rawX - touchX).toInt()
                    val dy = (event.rawY - touchY).toInt()
                    if (abs(dx) > 12 || abs(dy) > 12) moved = true
                    params.x = startX + dx
                    params.y = startY + dy
                    val target = if (view.id == R.id.panelHandle) panel else bubble
                    target?.let { windowManager.updateViewLayout(it, params) }
                    return true
                }
                MotionEvent.ACTION_UP -> {
                    if (!moved) view.performClick()
                    onRelease(moved)
                    return true
                }
            }
            return false
        }
    }

    // ------------------------------------------------------------ thong bao

    private fun buildNotification(): Notification {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                getString(R.string.overlay_channel),
                NotificationManager.IMPORTANCE_LOW
            )
            channel.setShowBadge(false)
            (getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager)
                .createNotificationChannel(channel)
        }

        val stopIntent = PendingIntent.getService(
            this,
            0,
            Intent(this, OverlayService::class.java).setAction(ACTION_STOP),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Notification.Builder(this, CHANNEL_ID)
        } else {
            @Suppress("DEPRECATION")
            Notification.Builder(this)
        }

        return builder
            .setContentTitle(getString(R.string.app_name))
            .setContentText(getString(R.string.overlay_running))
            .setSmallIcon(R.drawable.ic_bubble)
            .setOngoing(true)
            .addAction(
                Notification.Action.Builder(null, getString(R.string.stop_overlay), stopIntent).build()
            )
            .build()
    }
}

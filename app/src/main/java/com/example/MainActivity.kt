// FILE: app/src/main/java/com/example/MainActivity.kt
package com.example

import android.Manifest
import android.annotation.SuppressLint
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.graphics.Color
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.view.View
import android.view.WindowManager
import android.webkit.ConsoleMessage
import android.webkit.PermissionRequest
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import androidx.activity.ComponentActivity
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.lifecycle.lifecycleScope
import androidx.webkit.WebViewAssetLoader
import com.example.plugins.RiyaAgentPlugin
import com.example.plugins.SecureVaultPlugin
import com.example.plugins.SystemBridgePlugin
import com.example.service.TelegramService
import com.example.service.WakeWordService
import kotlinx.coroutines.launch

/**
 * MainActivity: Fullscreen immersive container hosting the 3D Anime Avatar & Gemini Live Web app
 * via an accelerated hardware WebView and native bridge plugins.
 */
class MainActivity : ComponentActivity() {

    private lateinit var webView: WebView
    private lateinit var systemBridge: SystemBridgePlugin
    private lateinit var secureVault: SecureVaultPlugin
    private lateinit var riyaAgent: RiyaAgentPlugin
    private var pendingPermissionRequest: PermissionRequest? = null
    private var filePathCallback: ValueCallback<Array<Uri>>? = null

    // Native File Picker Launcher for VRM 3D Model Imports
    private val filePickerLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        if (result.resultCode == android.app.Activity.RESULT_OK) {
            val data = result.data
            val uris: Array<Uri>? = when {
                data?.clipData != null -> {
                    val count = data.clipData!!.itemCount
                    Array(count) { i -> data.clipData!!.getItemAt(i).uri }
                }
                data?.data != null -> arrayOf(data.data!!)
                else -> null
            }
            filePathCallback?.onReceiveValue(uris)
        } else {
            filePathCallback?.onReceiveValue(null)
        }
        filePathCallback = null
    }

    // Gated Permission Launchers (D1: Zero startup dialogs)
    val audioPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { granted ->
        if (granted && pendingPermissionRequest != null) {
            pendingPermissionRequest?.grant(pendingPermissionRequest?.resources)
            pendingPermissionRequest = null
        }
        notifyPermissionStateToWeb("audio", granted)
    }

    val cameraPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { granted ->
        notifyPermissionStateToWeb("camera", granted)
    }

    val notificationPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { granted ->
        notifyPermissionStateToWeb("notifications", granted)
    }

    private val broadcastReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            when (intent?.action) {
                WakeWordService.ACTION_WAKE_DETECTED -> onWakeDetected()
                "com.aistudio.riya.ACTION_STOP_AGENT" -> onStopAgentRequested()
            }
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Immersive edge-to-edge configuration with safe IME handling
        WindowCompat.setDecorFitsSystemWindows(window, false)
        window.statusBarColor = Color.TRANSPARENT
        window.navigationBarColor = Color.TRANSPARENT
        window.setFlags(
            WindowManager.LayoutParams.FLAG_HARDWARE_ACCELERATED,
            WindowManager.LayoutParams.FLAG_HARDWARE_ACCELERATED
        )

        val rootLayout = FrameLayout(this).apply {
            setBackgroundColor(Color.parseColor("#0b0f14"))
            // Apply system bar insets without conflicting with IME animations
            androidx.core.view.ViewCompat.setOnApplyWindowInsetsListener(this) { view, insets ->
                val imeInsets = insets.getInsets(WindowInsetsCompat.Type.ime())
                val sysBarInsets = insets.getInsets(WindowInsetsCompat.Type.systemBars())
                view.setPadding(0, sysBarInsets.top, 0, if (imeInsets.bottom > 0) imeInsets.bottom else sysBarInsets.bottom)
                insets
            }
        }

        systemBridge = SystemBridgePlugin(this)
        secureVault = SecureVaultPlugin(this, lifecycleScope)
        riyaAgent = RiyaAgentPlugin(this)

        val assetLoader = WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .addPathHandler("/res/", WebViewAssetLoader.ResourcesPathHandler(this))
            .build()

        webView = WebView(this).apply {
            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
            )
            setBackgroundColor(Color.TRANSPARENT)
            setLayerType(View.LAYER_TYPE_HARDWARE, null)

            settings.apply {
                javaScriptEnabled = true
                domStorageEnabled = true
                databaseEnabled = true
                mediaPlaybackRequiresUserGesture = false
                allowFileAccess = true
                allowContentAccess = true
                cacheMode = WebSettings.LOAD_DEFAULT
                loadWithOverviewMode = true
                useWideViewPort = true
                builtInZoomControls = false
                displayZoomControls = false
                mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
            }

            addJavascriptInterface(systemBridge, "SystemBridgeNative")
            addJavascriptInterface(secureVault, "SecureVaultNative")
            addJavascriptInterface(riyaAgent, "RiyaAgentNative")
            addJavascriptInterface(WakeWordBridge(this@MainActivity), "WakeWordNative")

            webViewClient = object : WebViewClient() {
                override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? {
                    return assetLoader.shouldInterceptRequest(request.url)
                }

                override fun onPageFinished(view: WebView?, url: String?) {
                    super.onPageFinished(view, url)
                    checkAudioPermissionState()
                    checkAccessibilityState()
                }
            }

            webChromeClient = object : WebChromeClient() {
                override fun onShowFileChooser(
                    webView: WebView?,
                    filePathCallback: ValueCallback<Array<Uri>>?,
                    fileChooserParams: FileChooserParams?
                ): Boolean {
                    this@MainActivity.filePathCallback?.onReceiveValue(null)
                    this@MainActivity.filePathCallback = filePathCallback

                    val intent = Intent(Intent.ACTION_GET_CONTENT).apply {
                        addCategory(Intent.CATEGORY_OPENABLE)
                        type = "*/*"
                        putExtra(
                            Intent.EXTRA_MIME_TYPES,
                            arrayOf(
                                "application/octet-stream",
                                "model/gltf-binary",
                                "application/x-vrm",
                                "*/*"
                            )
                        )
                    }
                    filePickerLauncher.launch(Intent.createChooser(intent, "Select 3D VRM Character Model"))
                    return true
                }

                override fun onPermissionRequest(request: PermissionRequest?) {
                    if (request == null) return
                    val requestedResources = request.resources
                    val needsAudio = requestedResources.contains(PermissionRequest.RESOURCE_AUDIO_CAPTURE)

                    if (needsAudio) {
                        val hasAudioPerm = ContextCompat.checkSelfPermission(
                            this@MainActivity,
                            Manifest.permission.RECORD_AUDIO
                        ) == PackageManager.PERMISSION_GRANTED

                        if (hasAudioPerm) {
                            request.grant(requestedResources)
                        } else {
                            pendingPermissionRequest = request
                            audioPermissionLauncher.launch(Manifest.permission.RECORD_AUDIO)
                        }
                    } else {
                        request.grant(requestedResources)
                    }
                }

                override fun onConsoleMessage(consoleMessage: ConsoleMessage?): Boolean {
                    return super.onConsoleMessage(consoleMessage)
                }
            }
        }

        rootLayout.addView(webView)
        setContentView(rootLayout)

        hideSystemUI()

        // Load bundled public/index.html via AssetLoader domain
        webView.loadUrl("https://appassets.androidplatform.net/assets/public/index.html")

        val filter = IntentFilter().apply {
            addAction(WakeWordService.ACTION_WAKE_DETECTED)
            addAction("com.aistudio.riya.ACTION_STOP_AGENT")
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(broadcastReceiver, filter, RECEIVER_NOT_EXPORTED)
        } else {
            registerReceiver(broadcastReceiver, filter)
        }

        handleIncomingIntent(intent)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleIncomingIntent(intent)
    }

    private fun handleIncomingIntent(intent: Intent?) {
        if (intent == null) return
        when (intent.action) {
            WakeWordService.ACTION_WAKE_DETECTED -> onWakeDetected()
            TelegramService.ACTION_REMOTE_TASK -> {
                val task = intent.getStringExtra(TelegramService.EXTRA_TASK_TEXT) ?: ""
                if (task.isNotBlank()) {
                    onRemoteTaskReceived(task)
                }
            }
        }
    }

    private fun onWakeDetected() {
        runOnUiThread {
            webView.evaluateJavascript("if (window.onWakeWordTriggered) { window.onWakeWordTriggered(); }", null)
        }
    }

    private fun onStopAgentRequested() {
        runOnUiThread {
            webView.evaluateJavascript("if (window.onStopAgentRequested) { window.onStopAgentRequested(); }", null)
        }
    }

    private fun onRemoteTaskReceived(taskText: String) {
        runOnUiThread {
            val safeJson = org.json.JSONObject.quote(taskText)
            webView.evaluateJavascript("if (window.onRemoteAgentTask) { window.onRemoteAgentTask($safeJson); }", null)
        }
    }

    fun requestAudioPermission() {
        runOnUiThread {
            val hasAudio = ContextCompat.checkSelfPermission(
                this,
                Manifest.permission.RECORD_AUDIO
            ) == PackageManager.PERMISSION_GRANTED

            if (hasAudio) {
                notifyPermissionStateToWeb("audio", true)
            } else {
                audioPermissionLauncher.launch(Manifest.permission.RECORD_AUDIO)
            }
        }
    }

    fun requestNotificationPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            runOnUiThread {
                val hasNotif = ContextCompat.checkSelfPermission(
                    this,
                    Manifest.permission.POST_NOTIFICATIONS
                ) == PackageManager.PERMISSION_GRANTED

                if (!hasNotif) {
                    notificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
                }
            }
        }
    }

    fun requestCameraPermission(onGranted: () -> Unit) {
        val hasCamera = ContextCompat.checkSelfPermission(
            this,
            Manifest.permission.CAMERA
        ) == PackageManager.PERMISSION_GRANTED

        if (hasCamera) {
            onGranted()
        } else {
            cameraPermissionLauncher.launch(Manifest.permission.CAMERA)
        }
    }

    private fun checkAudioPermissionState() {
        val hasAudio = ContextCompat.checkSelfPermission(
            this,
            Manifest.permission.RECORD_AUDIO
        ) == PackageManager.PERMISSION_GRANTED
        notifyPermissionStateToWeb("audio", hasAudio)
    }

    fun checkAccessibilityState() {
        runOnUiThread {
            val isEnabled = com.example.service.RiyaAgentService.isServiceRunning
            webView.evaluateJavascript(
                "if (window.onAccessibilityStateChanged) { window.onAccessibilityStateChanged($isEnabled); }",
                null
            )
        }
    }

    private fun notifyPermissionStateToWeb(permission: String, granted: Boolean) {
        runOnUiThread {
            webView.evaluateJavascript(
                "if (window.onNativePermissionsResult) { window.onNativePermissionsResult('$permission', $granted); }",
                null
            )
        }
    }

    private fun hideSystemUI() {
        try {
            val decor = window.peekDecorView() ?: window.decorView
            val controller = WindowCompat.getInsetsController(window, decor)
            controller.systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
            // Only hide navigation and status bars; do not interfere with IME
            controller.hide(WindowInsetsCompat.Type.systemBars())
        } catch (_: Exception) {}
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        // Avoid aggressively calling hideSystemUI during soft keyboard interaction
    }

    override fun onResume() {
        super.onResume()
        hideSystemUI()
        checkAccessibilityState()
    }

    override fun onDestroy() {
        try {
            unregisterReceiver(broadcastReceiver)
        } catch (_: Exception) {}
        webView.destroy()
        super.onDestroy()
    }

    /**
     * Bridge class for WakeWordService control from JavaScript
     */
    inner class WakeWordBridge(private val context: Context) {
        @android.webkit.JavascriptInterface
        fun startWakeService(phrase: String): Boolean {
            return try {
                requestNotificationPermission()
                val serviceIntent = Intent(context, WakeWordService::class.java).apply {
                    action = WakeWordService.ACTION_START
                    putExtra(WakeWordService.EXTRA_WAKE_PHRASE, phrase)
                }
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    context.startForegroundService(serviceIntent)
                } else {
                    context.startService(serviceIntent)
                }
                true
            } catch (e: Exception) {
                false
            }
        }

        @android.webkit.JavascriptInterface
        fun stopWakeService(): Boolean {
            return try {
                val serviceIntent = Intent(context, WakeWordService::class.java).apply {
                    action = WakeWordService.ACTION_STOP
                }
                context.startService(serviceIntent)
                true
            } catch (e: Exception) {
                false
            }
        }
    }
}

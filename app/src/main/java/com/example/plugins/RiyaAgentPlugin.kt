// FILE: app/src/main/java/com/example/plugins/RiyaAgentPlugin.kt
package com.example.plugins

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.os.Build
import android.provider.Settings
import android.util.Log
import android.webkit.JavascriptInterface
import com.example.service.RiyaAgentService
import com.example.service.TelegramService
import org.json.JSONObject
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

/**
 * RiyaAgentPlugin: Bridge exposing Accessibility Service autonomous control
 * to the web frontend and Riya Gemini Planner.
 */
class RiyaAgentPlugin(private val activity: Activity) {

    companion object {
        private const val TAG = "RiyaAgentPlugin"
    }

    @JavascriptInterface
    fun isAccessibilityEnabled(): Boolean {
        return RiyaAgentService.isServiceRunning
    }

    @JavascriptInterface
    fun openAccessibilitySettings(): String {
        return try {
            val intent = Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            activity.startActivity(intent)
            successResult("Opened Accessibility Settings")
        } catch (e: Exception) {
            errorResult("Failed to open accessibility settings: ${e.message}")
        }
    }

    @JavascriptInterface
    fun getUiHierarchy(): String {
        val service = RiyaAgentService.instance
        if (service == null) {
            return errorResult("Accessibility Service is not enabled. Please enable Riya in Accessibility Settings.")
        }
        return try {
            service.getParsedUiHierarchy().toString()
        } catch (e: Exception) {
            errorResult("Error reading UI hierarchy: ${e.message}")
        }
    }

    @JavascriptInterface
    fun getForegroundPackage(): String {
        val service = RiyaAgentService.instance ?: return ""
        return service.getCurrentForegroundPackage()
    }

    @JavascriptInterface
    fun isSensitiveApp(packageName: String): Boolean {
        return RiyaAgentService.isSensitivePackage(packageName)
    }

    @JavascriptInterface
    fun tap(x: Float, y: Float): String {
        val service = RiyaAgentService.instance ?: return errorResult("Accessibility Service inactive")
        val latch = CountDownLatch(1)
        var success = false

        service.tap(x, y) { ok ->
            success = ok
            latch.countDown()
        }

        try {
            latch.await(1500, TimeUnit.MILLISECONDS)
        } catch (e: InterruptedException) {
            return errorResult("Tap timed out")
        }

        return if (success) successResult("Tapped coordinate ($x, $y)") else errorResult("Tap dispatch failed")
    }

    @JavascriptInterface
    fun longPress(x: Float, y: Float, durationMs: Long): String {
        val service = RiyaAgentService.instance ?: return errorResult("Accessibility Service inactive")
        val latch = CountDownLatch(1)
        var success = false
        val duration = if (durationMs > 0) durationMs else 1000L

        service.longPress(x, y, duration) { ok ->
            success = ok
            latch.countDown()
        }

        try {
            latch.await(duration + 1000, TimeUnit.MILLISECONDS)
        } catch (e: InterruptedException) {
            return errorResult("LongPress timed out")
        }

        return if (success) successResult("Long-pressed ($x, $y) for ${duration}ms") else errorResult("Long-press dispatch failed")
    }

    @JavascriptInterface
    fun swipe(startX: Float, startY: Float, endX: Float, endY: Float, durationMs: Long): String {
        val service = RiyaAgentService.instance ?: return errorResult("Accessibility Service inactive")
        val latch = CountDownLatch(1)
        var success = false
        val duration = if (durationMs > 0) durationMs else 300L

        service.swipe(startX, startY, endX, endY, duration) { ok ->
            success = ok
            latch.countDown()
        }

        try {
            latch.await(duration + 1000, TimeUnit.MILLISECONDS)
        } catch (e: InterruptedException) {
            return errorResult("Swipe timed out")
        }

        return if (success) successResult("Swiped ($startX,$startY) -> ($endX,$endY)") else errorResult("Swipe dispatch failed")
    }

    @JavascriptInterface
    fun typeText(text: String): String {
        val service = RiyaAgentService.instance ?: return errorResult("Accessibility Service inactive")
        val latch = CountDownLatch(1)
        var success = false
        var message = ""

        service.typeText(text) { ok, msg ->
            success = ok
            message = msg
            latch.countDown()
        }

        try {
            latch.await(2000, TimeUnit.MILLISECONDS)
        } catch (e: InterruptedException) {
            return errorResult("Type operation timed out")
        }

        return if (success) successResult(message) else errorResult(message)
    }

    @JavascriptInterface
    fun scrollIntoView(text: String): String {
        val service = RiyaAgentService.instance ?: return errorResult("Accessibility Service inactive")
        val latch = CountDownLatch(1)
        var success = false
        var message = ""

        service.scrollIntoView(text) { ok, msg ->
            success = ok
            message = msg
            latch.countDown()
        }

        try {
            latch.await(2000, TimeUnit.MILLISECONDS)
        } catch (e: InterruptedException) {
            return errorResult("Scroll timed out")
        }

        return if (success) successResult(message) else errorResult(message)
    }

    @JavascriptInterface
    fun pressBack(): String {
        val service = RiyaAgentService.instance ?: return errorResult("Accessibility Service inactive")
        val ok = service.pressBack()
        return if (ok) successResult("Pressed Back") else errorResult("Failed to perform back action")
    }

    @JavascriptInterface
    fun pressHome(): String {
        val service = RiyaAgentService.instance ?: return errorResult("Accessibility Service inactive")
        val ok = service.pressHome()
        return if (ok) successResult("Pressed Home") else errorResult("Failed to perform home action")
    }

    @JavascriptInterface
    fun takeScreenshot(): String {
        val service = RiyaAgentService.instance ?: return errorResult("Accessibility Service inactive")
        val latch = CountDownLatch(1)
        var base64Img: String? = null
        var errorMsg: String? = null

        service.captureScreenBase64 { img, err ->
            base64Img = img
            errorMsg = err
            latch.countDown()
        }

        try {
            latch.await(3000, TimeUnit.MILLISECONDS)
        } catch (e: InterruptedException) {
            return errorResult("Screenshot capture timed out")
        }

        return if (base64Img != null) {
            JSONObject().apply {
                put("status", "success")
                put("image_base64", base64Img)
            }.toString()
        } else {
            errorResult(errorMsg ?: "Failed to capture screenshot")
        }
    }

    // =========================================================================
    // Telegram Remote Bridge
    // =========================================================================
    @JavascriptInterface
    fun startTelegramBridge(token: String, chatId: String): String {
        return try {
            val intent = Intent(activity, TelegramService::class.java).apply {
                action = TelegramService.ACTION_START
                putExtra(TelegramService.EXTRA_BOT_TOKEN, token.trim())
                putExtra(TelegramService.EXTRA_CHAT_ID, chatId.trim())
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                activity.startForegroundService(intent)
            } else {
                activity.startService(intent)
            }
            successResult("Telegram Remote Control Service started")
        } catch (e: Exception) {
            errorResult("Failed to start Telegram Service: ${e.message}")
        }
    }

    @JavascriptInterface
    fun stopTelegramBridge(): String {
        return try {
            val intent = Intent(activity, TelegramService::class.java).apply {
                action = TelegramService.ACTION_STOP
            }
            activity.stopService(intent)
            successResult("Telegram Remote Control Service stopped")
        } catch (e: Exception) {
            errorResult("Failed to stop Telegram Service: ${e.message}")
        }
    }

    @JavascriptInterface
    fun isTelegramBridgeRunning(): Boolean {
        return TelegramService.isRunning
    }

    private fun successResult(msg: String): String {
        return JSONObject().apply {
            put("status", "success")
            put("message", msg)
        }.toString()
    }

    private fun errorResult(msg: String): String {
        return JSONObject().apply {
            put("status", "error")
            put("message", msg)
        }.toString()
    }
}

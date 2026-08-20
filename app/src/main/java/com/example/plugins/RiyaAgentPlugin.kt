package com.example.plugins

import android.app.Activity
import android.content.Intent
import android.provider.Settings
import android.webkit.JavascriptInterface
import com.example.service.RiyaAgentService
import org.json.JSONObject
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

class RiyaAgentPlugin(private val activity: Activity) {

    @JavascriptInterface
    fun isAccessibilityEnabled(): Boolean = RiyaAgentService.isServiceRunning

    @JavascriptInterface
    fun openAccessibilitySettings(): String {
        return try {
            activity.startActivity(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS).apply { 
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK) 
            })
            success("Opened settings")
        } catch (e: Exception) { error(e.message ?: "Failed") }
    }

    @JavascriptInterface
    fun getUiHierarchy(): String {
        val svc = RiyaAgentService.instance ?: return error("Service not running")
        return try { svc.getParsedUiHierarchy().toString() } catch (e: Exception) { error(e.message ?: "") }
    }

    @JavascriptInterface
    fun getForegroundPackage(): String = RiyaAgentService.instance?.getForegroundPackage() ?: ""

    @JavascriptInterface
    fun isSensitiveApp(pkg: String): Boolean = RiyaAgentService.isSensitivePackage(pkg)

    @JavascriptInterface
    fun tap(x: Float, y: Float): String {
        val svc = RiyaAgentService.instance ?: return error("Service inactive")
        val latch = CountDownLatch(1)
        var ok = false
        svc.tap(x, y) { ok = it; latch.countDown() }
        latch.await(1500, TimeUnit.MILLISECONDS)
        return if (ok) success("Tapped") else error("Tap failed")
    }

    @JavascriptInterface
    fun swipe(sX: Float, sY: Float, eX: Float, eY: Float, duration: Long): String {
        val svc = RiyaAgentService.instance ?: return error("Service inactive")
        val latch = CountDownLatch(1)
        var ok = false
        svc.swipe(sX, sY, eX, eY, duration) { ok = it; latch.countDown() }
        latch.await(duration + 1000, TimeUnit.MILLISECONDS)
        return if (ok) success("Swiped") else error("Swipe failed")
    }

    @JavascriptInterface
    fun typeText(text: String): String {
        val svc = RiyaAgentService.instance ?: return error("Service inactive")
        val latch = CountDownLatch(1)
        var ok = false; var msg = ""
        svc.typeText(text) { o, m -> ok = o; msg = m; latch.countDown() }
        latch.await(2000, TimeUnit.MILLISECONDS)
        return if (ok) success(msg) else error(msg)
    }

    @JavascriptInterface
    fun pressBack(): String {
        return if (RiyaAgentService.instance?.pressBack() == true) success("Back") else error("Back failed")
    }

    @JavascriptInterface
    fun pressHome(): String {
        return if (RiyaAgentService.instance?.pressHome() == true) success("Home") else error("Home failed")
    }

    private fun success(msg: String) = JSONObject().put("status", "success").put("message", msg).toString()
    private fun error(msg: String) = JSONObject().put("status", "error").put("message", msg).toString()
}

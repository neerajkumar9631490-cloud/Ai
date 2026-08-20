// FILE: app/src/main/java/com/example/service/RiyaAgentService.kt
package com.example.service

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.GestureDescription
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.Path
import android.graphics.Rect
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.util.Base64
import android.util.Log
import android.view.Display
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo
import org.json.JSONArray
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.util.concurrent.CountDownLatch
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

/**
 * RiyaAgentService: Autonomous Android Accessibility Service for on-device screen control,
 * UI tree parsing, gesture dispatching, and screenshot capture.
 */
class RiyaAgentService : AccessibilityService() {

    companion object {
        private const val TAG = "RiyaAgentService"
        var instance: RiyaAgentService? = null
            private set

        val isServiceRunning: Boolean
            get() = instance != null

        // Sensitive apps blocklist (Banking, Payments, Wallets, Crypto, Auth)
        private val SENSITIVE_PACKAGE_KEYWORDS = listOf(
            "bank", "pay", "wallet", "crypto", "auth", "otp", "token",
            "com.google.android.apps.nbu.paisa.user", // Google Pay
            "com.phonepe.app",                       // PhonePe
            "net.one97.paytm",                        // Paytm
            "com.cred.club",                          // CRED
            "com.sbi.upi", "com.sbi.lotusintouch",    // YONO SBI
            "com.hdfcbank.payzapp", "com.snapwork.hdfc", // HDFC
            "com.icicibank.imobile",                  // ICICI
            "com.axis.mobile",                        // Axis Bank
            "com.msf.kbank.mobile",                   // Kotak
            "com.zerodha.kite3", "com.nextbillion.groww" // Trading
        )

        fun isSensitivePackage(pkgName: String?): Boolean {
            if (pkgName.isNullOrBlank()) return false
            val lower = pkgName.lowercase()
            return SENSITIVE_PACKAGE_KEYWORDS.any { lower.contains(it) }
        }
    }

    private val mainHandler = Handler(Looper.getMainLooper())
    private val backgroundExecutor = Executors.newSingleThreadExecutor()
    private var currentPackage: String = ""

    override fun onServiceConnected() {
        super.onServiceConnected()
        instance = this
        Log.i(TAG, "Riya Autonomous Agent Accessibility Service CONNECTED")
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        if (event == null) return
        if (event.eventType == AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) {
            val pkg = event.packageName?.toString()
            if (!pkg.isNullOrEmpty()) {
                currentPackage = pkg
            }
        }
    }

    override fun onInterrupt() {
        Log.w(TAG, "Riya Autonomous Agent Service INTERRUPTED")
    }

    override fun onDestroy() {
        super.onDestroy()
        instance = null
        Log.i(TAG, "Riya Autonomous Agent Service DESTROYED")
    }

    fun getCurrentForegroundPackage(): String {
        return currentPackage.ifEmpty {
            rootInActiveWindow?.packageName?.toString() ?: ""
        }
    }

    // =========================================================================
    // 1. UI Hierarchy Extraction (Node Tree)
    // =========================================================================
    fun getParsedUiHierarchy(): JSONObject {
        val result = JSONObject()
        val root = rootInActiveWindow
        if (root == null) {
            result.put("status", "error")
            result.put("message", "No active window root found")
            return result
        }

        val foregroundPkg = root.packageName?.toString() ?: currentPackage
        result.put("status", "success")
        result.put("package", foregroundPkg)
        result.put("is_sensitive", isSensitivePackage(foregroundPkg))

        val nodesArray = JSONArray()
        var nodeIndex = 0
        traverseNode(root, nodesArray, nodeIndex)
        result.put("nodes", nodesArray)
        result.put("node_count", nodesArray.length())
        return result
    }

    private fun traverseNode(node: AccessibilityNodeInfo?, array: JSONArray, counter: Int): Int {
        if (node == null) return counter
        var nextCounter = counter

        if (node.isVisibleToUser) {
            val bounds = Rect()
            node.getBoundsInScreen(bounds)

            // Only index nodes within visible non-zero bounds
            if (bounds.width() > 0 && bounds.height() > 0) {
                val nodeObj = JSONObject()
                nodeObj.put("index", nextCounter++)
                nodeObj.put("id", node.viewIdResourceName ?: "")
                nodeObj.put("class", node.className?.toString() ?: "")
                nodeObj.put("text", node.text?.toString() ?: "")
                nodeObj.put("desc", node.contentDescription?.toString() ?: "")
                nodeObj.put("clickable", node.isClickable)
                nodeObj.put("editable", node.isEditable)
                nodeObj.put("scrollable", node.isScrollable)
                nodeObj.put("is_password", node.isPassword || isPasswordContext(node))
                
                val boundsObj = JSONObject()
                boundsObj.put("left", bounds.left)
                boundsObj.put("top", bounds.top)
                boundsObj.put("right", bounds.right)
                boundsObj.put("bottom", bounds.bottom)
                boundsObj.put("cx", bounds.centerX())
                boundsObj.put("cy", bounds.centerY())
                boundsObj.put("width", bounds.width())
                boundsObj.put("height", bounds.height())
                nodeObj.put("bounds", boundsObj)

                array.put(nodeObj)
            }
        }

        for (i in 0 until node.childCount) {
            val child = node.getChild(i) ?: continue
            nextCounter = traverseNode(child, array, nextCounter)
        }
        return nextCounter
    }

    private fun isPasswordContext(node: AccessibilityNodeInfo): Boolean {
        val text = (node.text?.toString() ?: "").lowercase()
        val desc = (node.contentDescription?.toString() ?: "").lowercase()
        val id = (node.viewIdResourceName ?: "").lowercase()
        val combined = "$text $desc $id"
        return combined.contains("password") || combined.contains("pin") || combined.contains("otp") || combined.contains("cvv")
    }

    // =========================================================================
    // 2. Gesture Dispatching Engine
    // =========================================================================
    fun tap(x: Float, y: Float, callback: ((Boolean) -> Unit)? = null) {
        val path = Path().apply { moveTo(x, y) }
        val stroke = GestureDescription.StrokeDescription(path, 0, 50)
        val gesture = GestureDescription.Builder().addStroke(stroke).build()
        dispatchGesture(gesture, object : GestureResultCallback() {
            override fun onCompleted(gestureDescription: GestureDescription?) {
                Log.d(TAG, "Tap completed at ($x, $y)")
                callback?.invoke(true)
            }

            override fun onCancelled(gestureDescription: GestureDescription?) {
                Log.w(TAG, "Tap cancelled at ($x, $y)")
                callback?.invoke(false)
            }
        }, mainHandler)
    }

    fun longPress(x: Float, y: Float, durationMs: Long = 1000L, callback: ((Boolean) -> Unit)? = null) {
        val path = Path().apply { moveTo(x, y) }
        val stroke = GestureDescription.StrokeDescription(path, 0, durationMs)
        val gesture = GestureDescription.Builder().addStroke(stroke).build()
        dispatchGesture(gesture, object : GestureResultCallback() {
            override fun onCompleted(gestureDescription: GestureDescription?) {
                Log.d(TAG, "LongPress completed at ($x, $y)")
                callback?.invoke(true)
            }

            override fun onCancelled(gestureDescription: GestureDescription?) {
                Log.w(TAG, "LongPress cancelled at ($x, $y)")
                callback?.invoke(false)
            }
        }, mainHandler)
    }

    fun swipe(startX: Float, startY: Float, endX: Float, endY: Float, durationMs: Long = 300L, callback: ((Boolean) -> Unit)? = null) {
        val path = Path().apply {
            moveTo(startX, startY)
            lineTo(endX, endY)
        }
        val stroke = GestureDescription.StrokeDescription(path, 0, durationMs)
        val gesture = GestureDescription.Builder().addStroke(stroke).build()
        dispatchGesture(gesture, object : GestureResultCallback() {
            override fun onCompleted(gestureDescription: GestureDescription?) {
                Log.d(TAG, "Swipe completed from ($startX,$startY) to ($endX,$endY)")
                callback?.invoke(true)
            }

            override fun onCancelled(gestureDescription: GestureDescription?) {
                Log.w(TAG, "Swipe cancelled from ($startX,$startY) to ($endX,$endY)")
                callback?.invoke(false)
            }
        }, mainHandler)
    }

    fun typeText(text: String, callback: ((Boolean, String) -> Unit)? = null) {
        val root = rootInActiveWindow
        if (root == null) {
            callback?.invoke(false, "No active window root to type into")
            return
        }

        // Find focused editable node or first editable node
        var targetNode: AccessibilityNodeInfo? = root.findFocus(AccessibilityNodeInfo.FOCUS_INPUT)
        if (targetNode == null || !targetNode.isEditable) {
            targetNode = findFirstEditableNode(root)
        }

        if (targetNode == null) {
            callback?.invoke(false, "No editable input field found on screen")
            return
        }

        // Password protection safety rail
        if (targetNode.isPassword || isPasswordContext(targetNode)) {
            callback?.invoke(false, "Safety Rail Triggered: Typing into password or PIN fields is strictly prohibited.")
            return
        }

        val arguments = Bundle().apply {
            putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE, text)
        }
        val success = targetNode.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, arguments)
        if (success) {
            callback?.invoke(true, "Typed '$text' into active input field")
        } else {
            callback?.invoke(false, "Failed to perform ACTION_SET_TEXT on target node")
        }
    }

    private fun findFirstEditableNode(node: AccessibilityNodeInfo?): AccessibilityNodeInfo? {
        if (node == null) return null
        if (node.isEditable && node.isVisibleToUser) return node
        for (i in 0 until node.childCount) {
            val child = node.getChild(i)
            val found = findFirstEditableNode(child)
            if (found != null) return found
        }
        return null
    }

    fun scrollIntoView(text: String, callback: ((Boolean, String) -> Unit)? = null) {
        val root = rootInActiveWindow
        if (root == null) {
            callback?.invoke(false, "No active window root")
            return
        }

        val found = root.findAccessibilityNodeInfosByText(text)
        if (!found.isNullOrEmpty()) {
            callback?.invoke(true, "Element with text '$text' is already visible")
            return
        }

        val scrollableNode = findScrollableNode(root)
        if (scrollableNode != null) {
            val scrolled = scrollableNode.performAction(AccessibilityNodeInfo.ACTION_SCROLL_FORWARD)
            if (scrolled) {
                callback?.invoke(true, "Scrolled forward looking for '$text'")
            } else {
                callback?.invoke(false, "Scroll forward failed on scrollable container")
            }
        } else {
            // Fallback gesture scroll
            val displayMetrics = resources.displayMetrics
            val cx = displayMetrics.widthPixels / 2f
            val startY = displayMetrics.heightPixels * 0.75f
            val endY = displayMetrics.heightPixels * 0.25f
            swipe(cx, startY, cx, endY, 400L) { ok ->
                callback?.invoke(ok, if (ok) "Dispatched fallback scroll swipe" else "Scroll swipe failed")
            }
        }
    }

    private fun findScrollableNode(node: AccessibilityNodeInfo?): AccessibilityNodeInfo? {
        if (node == null) return null
        if (node.isScrollable && node.isVisibleToUser) return node
        for (i in 0 until node.childCount) {
            val child = node.getChild(i)
            val found = findScrollableNode(child)
            if (found != null) return found
        }
        return null
    }

    fun pressBack(): Boolean {
        return performGlobalAction(GLOBAL_ACTION_BACK)
    }

    fun pressHome(): Boolean {
        return performGlobalAction(GLOBAL_ACTION_HOME)
    }

    // =========================================================================
    // 3. Screenshot Capture (Android 11+ Native Accessibility API)
    // =========================================================================
    fun captureScreenBase64(callback: (String?, String?) -> Unit) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            takeScreenshot(Display.DEFAULT_DISPLAY, backgroundExecutor, object : TakeScreenshotCallback {
                override fun onSuccess(screenshot: ScreenshotResult) {
                    val hardwareBuffer = screenshot.hardwareBuffer
                    val colorSpace = screenshot.colorSpace
                    val bitmap = Bitmap.wrapHardwareBuffer(hardwareBuffer, colorSpace)
                    hardwareBuffer.close()

                    if (bitmap == null) {
                        callback(null, "Failed to wrap hardware buffer into Bitmap")
                        return
                    }

                    // Copy to software bitmap for JPEG compression
                    val softwareBitmap = bitmap.copy(Bitmap.Config.ARGB_8888, false)
                    val outputStream = ByteArrayOutputStream()
                    // Downscale to 720p max for fast transmission to Gemini Vision
                    val scaled = scaleBitmap(softwareBitmap, 1280)
                    scaled.compress(Bitmap.CompressFormat.JPEG, 75, outputStream)
                    val base64 = Base64.encodeToString(outputStream.toByteArray(), Base64.NO_WRAP)
                    callback(base64, null)
                }

                override fun onFailure(errorCode: Int) {
                    Log.e(TAG, "takeScreenshot failed with error code: $errorCode")
                    callback(null, "Accessibility takeScreenshot failed with error code $errorCode")
                }
            })
        } else {
            callback(null, "Native takeScreenshot requires Android 11 (API 30) or above")
        }
    }

    private fun scaleBitmap(bm: Bitmap, maxDim: Int): Bitmap {
        val width = bm.width
        val height = bm.height
        if (width <= maxDim && height <= maxDim) return bm
        val ratio = width.toFloat() / height.toFloat()
        val newW: Int
        val newH: Int
        if (width > height) {
            newW = maxDim
            newH = (maxDim / ratio).toInt()
        } else {
            newH = maxDim
            newW = (maxDim * ratio).toInt()
        }
        return Bitmap.createScaledBitmap(bm, newW, newH, true)
    }
}

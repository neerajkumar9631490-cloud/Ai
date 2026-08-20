package com.example.service

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.GestureDescription
import android.graphics.Path
import android.graphics.Rect
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo
import org.json.JSONArray
import org.json.JSONObject

class RiyaAgentService : AccessibilityService() {
    companion object {
        private const val TAG = "RiyaAgentService"
        var instance: RiyaAgentService? = null; private set
        val isServiceRunning: Boolean get() = instance != null
        
        private val SENSITIVE_KEYWORDS = listOf("bank", "pay", "wallet", "crypto", "auth", "otp", "pin", "password")
        fun isSensitivePackage(pkg: String?): Boolean {
            if (pkg.isNullOrBlank()) return false
            val lower = pkg.lowercase()
            return SENSITIVE_KEYWORDS.any { lower.contains(it) }
        }
    }

    private val mainHandler = Handler(Looper.getMainLooper())

    override fun onServiceConnected() {
        super.onServiceConnected()
        instance = this
        Log.i(TAG, "Riya Agent Service CONNECTED")
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {}
    override fun onInterrupt() {}
    override fun onDestroy() {
        super.onDestroy()
        instance = null
    }

    fun getForegroundPackage(): String = rootInActiveWindow?.packageName?.toString() ?: ""

    fun getParsedUiHierarchy(): JSONObject {
        val result = JSONObject()
        val root = rootInActiveWindow ?: return result.put("status", "error") as JSONObject
        result.put("status", "success")
        val nodes = JSONArray()
        var idx = 0
        traverse(root, nodes, idx)
        result.put("nodes", nodes)
        return result
    }

    private fun traverse(node: AccessibilityNodeInfo?, arr: JSONArray, counter: Int): Int {
        if (node == null) return counter
        var c = counter
        if (node.isVisibleToUser) {
            val bounds = Rect()
            node.getBoundsInScreen(bounds)
            if (bounds.width() > 0 && bounds.height() > 0) {
                val obj = JSONObject()
                obj.put("id", node.viewIdResourceName ?: "")
                obj.put("class", node.className?.toString() ?: "")
                obj.put("text", node.text?.toString() ?: "")
                obj.put("desc", node.contentDescription?.toString() ?: "")
                obj.put("clickable", node.isClickable)
                obj.put("editable", node.isEditable)
                obj.put("is_password", node.isPassword)
                val b = JSONObject().apply { 
                    put("cx", bounds.centerX()); put("cy", bounds.centerY())
                    put("left", bounds.left); put("top", bounds.top)
                    put("right", bounds.right); put("bottom", bounds.bottom)
                }
                obj.put("bounds", b)
                arr.put(obj)
                c++
            }
        }
        for (i in 0 until node.childCount) c = traverse(node.getChild(i), arr, c)
        return c
    }

    fun tap(x: Float, y: Float, callback: (Boolean) -> Unit) {
        val path = Path().apply { moveTo(x, y) }
        val stroke = GestureDescription.StrokeDescription(path, 0, 50)
        dispatchGesture(GestureDescription.Builder().addStroke(stroke).build(), 
            object : GestureResultCallback() {
                override fun onCompleted(g: GestureDescription?) { callback(true) }
                override fun onCancelled(g: GestureDescription?) { callback(false) }
            }, mainHandler)
    }

    fun swipe(sX: Float, sY: Float, eX: Float, eY: Float, duration: Long, callback: (Boolean) -> Unit) {
        val path = Path().apply { moveTo(sX, sY); lineTo(eX, eY) }
        val stroke = GestureDescription.StrokeDescription(path, 0, duration)
        dispatchGesture(GestureDescription.Builder().addStroke(stroke).build(),
            object : GestureResultCallback() {
                override fun onCompleted(g: GestureDescription?) { callback(true) }
                override fun onCancelled(g: GestureDescription?) { callback(false) }
            }, mainHandler)
    }

    fun typeText(text: String, callback: (Boolean, String) -> Unit) {
        val root = rootInActiveWindow ?: run { callback(false, "No root"); return }
        var target = root.findFocus(AccessibilityNodeInfo.FOCUS_INPUT)
        if (target == null || !target.isEditable) target = findEditable(root)
        if (target == null) { callback(false, "No editable field found"); return }
        if (target.isPassword) { callback(false, "Blocked: Password field"); return }
        
        val args = Bundle().apply { putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE, text) }
        val success = target.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, args)
        callback(success, if(success) "Typed text" else "Type failed")
    }

    private fun findEditable(node: AccessibilityNodeInfo?): AccessibilityNodeInfo? {
        if (node == null) return null
        if (node.isEditable && node.isVisibleToUser) return node
        for (i in 0 until node.childCount) {
            val found = findEditable(node.getChild(i))
            if (found != null) return found
        }
        return null
    }

    fun pressBack(): Boolean = performGlobalAction(GLOBAL_ACTION_BACK)
    fun pressHome(): Boolean = performGlobalAction(GLOBAL_ACTION_HOME)
}

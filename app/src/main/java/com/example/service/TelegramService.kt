// FILE: app/src/main/java/com/example/service/TelegramService.kt
package com.example.service

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.IBinder
import android.util.Log
import androidx.core.app.NotificationCompat
import com.example.MainActivity
import com.example.R
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import org.json.JSONArray
import org.json.JSONObject
import java.io.BufferedReader
import java.io.InputStreamReader
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL

/**
 * TelegramService: Background service polling Telegram Bot API for remote autonomous control.
 * Commands starting with "/riya <task>" trigger on-device autonomous execution.
 */
class TelegramService : Service() {

    companion object {
        private const val TAG = "TelegramService"
        const val CHANNEL_ID = "riya_telegram_channel"
        const val NOTIFICATION_ID = 5001
        const val ACTION_START = "com.aistudio.riya.telegram.START"
        const val ACTION_STOP = "com.aistudio.riya.telegram.STOP"
        const val ACTION_REMOTE_TASK = "com.aistudio.riya.ACTION_REMOTE_TASK"
        const val EXTRA_BOT_TOKEN = "extra_bot_token"
        const val EXTRA_CHAT_ID = "extra_chat_id"
        const val EXTRA_TASK_TEXT = "extra_task_text"

        var isRunning = false
            private set

        private var activeBotToken: String = ""
        private var activeChatId: String = ""

        fun sendTelegramMessage(text: String) {
            if (activeBotToken.isBlank() || activeChatId.isBlank()) return
            CoroutineScope(Dispatchers.IO).launch {
                try {
                    val endpoint = "https://api.telegram.org/bot$activeBotToken/sendMessage"
                    val url = URL(endpoint)
                    val conn = (url.openConnection() as HttpURLConnection).apply {
                        requestMethod = "POST"
                        doOutput = true
                        setRequestProperty("Content-Type", "application/json")
                        connectTimeout = 8000
                        readTimeout = 8000
                    }
                    val json = JSONObject().apply {
                        put("chat_id", activeChatId)
                        put("text", "🤖 Riya: $text")
                    }
                    OutputStreamWriter(conn.outputStream).use { it.write(json.toString()) }
                    conn.responseCode
                    conn.disconnect()
                } catch (e: Exception) {
                    Log.e(TAG, "Failed to send telegram message: ${e.message}")
                }
            }
        }
    }

    private val serviceScope = CoroutineScope(Dispatchers.IO + Job())
    private var pollJob: Job? = null
    private var lastUpdateId = 0L

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent == null) return START_NOT_STICKY

        when (intent.action) {
            ACTION_START -> {
                val token = intent.getStringExtra(EXTRA_BOT_TOKEN) ?: ""
                val chatId = intent.getStringExtra(EXTRA_CHAT_ID) ?: ""
                if (token.isNotBlank()) {
                    activeBotToken = token
                    activeChatId = chatId
                    startForeground(NOTIFICATION_ID, buildNotification("Listening for Telegram commands..."))
                    isRunning = true
                    startPolling()
                }
            }
            ACTION_STOP -> {
                stopPolling()
                stopForeground(true)
                stopSelf()
            }
        }
        return START_STICKY
    }

    override fun onDestroy() {
        super.onDestroy()
        stopPolling()
        isRunning = false
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Riya Telegram Remote Control",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Monitors Telegram bot commands for remote autonomous actions"
                setShowBadge(false)
            }
            val manager = getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(channel)
        }
    }

    private fun buildNotification(statusText: String): Notification {
        val tapIntent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val pendingIntent = PendingIntent.getActivity(
            this,
            0,
            tapIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Riya Remote Telegram Bridge")
            .setContentText(statusText)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()
    }

    private fun startPolling() {
        pollJob?.cancel()
        pollJob = serviceScope.launch {
            Log.i(TAG, "Telegram polling loop initiated")
            while (isActive) {
                try {
                    pollUpdates()
                } catch (e: Exception) {
                    Log.e(TAG, "Error in Telegram polling: ${e.message}")
                }
                delay(3000L) // Poll every 3s
            }
        }
    }

    private fun stopPolling() {
        pollJob?.cancel()
        pollJob = null
        isRunning = false
    }

    private fun pollUpdates() {
        if (activeBotToken.isBlank()) return
        val urlStr = "https://api.telegram.org/bot$activeBotToken/getUpdates?offset=${lastUpdateId + 1}&timeout=5"
        val url = URL(urlStr)
        val conn = (url.openConnection() as HttpURLConnection).apply {
            requestMethod = "GET"
            connectTimeout = 8000
            readTimeout = 8000
        }

        if (conn.responseCode == 200) {
            val responseText = BufferedReader(InputStreamReader(conn.inputStream)).use { it.readText() }
            val json = JSONObject(responseText)
            if (json.optBoolean("ok", false)) {
                val results = json.optJSONArray("result") ?: JSONArray()
                for (i in 0 until results.length()) {
                    val update = results.getJSONObject(i)
                    val updateId = update.getLong("update_id")
                    if (updateId > lastUpdateId) {
                        lastUpdateId = updateId
                    }

                    val message = update.optJSONObject("message") ?: continue
                    val text = message.optString("text", "").trim()
                    val fromChat = message.optJSONObject("chat")?.optLong("id")?.toString() ?: ""

                    if (activeChatId.isBlank() && fromChat.isNotBlank()) {
                        activeChatId = fromChat
                    }

                    if (text.isNotBlank()) {
                        handleIncomingCommand(text, fromChat)
                    }
                }
            }
        }
        conn.disconnect()
    }

    private fun handleIncomingCommand(text: String, chatId: String) {
        val lower = text.lowercase()
        var task = ""

        if (lower.startsWith("/riya ")) {
            task = text.substring(6).trim()
        } else if (lower.startsWith("/agent ")) {
            task = text.substring(7).trim()
        } else if (lower == "/status") {
            sendTelegramMessage("Riya is online. Autonomous Agent: ${if (RiyaAgentService.isServiceRunning) "ACTIVE" else "ACCESSIBILITY NOT ENABLED"}.")
            return
        } else if (lower == "/stop") {
            val stopIntent = Intent("com.aistudio.riya.ACTION_STOP_AGENT")
            sendBroadcast(stopIntent)
            sendTelegramMessage("Issued STOP command to active agent loop.")
            return
        }

        if (task.isNotBlank()) {
            sendTelegramMessage("Received task: '$task'. Initiating autonomous on-device planner...")
            val taskIntent = Intent(this, MainActivity::class.java).apply {
                action = ACTION_REMOTE_TASK
                putExtra(EXTRA_TASK_TEXT, task)
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP
            }
            startActivity(taskIntent)
        }
    }
}

package com.example.service

import android.app.Service
import android.content.Intent
import android.os.IBinder

class TelegramService : Service() {
    companion object {
        const val ACTION_START = "com.example.telegram.START"
        const val ACTION_STOP = "com.example.telegram.STOP"
        const val ACTION_REMOTE_TASK = "com.example.telegram.REMOTE_TASK"
        const val EXTRA_TASK_TEXT = "extra_task_text"
        var isRunning = false; private set
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_START -> isRunning = true
            ACTION_STOP -> { isRunning = false; stopSelf() }
        }
        return START_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null
}

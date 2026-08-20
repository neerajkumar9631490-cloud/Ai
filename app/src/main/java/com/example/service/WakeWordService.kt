package com.example.service

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import android.os.VibrationEffect
import android.os.Vibrator
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.util.Log
import androidx.core.app.NotificationCompat
import com.example.MainActivity
import com.example.R
import java.util.Locale

/**
 * WakeWordService: Background foreground service that keeps Android SpeechRecognizer
 * active in a continuous loop to detect the "[hey riya]" wake phrase.
 */
class WakeWordService : Service(), RecognitionListener {

    companion object {
        private const val TAG = "Riya_WakeWord"
        const val CHANNEL_ID = "riya_wake_channel"
        const val NOTIFICATION_ID = 4096
        const val ACTION_START = "com.aistudio.riya.service.START"
        const val ACTION_STOP = "com.aistudio.riya.service.STOP"
        const val ACTION_WAKE_DETECTED = "com.aistudio.riya.ACTION_WAKE_ACTIVATED"
        const val EXTRA_WAKE_PHRASE = "extra_wake_phrase"
    }

    private var speechRecognizer: SpeechRecognizer? = null
    private var recognizerIntent: Intent? = null
    private var isListening = false
    private var targetWakePhrase = "hey riya"
    private var wakeLock: PowerManager.WakeLock? = null
    private val mainHandler = Handler(Looper.getMainLooper())

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()

        val powerManager = getSystemService(Context.POWER_SERVICE) as PowerManager
        wakeLock = powerManager.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "Riya:WakeLock")
        wakeLock?.acquire(10 * 60 * 1000L) // 10 min safe window

        initSpeechRecognizer()
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Riya Wake Word Listener",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Monitors background wake word 'hey riya'"
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
            .setContentTitle("Riya Core Standby")
            .setContentText(statusText)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .build()
    }

    private fun initSpeechRecognizer() {
        if (!SpeechRecognizer.isRecognitionAvailable(this)) {
            Log.w(TAG, "SpeechRecognizer is not available on this device.")
            return
        }

        speechRecognizer = SpeechRecognizer.createSpeechRecognizer(this).apply {
            setRecognitionListener(this@WakeWordService)
        }

        recognizerIntent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            putExtra(RecognizerIntent.EXTRA_LANGUAGE, Locale.getDefault())
            putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
            putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 3)
            putExtra(RecognizerIntent.EXTRA_CALLING_PACKAGE, packageName)
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val action = intent?.action
        if (action == ACTION_STOP) {
            stopListening()
            stopForeground(STOP_FOREGROUND_REMOVE)
            stopSelf()
            return START_NOT_STICKY
        }

        val customPhrase = intent?.getStringExtra(EXTRA_WAKE_PHRASE)
        if (!customPhrase.isNullOrBlank()) {
            targetWakePhrase = customPhrase.trim().lowercase()
        }

        val notification = buildNotification("Awaiting voice trigger: \"$targetWakePhrase\"")
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE)
        } else {
            startForeground(NOTIFICATION_ID, notification)
        }

        startListeningLoop()
        return START_STICKY
    }

    private fun startListeningLoop() {
        if (speechRecognizer == null) {
            initSpeechRecognizer()
        }
        mainHandler.post {
            try {
                if (!isListening && speechRecognizer != null && recognizerIntent != null) {
                    isListening = true
                    speechRecognizer?.startListening(recognizerIntent)
                    Log.d(TAG, "Wake listener loop initiated.")
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error starting speech listener: ${e.message}")
                scheduleRestart(1500)
            }
        }
    }

    private fun stopListening() {
        isListening = false
        try {
            speechRecognizer?.stopListening()
            speechRecognizer?.cancel()
            speechRecognizer?.destroy()
            speechRecognizer = null
        } catch (e: Exception) {
            Log.e(TAG, "Error destroying speech recognizer: ${e.message}")
        }
    }

    private fun scheduleRestart(delayMs: Long) {
        mainHandler.postDelayed({
            if (speechRecognizer != null) {
                try {
                    speechRecognizer?.cancel()
                    isListening = true
                    speechRecognizer?.startListening(recognizerIntent)
                } catch (e: Exception) {
                    Log.e(TAG, "Restart failed: ${e.message}")
                    initSpeechRecognizer()
                    startListeningLoop()
                }
            }
        }, delayMs)
    }

    private fun checkTextForWake(text: String) {
        val normalized = text.lowercase().trim()
        val targets = listOf(
            targetWakePhrase,
            "hey riya",
            "hey reeya",
            "hey reea",
            "riya",
            "reeya"
        )

        val isTriggered = targets.any { normalized.contains(it) }

        if (isTriggered) {
            Log.i(TAG, "Wake phrase triggered! Matched: $normalized")
            triggerWakeAction()
        }
    }

    private fun triggerWakeAction() {
        // Haptic feedback
        val vibrator = getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            vibrator.vibrate(VibrationEffect.createOneShot(150, VibrationEffect.DEFAULT_AMPLITUDE))
        } else {
            @Suppress("DEPRECATION")
            vibrator.vibrate(150)
        }

        // Launch MainActivity and bring to foreground
        val launchIntent = Intent(this, MainActivity::class.java).apply {
            action = ACTION_WAKE_DETECTED
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_REORDER_TO_FRONT or Intent.FLAG_ACTIVITY_SINGLE_TOP
        }
        startActivity(launchIntent)

        // Broadcast locally to notify active UI
        val broadcastIntent = Intent(ACTION_WAKE_DETECTED)
        sendBroadcast(broadcastIntent)
    }

    // Speech Recognition Callbacks
    override fun onReadyForSpeech(params: Bundle?) {}
    override fun onBeginningOfSpeech() {}
    override fun onRmsChanged(rmsdB: Float) {}
    override fun onBufferReceived(buffer: ByteArray?) {}
    override fun onEndOfSpeech() {}

    override fun onError(error: Int) {
        Log.w(TAG, "SpeechRecognizer error code: $error. Rescheduling...")
        isListening = false
        // Error codes like NO_MATCH or SPEECH_TIMEOUT are normal during standby
        val restartDelay = when (error) {
            SpeechRecognizer.ERROR_NO_MATCH,
            SpeechRecognizer.ERROR_SPEECH_TIMEOUT -> 300L
            SpeechRecognizer.ERROR_RECOGNIZER_BUSY -> 800L
            else -> 1500L
        }
        scheduleRestart(restartDelay)
    }

    override fun onResults(results: Bundle?) {
        isListening = false
        val matches = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
        matches?.forEach { checkTextForWake(it) }
        scheduleRestart(200L)
    }

    override fun onPartialResults(partialResults: Bundle?) {
        val matches = partialResults?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
        matches?.forEach { checkTextForWake(it) }
    }

    override fun onEvent(eventType: Int, params: Bundle?) {}

    override fun onDestroy() {
        stopListening()
        if (wakeLock?.isHeld == true) {
            wakeLock?.release()
        }
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null
}

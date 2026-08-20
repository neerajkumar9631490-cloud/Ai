// FILE: app/src/main/java/com/example/plugins/SystemBridgePlugin.kt
package com.example.plugins

import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.hardware.camera2.CameraAccessException
import android.hardware.camera2.CameraManager
import android.media.AudioManager
import android.net.Uri
import android.provider.AlarmClock
import android.provider.MediaStore
import android.provider.Settings
import android.webkit.JavascriptInterface
import com.example.MainActivity
import org.json.JSONArray
import org.json.JSONObject

/**
 * SystemBridgePlugin: Exposes native Android OS device capabilities to the WebView / JavaScript runtime
 * for the 11 Gemini Live Action Bridge function calling tools.
 */
class SystemBridgePlugin(private val activity: MainActivity) {

    private val cameraManager: CameraManager by lazy {
        activity.getSystemService(Context.CAMERA_SERVICE) as CameraManager
    }

    private val audioManager: AudioManager by lazy {
        activity.getSystemService(Context.AUDIO_SERVICE) as AudioManager
    }

    /**
     * Request microphone permission explicitly from Web / SetupWizard
     */
    @JavascriptInterface
    fun requestAudioPermission() {
        activity.requestAudioPermission()
    }

    /**
     * Tool 1: open_app
     */
    @JavascriptInterface
    fun openApp(payloadJson: String): String {
        return try {
            val json = JSONObject(payloadJson)
            val appName = json.optString("app_name", "").lowercase().trim()
            val pm = activity.packageManager

            // Known common packages mapping
            val knownMap = mapOf(
                "chrome" to "com.android.chrome",
                "google chrome" to "com.android.chrome",
                "browser" to "com.android.chrome",
                "youtube" to "com.google.android.youtube",
                "maps" to "com.google.android.apps.maps",
                "google maps" to "com.google.android.apps.maps",
                "whatsapp" to "com.whatsapp",
                "spotify" to "com.spotify.music",
                "camera" to "camera_intent",
                "settings" to "settings_intent",
                "clock" to "com.google.android.deskclock",
                "calculator" to "com.google.android.calculator",
                "photos" to "com.google.android.apps.photos",
                "gallery" to "com.google.android.apps.photos",
                "gmail" to "com.google.android.gm",
                "email" to "com.google.android.gm",
                "play store" to "com.android.vending",
                "store" to "com.android.vending"
            )

            val targetPackage = knownMap[appName]

            if (targetPackage == "camera_intent") {
                return takePhoto()
            } else if (targetPackage == "settings_intent") {
                val intent = Intent(Settings.ACTION_SETTINGS).apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                activity.startActivity(intent)
                return successResult("System Settings opened successfully.")
            }

            var launchIntent: Intent? = null
            if (targetPackage != null) {
                launchIntent = pm.getLaunchIntentForPackage(targetPackage)
            }

            if (launchIntent == null) {
                // Search installed applications matching name
                val installed = pm.getInstalledApplications(PackageManager.GET_META_DATA)
                for (appInfo in installed) {
                    val label = pm.getApplicationLabel(appInfo).toString().lowercase()
                    if (label.contains(appName) || appName.contains(label)) {
                        launchIntent = pm.getLaunchIntentForPackage(appInfo.packageName)
                        if (launchIntent != null) break
                    }
                }
            }

            if (launchIntent != null) {
                launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                activity.startActivity(launchIntent)
                successResult("Application '$appName' opened successfully.")
            } else {
                // Fallback: search in Google Play Store
                val playIntent = Intent(Intent.ACTION_VIEW, Uri.parse("market://search?q=$appName")).apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                if (playIntent.resolveActivity(pm) != null) {
                    activity.startActivity(playIntent)
                    successResult("Application '$appName' not installed directly; opened Google Play Store search.")
                } else {
                    errorResult("Application '$appName' could not be found or launched.")
                }
            }
        } catch (e: Exception) {
            errorResult("Failed to open app: ${e.localizedMessage}")
        }
    }

    /**
     * Tool 2: set_alarm
     */
    @JavascriptInterface
    fun setAlarm(payloadJson: String): String {
        return try {
            val json = JSONObject(payloadJson)
            val hour = json.getInt("hour")
            val minutes = json.getInt("minutes")
            val message = json.optString("message", "Riya Alarm")

            val intent = Intent(AlarmClock.ACTION_SET_ALARM).apply {
                putExtra(AlarmClock.EXTRA_HOUR, hour)
                putExtra(AlarmClock.EXTRA_MINUTES, minutes)
                putExtra(AlarmClock.EXTRA_MESSAGE, message)
                putExtra(AlarmClock.EXTRA_SKIP_UI, true)
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }

            if (intent.resolveActivity(activity.packageManager) != null) {
                activity.startActivity(intent)
                val timeStr = String.format("%02d:%02d", hour, minutes)
                successResult("Alarm set for $timeStr with label '$message'.")
            } else {
                errorResult("No clock app available to set alarm.")
            }
        } catch (e: Exception) {
            errorResult("Failed to set alarm: ${e.localizedMessage}")
        }
    }

    /**
     * Tool 3: set_timer
     */
    @JavascriptInterface
    fun setTimer(payloadJson: String): String {
        return try {
            val json = JSONObject(payloadJson)
            val seconds = json.getInt("seconds")
            val message = json.optString("message", "Riya Timer")

            val intent = Intent(AlarmClock.ACTION_SET_TIMER).apply {
                putExtra(AlarmClock.EXTRA_LENGTH, seconds)
                putExtra(AlarmClock.EXTRA_MESSAGE, message)
                putExtra(AlarmClock.EXTRA_SKIP_UI, true)
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }

            if (intent.resolveActivity(activity.packageManager) != null) {
                activity.startActivity(intent)
                successResult("Timer set for $seconds seconds with label '$message'.")
            } else {
                errorResult("No timer app available to set timer.")
            }
        } catch (e: Exception) {
            errorResult("Failed to set timer: ${e.localizedMessage}")
        }
    }

    /**
     * Tool 4: set_torch
     */
    @JavascriptInterface
    fun setTorch(payloadJson: String): String {
        return try {
            val json = JSONObject(payloadJson)
            val state = json.optBoolean("state", true)
            val cameraId = cameraManager.cameraIdList.firstOrNull { id ->
                val characteristics = cameraManager.getCameraCharacteristics(id)
                characteristics.get(android.hardware.camera2.CameraCharacteristics.FLASH_INFO_AVAILABLE) == true
            }

            if (cameraId != null) {
                cameraManager.setTorchMode(cameraId, state)
                successResult("Flashlight ${if (state) "turned ON" else "turned OFF"}.")
            } else {
                errorResult("Flashlight hardware not available on this device.")
            }
        } catch (e: CameraAccessException) {
            errorResult("Camera access error: ${e.localizedMessage}")
        } catch (e: Exception) {
            errorResult("Failed to toggle flashlight: ${e.localizedMessage}")
        }
    }

    /**
     * Tool 5: set_volume
     */
    @JavascriptInterface
    fun setVolume(payloadJson: String): String {
        return try {
            val json = JSONObject(payloadJson)
            val streamTypeStr = json.optString("stream", "media").lowercase()
            val levelPercent = json.optInt("level", 50).coerceIn(0, 100)

            val streamType = when (streamTypeStr) {
                "media", "music" -> AudioManager.STREAM_MUSIC
                "ring", "ringer" -> AudioManager.STREAM_RING
                "alarm" -> AudioManager.STREAM_ALARM
                "notification" -> AudioManager.STREAM_NOTIFICATION
                "voice", "call" -> AudioManager.STREAM_VOICE_CALL
                else -> AudioManager.STREAM_MUSIC
            }

            val maxVolume = audioManager.getStreamMaxVolume(streamType)
            val targetVolume = (levelPercent * maxVolume) / 100

            audioManager.setStreamVolume(streamType, targetVolume, AudioManager.FLAG_SHOW_UI)
            successResult("Volume for $streamTypeStr set to $levelPercent% ($targetVolume/$maxVolume).")
        } catch (e: Exception) {
            errorResult("Failed to set volume: ${e.localizedMessage}")
        }
    }

    /**
     * Tool 6: prepare_sms
     */
    @JavascriptInterface
    fun prepareSms(payloadJson: String): String {
        return try {
            val json = JSONObject(payloadJson)
            val phoneNumber = json.optString("phone_number", "")
            val message = json.optString("message", "")

            val uri = Uri.parse("smsto:$phoneNumber")
            val intent = Intent(Intent.ACTION_SENDTO, uri).apply {
                putExtra("sms_body", message)
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }

            if (intent.resolveActivity(activity.packageManager) != null) {
                activity.startActivity(intent)
                successResult("SMS draft prepared for $phoneNumber.")
            } else {
                errorResult("No messaging app available to prepare SMS.")
            }
        } catch (e: Exception) {
            errorResult("Failed to prepare SMS: ${e.localizedMessage}")
        }
    }

    /**
     * Tool 7: open_whatsapp_to
     */
    @JavascriptInterface
    fun openWhatsappTo(payloadJson: String): String {
        return try {
            val json = JSONObject(payloadJson)
            val phoneNumber = json.optString("phone_number", "").replace("+", "").replace(" ", "").replace("-", "")
            val message = json.optString("message", "")

            val encodedMsg = Uri.encode(message)
            val uri = if (phoneNumber.isNotEmpty()) {
                Uri.parse("https://api.whatsapp.com/send?phone=$phoneNumber&text=$encodedMsg")
            } else {
                Uri.parse("https://api.whatsapp.com/send?text=$encodedMsg")
            }

            val intent = Intent(Intent.ACTION_VIEW, uri).apply {
                setPackage("com.whatsapp")
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }

            if (intent.resolveActivity(activity.packageManager) != null) {
                activity.startActivity(intent)
                successResult("WhatsApp opened with message draft.")
            } else {
                val webIntent = Intent(Intent.ACTION_VIEW, uri).apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                activity.startActivity(webIntent)
                successResult("WhatsApp intent routed via web browser.")
            }
        } catch (e: Exception) {
            errorResult("Failed to open WhatsApp: ${e.localizedMessage}")
        }
    }

    /**
     * Tool 8: open_maps
     */
    @JavascriptInterface
    fun openMaps(payloadJson: String): String {
        return try {
            val json = JSONObject(payloadJson)
            val query = json.optString("query", "")
            val encodedQuery = Uri.encode(query)
            val gmmIntentUri = Uri.parse("geo:0,0?q=$encodedQuery")

            val mapIntent = Intent(Intent.ACTION_VIEW, gmmIntentUri).apply {
                setPackage("com.google.android.apps.maps")
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }

            if (mapIntent.resolveActivity(activity.packageManager) != null) {
                activity.startActivity(mapIntent)
                successResult("Google Maps opened searching for '$query'.")
            } else {
                val genericMapIntent = Intent(Intent.ACTION_VIEW, Uri.parse("https://www.google.com/maps/search/?api=1&query=$encodedQuery")).apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                activity.startActivity(genericMapIntent)
                successResult("Maps search for '$query' opened in browser.")
            }
        } catch (e: Exception) {
            errorResult("Failed to open maps: ${e.localizedMessage}")
        }
    }

    /**
     * Tool 9: web_search
     */
    @JavascriptInterface
    fun webSearch(payloadJson: String): String {
        return try {
            val json = JSONObject(payloadJson)
            val query = json.optString("query", "")

            val intent = Intent(Intent.ACTION_WEB_SEARCH).apply {
                putExtra(android.app.SearchManager.QUERY, query)
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }

            if (intent.resolveActivity(activity.packageManager) != null) {
                activity.startActivity(intent)
                successResult("Web search for '$query' launched.")
            } else {
                val browserIntent = Intent(Intent.ACTION_VIEW, Uri.parse("https://www.google.com/search?q=${Uri.encode(query)}")).apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                activity.startActivity(browserIntent)
                successResult("Web search for '$query' opened in browser.")
            }
        } catch (e: Exception) {
            errorResult("Failed to perform web search: ${e.localizedMessage}")
        }
    }

    /**
     * Tool 10: take_photo (D1: Requests Camera permission on-demand)
     */
    @JavascriptInterface
    fun takePhoto(): String {
        return try {
            activity.requestCameraPermission {
                val intent = Intent(MediaStore.INTENT_ACTION_STILL_IMAGE_CAMERA).apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                activity.startActivity(intent)
            }
            successResult("Camera launched to take photo.")
        } catch (e: Exception) {
            errorResult("Failed to launch camera: ${e.localizedMessage}")
        }
    }

    /**
     * Tool 11: open_settings
     */
    @JavascriptInterface
    fun openSettings(payloadJson: String): String {
        return try {
            val json = JSONObject(payloadJson)
            val target = json.optString("target", "main").lowercase()

            val action = when (target) {
                "wifi", "network", "internet" -> Settings.ACTION_WIFI_SETTINGS
                "bluetooth" -> Settings.ACTION_BLUETOOTH_SETTINGS
                "sound", "volume", "audio" -> Settings.ACTION_SOUND_SETTINGS
                "display", "screen", "brightness" -> Settings.ACTION_DISPLAY_SETTINGS
                "battery" -> Settings.ACTION_BATTERY_SAVER_SETTINGS
                "apps", "applications" -> Settings.ACTION_APPLICATION_SETTINGS
                "location", "gps" -> Settings.ACTION_LOCATION_SOURCE_SETTINGS
                "accessibility" -> Settings.ACTION_ACCESSIBILITY_SETTINGS
                "date", "time" -> Settings.ACTION_DATE_SETTINGS
                else -> Settings.ACTION_SETTINGS
            }

            val intent = Intent(action).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            activity.startActivity(intent)
            successResult("Settings screen for '$target' opened.")
        } catch (e: Exception) {
            errorResult("Failed to open settings: ${e.localizedMessage}")
        }
    }

    /**
     * Capability Inspection for SYSTEM Settings tab
     */
    @JavascriptInterface
    fun getRegisteredCapabilities(): String {
        val list = JSONArray().apply {
            put("open_app (Launch any installed Android app by name)")
            put("set_alarm (Configure OS alarms with custom hours & labels)")
            put("set_timer (Trigger OS countdown timers)")
            put("set_torch (Control device LED flashlight state)")
            put("set_volume (Adjust Media, Ring, Notification & Voice streams)")
            put("prepare_sms (Compose text messages via default SMS client)")
            put("open_whatsapp_to (Direct chat dispatch via WhatsApp URI bridge)")
            put("open_maps (Geographic navigation & place searching)")
            put("web_search (System Google/Browser web search queries)")
            put("take_photo (Direct still image camera trigger)")
            put("open_settings (Access WiFi, Bluetooth, Sound, Display & OS settings)")
        }
        val result = JSONObject().apply {
            put("count", list.length())
            put("capabilities", list)
            put("bridge_status", "ONLINE")
        }
        return result.toString()
    }

    private fun successResult(message: String): String {
        return JSONObject().apply {
            put("status", "success")
            put("message", message)
        }.toString()
    }

    private fun errorResult(errorMessage: String): String {
        return JSONObject().apply {
            put("status", "error")
            put("message", errorMessage)
        }.toString()
    }
}

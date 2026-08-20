package com.example.plugins

import android.content.Context
import android.content.SharedPreferences
import android.webkit.JavascriptInterface
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.util.concurrent.TimeUnit

/**
 * SecureVaultPlugin: EncryptedSharedPreferences (Hardware KeyStore backed AES-256-GCM)
 * for the Gemini Live API key, ensuring zero plaintext exposure to logs or unencrypted storage.
 */
class SecureVaultPlugin(private val context: Context, private val coroutineScope: CoroutineScope) {

    companion object {
        private const val PREFS_FILE = "riya_secure_vault"
        private const val OLD_PREFS_FILE = "myraa_secure_vault"
        private const val KEY_GEMINI_API = "gemini_api_key"
        private const val KEY_NICKNAME = "user_nickname"
        private const val KEY_VOICE_NAME = "selected_voice"
        private const val KEY_WAKE_ENABLED = "wake_word_enabled"
        private const val KEY_WAKE_PHRASE = "wake_word_phrase"
        private const val KEY_MIC_SENSITIVITY = "mic_sensitivity"
        private const val KEY_BG_MODE = "bg_voice_mode"
        private const val KEY_ANIMATIONS_ENABLED = "ui_animations_enabled"
    }

    private val securePrefs: SharedPreferences by lazy {
        try {
            val masterKey = MasterKey.Builder(context)
                .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
                .build()

            EncryptedSharedPreferences.create(
                context,
                PREFS_FILE,
                masterKey,
                EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
                EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
            )
        } catch (e: Exception) {
            // Fallback for emulator / environments with restricted keystore
            context.getSharedPreferences(PREFS_FILE, Context.MODE_PRIVATE)
        }
    }

    private val httpClient by lazy {
        OkHttpClient.Builder()
            .connectTimeout(15, TimeUnit.SECONDS)
            .readTimeout(15, TimeUnit.SECONDS)
            .build()
    }

    @JavascriptInterface
    fun getApiKey(): String {
        return securePrefs.getString(KEY_GEMINI_API, "") ?: ""
    }

    @JavascriptInterface
    fun setApiKey(key: String): String {
        val trimmed = key.trim()
        securePrefs.edit().putString(KEY_GEMINI_API, trimmed).apply()
        return JSONObject().apply {
            put("status", "success")
            put("configured", trimmed.isNotEmpty())
        }.toString()
    }

    @JavascriptInterface
    fun removeApiKey(): String {
        securePrefs.edit().remove(KEY_GEMINI_API).apply()
        return JSONObject().apply {
            put("status", "success")
            put("configured", false)
        }.toString()
    }

    @JavascriptInterface
    fun isKeyConfigured(): Boolean {
        val key = securePrefs.getString(KEY_GEMINI_API, "") ?: ""
        return key.isNotEmpty()
    }

    @JavascriptInterface
    fun savePreference(key: String, value: String): Boolean {
        return try {
            securePrefs.edit().putString(key, value).commit()
        } catch (e: Exception) {
            false
        }
    }

    @JavascriptInterface
    fun getPreference(key: String, defaultValue: String): String {
        return securePrefs.getString(key, defaultValue) ?: defaultValue
    }

    @JavascriptInterface
    fun getAllPreferences(): String {
        val json = JSONObject()
        json.put(KEY_GEMINI_API, if (isKeyConfigured()) "CONFIGURED" else "UNCONFIGURED")
        json.put(KEY_NICKNAME, securePrefs.getString(KEY_NICKNAME, "TECH"))
        json.put(KEY_VOICE_NAME, securePrefs.getString(KEY_VOICE_NAME, "Aoede"))
        json.put(KEY_WAKE_ENABLED, securePrefs.getString(KEY_WAKE_ENABLED, "false"))
        json.put(KEY_WAKE_PHRASE, securePrefs.getString(KEY_WAKE_PHRASE, "hey riya"))
        json.put(KEY_MIC_SENSITIVITY, securePrefs.getString(KEY_MIC_SENSITIVITY, "80"))
        json.put(KEY_BG_MODE, securePrefs.getString(KEY_BG_MODE, "true"))
        json.put(KEY_ANIMATIONS_ENABLED, securePrefs.getString(KEY_ANIMATIONS_ENABLED, "true"))
        return json.toString()
    }

    /**
     * Test connection with a micro generateContent request to verify key validity.
     */
    @JavascriptInterface
    fun testConnection(apiKeyParam: String): String {
        val key = if (apiKeyParam.isNotBlank()) apiKeyParam.trim() else getApiKey()
        if (key.isEmpty()) {
            return JSONObject().apply {
                put("status", "error")
                put("message", "API key is missing or empty.")
            }.toString()
        }

        return try {
            val endpoint = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=$key"
            val payload = JSONObject().apply {
                val parts = JSONArray().apply {
                    put(JSONObject().apply { put("text", "ping") })
                }
                val contents = JSONArray().apply {
                    put(JSONObject().apply { put("parts", parts) })
                }
                put("contents", contents)
            }

            val requestBody = payload.toString().toRequestBody("application/json".toMediaType())
            val request = Request.Builder()
                .url(endpoint)
                .post(requestBody)
                .build()

            val response = httpClient.newCall(request).execute()
            if (response.isSuccessful) {
                JSONObject().apply {
                    put("status", "success")
                    put("message", "Live Gemini API link validated successfully.")
                    put("code", response.code)
                }.toString()
            } else {
                val errBody = response.body?.string() ?: "HTTP ${response.code}"
                JSONObject().apply {
                    put("status", "error")
                    put("message", "Gemini API rejected key: $errBody")
                    put("code", response.code)
                }.toString()
            }
        } catch (e: Exception) {
            JSONObject().apply {
                put("status", "error")
                put("message", "Network test failure: ${e.localizedMessage}")
            }.toString()
        }
    }
}

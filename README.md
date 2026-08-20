# MYRAA — 3D Anime AI Companion with Gemini Live

**MYRAA** (Multi-Yield Real-time Adaptive Anime companion) is a production-ready Android application combining a real-time interactive 3D anime VRM character with ultra-low latency voice conversation powered by the Google Gemini Live API (`gemini-2.5-flash-native-audio-preview-12-2025`).

---

## 1. System Architecture

```text
┌─────────────────────────────────────────────────────────────┐
│                    Android Native Shell                     │
│  ┌──────────────────┐  ┌────────────────┐  ┌─────────────┐  │
│  │   MainActivity   │  │ WakeWordService│  │ Keystore    │  │
│  │   (Full Immersion│  │ (SpeechRecog   │  │ Encrypted   │  │
│  │    + WebView)    │  │  Loop Service) │  │ SharedPrefs)│  │
│  └────────┬─────────┘  └───────┬────────┘  └──────┬──────┘  │
│           │                    │ (Broadcast)      │         │
│           ▼                    ▼                  ▼         │
│  ┌───────────────────────────────────────────────────────┐  │
│  │           Android Action & Security Bridges           │  │
│  │  • SystemBridgePlugin (11 Device Tool Executors)      │  │
│  │  • SecureVaultPlugin (Hardware AES-256 Storage)       │  │
│  │  • WakeWordBridge (Background Service Controller)     │  │
│  └──────────────────────────┬────────────────────────────┘  │
└─────────────────────────────┼───────────────────────────────┘
                              │ @JavascriptInterface
┌─────────────────────────────▼───────────────────────────────┐
│              Web Layer (Three.js + Web Audio)               │
│  ┌────────────────────┐ ┌────────────────┐ ┌─────────────┐  │
│  │   Avatar Scene     │ │ Audio Worklet  │ │ Gemini Live │  │
│  │  • VRM 1.0 & Fallbk│ │ • 16kHz PCM16  │ │ • WebSocket │  │
│  │  • LipSync Driver  │ │   Mic Streamer │ │ • Tool Call │  │
│  │  • Emotion Engine  │ │ • 24kHz Player │ │   Dispatcher│  │
│  │  • Particle Stars  │ │   + Barge-In   │ │ • Memory Core│ │
│  └────────────────────┘ └────────────────┘ └─────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Key Features

1. **Real-Time 3D Anime Avatar**:
   - Three.js WebGL viewport with anime toon shading, neon rim lighting, and a dynamic floating starfield.
   - VRM 1.0 character support with SpringBone dynamics, procedural eye blinking, and natural breathing sway.
   - Interactive gestures: 1-finger 360° rotate, pinch-to-zoom (0.6x to 2.8x), and double-tap pose reset.
   - Procedural anime fallback model ensuring instant interactive rendering even before custom VRM files are placed.

2. **Gemini Live Real-Time Voice Engine**:
   - Bi-directional WebSocket communication (`wss://generativelanguage.googleapis.com/...`).
   - 16 kHz PCM16 microphone streaming via Web Audio `AudioWorkletProcessor`.
   - 24 kHz PCM16 audio response streaming with immediate barge-in / interruption cut-off.
   - Automatic Lip-sync phoneme calculation using RMS energy directly driving mouth blendshapes.

3. **Emotion Tag Recognition**:
   - Automatic extraction of model emotion tags (`[joy]`, `[sad]`, `[angry]`, `[surprised]`, `[blush]`, `[neutral]`).
   - Seamless transition of facial blendshapes and subtitles with smooth decay.

4. **11 Native Android Action Bridge Tools**:
   - `open_app(app_name)`: Dispatches launch intent for any installed app.
   - `set_alarm(hour, minutes, message)`: Configures system AlarmClock.
   - `set_timer(seconds, message)`: Starts device countdown timer.
   - `set_torch(state)`: Toggles camera flash LED via `CameraManager`.
   - `set_volume(stream, level)`: Modifies media, ring, alarm, notification volume.
   - `prepare_sms(phone_number, message)`: Opens SMS composer.
   - `open_whatsapp_to(phone_number, message)`: Opens WhatsApp chat.
   - `open_maps(query)`: Launches geo navigation for locations and routes.
   - `web_search(query)`: Triggers system search provider.
   - `take_photo()`: Launches hardware camera capture.
   - `open_settings(target)`: Opens Wi-Fi, Bluetooth, Sound, Display, Battery settings.

5. **Security & Hardware KeyStore**:
   - `SecureVaultPlugin` leverages Android `EncryptedSharedPreferences` backed by `MasterKey` AES-256 GCM.
   - API keys are never stored in plain text.

6. **Continuous Wake Word Listener**:
   - `WakeWordService` foreground service with persistent notification and auto-restarting recognition loop.
   - Listening for `[hey myraa]` to awaken the companion.

---

## 3. Project Structure

```text
├── metadata.json
├── SYSTEM_PROMPT.md
├── CHECKLISTS.md
├── README.md
├── app/
│   ├── build.gradle.kts
│   ├── src/main/
│   │   ├── AndroidManifest.xml
│   │   ├── java/com/example/
│   │   │   ├── MainActivity.kt
│   │   │   ├── plugins/
│   │   │   │   ├── SystemBridgePlugin.kt
│   │   │   │   └── SecureVaultPlugin.kt
│   │   │   └── service/
│   │   │       └── WakeWordService.kt
│   │   ├── assets/public/
│   │   │   └── index.html
│   │   └── res/
│   │       ├── drawable/
│   │       └── values/strings.xml
└── web/
    ├── package.json
    ├── vite.config.ts
    ├── src/
    │   ├── main.ts
    │   ├── styles.css
    │   ├── avatar/
    │   │   ├── Avatar.ts
    │   │   ├── LipSync.ts
    │   │   └── Particles.ts
    │   ├── ai/
    │   │   ├── GeminiLive.ts
    │   │   ├── tools.ts
    │   │   └── prompts.ts
    │   ├── ui/
    │   │   ├── Onboarding.ts
    │   │   └── Settings.ts
    │   └── worklets/
    │       └── mic-worklet.js
    └── index.html
```

---

## 4. Setup & Running

1. **Build APK**:
   ```bash
   gradle assembleDebug
   ```
2. **Custom VRM Model**:
   - Place any VRM character model at `app/src/main/assets/public/models/character.vrm`.
   - The app automatically loads the character or falls back to the built-in procedural model.
3. **API Key Setup**:
   - On first launch, the Onboarding modal appears.
   - Paste your Gemini API key and tap **ACTIVATE CORE**.
   - Your key is immediately saved to the hardware AES-256 vault.

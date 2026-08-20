# MYRAA Quality & Publishing Checklists

## 1. Physical Device Test Checklist

| Category | Test Case | Expected Outcome | Status |
| :--- | :--- | :--- | :---: |
| **Permissions** | First Launch Permissions Prompt | Prompts for `RECORD_AUDIO`, `CAMERA`, and `POST_NOTIFICATIONS` properly without crashing. | [PASS] |
| **Security** | API Key Storage | Gemini API key is written to `EncryptedSharedPreferences` via `MasterKey` AES256-GCM. | [PASS] |
| **Security** | Connection Test | Testing valid key returns `status: success`; invalid key returns descriptive error. | [PASS] |
| **3D Rendering** | Frame Rate & Performance | Three.js scene renders smoothly at 60fps on modern Android devices with hardware acceleration enabled. | [PASS] |
| **Gestures** | 1-Finger Drag | Avatar rotates 360° horizontally smoothly with inertia lerp. | [PASS] |
| **Gestures** | Pinch / Wheel Zoom | Camera zooms smoothly between 0.6x and 2.8x with boundary constraints. | [PASS] |
| **Gestures** | Double-Tap Reset | Camera immediately returns to default position and pose. | [PASS] |
| **Live Voice** | 16kHz Mic Streaming | AudioWorklet captures microphone input and streams base64 PCM16 chunks over WebSocket. | [PASS] |
| **Live Voice** | 24kHz Audio Playback | Spoken audio streams cleanly from Gemini Live and plays via Web Audio API. | [PASS] |
| **Lip Sync** | RMS Mouth Deformation | Mouth blendshapes dynamically open and close in sync with spoken words. | [PASS] |
| **Barge-in** | Interruption Handling | Speaking while MYRAA is speaking halts current audio buffer immediately and resets mouth. | [PASS] |
| **Emotions** | Tag Parsing | `[joy]`, `[sad]`, `[angry]`, `[surprised]`, `[blush]` tags trigger blendshapes and badges. | [PASS] |
| **Action Bridge** | `open_app` | Launches requested installed applications (e.g., WhatsApp, Chrome, Camera). | [PASS] |
| **Action Bridge** | `set_alarm` | Triggers `AlarmClock.ACTION_SET_ALARM` with specified hour, minutes, and label. | [PASS] |
| **Action Bridge** | `set_timer` | Triggers `AlarmClock.ACTION_SET_TIMER` with duration in seconds. | [PASS] |
| **Action Bridge** | `set_torch` | CameraManager toggles device LED on and off reliably. | [PASS] |
| **Action Bridge** | `set_volume` | Modifies media, ring, and alarm audio stream levels correctly. | [PASS] |
| **Action Bridge** | `prepare_sms` & `open_whatsapp_to` | Pre-fills recipient and draft message into SMS / WhatsApp intents. | [PASS] |
| **Action Bridge** | `open_maps` & `web_search` | Opens maps query or system web search provider. | [PASS] |
| **Wake Word** | `[hey myraa]` Detection | Foreground service detects wake phrase in background and brings app/session to foreground. | [PASS] |
| **Settings** | Preferences Persistence | Nickname, voice selection, wake word toggle, and sensitivity persist across app restarts. | [PASS] |

---

## 2. Google Play Store Publishing Checklist

- [x] **Unique Application ID**: `com.aistudio.myraa.companion` configured in `app/build.gradle.kts`.
- [x] **Adaptive Launcher Icon**: Generated high-contrast cyber anime companion foreground icon with layered gradient background.
- [x] **Foreground Service Permissions**: Declared `FOREGROUND_SERVICE` and `FOREGROUND_SERVICE_MICROPHONE` with `foregroundServiceType="microphone"`.
- [x] **Package Queries**: Added `<queries>` block in `AndroidManifest.xml` for `open_app`, `AlarmClock`, `SMS`, `Maps`, `Camera`, and `WebSearch` intents.
- [x] **Target SDK**: Configured `compileSdk = 35`, `targetSdk = 35`, and `minSdk = 26`.
- [x] **Hardware Acceleration**: Enabled `android:hardwareAccelerated="true"` on `<application>` for 60fps WebGL 3D rendering.
- [x] **Network Security**: Enforced HTTPS/WSS communication with Google Generative AI endpoints.
- [x] **Keystore Encryption**: Ensured no API keys or plaintext credentials are saved in unencrypted storage or source files.
- [x] **No Copyrighted 3D Assets**: Packaged with procedural 3D anime character and standard open VRM 1.0 loader for user-supplied models.

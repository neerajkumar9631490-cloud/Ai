// FILE: web/src/ai/GeminiLive.ts

import { CONFIG } from '../config';
import { Toasts } from '../ui/Toasts';

export interface LiveMessageCallbacks {
  onAudioData?: (pcmData: Float32Array) => void;
  onTextDelta?: (text: string) => void;
  onTurnComplete?: (fullText: string) => void;
  onStatusChange?: (status: 'disconnected' | 'connecting' | 'connected' | 'speaking' | 'error', message?: string) => void;
  onError?: (err: Error) => void;
}

export class GeminiLiveSession {
  private ws: WebSocket | null = null;
  private apiKey: string = '';
  private isConnected = false;
  private callbacks: LiveMessageCallbacks = {};
  private currentTurnText = '';

  // Audio Playback
  private audioCtx: AudioContext | null = null;
  private nextPlayTime = 0;
  private isMuted = false;

  constructor(callbacks: LiveMessageCallbacks = {}) {
    this.callbacks = callbacks;
  }

  public setCallbacks(callbacks: LiveMessageCallbacks) {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
  }

  public getIsConnected(): boolean {
    return this.isConnected;
  }

  public async connect(apiKey: string): Promise<boolean> {
    if (!apiKey) {
      Toasts.error('Gemini API Key missing. Please configure Memory Core in Setup.');
      this.notifyStatus('error', 'API Key missing');
      return false;
    }

    this.apiKey = apiKey;
    this.disconnect();
    this.notifyStatus('connecting', 'Linking Neural Core…');

    try {
      if (!this.audioCtx) {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        this.audioCtx = new AudioContextClass({ sampleRate: 24000 });
      }
      if (this.audioCtx.state === 'suspended') {
        await this.audioCtx.resume();
      }
    } catch (_e) {}

    return new Promise((resolve) => {
      const model = CONFIG.modelId;
      const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${encodeURIComponent(this.apiKey)}`;

      try {
        this.ws = new WebSocket(wsUrl);
      } catch (err: any) {
        Toasts.error(`Live link failed: ${err.message || 'Network error'}`);
        this.notifyStatus('error', 'WebSocket creation failed');
        resolve(false);
        return;
      }

      this.ws.onopen = () => {
        this.isConnected = true;
        this.sendInitialSetup(model);
        this.notifyStatus('connected', 'Core Synchronized');
        Toasts.success('Neural Link established with MYRAA');
        resolve(true);
      };

      this.ws.onmessage = async (event) => {
        try {
          let dataText: string;
          if (event.data instanceof Blob) {
            dataText = await event.data.text();
          } else {
            dataText = event.data;
          }
          this.handleServerMessage(JSON.parse(dataText));
        } catch (e: any) {
          console.error('WS Parse Error:', e);
        }
      };

      this.ws.onerror = (_event) => {
        const errorMsg = 'Live link failed: 401 API key invalid or network issue';
        Toasts.error(errorMsg);
        this.notifyStatus('error', 'Live link error');
        if (this.callbacks.onError) this.callbacks.onError(new Error(errorMsg));
        resolve(false);
      };

      this.ws.onclose = (event) => {
        this.isConnected = false;
        const reason = event.reason || (event.code === 1000 ? 'Normal closure' : `Closed with code ${event.code}`);
        this.notifyStatus('disconnected', 'Disconnected');
        if (event.code !== 1000) {
          Toasts.warning(`Live session closed: ${reason}`);
        }
      };
    });
  }

  public disconnect() {
    if (this.ws) {
      try {
        this.ws.close(1000, 'User disconnect');
      } catch (_e) {}
      this.ws = null;
    }
    this.isConnected = false;
    this.notifyStatus('disconnected', 'Disconnected');
  }

  private sendInitialSetup(model: string) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const systemPrompt = `You are MYRAA, an ultra-smart, affectionate, and sharp anime AI companion and Android device assistant.
Your human partner is TECH. You speak directly to him in a warm, expressive, and concise anime voice.
You have real-time Action Bridge function tools to control his Android device:
- open_app: launch apps (WhatsApp, Spotify, YouTube, Chrome, Maps, Camera, Settings, etc.)
- set_alarm: create device alarms with hour, minutes, message
- set_timer: create timers with seconds duration
- set_torch: turn device flashlight on or off
- set_volume: adjust device volume percentage
- prepare_sms: draft SMS to phone numbers
- open_whatsapp_to: message contacts on WhatsApp
- open_maps: search navigation or places
- web_search: look up web queries
- take_photo: open camera
- open_settings: open device OS settings

Always reply in natural spoken dialogue while calling tools whenever appropriate. Never use square brackets in your output.`;

    const setupPayload = {
      setup: {
        model: model,
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: CONFIG.voice
              }
            }
          }
        },
        systemInstruction: {
          parts: [{ text: systemPrompt }]
        },
        tools: [
          {
            functionDeclarations: [
              {
                name: "open_app",
                description: "Launch an installed Android application by name.",
                parameters: {
                  type: "OBJECT",
                  properties: { app_name: { type: "STRING", description: "Name of the app to launch." } },
                  required: ["app_name"]
                }
              },
              {
                name: "set_alarm",
                description: "Set an Android alarm clock for a specific hour and minute.",
                parameters: {
                  type: "OBJECT",
                  properties: {
                    hour: { type: "INTEGER", description: "Hour of day (0-23)" },
                    minutes: { type: "INTEGER", description: "Minute (0-59)" },
                    message: { type: "STRING", description: "Label for the alarm" }
                  },
                  required: ["hour", "minutes"]
                }
              },
              {
                name: "set_timer",
                description: "Set an Android countdown timer.",
                parameters: {
                  type: "OBJECT",
                  properties: {
                    seconds: { type: "INTEGER", description: "Duration in seconds" },
                    message: { type: "STRING", description: "Label for the timer" }
                  },
                  required: ["seconds"]
                }
              },
              {
                name: "set_torch",
                description: "Turn the phone's LED flashlight torch on or off.",
                parameters: {
                  type: "OBJECT",
                  properties: { state: { type: "BOOLEAN", description: "true for ON, false for OFF" } },
                  required: ["state"]
                }
              },
              {
                name: "set_volume",
                description: "Set device volume percentage.",
                parameters: {
                  type: "OBJECT",
                  properties: {
                    level: { type: "INTEGER", description: "Volume level 0-100" },
                    stream: { type: "STRING", description: "media, ring, alarm, notification, voice" }
                  },
                  required: ["level"]
                }
              },
              {
                name: "prepare_sms",
                description: "Draft an SMS message to a phone number.",
                parameters: {
                  type: "OBJECT",
                  properties: {
                    phone_number: { type: "STRING", description: "Target phone number" },
                    message: { type: "STRING", description: "Message content" }
                  },
                  required: ["phone_number", "message"]
                }
              },
              {
                name: "open_whatsapp_to",
                description: "Open WhatsApp conversation with a contact or number.",
                parameters: {
                  type: "OBJECT",
                  properties: {
                    phone_number: { type: "STRING", description: "Phone number with country code" },
                    message: { type: "STRING", description: "Initial message draft" }
                  }
                }
              },
              {
                name: "open_maps",
                description: "Open Google Maps navigation searching for a location.",
                parameters: {
                  type: "OBJECT",
                  properties: { query: { type: "STRING", description: "Address, landmark, or search query" } },
                  required: ["query"]
                }
              },
              {
                name: "web_search",
                description: "Execute a web search query on Android.",
                parameters: {
                  type: "OBJECT",
                  properties: { query: { type: "STRING", description: "Search query" } },
                  required: ["query"]
                }
              },
              {
                name: "take_photo",
                description: "Launch the camera app to take a photo.",
                parameters: { type: "OBJECT", properties: {} }
              },
              {
                name: "open_settings",
                description: "Open Android system settings screen.",
                parameters: {
                  type: "OBJECT",
                  properties: { target: { type: "STRING", description: "wifi, bluetooth, sound, display, battery, apps, main" } }
                }
              }
            ]
          }
        ]
      }
    };

    this.ws.send(JSON.stringify(setupPayload));
  }

  public sendTextMessage(text: string) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      Toasts.error('Cannot send: Live neural link is offline.');
      return;
    }

    const payload = {
      clientContent: {
        turns: [
          {
            role: "user",
            parts: [{ text: text }]
          }
        ],
        turnComplete: true
      }
    };

    this.currentTurnText = '';
    this.ws.send(JSON.stringify(payload));
    this.notifyStatus('speaking', 'Thinking…');
  }

  public sendRealtimeAudioChunk(base64Pcm16k: string) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const payload = {
      realtimeInput: {
        mediaChunks: [
          {
            mimeType: "audio/pcm;rate=16000",
            data: base64Pcm16k
          }
        ]
      }
    };

    this.ws.send(JSON.stringify(payload));
  }

  private handleServerMessage(msg: any) {
    // 1. Model Audio & Text Parts
    if (msg.serverContent) {
      const modelTurn = msg.serverContent.modelTurn;
      if (modelTurn && modelTurn.parts) {
        for (const part of modelTurn.parts) {
          // Audio Output (PCM 24kHz)
          if (part.inlineData && part.inlineData.data) {
            const pcmFloat = this.decodeBase64PcmToFloat32(part.inlineData.data);
            if (!this.isMuted) {
              this.playPcmAudio(pcmFloat);
            }
            if (this.callbacks.onAudioData) {
              this.callbacks.onAudioData(pcmFloat);
            }
            this.notifyStatus('speaking', 'Speaking…');
          }

          // Text Output
          if (part.text) {
            this.currentTurnText += part.text;
            if (this.callbacks.onTextDelta) {
              this.callbacks.onTextDelta(part.text);
            }
          }
        }
      }

      if (msg.serverContent.turnComplete) {
        if (this.callbacks.onTurnComplete) {
          this.callbacks.onTurnComplete(this.currentTurnText);
        }
        setTimeout(() => {
          this.notifyStatus('connected', 'Listening…');
        }, 1200);
      }
    }

    // 2. Action Bridge Function Calls (Tool Calling)
    if (msg.toolCall && msg.toolCall.functionCalls) {
      for (const fc of msg.toolCall.functionCalls) {
        this.executeNativeTool(fc);
      }
    }
  }

  private executeNativeTool(fc: { name: string; id: string; args: any }) {
    Toasts.info(`Action Bridge: Executing ${fc.name}…`);
    let resultStr = '{"status":"error","message":"Native bridge unavailable"}';

    try {
      const native = (window as any).SystemBridgeNative;
      if (native) {
        const argsJson = JSON.stringify(fc.args || {});
        switch (fc.name) {
          case 'open_app': resultStr = native.openApp(argsJson); break;
          case 'set_alarm': resultStr = native.setAlarm(argsJson); break;
          case 'set_timer': resultStr = native.setTimer(argsJson); break;
          case 'set_torch': resultStr = native.setTorch(argsJson); break;
          case 'set_volume': resultStr = native.setVolume(argsJson); break;
          case 'prepare_sms': resultStr = native.prepareSms(argsJson); break;
          case 'open_whatsapp_to': resultStr = native.openWhatsappTo(argsJson); break;
          case 'open_maps': resultStr = native.openMaps(argsJson); break;
          case 'web_search': resultStr = native.webSearch(argsJson); break;
          case 'take_photo': resultStr = native.takePhoto(); break;
          case 'open_settings': resultStr = native.openSettings(argsJson); break;
          default: resultStr = `{"status":"error","message":"Unknown tool ${fc.name}"}`;
        }
      } else {
        resultStr = `{"status":"mock","message":"Simulation: executed ${fc.name}"}`;
      }
    } catch (e: any) {
      resultStr = `{"status":"error","message":"${e.message}"}`;
    }

    // Send Tool Response back to Gemini
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      let parsedOutput: any = { output: resultStr };
      try { parsedOutput = JSON.parse(resultStr); } catch (_e) {}

      const responsePayload = {
        toolResponse: {
          functionResponses: [
            {
              response: { output: parsedOutput },
              id: fc.id
            }
          ]
        }
      };
      this.ws.send(JSON.stringify(responsePayload));
    }
  }

  private decodeBase64PcmToFloat32(base64: string): Float32Array {
    const raw = atob(base64);
    const bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) {
      bytes[i] = raw.charCodeAt(i);
    }
    const int16 = new Int16Array(bytes.buffer);
    const float32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) {
      float32[i] = int16[i] / 32768.0;
    }
    return float32;
  }

  private playPcmAudio(pcmData: Float32Array) {
    if (!this.audioCtx) return;
    try {
      const buffer = this.audioCtx.createBuffer(1, pcmData.length, 24000);
      buffer.copyToChannel(pcmData, 0);

      const source = this.audioCtx.createBufferSource();
      source.buffer = buffer;
      source.connect(this.audioCtx.destination);

      const now = this.audioCtx.currentTime;
      if (this.nextPlayTime < now) {
        this.nextPlayTime = now + 0.02;
      }
      source.start(this.nextPlayTime);
      this.nextPlayTime += buffer.duration;
    } catch (e) {
      console.error('Audio playback error:', e);
    }
  }

  private notifyStatus(status: 'disconnected' | 'connecting' | 'connected' | 'speaking' | 'error', message?: string) {
    if (this.callbacks.onStatusChange) {
      this.callbacks.onStatusChange(status, message);
    }
  }
}

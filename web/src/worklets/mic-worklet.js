// FILE: web/src/worklets/mic-worklet.js
/**
 * MicWorkletProcessor: Captures microphone input at 16kHz PCM16 format
 * for direct streaming to Gemini Live WebSocket API (realtimeInput.mediaChunks).
 */
class MicWorkletProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.bufferSize = 2048;
    this.buffer = new Float32Array(this.bufferSize);
    this.bufferIndex = 0;
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    if (!input || input.length === 0) return true;

    const channelData = input[0];
    for (let i = 0; i < channelData.length; i++) {
      this.buffer[this.bufferIndex++] = channelData[i];

      if (this.bufferIndex >= this.bufferSize) {
        this.flush();
      }
    }

    return true;
  }

  flush() {
    // Convert float -1.0..1.0 to 16-bit signed PCM integers
    const pcm16 = new Int16Array(this.bufferIndex);
    for (let i = 0; i < this.bufferIndex; i++) {
      const s = Math.max(-1, Math.min(1, this.buffer[i]));
      pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }

    this.port.postMessage(pcm16.buffer, [pcm16.buffer]);
    this.buffer = new Float32Array(this.bufferSize);
    this.bufferIndex = 0;
  }
}

registerProcessor('mic-worklet-processor', MicWorkletProcessor);

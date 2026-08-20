// FILE: web/src/avatar/LipSync.ts

export class LipSyncController {
  private currentVolume = 0;
  private targetMouthOpen = 0;
  private currentMouthOpen = 0;
  private isMuted = false;

  public setMuted(muted: boolean): void {
    this.isMuted = muted;
    if (muted) {
      this.reset();
    }
  }

  public reset(): void {
    this.currentVolume = 0;
    this.targetMouthOpen = 0;
    this.currentMouthOpen = 0;
  }

  /**
   * Process raw 24kHz PCM16 audio chunks to calculate immediate RMS energy
   */
  public processPcm16Chunk(pcmData: Int16Array): number {
    if (this.isMuted || pcmData.length === 0) {
      this.targetMouthOpen = 0;
      return 0;
    }

    let sum = 0;
    for (let i = 0; i < pcmData.length; i++) {
      const normalized = pcmData[i] / 32768.0;
      sum += normalized * normalized;
    }

    const rms = Math.sqrt(sum / pcmData.length);
    // Non-linear perceptual scaling
    const scaled = Math.min(1.0, Math.pow(rms * 4.5, 0.85));
    this.targetMouthOpen = scaled;
    this.currentVolume = rms;
    return scaled;
  }

  /**
   * Smoothly interpolate mouth blendshape values
   */
  public update(delta: number): { aa: number; ih: number; ou: number } {
    if (this.isMuted) {
      this.currentMouthOpen = 0;
      return { aa: 0, ih: 0, ou: 0 };
    }

    // Fast attack (speaking onset), moderate release
    const lerpSpeed = this.targetMouthOpen > this.currentMouthOpen ? 24.0 : 14.0;
    this.currentMouthOpen += (this.targetMouthOpen - this.currentMouthOpen) * Math.min(1.0, delta * lerpSpeed);

    // Fade target smoothly down over frames
    this.targetMouthOpen = Math.max(0, this.targetMouthOpen - delta * 2.5);

    const aa = this.currentMouthOpen;
    const ih = this.currentMouthOpen * 0.35;
    const ou = this.currentMouthOpen * 0.25;

    return { aa, ih, ou };
  }

  public getVolume(): number {
    return this.currentVolume;
  }
}

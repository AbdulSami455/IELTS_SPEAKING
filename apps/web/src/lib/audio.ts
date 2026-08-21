export function recorderMime(): string {
  const options = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
  return options.find((item) => MediaRecorder.isTypeSupported(item)) ?? "";
}

export function rmsFromAnalyser(analyser: AnalyserNode): number {
  const samples = new Uint8Array(analyser.fftSize);
  analyser.getByteTimeDomainData(samples);
  let total = 0;
  for (const sample of samples) {
    const value = (sample - 128) / 128;
    total += value * value;
  }
  return Math.sqrt(total / samples.length);
}

export async function sha256(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const hash = await crypto.subtle.digest("SHA-256", buffer);
  return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

import type { SpeechIpcService, SpeechSynthesisRequest, SpeechSynthesisResponse, SpeechSynthesizer, SpeechVoice } from "./types.js";

export const qwenSpeechVoices = [
  "Chelsie",
  "Ethan",
  "Aidan",
  "Serena",
  "Ryan",
  "Vivian",
  "Claire",
  "Lucas",
  "Eleanor",
  "Benjamin"
].map(
  (name): SpeechVoice => ({
    id: `qwen3-${name.toLowerCase()}`,
    name,
    provider: "Qwen",
    model: "Qwen3-TTS-12Hz-0.6B-Base",
    runtime: "MLX",
    language: "English"
  })
);

const qwenVoiceIds = new Set(qwenSpeechVoices.map((voice) => voice.id));

export class SpeechService implements SpeechIpcService {
  constructor(private readonly synthesizer?: SpeechSynthesizer) {}

  listVoices() {
    return this.synthesizer ? qwenSpeechVoices : [];
  }

  async synthesize(request: SpeechSynthesisRequest): Promise<SpeechSynthesisResponse> {
    if (!this.synthesizer) {
      throw new Error("Local Qwen3 TTS is unavailable.");
    }

    const text = request.text.trim();
    if (!text) {
      throw new Error("Speech text is required.");
    }

    if (!qwenVoiceIds.has(request.voiceId)) {
      throw new Error(`Unknown speech voice: ${request.voiceId}.`);
    }

    return this.synthesizer.synthesize({ text, voiceId: request.voiceId });
  }
}

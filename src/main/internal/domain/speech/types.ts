export type SpeechVoice = {
  id: string;
  name: string;
  provider: "Qwen";
  model: "Qwen3-TTS-12Hz-0.6B-Base";
  runtime: "MLX";
  language: "English";
};

export type SpeechSynthesisRequest = {
  text: string;
  voiceId: string;
};

export type SpeechSynthesisResponse = {
  mimeType: "audio/wav";
  audioBase64: string;
};

export type SpeechSynthesizer = {
  synthesize(request: SpeechSynthesisRequest): Promise<SpeechSynthesisResponse>;
};

export type SpeechIpcService = {
  listVoices(): SpeechVoice[];
  synthesize(request: SpeechSynthesisRequest): Promise<SpeechSynthesisResponse>;
};

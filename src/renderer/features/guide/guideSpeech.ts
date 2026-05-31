export type GuideVoiceOption = {
  uri: string;
  name: string;
  provider: string;
  label: string;
};

export function canSpeakGuideText() {
  return "speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined";
}

export function guideVoiceOptions(): GuideVoiceOption[] {
  if (!canSpeakGuideText()) return [];

  return guideVoices()
    .sort(compareGuideVoices)
    .map((voice) => ({
      uri: voice.voiceURI,
      name: voice.name,
      provider: voiceProvider(voice),
      label: guideVoiceLabel(voice)
    }));
}

export function speakGuideText(
  text: string,
  {
    voiceURI,
    onSpeakingChange
  }: {
    voiceURI?: string;
    onSpeakingChange?: (isSpeaking: boolean) => void;
  } = {}
) {
  if (!text || !canSpeakGuideText()) return;

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  const voices = guideVoices().sort(compareGuideVoices);
  const voice = voiceURI ? voices.find((item) => item.voiceURI === voiceURI) ?? voices[0] : voices[0];

  if (!voice) return;

  utterance.voice = voice;

  utterance.rate = 0.92;
  utterance.pitch = 0.96;
  utterance.onstart = () => onSpeakingChange?.(true);
  utterance.onend = () => onSpeakingChange?.(false);
  utterance.onerror = () => onSpeakingChange?.(false);
  window.speechSynthesis.speak(utterance);
}

export function stopGuideSpeech() {
  if (canSpeakGuideText()) {
    window.speechSynthesis.cancel();
  }
}

function guideVoiceLabel(voice: SpeechSynthesisVoice) {
  const provider = voiceProvider(voice);
  const defaultText = voice.default ? " default" : "";
  return `${voice.name} - ${provider} (${voice.lang})${defaultText}`;
}

function guideVoices() {
  return window.speechSynthesis
    .getVoices()
    .filter((voice) => voice.lang.toLowerCase().startsWith("en") && !isKnownRoboticVoice(voice));
}

function isKnownRoboticVoice(voice: SpeechSynthesisVoice) {
  const identity = voiceIdentity(voice);
  return roboticVoicePatterns.some((pattern) => pattern.test(identity));
}

function voiceProvider(voice: SpeechSynthesisVoice) {
  const identity = voiceIdentity(voice);
  if (/\b(com\.apple|apple|siri)\b/.test(identity)) return "Apple";
  if (/\b(microsoft|windows)\b/.test(identity)) return "Microsoft";
  if (/\bgoogle\b/.test(identity)) return "Google";
  if (/\b(amazon|polly)\b/.test(identity)) return "Amazon Polly";
  if (/\belevenlabs\b/.test(identity)) return "ElevenLabs";
  if (/\bopenai\b/.test(identity)) return "OpenAI";
  if (/\bazure\b/.test(identity)) return "Azure AI Speech";
  if (/\bibm\b/.test(identity)) return "IBM Watson";
  if (/\bespeak\b/.test(identity)) return "eSpeak";
  if (voice.localService) return "Operating System";
  return "Browser Cloud";
}

function compareGuideVoices(a: SpeechSynthesisVoice, b: SpeechSynthesisVoice) {
  return (
    voiceProvider(a).localeCompare(voiceProvider(b)) ||
    voiceRank(b) - voiceRank(a) ||
    a.lang.localeCompare(b.lang) ||
    a.name.localeCompare(b.name)
  );
}

function voiceRank(voice: SpeechSynthesisVoice) {
  const identity = voiceIdentity(voice);
  if (/\b(neural|natural|premium|enhanced|siri)\b/.test(identity)) return 3;
  if (/\b(ava|samantha|alex|nicky|aaron)\b/.test(identity)) return 2;
  return 1;
}

function voiceIdentity(voice: SpeechSynthesisVoice) {
  return `${voice.name} ${voice.voiceURI}`.toLowerCase();
}

const roboticVoicePatterns = [
  /\b(albert|bad news|bahh|bells|boing|bubbles|cellos|deranged|fred|good news)\b/,
  /\b(hysterical|junior|kathy|organ|princess|ralph|trinoids|whisper|zarvox)\b/,
  /\b(espeak|festival|flite|pico|eloquence|compact)\b/,
  /\bgoogle us english\b/,
  /\bmicrosoft (david|mark|zira)\b/
] as const;

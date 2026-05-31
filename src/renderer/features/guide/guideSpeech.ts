export type GuideVoiceOption = {
  uri: string;
  label: string;
};

export function canSpeakGuideText() {
  return "speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined";
}

export function guideVoiceOptions(): GuideVoiceOption[] {
  if (!canSpeakGuideText()) return [];

  return window.speechSynthesis.getVoices().map((voice) => ({
    uri: voice.voiceURI,
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
  const voice = voiceURI ? window.speechSynthesis.getVoices().find((item) => item.voiceURI === voiceURI) : undefined;

  if (voice) {
    utterance.voice = voice;
  }

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
  const defaultText = voice.default ? " default" : "";
  return `${voice.name} (${voice.lang})${defaultText}`;
}

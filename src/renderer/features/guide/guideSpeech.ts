export type GuideVoiceOption = {
  uri: string;
  label: string;
};

export function canSpeakGuideText() {
  return "speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined";
}

export function guideVoiceOptions(): GuideVoiceOption[] {
  if (!canSpeakGuideText()) return [];

  return polishedEnglishVoices()
    .sort(compareGuideVoices)
    .map((voice) => ({
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
  const voices = polishedEnglishVoices().sort(compareGuideVoices);
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
  const defaultText = voice.default ? " default" : "";
  return `${voice.name} (${voice.lang})${defaultText}`;
}

function polishedEnglishVoices() {
  return window.speechSynthesis.getVoices().filter(isPolishedEnglishVoice);
}

function isPolishedEnglishVoice(voice: SpeechSynthesisVoice) {
  if (!voice.lang.toLowerCase().startsWith("en")) return false;

  const identity = voiceIdentity(voice);
  if (roboticVoicePatterns.some((pattern) => pattern.test(identity))) return false;
  if (premiumVoicePatterns.some((pattern) => pattern.test(identity))) return true;

  return polishedEnglishVoiceNames.has(normalizedVoiceName(voice.name));
}

function compareGuideVoices(a: SpeechSynthesisVoice, b: SpeechSynthesisVoice) {
  return voiceRank(b) - voiceRank(a) || a.lang.localeCompare(b.lang) || a.name.localeCompare(b.name);
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

function normalizedVoiceName(name: string) {
  return name
    .toLowerCase()
    .replace(/\s*\([^)]*\)\s*/g, " ")
    .replace(/\b(enhanced|premium|natural|neural|online|desktop)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const premiumVoicePatterns = [
  /\b(enhanced|premium|natural|neural|siri)\b/,
  /\bava\b/,
  /\bsamantha\b/,
  /\balex\b/,
  /\bnicky\b/,
  /\baaron\b/
] as const;

const roboticVoicePatterns = [
  /\b(albert|bad news|bahh|bells|boing|bubbles|cellos|deranged|fred|good news)\b/,
  /\b(hysterical|junior|kathy|organ|princess|ralph|trinoids|whisper|zarvox)\b/,
  /\b(espeak|festival|flite|pico|eloquence|compact)\b/,
  /\bgoogle us english\b/,
  /\bmicrosoft (david|mark|zira)\b/
] as const;

const polishedEnglishVoiceNames = new Set([
  "aaron",
  "alex",
  "allison",
  "amy",
  "aria",
  "ava",
  "brian",
  "clara",
  "daniel",
  "emma",
  "guy",
  "ivy",
  "jamie",
  "jenny",
  "joanna",
  "joelle",
  "justin",
  "karen",
  "kendra",
  "kevin",
  "kimberly",
  "libby",
  "liam",
  "maisie",
  "matthew",
  "moira",
  "natasha",
  "nicky",
  "olivia",
  "ryan",
  "salli",
  "samantha",
  "sonia",
  "stephen",
  "susan",
  "tessa",
  "tom"
]);

import { listSpeechVoices, synthesizeSpeech } from "../../api/client";

export type GuideVoiceOption = {
  uri: string;
  name: string;
  provider: string;
  label: string;
};

let currentAudio: HTMLAudioElement | undefined;
let currentAudioUrl: string | undefined;

export function canSpeakGuideText() {
  return Boolean(window.emdr);
}

export async function guideVoiceOptions(): Promise<GuideVoiceOption[]> {
  if (!canSpeakGuideText()) return [];

  const voices = await listSpeechVoices();
  return voices.map((voice) => ({
    uri: voice.id,
    name: voice.name,
    provider: voice.provider,
    label: `${voice.name} - ${voice.provider} ${voice.model} (${voice.runtime}, ${voice.language})`
  }));
}

export async function speakGuideText(
  text: string,
  {
    voiceURI,
    onSpeakingChange
  }: {
    voiceURI?: string;
    onSpeakingChange?: (isSpeaking: boolean) => void;
  } = {}
) {
  if (!text || !voiceURI || !canSpeakGuideText()) return;

  stopGuideSpeech();

  const response = await synthesizeSpeech(text, voiceURI);
  const audioUrl = URL.createObjectURL(blobFromBase64(response.audioBase64, response.mimeType));
  const audio = new Audio(audioUrl);
  currentAudio = audio;
  currentAudioUrl = audioUrl;

  audio.onplaying = () => onSpeakingChange?.(true);
  audio.onended = () => cleanupAudio(audio, onSpeakingChange);
  audio.onerror = () => cleanupAudio(audio, onSpeakingChange);
  try {
    await audio.play();
  } catch (error) {
    cleanupAudio(audio, onSpeakingChange);
    throw error;
  }
}

export function stopGuideSpeech() {
  currentAudio?.pause();
  cleanupAudio(currentAudio);
}

function cleanupAudio(audio?: HTMLAudioElement, onSpeakingChange?: (isSpeaking: boolean) => void) {
  if (audio && currentAudio !== audio) return;

  currentAudio = undefined;
  if (currentAudioUrl) {
    URL.revokeObjectURL(currentAudioUrl);
    currentAudioUrl = undefined;
  }
  onSpeakingChange?.(false);
}

function blobFromBase64(value: string, mimeType: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new Blob([bytes], { type: mimeType });
}

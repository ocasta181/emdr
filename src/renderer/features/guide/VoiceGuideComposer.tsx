import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import type { GuideChatMessage } from "./GuidePanel";

export function VoiceGuideComposer({
  messages,
  chatDraft,
  placeholder,
  onChatChange,
  onSubmitMessage,
  onGuideSpeakingChange
}: {
  messages: GuideChatMessage[];
  chatDraft: string;
  placeholder: string;
  onChatChange: (value: string) => void;
  onSubmitMessage: (message: string) => void;
  onGuideSpeakingChange: (isSpeaking: boolean) => void;
}) {
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [isListening, setListening] = useState(false);
  const [heardText, setHeardText] = useState("");
  const [voiceError, setVoiceError] = useState("");
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const spokenMessageRef = useRef("");
  const recognitionConstructor = useMemo(() => speechRecognitionConstructor(), []);
  const canListen = Boolean(recognitionConstructor);
  const latestGuideMessage = latestGuideText(messages);

  useEffect(() => {
    if (!latestGuideMessage || spokenMessageRef.current === latestGuideMessage || !canSpeak()) return;
    spokenMessageRef.current = latestGuideMessage;
    speak(latestGuideMessage, onGuideSpeakingChange);
  }, [latestGuideMessage, onGuideSpeakingChange]);

  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
      if (canSpeak()) {
        window.speechSynthesis.cancel();
      }
      onGuideSpeakingChange(false);
    };
  }, [onGuideSpeakingChange]);

  function startListening() {
    setVoiceError("");
    setHeardText("");

    if (!recognitionConstructor) {
      setKeyboardOpen(true);
      setVoiceError("Speech recognition is unavailable in this build. Use keyboard entry instead.");
      return;
    }

    recognitionRef.current?.abort();
    const recognition = new recognitionConstructor();
    recognitionRef.current = recognition;
    recognition.lang = "en-US";
    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onstart = () => setListening(true);
    recognition.onerror = () => {
      setListening(false);
      setVoiceError("I could not hear that clearly. Try again or use keyboard entry.");
    };
    recognition.onend = () => setListening(false);
    recognition.onresult = (event) => {
      const transcript = transcriptFromRecognitionEvent(event);
      setHeardText(transcript.displayText);
      if (transcript.finalText) {
        recognition.stop();
        onSubmitMessage(transcript.finalText);
        setHeardText("");
      }
    };

    try {
      recognition.start();
    } catch {
      setListening(false);
      setVoiceError("I could not start voice input. Try again or use keyboard entry.");
    }
  }

  function stopListening() {
    recognitionRef.current?.stop();
    setListening(false);
  }

  function submitKeyboardMessage(event: FormEvent) {
    event.preventDefault();
    onSubmitMessage(chatDraft);
  }

  return (
    <div className="voiceGuide">
      <div className="voiceStatus" aria-live="polite">
        <span className={isListening ? "voiceStatusDot active" : "voiceStatusDot"} />
        <span>{voiceStatusText({ canListen, isListening, heardText })}</span>
      </div>
      <div className="voiceControls">
        <button
          type="button"
          className={isListening ? "active" : undefined}
          onClick={isListening ? stopListening : startListening}
        >
          {isListening ? "Stop Listening" : "Start Voice"}
        </button>
        <button type="button" onClick={() => speak(latestGuideMessage, onGuideSpeakingChange)}>
          Replay Guide
        </button>
        <button type="button" onClick={() => setKeyboardOpen((current) => !current)}>
          {keyboardOpen ? "Hide Keyboard" : "Use Keyboard"}
        </button>
      </div>
      {voiceError && <div className="formError">{voiceError}</div>}
      {keyboardOpen && (
        <form className="chatComposer" onSubmit={submitKeyboardMessage}>
          <label>
            Tell the guide
            <textarea
              placeholder={placeholder}
              value={chatDraft}
              onChange={(event) => onChatChange(event.target.value)}
            />
          </label>
          <button type="submit">Send</button>
        </form>
      )}
    </div>
  );
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onstart: (() => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  abort: () => void;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionEventLike = {
  results: {
    length: number;
    [index: number]: SpeechRecognitionResultLike;
  };
};

type SpeechRecognitionResultLike = {
  isFinal: boolean;
  [index: number]: { transcript: string };
};

function latestGuideText(messages: GuideChatMessage[]) {
  return [...messages].reverse().find((message) => message.speaker === "guide")?.text ?? "";
}

function speechRecognitionConstructor(): SpeechRecognitionConstructor | undefined {
  const browserWindow = window as Window & {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return browserWindow.SpeechRecognition ?? browserWindow.webkitSpeechRecognition;
}

function transcriptFromRecognitionEvent(event: SpeechRecognitionEventLike) {
  let displayText = "";
  let finalText = "";

  for (let index = 0; index < event.results.length; index += 1) {
    const result = event.results[index];
    const text = result[0]?.transcript.trim() ?? "";
    if (!text) continue;

    displayText = text;
    if (result.isFinal) {
      finalText = text;
    }
  }

  return { displayText, finalText };
}

function voiceStatusText({
  canListen,
  isListening,
  heardText
}: {
  canListen: boolean;
  isListening: boolean;
  heardText: string;
}) {
  if (!canListen) return "Voice input unavailable. Keyboard fallback is ready.";
  if (heardText) return `Heard: ${heardText}`;
  if (isListening) return "Listening...";
  return "Voice guide is ready.";
}

function canSpeak() {
  return "speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined";
}

function speak(text: string, onGuideSpeakingChange?: (isSpeaking: boolean) => void) {
  if (!text || !canSpeak()) return;

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 0.92;
  utterance.pitch = 0.96;
  utterance.onstart = () => onGuideSpeakingChange?.(true);
  utterance.onend = () => onGuideSpeakingChange?.(false);
  utterance.onerror = () => onGuideSpeakingChange?.(false);
  window.speechSynthesis.speak(utterance);
}

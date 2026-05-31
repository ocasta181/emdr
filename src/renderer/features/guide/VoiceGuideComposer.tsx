import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import type { GuideChatMessage } from "./GuidePanel";
import { canSpeakGuideText, speakGuideText, stopGuideSpeech } from "./guideSpeech";

export function VoiceGuideComposer({
  messages,
  guideVoiceURI,
  chatDraft,
  placeholder,
  onChatChange,
  onSubmitMessage,
  onGuideSpeakingChange
}: {
  messages: GuideChatMessage[];
  guideVoiceURI: string;
  chatDraft: string;
  placeholder: string;
  onChatChange: (value: string) => void;
  onSubmitMessage: (message: string) => void;
  onGuideSpeakingChange: (isSpeaking: boolean) => void;
}) {
  const [voiceError, setVoiceError] = useState("");
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const shouldListenRef = useRef(false);
  const onSubmitMessageRef = useRef(onSubmitMessage);
  const onGuideSpeakingChangeRef = useRef(onGuideSpeakingChange);
  const spokenMessageRef = useRef("");
  const recognitionConstructor = useMemo(() => speechRecognitionConstructor(), []);
  const latestGuideMessage = latestGuideText(messages);

  useEffect(() => {
    if (!latestGuideMessage || spokenMessageRef.current === latestGuideMessage || !canSpeakGuideText()) return;
    spokenMessageRef.current = latestGuideMessage;
    speakGuideText(latestGuideMessage, { voiceURI: guideVoiceURI, onSpeakingChange: onGuideSpeakingChange });
  }, [latestGuideMessage, guideVoiceURI, onGuideSpeakingChange]);

  useEffect(() => {
    onSubmitMessageRef.current = onSubmitMessage;
  }, [onSubmitMessage]);

  useEffect(() => {
    onGuideSpeakingChangeRef.current = onGuideSpeakingChange;
  }, [onGuideSpeakingChange]);

  useEffect(() => {
    if (!recognitionConstructor) {
      setVoiceError("Speech-to-text is unavailable in this build. Type below instead.");
      return;
    }

    let restartTimer: number | undefined;
    shouldListenRef.current = true;
    setVoiceError("");

    function scheduleRestart() {
      if (!shouldListenRef.current) return;
      window.clearTimeout(restartTimer);
      restartTimer = window.setTimeout(startListening, 250);
    }

    function startListening() {
      if (!shouldListenRef.current || !recognitionConstructor) return;

      const recognition = new recognitionConstructor();
      recognitionRef.current = recognition;
      recognition.lang = "en-US";
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.onstart = () => setVoiceError("");
      recognition.onerror = (event) => {
        if (!shouldListenRef.current || event.error === "aborted" || event.error === "no-speech") return;
        if (isFatalSpeechRecognitionError(event.error)) {
          shouldListenRef.current = false;
        }
        setVoiceError(speechRecognitionErrorMessage(event.error));
      };
      recognition.onend = () => {
        if (recognitionRef.current === recognition) {
          recognitionRef.current = null;
        }
        scheduleRestart();
      };
      recognition.onresult = (event) => {
        const transcript = transcriptFromRecognitionEvent(event);
        if (transcript.finalText) {
          onSubmitMessageRef.current(transcript.finalText);
        }
      };

      try {
        recognition.start();
      } catch {
        shouldListenRef.current = false;
        setVoiceError("Speech-to-text could not start. Type below or check microphone access.");
      }
    }

    startListening();

    return () => {
      shouldListenRef.current = false;
      window.clearTimeout(restartTimer);
      recognitionRef.current?.abort();
      recognitionRef.current = null;
    };
  }, [recognitionConstructor]);

  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
      stopGuideSpeech();
      onGuideSpeakingChangeRef.current(false);
    };
  }, []);

  function submitKeyboardMessage(event: FormEvent) {
    event.preventDefault();
    onSubmitMessage(chatDraft);
  }

  function submitKeyboardShortcut(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || (!event.metaKey && !event.ctrlKey) || event.nativeEvent.isComposing) return;
    event.preventDefault();
    onSubmitMessage(chatDraft);
  }

  return (
    <div className="voiceGuide">
      {voiceError && <div className="formError">{voiceError}</div>}
      <form className="chatComposer" onSubmit={submitKeyboardMessage}>
        <textarea
          aria-label="Guide message"
          placeholder={placeholder}
          value={chatDraft}
          onChange={(event) => onChatChange(event.target.value)}
          onKeyDown={submitKeyboardShortcut}
        />
        <button type="submit">Send</button>
      </form>
    </div>
  );
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onstart: (() => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  abort: () => void;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: SpeechRecognitionResultLike;
  };
};

type SpeechRecognitionErrorEventLike = {
  error?: string;
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
  let finalText = "";

  for (let index = event.resultIndex; index < event.results.length; index += 1) {
    const result = event.results[index];
    const text = result[0]?.transcript.trim() ?? "";
    if (!text) continue;

    if (result.isFinal) {
      finalText = text;
    }
  }

  return { finalText };
}

function speechRecognitionErrorMessage(error: string | undefined) {
  if (error === "not-allowed" || error === "service-not-allowed") {
    return "Speech-to-text does not have microphone access. Type below or check microphone access.";
  }

  if (error === "network") {
    return "Speech-to-text is unavailable in Electron's browser service. Type below instead.";
  }

  if (error === "audio-capture") {
    return "Speech-to-text cannot access an audio input device. Type below or check microphone access.";
  }

  return "Speech-to-text could not stay connected. Type below or check microphone access.";
}

function isFatalSpeechRecognitionError(error: string | undefined) {
  return (
    error === "network" ||
    error === "audio-capture" ||
    error === "not-allowed" ||
    error === "service-not-allowed" ||
    error === "language-not-supported" ||
    error === "bad-grammar"
  );
}

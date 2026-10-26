"use client";

import { useHydrated } from "@/lib/use-hydrated";

import { useEffect, useRef, useState } from "react";

type RecognitionResult = {
  isFinal: boolean;
  [index: number]: { transcript: string };
};

type RecognitionEvent = {
  resultIndex: number;
  results: ArrayLike<RecognitionResult>;
};

type RecognitionInstance = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: RecognitionEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

type RecognitionConstructor = new () => RecognitionInstance;

export function useDictation(
  input: string,
  setInput: (input: string) => void,
  reportError: (error: string) => void,
) {
  const hydrated = useHydrated();
  const browserWindow = hydrated
    ? (window as typeof window & {
        SpeechRecognition?: RecognitionConstructor;
        webkitSpeechRecognition?: RecognitionConstructor;
      })
    : null;
  const dictationSupported = Boolean(
    browserWindow?.SpeechRecognition || browserWindow?.webkitSpeechRecognition,
  );
  const [isDictating, setIsDictating] = useState(false);
  const [dictationTranscript, setDictationTranscript] = useState("");
  const recognitionRef = useRef<RecognitionInstance | null>(null);
  const dictationTranscriptRef = useRef("");
  const dictationBaseRef = useRef("");
  const dictationActionRef = useRef<"accept" | "cancel" | null>(null);
  useEffect(
    () => () => {
      const recognition = recognitionRef.current;
      if (recognition) {
        // Unmount must not commit a pending transcript or update component state.
        recognition.onend = null;
        recognition.onresult = null;
        recognition.onerror = null;
        recognition.abort();
      }
    },
    [],
  );

  function startDictation() {
    const browserWindow = window as typeof window & {
      SpeechRecognition?: RecognitionConstructor;
      webkitSpeechRecognition?: RecognitionConstructor;
    };
    const Recognition =
      browserWindow.SpeechRecognition || browserWindow.webkitSpeechRecognition;
    if (!Recognition) return;

    const recognition = new Recognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = navigator.language || "en-US";
    recognition.onresult = (event) => {
      const phrases: string[] = [];
      for (let index = 0; index < event.results.length; index += 1) {
        const result = event.results[index];
        phrases.push(result[0].transcript.trim());
      }
      const transcript = phrases.filter(Boolean).join(" ");
      dictationTranscriptRef.current = transcript;
      setDictationTranscript(transcript);
    };
    recognition.onerror = (event) => {
      setIsDictating(false);
      if (event.error === "not-allowed")
        reportError("Microphone access is required to use dictation.");
    };
    recognition.onend = () => {
      if (dictationActionRef.current !== "cancel") {
        const transcript = dictationTranscriptRef.current.trim();
        if (transcript) {
          const base = dictationBaseRef.current;
          setInput(
            `${base}${base && !base.endsWith(" ") ? " " : ""}${transcript}`,
          );
        }
      }
      recognitionRef.current = null;
      dictationActionRef.current = null;
      setIsDictating(false);
    };
    recognitionRef.current = recognition;
    dictationBaseRef.current = input;
    dictationTranscriptRef.current = "";
    dictationActionRef.current = null;
    setDictationTranscript("");
    setIsDictating(true);
    try {
      recognition.start();
    } catch {
      setIsDictating(false);
    }
  }

  function acceptDictation() {
    dictationActionRef.current = "accept";
    recognitionRef.current?.stop();
  }

  function cancelDictation() {
    dictationActionRef.current = "cancel";
    recognitionRef.current?.abort();
    recognitionRef.current = null;
    setDictationTranscript("");
    setIsDictating(false);
  }

  return {
    dictationSupported,
    isDictating,
    dictationTranscript,
    startDictation,
    acceptDictation,
    cancelDictation,
  };
}

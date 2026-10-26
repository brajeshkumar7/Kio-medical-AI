import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useDictation } from "@/features/chat/hooks/use-dictation";

class Recognition {
  static latest: Recognition;
  continuous = false;
  interimResults = false;
  lang = "";
  onresult:
    | ((event: {
        resultIndex: number;
        results: { isFinal: boolean; 0: { transcript: string } }[];
      }) => void)
    | null = null;
  onerror: ((event: { error: string }) => void) | null = null;
  onend: (() => void) | null = null;
  start = vi.fn();
  stop = vi.fn(() => this.onend?.());
  abort = vi.fn(() => this.onend?.());
  constructor() {
    Recognition.latest = this;
  }
}

beforeEach(() => vi.stubGlobal("SpeechRecognition", Recognition));

describe("browser dictation", () => {
  it("appends accepted transcription to the existing draft", () => {
    const setInput = vi.fn();
    const { result } = renderHook(() =>
      useDictation("Existing", setInput, vi.fn()),
    );
    expect(result.current.dictationSupported).toBe(true);
    act(() => result.current.startDictation());
    act(() =>
      Recognition.latest.onresult?.({
        resultIndex: 0,
        results: [{ isFinal: true, 0: { transcript: " new words " } }],
      }),
    );
    expect(result.current.dictationTranscript).toBe("new words");
    act(() => result.current.acceptDictation());
    expect(setInput).toHaveBeenCalledWith("Existing new words");
    expect(result.current.isDictating).toBe(false);
  });

  it("discards cancelled transcription", () => {
    const setInput = vi.fn();
    const { result } = renderHook(() =>
      useDictation("Draft", setInput, vi.fn()),
    );
    act(() => result.current.startDictation());
    act(() =>
      Recognition.latest.onresult?.({
        resultIndex: 0,
        results: [{ isFinal: false, 0: { transcript: "discard" } }],
      }),
    );
    act(() => result.current.cancelDictation());
    expect(Recognition.latest.abort).toHaveBeenCalledOnce();
    expect(setInput).not.toHaveBeenCalled();
    expect(result.current.dictationTranscript).toBe("");
  });

  it("reports denied microphone access and aborts active recognition on unmount", () => {
    const setError = vi.fn();
    const { result, unmount } = renderHook(() =>
      useDictation("", vi.fn(), setError),
    );
    act(() => result.current.startDictation());
    act(() => Recognition.latest.onerror?.({ error: "not-allowed" }));
    expect(setError).toHaveBeenCalledWith(
      "Microphone access is required to use dictation.",
    );
    unmount();
    expect(Recognition.latest.abort).toHaveBeenCalledOnce();
  });
});

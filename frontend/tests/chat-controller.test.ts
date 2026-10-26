import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Conversation, Message, StreamStart } from "@/features/chat/types";

const mocks = vi.hoisted(() => ({
  getToken: vi.fn(),
  notify: vi.fn(),
  confirm: vi.fn(),
  checkBackend: vi.fn(),
  listConversations: vi.fn(),
  createConversation: vi.fn(),
  getConversation: vi.fn(),
  deleteConversation: vi.fn(),
  streamMessage: vi.fn(),
  ensureGuestSession: vi.fn(),
  transferGuestSession: vi.fn(),
  getGuestStatus: vi.fn(),
}));
vi.mock("@clerk/nextjs", () => ({
  useAuth: () => ({
    getToken: mocks.getToken,
    isLoaded: true,
    isSignedIn: true,
  }),
  useUser: () => ({ user: { firstName: "Test" } }),
}));
vi.mock("@/providers/theme-provider", () => ({
  useKioTheme: () => ({ theme: "dark", toggleTheme: vi.fn() }),
}));
vi.mock("@/providers/toast-provider", () => ({
  useToast: () => ({ notify: mocks.notify, confirm: mocks.confirm }),
}));
vi.mock("@/features/chat/hooks/use-backend-status", () => ({
  useBackendStatus: () => ({
    backendStatus: "online",
    checkBackend: mocks.checkBackend,
  }),
}));
vi.mock("@/features/chat/services/conversations", () => mocks);
vi.mock("@/features/chat/services/guest-session", () => mocks);
vi.mock("@/features/chat/services/guest-api", () => mocks);
import { useChatController } from "@/features/chat/hooks/use-chat-controller";

const conversation: Conversation = {
  id: "chat",
  title: "Question",
  createdAt: "2026-01-01",
  updatedAt: "2026-01-01",
};
const userMessage: Message = {
  id: "user",
  role: "user",
  content: "Question",
  sequence: 1,
  createdAt: "2026-01-01",
};
const assistantMessage: Message = {
  id: "answer",
  role: "assistant",
  content: "Answer",
  sequence: 2,
  createdAt: "2026-01-01",
};

beforeEach(() => {
  vi.resetAllMocks();
  mocks.getToken.mockResolvedValue("account-token");
  mocks.listConversations.mockResolvedValue([conversation]);
  mocks.createConversation.mockResolvedValue({ ...conversation, messages: [] });
  mocks.getConversation.mockResolvedValue({
    ...conversation,
    messages: [userMessage, assistantMessage],
  });
  mocks.confirm.mockResolvedValue(true);
  mocks.ensureGuestSession.mockResolvedValue({
    token: "guest-token",
    usage: {
      remaining: 0,
      limit: 3,
      resetAt: new Date(Date.now() + 60000).toISOString(),
    },
  });
});

describe("chat coordination", () => {
  it("reconciles optimistic and streamed messages without duplicates", async () => {
    const { result } = renderHook(() => useChatController("account"));
    await waitFor(() => expect(result.current.isHistoryLoading).toBe(false));
    expect(mocks.transferGuestSession).toHaveBeenCalledWith("account-token");
    vi.useFakeTimers();
    mocks.streamMessage.mockImplementation(
      async (
        _token: string,
        _id: string,
        _question: string,
        callbacks: {
          onStart: (event: StreamStart) => void;
          onDelta: (content: string) => void;
        },
      ) => {
        callbacks.onStart({
          type: "start",
          conversation,
          userMessage,
          sources: [],
        });
        callbacks.onDelta("Answer");
        return {
          type: "complete",
          conversation,
          userMessage,
          assistantMessage,
        };
      },
    );
    let pending: Promise<void>;
    await act(async () => {
      pending = result.current.submitMessage("Question");
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(result.current.isLoading).toBe(true);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
      await pending;
    });
    expect(result.current.messages).toEqual([userMessage, assistantMessage]);
    expect(result.current.conversations).toEqual([conversation]);
    expect(result.current.streamingAnswer).toBeNull();
    expect(result.current.isLoading).toBe(false);
    expect(mocks.streamMessage).toHaveBeenCalledWith(
      "account-token",
      "chat",
      "Question",
      expect.anything(),
      false,
    );
  });

  it("loads history and respects delete confirmation", async () => {
    const { result } = renderHook(() => useChatController("account"));
    await waitFor(() => expect(result.current.isHistoryLoading).toBe(false));
    await act(async () => {
      await result.current.selectConversation("chat");
    });
    expect(result.current.messages).toEqual([userMessage, assistantMessage]);
    mocks.confirm.mockResolvedValueOnce(false);
    await act(async () => {
      await result.current.removeConversation("chat");
    });
    expect(mocks.deleteConversation).not.toHaveBeenCalled();
    await act(async () => {
      await result.current.removeConversation("chat");
    });
    expect(mocks.deleteConversation).toHaveBeenCalledWith(
      "account-token",
      "chat",
      false,
    );
    expect(result.current.activeId).toBeNull();
    expect(result.current.messages).toEqual([]);
    expect(result.current.conversations).toEqual([]);
  });

  it("removes optimistic text and reports a failed stream", async () => {
    const { result } = renderHook(() => useChatController("account"));
    await waitFor(() => expect(result.current.isHistoryLoading).toBe(false));
    mocks.streamMessage.mockRejectedValueOnce(new Error("Stream failed"));
    await act(async () => {
      await result.current.submitMessage("Question");
    });
    expect(result.current.messages).toEqual([]);
    expect(result.current.isLoading).toBe(false);
    expect(mocks.notify).toHaveBeenCalledWith({
      title: "Stream failed",
      tone: "error",
    });
    expect(mocks.checkBackend).toHaveBeenCalled();
  });

  it("uses guest authorization and blocks messages after quota exhaustion", async () => {
    const { result } = renderHook(() => useChatController("guest"));
    await waitFor(() => expect(result.current.guestToken).toBe("guest-token"));
    await waitFor(() => expect(result.current.isHistoryLoading).toBe(false));
    expect(mocks.listConversations).toHaveBeenCalledWith("guest-token", true);
    await act(async () => {
      await result.current.submitMessage("Question");
    });
    expect(mocks.streamMessage).not.toHaveBeenCalled();
    expect(mocks.notify).toHaveBeenCalledWith({
      title: "Guest questions are used up for today. Sign in to continue.",
      tone: "error",
    });
  });
});

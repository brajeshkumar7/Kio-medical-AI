import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
} from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { KioThemeProvider, useKioTheme } from "@/providers/theme-provider";
import { ToastProvider, useToast } from "@/providers/toast-provider";

it("restores and persists the theme across provider mounts", () => {
  localStorage.setItem("kio-theme", "light");
  const { result, unmount } = renderHook(() => useKioTheme(), {
    wrapper: KioThemeProvider,
  });
  expect(result.current.theme).toBe("light");
  expect(document.documentElement.dataset.theme).toBe("light");
  act(() => result.current.toggleTheme());
  expect(result.current.theme).toBe("dark");
  expect(localStorage.getItem("kio-theme")).toBe("dark");
  unmount();
  const remounted = renderHook(() => useKioTheme(), {
    wrapper: KioThemeProvider,
  });
  expect(remounted.result.current.theme).toBe("dark");
});

it("uses the OS preference when no theme was saved", () => {
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({ matches: true })),
  );
  const { result } = renderHook(() => useKioTheme(), {
    wrapper: KioThemeProvider,
  });
  expect(result.current.theme).toBe("light");
});

function ConfirmButton({ onResult }: { onResult: (result: boolean) => void }) {
  const { confirm } = useToast();
  return (
    <button
      onClick={() =>
        void confirm({
          title: "Delete conversation?",
          confirmLabel: "Delete",
        }).then(onResult)
      }
    >
      Request deletion
    </button>
  );
}

it("settles destructive confirmations through explicit confirm and cancel actions", async () => {
  const onResult = vi.fn();
  render(
    <ToastProvider>
      <ConfirmButton onResult={onResult} />
    </ToastProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Request deletion" }));
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  });
  expect(onResult).toHaveBeenLastCalledWith(false);
  fireEvent.click(screen.getByRole("button", { name: "Request deletion" }));
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
  });
  expect(onResult).toHaveBeenLastCalledWith(true);
});

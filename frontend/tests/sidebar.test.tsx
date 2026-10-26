import { fireEvent, render, screen, within } from "@testing-library/react";
import { expect, it, vi } from "vitest";
vi.mock("@clerk/nextjs", () => ({
  useUser: () => ({ user: null }),
  useClerk: () => ({ signOut: vi.fn() }),
}));
vi.mock("@/providers/theme-provider", () => ({
  useKioTheme: () => ({ theme: "dark", toggleTheme: vi.fn() }),
}));
import Sidebar from "@/features/chat/components/sidebar";

it("searches and selects conversations and closes search with Escape", () => {
  const onSelect = vi.fn();
  render(
    <Sidebar
      guest
      open={false}
      collapsed={false}
      conversations={[
        {
          id: "a",
          title: "Sleep routine",
          createdAt: "2026-01-01",
          updatedAt: "2026-01-01",
        },
        {
          id: "b",
          title: "Appointment",
          createdAt: "2026-01-01",
          updatedAt: "2026-01-01",
        },
      ]}
      activeId={null}
      onClose={vi.fn()}
      onToggleCollapsed={vi.fn()}
      onNewChat={vi.fn()}
      onSelect={onSelect}
      onDelete={vi.fn()}
      deletingId={null}
    />,
  );
  fireEvent.keyDown(document, { key: "k", ctrlKey: true });
  const dialog = screen.getByRole("dialog", { name: "Search conversations" });
  fireEvent.change(within(dialog).getByRole("textbox"), {
    target: { value: "sleep" },
  });
  expect(
    within(dialog).queryByRole("button", { name: "Appointment" }),
  ).toBeNull();
  fireEvent.click(
    within(dialog).getByRole("button", { name: "Sleep routine" }),
  );
  expect(onSelect).toHaveBeenCalledWith("a");
  expect(screen.queryByRole("dialog")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Search conversations" }));
  fireEvent.keyDown(document, { key: "Escape" });
  expect(screen.queryByRole("dialog")).toBeNull();
});

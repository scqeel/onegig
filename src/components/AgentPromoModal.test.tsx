import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AgentPromoModal } from "./AgentPromoModal";

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ isAgent: false, loading: false, user: null }),
}));

function renderAt(path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <AgentPromoModal />
    </MemoryRouter>,
  );
  act(() => {
    vi.advanceTimersByTime(1000);
  });
}

describe("AgentPromoModal", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    sessionStorage.clear();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("appears on OneGig's own pages", () => {
    renderAt("/buy");
    expect(screen.queryByText("Earn by selling data bundles")).not.toBeNull();
  });

  it("stays off an agent's store", () => {
    renderAt("/store/kofi");
    expect(screen.queryByText("Earn by selling data bundles")).toBeNull();
  });

  it("stays off an agent's store login", () => {
    renderAt("/store-auth/kofi");
    expect(screen.queryByText("Earn by selling data bundles")).toBeNull();
  });
});

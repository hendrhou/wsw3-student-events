import { renderHook } from "@testing-library/react";
import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { HostProvider, useHost, invalidateParticipation, queryKeys, type HostServices } from "./index";

describe("feature host contract", () => {
  it("requires explicit host services instead of reading browser storage", () => {
    expect(() => renderHook(() => useHost())).toThrow("HostProvider");
  });

  it("passes the current session, navigation and notifications to features", () => {
    const host: HostServices = {
      user: { name: "Student", studentNumber: "123", email: "student@ufp.edu.pt", role: "user" },
      navigate: vi.fn(),
      href: () => "/custom/event",
      notify: vi.fn(),
    };
    const { result } = renderHook(() => useHost(), {
      wrapper: ({ children }) => <HostProvider value={host}>{children}</HostProvider>,
    });
    result.current.navigate({ page: "event", eventId: "event-1" });
    result.current.notify({ type: "success", message: "Registered" });
    expect(result.current.user).toEqual(host.user);
    expect(host.navigate).toHaveBeenCalledWith({ page: "event", eventId: "event-1" });
    expect(host.notify).toHaveBeenCalledWith({ type: "success", message: "Registered" });
  });

  it("invalidates capacity, registrations, tickets and attendance after participation changes", async () => {
    const client = new QueryClient();
    const keys = [queryKeys.event("event-1"), queryKeys.tickets, queryKeys.organiserEvents,
      queryKeys.registrations("event-1", "registered")];
    keys.forEach((key) => client.setQueryData(key, []));
    await invalidateParticipation(client, "event-1");
    keys.forEach((key) => expect(client.getQueryState(key)?.isInvalidated).toBe(true));
  });
});
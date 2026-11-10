import { useMemo, useState, type ReactElement, type ReactNode } from "react";
import { render } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useNavigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HostProvider, destinationHref, type HostServices, type Notification } from "@campus-pulse/contracts";
import { ToastRegion, type ToastData } from "@campus-pulse/ui";

/**
 * Test host: provides the contracts HostProvider every screen consumes and
 * renders pushed notifications via ToastRegion, so toast assertions work.
 */
function TestHost({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [toasts, setToasts] = useState<ToastData[]>([]);
  const host = useMemo<HostServices>(
    () => ({
      user: { name: "Vítor Carvalho", studentNumber: "20220123", email: "vitor@ufp.edu.pt", role: "admin" },
      navigate: (destination, options) => navigate(destinationHref(destination), options),
      href: destinationHref,
      notify: (notification: Notification) =>
        setToasts((current) => [...current, { ...notification, id: crypto.randomUUID() }]),
    }),
    [navigate],
  );
  return (
    <HostProvider value={host}>
      <ToastRegion toasts={toasts} onDismiss={(id) => setToasts((current) => current.filter((t) => t.id !== id))} />
      {children}
    </HostProvider>
  );
}

export function renderWithProviders(
  ui: ReactElement,
  options: { initialEntries?: string[]; path?: string } = {},
) {
  const { initialEntries = ["/"], path } = options;
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries}>
        <TestHost>
          {path ? (
            <Routes>
              <Route path={path} element={ui} />
            </Routes>
          ) : (
            ui
          )}
        </TestHost>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

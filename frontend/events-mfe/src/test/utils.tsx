import { useMemo, useState, type ReactElement, type ReactNode, type ComponentType } from "react";
import { render } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useNavigate, useParams } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HostProvider, destinationHref, type HostServices, type Notification } from "@campus-pulse/contracts";
import { ToastRegion, type ToastData } from "@campus-pulse/ui";

/**
 * Test host: provides the contracts HostProvider every screen consumes and
 * renders pushed notifications via ToastRegion, so toast assertions work.
 * Self-contained by design: MFE Docker builds do not include the shell sources.
 */
export function TestHost({ children }: { children: ReactNode }) {
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

export function withEventId<Props extends { eventId?: string }>(Component: ComponentType<Props>) {
  return function RoutedFeature(props: Omit<Props, "eventId"> & { eventId?: string }) {
    const params = useParams<{ eventId: string }>();
    return <Component {...{ ...props, eventId: props.eventId ?? params.eventId ?? "" } as Props} />;
  };
}

export function renderWithProviders(
  ui: ReactElement,
  options: { initialEntries?: string[]; path?: string; extraRoutes?: Array<[string, string]> } = {},
) {
  const { initialEntries = ["/"], path, extraRoutes = [] } = options;
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries}>
        <TestHost>
        {path || extraRoutes.length > 0 ? (
          <Routes>
            {extraRoutes.map(([routePath, marker]) => (
              <Route key={routePath} path={routePath} element={<p>{marker}</p>} />
            ))}
            <Route path={path ?? "*"} element={ui} />
          </Routes>
        ) : (
          ui
        )}
        </TestHost>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

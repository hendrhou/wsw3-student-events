import { useMemo, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { HostProvider, destinationHref, type HostServices } from "@campus-pulse/contracts";
import { useAuth } from "./auth";
import { useNotifications } from "./notifications";

/**
 * Wires the shell's router, session store and toast store into the host
 * contract every federated feature screen consumes via useHost().
 */
export function HostServicesProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const user = useAuth((s) => s.user);
  const push = useNotifications((s) => s.push);
  const value = useMemo<HostServices>(
    () => ({
      user,
      navigate: (destination, options) => navigate(destinationHref(destination), options),
      href: destinationHref,
      notify: push,
    }),
    [user, navigate, push],
  );
  return <HostProvider value={value}>{children}</HostProvider>;
}

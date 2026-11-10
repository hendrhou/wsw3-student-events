import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { recordNavigation } from "./index";

export function TelemetryNavigation() {
  const { pathname } = useLocation();
  useEffect(() => recordNavigation(pathname), [pathname]);
  return null;
}
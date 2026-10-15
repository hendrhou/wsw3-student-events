import { setupWorker } from "msw/browser";
import { handlers } from "./handlers";

/** Browser worker for standalone MFE dev servers. */
export const worker = setupWorker(...handlers);

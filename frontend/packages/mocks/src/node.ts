import { setupServer } from "msw/node";
import { handlers } from "./handlers";

/** Node server for Vitest integration tests. */
export const server = setupServer(...handlers);

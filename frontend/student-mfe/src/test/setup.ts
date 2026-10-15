import "@testing-library/jest-dom/vitest";
import { server } from "@campus-pulse/mocks/node";
import { afterAll, afterEach, beforeAll } from "vitest";

beforeAll(() => server.listen({ onUnhandledRequest: "warn" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

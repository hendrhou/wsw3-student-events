import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { federation } from "@module-federation/vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [
      react(),
      federation({
        name: "eventsMfe",
        filename: "remoteEntry.js",
        exposes: {
          "./components": "./src/exposes.ts",
        },
        shared: {
          "@campus-pulse/contracts": { singleton: true },
          react: { singleton: true },
          "react-dom": { singleton: true },
          "react-router-dom": { singleton: true },
          "@tanstack/react-query": { singleton: true },
        },
      }),
    ],
    server: {
      proxy: {
        "/api": {
          target: env.VITE_GATEWAY_PROXY_TARGET ?? "http://localhost:8000",
          changeOrigin: true,
        },
      },
    },
    build: {
      target: "chrome89",
      modulePreload: false,
      cssCodeSplit: false,
    },
  };
});

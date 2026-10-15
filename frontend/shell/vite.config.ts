import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { federation } from "@module-federation/vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const studentUrl = env.VITE_STUDENT_MFE_URL ?? "http://localhost:5001";
  const organiserUrl = env.VITE_ORGANISER_MFE_URL ?? "http://localhost:5002";

  return {
    plugins: [
      react(),
      federation({
        name: "shell",
        remotes: {
          studentMfe: { type: "module", name: "studentMfe", entry: `${studentUrl}/remoteEntry.js` },
          organiserMfe: { type: "module", name: "organiserMfe", entry: `${organiserUrl}/remoteEntry.js` },
        },
        shared: {
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
    },
  };
});

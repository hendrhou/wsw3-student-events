import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { federation } from "@module-federation/vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const eventsUrl = env.VITE_EVENTS_MFE_URL ?? "http://localhost:5001";
  const participationUrl = env.VITE_PARTICIPATION_MFE_URL ?? "http://localhost:5002";
  const credentialsUrl = env.VITE_CREDENTIALS_MFE_URL ?? "http://localhost:5003";
  const peopleUrl = env.VITE_PEOPLE_MFE_URL ?? "http://localhost:5004";

  return {
    plugins: [
      react(),
      federation({
        name: "shell",
        remotes: {
          eventsMfe: { type: "module", name: "eventsMfe", entry: `${eventsUrl}/remoteEntry.js` },
          participationMfe: { type: "module", name: "participationMfe", entry: `${participationUrl}/remoteEntry.js` },
          credentialsMfe: { type: "module", name: "credentialsMfe", entry: `${credentialsUrl}/remoteEntry.js` },
          peopleMfe: { type: "module", name: "peopleMfe", entry: `${peopleUrl}/remoteEntry.js` },
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
    },
  };
});

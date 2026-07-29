import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  plugins: [vue()],
  base: "/",
  resolve: {
    alias: {
      "depa-data-web-shared": fileURLToPath(
        new URL("../web-shared/src/index.ts", import.meta.url),
      ),
    },
  },
  server: {
    port: 4174,
  },
});

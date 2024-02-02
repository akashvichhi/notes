import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// https://vitejs.dev/config/
export default defineConfig({
  optimizeDeps: {
    include: ["@workspace/ckeditor5-custom-build"],
  },
  build: {
    commonjsOptions: {
      include: [/@workspace\/ckeditor5-custom-build/, /node_modules/],
    },
    rollupOptions: {
      output: {
        assetFileNames: "assets/[hash].[ext]",
        chunkFileNames: "assets/[hash].js",
        entryFileNames: "assets/[hash].js",
      },
    },
  },
  plugins: [react()],
});

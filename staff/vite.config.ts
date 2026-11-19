import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Staff console runs on its own port, separate from the public Event Planner site (5173).
export default defineConfig({ plugins: [react()], server: { port: 5174, strictPort: true, fs: { allow: [".."] } } });

import { createRoot } from "react-dom/client";
import "@fontsource/roboto/400.css";
import "@fontsource/roboto/500.css";
import "@fontsource/roboto/700.css";
import "./work.css";
import "./styles.css";
import App from "./App";
import { ensureSeed } from "./store";
import { SUPABASE_AUTH } from "./supabase";

// Safety: an online (production) build must use real accounts. Without it the console would fall back to the local demo accounts.
if (import.meta.env.PROD && !SUPABASE_AUTH) document.getElementById("root")!.textContent = "This build is not configured for real staff accounts.";
else ensureSeed().then(() => createRoot(document.getElementById("root")!).render(<App />));

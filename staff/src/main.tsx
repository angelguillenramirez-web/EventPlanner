import { createRoot } from "react-dom/client";
import "@fontsource/roboto/400.css";
import "@fontsource/roboto/500.css";
import "@fontsource/roboto/700.css";
import "./work.css";
import "./styles.css";
import App from "./App";
import { ensureSeed } from "./store";

ensureSeed().then(() => createRoot(document.getElementById("root")!).render(<App />));

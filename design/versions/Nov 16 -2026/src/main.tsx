import { createRoot } from "react-dom/client";
import "@fontsource/roboto/400.css";
import "@fontsource/roboto/500.css";
import "@fontsource/roboto/700.css";
import "@fontsource-variable/plus-jakarta-sans";
import "@fontsource-variable/fraunces/opsz.css";
import "./styles.css";
import App from "./App";
import { initCloud } from "./cloud";
import { initMotion } from "./motion";

initCloud();
initMotion();

createRoot(document.getElementById("root")!).render(<App />);

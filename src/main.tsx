import { createRoot } from "react-dom/client";
import "./styles.css";
import { App } from "../domain/app/components/App";
import { AnimatedApp } from "../domain/app/components/AnimatedApp";

const uiMode = new URLSearchParams(window.location.search).get("ui");

createRoot(document.getElementById("root")!).render(uiMode === "animated" ? <AnimatedApp /> : <App />);

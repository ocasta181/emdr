import { createRoot } from "react-dom/client";
import "./styles.css";
import { AnimatedApp } from "./renderer/app/AnimatedApp";

createRoot(document.getElementById("root")!).render(<AnimatedApp />);

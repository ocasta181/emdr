import { createRoot } from "react-dom/client";
import "./styles.css";
import { AnimatedApp } from "../domain/app/components/AnimatedApp";

createRoot(document.getElementById("root")!).render(<AnimatedApp />);

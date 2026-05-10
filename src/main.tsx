import { createRoot } from "react-dom/client";
import "./styles.css";
import { App } from "./domain/app/components/App";

createRoot(document.getElementById("root")!).render(<App />);

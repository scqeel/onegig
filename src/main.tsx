import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { isSamePhoneNumber } from "@/lib/format";

(window as any).isSamePhoneNumber = isSamePhoneNumber;

createRoot(document.getElementById("root")!).render(<App />);

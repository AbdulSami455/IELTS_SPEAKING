import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./app/App";
import { ErrorBoundary } from "./app/ErrorBoundary";
import { Toaster } from "@/components/ui/sonner";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <App />
        <Toaster position="top-center" richColors closeButton theme="light" />
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
);

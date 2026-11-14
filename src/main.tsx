import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource-variable/inter";
import "./styles/index.css";
import { App } from "./App";

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("#root not found");
const root = rootEl;

async function bootstrap() {
  if (import.meta.env.DEV && typeof window !== "undefined") {
    const searchParams = new URLSearchParams(window.location.search);
    const mockParam = searchParams.get("mock");
    if (mockParam === "1") {
      try {
        sessionStorage.setItem("cfsm_dev_mock", "1");
      } catch {}
    } else if (mockParam === "0") {
      try {
        sessionStorage.setItem("cfsm_dev_mock", "0");
      } catch {}
    }

    let isMock = mockParam === "1";
    if (!isMock && mockParam !== "0") {
      try {
        const stored = sessionStorage.getItem("cfsm_dev_mock");
        isMock = stored ? stored === "1" : true;
      } catch {
        isMock = true;
      }
    }

    if (isMock) {
      const { installDevMockApi } = await import("./dev/mockApi");
      installDevMockApi();
    }
  }

  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

void bootstrap();

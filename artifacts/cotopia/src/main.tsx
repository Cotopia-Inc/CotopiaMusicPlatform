import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// If a lazy-loaded chunk fails to fetch (e.g. after a new deploy renamed the
// files), Vite emits "vite:preloadError" instead of throwing into React. Catch
// it and do a hard reload — the fresh index.html will reference the new chunk
// names and the page will load correctly. Guard against reload loops by only
// reloading once per minute.
window.addEventListener("vite:preloadError", () => {
  const key = "vite_preload_error_reload";
  const last = Number(sessionStorage.getItem(key) ?? 0);
  if (Date.now() - last > 60_000) {
    sessionStorage.setItem(key, String(Date.now()));
    window.location.reload();
  }
});

// If the browser restores this page from its back/forward cache (e.g. a
// logged-out user hits "back" into a session that was suspended, not
// re-fetched), force a hard reload so auth state is re-derived from the
// current token/localStorage instead of showing a stale in-memory snapshot.
window.addEventListener("pageshow", (event) => {
  if (event.persisted) {
    window.location.reload();
  }
});

createRoot(document.getElementById("root")!).render(<App />);

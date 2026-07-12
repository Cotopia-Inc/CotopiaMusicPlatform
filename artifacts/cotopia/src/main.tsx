import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// If a lazy-loaded chunk or the main bundle fails to fetch (e.g. after a new
// deploy renamed the hashed files), Vite emits "vite:preloadError". Catch it
// and do a hard reload — the fresh index.html will reference the new filenames.
// Guard against reload loops: only reload once per minute.
window.addEventListener("vite:preloadError", () => {
  const key = "vite_preload_error_reload";
  const last = Number(sessionStorage.getItem(key) ?? 0);
  if (Date.now() - last > 60_000) {
    sessionStorage.setItem(key, String(Date.now()));
    window.location.reload();
  }
});

// If the browser restores this page from its back/forward cache (e.g. a
// logged-out user hits "back" into a suspended session), force a hard reload
// so auth state is re-derived from the current token rather than a stale snapshot.
window.addEventListener("pageshow", (event) => {
  if (event.persisted) {
    window.location.reload();
  }
});

createRoot(document.getElementById("root")!).render(<App />);

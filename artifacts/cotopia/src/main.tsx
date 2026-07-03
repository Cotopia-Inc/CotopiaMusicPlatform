import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

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

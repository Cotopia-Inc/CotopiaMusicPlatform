import { useState, useRef, useCallback } from "react";
import { Sidebar } from "./sidebar";
import { Player } from "./player";
import { ChevronLeft, ChevronRight, ChevronUp, ArrowLeft, Home } from "lucide-react";
import { useLocation, Link } from "wouter";

const NO_NAV_PATHS = ["/", "/login", "/register", "/onboarding", "/verify-email"];

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    return localStorage.getItem("cotopia-sidebar") !== "false";
  });
  const [showBackTop, setShowBackTop] = useState(false);
  const mainRef = useRef<HTMLElement>(null);
  const [location] = useLocation();

  const showNav = !NO_NAV_PATHS.includes(location) && !location.startsWith("/embed/");

  function toggleSidebar() {
    setSidebarOpen(v => {
      const next = !v;
      localStorage.setItem("cotopia-sidebar", String(next));
      return next;
    });
  }

  const handleScroll = useCallback(() => {
    setShowBackTop((mainRef.current?.scrollTop ?? 0) > 400);
  }, []);

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background text-foreground">
      <div className="flex flex-1 overflow-hidden">
        <div
          className="flex-shrink-0 overflow-hidden transition-[width] duration-300 ease-in-out"
          style={{ width: sidebarOpen ? 256 : 0 }}
        >
          <Sidebar />
        </div>

        {/* Sidebar toggle — fixed so it's always visible regardless of scroll */}
        <button
          onClick={toggleSidebar}
          style={{ left: sidebarOpen ? 244 : 4 }}
          className="fixed top-1/2 -translate-y-1/2 z-40 w-5 h-10 bg-card border border-border rounded-r-md flex items-center justify-center hover:bg-secondary transition-all duration-300 shadow-sm"
          title={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
        >
          {sidebarOpen
            ? <ChevronLeft className="w-3 h-3" />
            : <ChevronRight className="w-3 h-3" />}
        </button>

        <main ref={mainRef} onScroll={handleScroll} className="flex-1 overflow-y-auto relative min-w-0">

          <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-background to-background pointer-events-none -z-10" />
          <div className="p-4 pl-8 md:p-6 md:pl-9 lg:p-8 lg:pl-10">

            {showNav && (
              <div className="flex items-center gap-3 mb-5">
                <button
                  onClick={() => window.history.back()}
                  className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />Back
                </button>
                <span className="text-muted-foreground/30">·</span>
                <Link
                  href="/"
                  className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Home className="w-4 h-4" />Home
                </Link>
              </div>
            )}

            {children}
          </div>

          {showBackTop && (
            <button
              onClick={() => mainRef.current?.scrollTo({ top: 0, behavior: "smooth" })}
              className="fixed bottom-24 right-6 z-50 w-10 h-10 rounded-full bg-primary text-primary-foreground shadow-xl flex items-center justify-center hover:bg-primary/90 hover:scale-105 active:scale-95 transition-all"
              title="Back to top"
            >
              <ChevronUp className="w-5 h-5" />
            </button>
          )}
        </main>
      </div>
      <Player />
    </div>
  );
}

import { useState, useRef, useCallback } from "react";
import { Sidebar } from "./sidebar";
import { Player } from "./player";
import { ChevronLeft, ChevronRight, ChevronUp } from "lucide-react";

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    return localStorage.getItem("cotopia-sidebar") !== "false";
  });
  const [showBackTop, setShowBackTop] = useState(false);
  const mainRef = useRef<HTMLElement>(null);

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

        <main ref={mainRef} onScroll={handleScroll} className="flex-1 overflow-y-auto relative min-w-0">
          <button
            onClick={toggleSidebar}
            className="absolute top-4 left-2 z-30 w-6 h-6 bg-card border border-border rounded-full flex items-center justify-center hover:bg-secondary transition-colors shadow-sm"
            title={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
          >
            {sidebarOpen
              ? <ChevronLeft className="w-3 h-3" />
              : <ChevronRight className="w-3 h-3" />}
          </button>

          <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-background to-background pointer-events-none -z-10" />
          <div className="p-8 pl-10">
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

import { useState, useRef, useCallback } from "react";
import { Sidebar } from "./sidebar";
import { Player } from "./player";
import { ChevronLeft, ChevronRight, ChevronUp, ArrowLeft, Home, Menu, Bell, Radio } from "lucide-react";
import { useLocation, Link } from "wouter";
import { useAuth } from "@/lib/auth";
import { useGetUnreadNotificationCount, getGetUnreadNotificationCountQueryKey } from "@workspace/api-client-react";

const NO_NAV_PATHS = ["/", "/login", "/register", "/onboarding", "/verify-email"];

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    return localStorage.getItem("cotopia-sidebar") !== "false";
  });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showBackTop, setShowBackTop] = useState(false);
  const mainRef = useRef<HTMLElement>(null);
  const [location] = useLocation();
  const { user } = useAuth();

  const { data: unreadData } = useGetUnreadNotificationCount({
    query: {
      enabled: !!user,
      queryKey: getGetUnreadNotificationCountQueryKey(),
      refetchInterval: 30_000,
    }
  });
  const unreadCount = unreadData?.count ?? 0;

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

      {/* ── Mobile header bar ──────────────────────────────────────────────── */}
      <header className="md:hidden flex items-center justify-between px-4 h-14 border-b border-border/50 bg-card/95 backdrop-blur z-40 flex-shrink-0">
        <button
          onClick={() => setMobileMenuOpen(true)}
          className="w-9 h-9 flex items-center justify-center rounded-md hover:bg-secondary transition-colors"
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <Link href="/">
          <div className="flex items-center gap-2 cursor-pointer">
            <img src="/logo.jpg" alt="Cotopia" className="w-5 h-5 rounded-sm object-cover flex-shrink-0" />
            <span className="text-base font-extrabold tracking-tighter">Everyday Radio</span>
          </div>
        </Link>

        <div className="flex items-center gap-1">
          {user && (
            <Link href="/notifications">
              <button className="relative w-9 h-9 flex items-center justify-center rounded-md hover:bg-secondary transition-colors">
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 min-w-[14px] h-[14px] rounded-full bg-primary text-primary-foreground text-[9px] font-bold flex items-center justify-center px-0.5 leading-none">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </button>
            </Link>
          )}
          {user ? (
            <Link href="/profile">
              <button className="w-9 h-9 flex items-center justify-center rounded-full overflow-hidden bg-primary/20 hover:ring-2 hover:ring-primary/50 transition-all">
                {user.avatarUrl
                  ? <img src={user.avatarUrl} alt={user.username} className="w-full h-full object-cover" />
                  : <span className="text-xs font-bold text-primary">{user.username[0].toUpperCase()}</span>
                }
              </button>
            </Link>
          ) : (
            <Link href="/login">
              <button className="text-xs font-semibold bg-primary text-primary-foreground px-3 py-1.5 rounded-full">
                Sign In
              </button>
            </Link>
          )}
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* ── Desktop sidebar ────────────────────────────────────────────────── */}
        <div
          className="hidden md:block flex-shrink-0 overflow-hidden transition-[width] duration-300 ease-in-out"
          style={{ width: sidebarOpen ? 256 : 0 }}
        >
          <Sidebar />
        </div>

        {/* Desktop sidebar toggle */}
        <button
          onClick={toggleSidebar}
          style={{ left: sidebarOpen ? 244 : 4 }}
          className="hidden md:flex fixed top-1/2 -translate-y-1/2 z-40 w-5 h-10 bg-card border border-border rounded-r-md items-center justify-center hover:bg-secondary transition-all duration-300 shadow-sm"
          title={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
        >
          {sidebarOpen
            ? <ChevronLeft className="w-3 h-3" />
            : <ChevronRight className="w-3 h-3" />}
        </button>

        {/* ── Mobile sidebar drawer ──────────────────────────────────────────── */}
        {mobileMenuOpen && (
          <div className="md:hidden fixed inset-0 z-50 flex">
            {/* Backdrop */}
            <div
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setMobileMenuOpen(false)}
            />
            {/* Drawer */}
            <div className="relative z-10 w-72 max-w-[85vw] h-full overflow-hidden animate-in slide-in-from-left duration-200">
              <Sidebar onMobileClose={() => setMobileMenuOpen(false)} />
            </div>
          </div>
        )}

        <main ref={mainRef} onScroll={handleScroll} className="flex-1 overflow-y-auto relative min-w-0">

          <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-background to-background pointer-events-none -z-10" />
          <div className="p-4 md:pl-8 md:p-6 md:pl-9 lg:p-8 lg:pl-10">

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
              className="fixed bottom-24 right-4 md:right-6 z-50 w-10 h-10 rounded-full bg-primary text-primary-foreground shadow-xl flex items-center justify-center hover:bg-primary/90 hover:scale-105 active:scale-95 transition-all"
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

import { Link, useLocation } from "wouter";
import { useState, useEffect, useRef } from "react";
import {
  Home, Compass, Music, Video, Users, Mic2, Library, Building2,
  LayoutDashboard, LogIn, LogOut, Settings, Send, Radio, Bell,
  BarChart3, Upload, ListMusic, Shield,
  MessageSquare, FileText, Eye, BookOpen, MessageCircle,
  AlertOctagon, ScrollText, Scale, ShieldOff, Search, X,
} from "lucide-react";
import { RoleBadges } from "@/components/role-badges";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useGetUnreadNotificationCount, getGetUnreadNotificationCountQueryKey, useGetUnreadMessageCount, getGetUnreadMessageCountQueryKey } from "@workspace/api-client-react";

interface SearchUser {
  id: number;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  role: string;
  isVerified: boolean | null;
}

function UserSearch() {
  const [, navigate] = useLocation();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchUser[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (query.trim().length < 2) { setResults([]); setOpen(false); return; }
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/users/search?q=${encodeURIComponent(query.trim())}`);
        const data: SearchUser[] = await res.json();
        setResults(data);
        setOpen(true);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") { setOpen(false); inputRef.current?.blur(); }
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, []);

  function go(user: SearchUser) {
    setQuery("");
    setOpen(false);
    navigate(`/users/${user.id}`);
  }

  function clear() { setQuery(""); setResults([]); setOpen(false); inputRef.current?.focus(); }

  return (
    <div ref={containerRef} className="relative px-3 py-2">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
        <Input
          ref={inputRef}
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => { if (results.length > 0) setOpen(true); }}
          placeholder="Search people…"
          className="pl-8 pr-7 h-8 text-xs bg-secondary/50 border-secondary"
        />
        {query && (
          <button onClick={clear} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
            <X className="w-3 h-3" />
          </button>
        )}
      </div>

      {open && (
        <div className="absolute left-3 right-3 top-full mt-1 z-50 bg-popover border border-border rounded-lg shadow-xl overflow-hidden">
          {loading && (
            <div className="px-3 py-2 text-xs text-muted-foreground">Searching…</div>
          )}
          {!loading && results.length === 0 && (
            <div className="px-3 py-2 text-xs text-muted-foreground">No results for "{query}"</div>
          )}
          {!loading && results.map(u => (
            <button
              key={u.id}
              onClick={() => go(u)}
              className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-secondary/60 transition-colors text-left"
            >
              <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xs font-bold flex-shrink-0 overflow-hidden">
                {u.avatarUrl
                  ? <img src={u.avatarUrl} alt={u.username} className="w-full h-full object-cover" />
                  : (u.displayName ?? u.username)[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold truncate flex items-center gap-0.5 flex-wrap">
                  {u.displayName ?? u.username}
                  <RoleBadges role={u.role} size="sm" isVerified={u.isVerified ?? false} />
                </p>
                <p className="text-[10px] text-muted-foreground truncate">@{u.username}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const ADMIN_ROLES = ["admin", "master_admin"];
const STAFF_ROLES = ["admin", "master_admin", "moderator", "editor"];

export function Sidebar() {
  const [location, navigate] = useLocation();
  const { user, logout } = useAuth();

  const { data: unreadData } = useGetUnreadNotificationCount({
    query: {
      enabled: !!user,
      queryKey: getGetUnreadNotificationCountQueryKey(),
      refetchInterval: 30_000,
    }
  });
  const unreadCount = unreadData?.count ?? 0;

  const { data: unreadMsgData } = useGetUnreadMessageCount({
    query: {
      enabled: !!user,
      queryKey: getGetUnreadMessageCountQueryKey(),
      refetchInterval: 30_000,
    }
  });
  const unreadMsgCount = unreadMsgData?.count ?? 0;

  const mainLinks = [
    { href: "/", label: "Home", icon: Home },
    { href: "/discover", label: "Discover", icon: Compass },
    { href: "/songs", label: "Songs", icon: Music },
    { href: "/videos", label: "Videos", icon: Video },
    { href: "/artists", label: "Artists", icon: Mic2 },
    { href: "/labels", label: "Labels", icon: Users },
    { href: "/company", label: "Company Hub", icon: Building2 },
  ];

  const userLinks = [
    { href: "/library", label: "My Library", icon: Library },
    { href: "/submit", label: "Submit Music", icon: Send },
    { href: "/submissions", label: "My Submissions", icon: Radio },
    { href: "/profile", label: "Profile", icon: Settings },
  ];

  const adminLinks = [
    { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
    { href: "/admin/analytics", label: "Analytics", icon: BarChart3 },
    { href: "/admin/users", label: "Users", icon: Users },
    { href: "/admin/listeners", label: "Listeners", icon: Eye },
    { href: "/admin/upload-song", label: "Upload Song", icon: Upload },
    { href: "/admin/upload-video", label: "Upload Video", icon: Upload },
    { href: "/admin/submissions", label: "Submissions", icon: FileText },
    { href: "/admin/songs", label: "Songs", icon: Music },
    { href: "/admin/videos", label: "Videos", icon: Video },
    { href: "/admin/comments", label: "Comments", icon: MessageSquare },
    { href: "/admin/messages", label: "DM Feed", icon: MessageCircle },
    { href: "/admin/dmca", label: "DMCA Claims", icon: AlertOctagon },
    { href: "/admin/strikes", label: "Copyright Strikes", icon: ShieldOff },
    { href: "/admin/settings", label: "Settings", icon: Settings },
  ];

  const editorLinks = [
    { href: "/editor", label: "Editor Dashboard", icon: BookOpen },
    { href: "/editor/playlists", label: "Editorial Playlists", icon: ListMusic },
  ];

  const isActive = (href: string) =>
    href === "/" ? location === "/" : location === href || (href !== "/" && location.startsWith(href + "/")) || location === href;

  const isAdminActive = (href: string) => {
    if (href === "/admin") return location === "/admin";
    return location.startsWith(href);
  };

  const role = user?.role ?? "";
  const isAdmin = ADMIN_ROLES.includes(role);
  const isMasterAdmin = role === "master_admin";
  const isEditor = role === "editor";
  const isStaff = STAFF_ROLES.includes(role);
  const isModerator = role === "moderator";

  return (
    <div className="w-64 h-full bg-card border-r border-border flex flex-col flex-shrink-0">
      {/* Logo */}
      <div className="px-6 pt-6 pb-4 border-b border-border/50">
        <Link href="/">
          <div className="cursor-pointer space-y-0.5">
            <div className="flex items-center gap-2">
              <Radio className="w-5 h-5 text-primary" />
              <h1 className="text-xl font-extrabold tracking-tighter text-foreground">Everyday Radio</h1>
            </div>
            <p className="text-[10px] text-muted-foreground tracking-widest uppercase pl-7">Powered by Cotopia</p>
          </div>
        </Link>
      </div>

      {/* Search */}
      <div className="border-b border-border/50">
        <UserSearch />
      </div>

      {/* Main Nav */}
      <div className="flex-1 overflow-y-auto py-4 space-y-1 px-3">
        {mainLinks.map((link) => {
          const Icon = link.icon;
          const active = isActive(link.href);
          return (
            <Link key={link.href} href={link.href}>
              <Button
                variant={active ? "secondary" : "ghost"}
                className={cn(
                  "w-full justify-start gap-3 text-sm h-9",
                  active ? "font-semibold text-primary bg-primary/10 hover:bg-primary/15" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                {link.label}
              </Button>
            </Link>
          );
        })}

        {user && (
          <>
            {/* Your Space */}
            <div className="pt-4 pb-1">
              <p className="px-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Your Space</p>
            </div>
            {userLinks.map((link) => {
              const Icon = link.icon;
              const active = isActive(link.href);
              return (
                <Link key={link.href} href={link.href}>
                  <Button
                    variant={active ? "secondary" : "ghost"}
                    className={cn(
                      "w-full justify-start gap-3 text-sm h-9",
                      active ? "font-semibold text-primary bg-primary/10 hover:bg-primary/15" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <Icon className="w-4 h-4 flex-shrink-0" />
                    {link.label}
                  </Button>
                </Link>
              );
            })}

            {/* Messages */}
            <Link href="/messages">
              <Button
                variant={isActive("/messages") ? "secondary" : "ghost"}
                className={cn(
                  "w-full justify-start gap-3 text-sm h-9",
                  isActive("/messages") ? "font-semibold text-primary bg-primary/10 hover:bg-primary/15" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <div className="relative flex-shrink-0">
                  <MessageCircle className="w-4 h-4" />
                  {unreadMsgCount > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 min-w-[14px] h-[14px] rounded-full bg-blue-500 text-white text-[9px] font-bold flex items-center justify-center px-0.5 leading-none">
                      {unreadMsgCount > 9 ? "9+" : unreadMsgCount}
                    </span>
                  )}
                </div>
                Messages
                {unreadMsgCount > 0 && (
                  <span className="ml-auto text-[10px] font-bold text-blue-400 bg-blue-500/15 rounded-full px-1.5 py-0.5 leading-none">
                    {unreadMsgCount}
                  </span>
                )}
              </Button>
            </Link>

            {/* Notifications */}
            <Link href="/notifications">
              <Button
                variant={isActive("/notifications") ? "secondary" : "ghost"}
                className={cn(
                  "w-full justify-start gap-3 text-sm h-9 relative",
                  isActive("/notifications") ? "font-semibold text-primary bg-primary/10 hover:bg-primary/15" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <div className="relative flex-shrink-0">
                  <Bell className="w-4 h-4" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 min-w-[14px] h-[14px] rounded-full bg-primary text-primary-foreground text-[9px] font-bold flex items-center justify-center px-0.5 leading-none">
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                  )}
                </div>
                Notifications
                {unreadCount > 0 && (
                  <span className="ml-auto text-[10px] font-bold text-primary bg-primary/15 rounded-full px-1.5 py-0.5 leading-none">
                    {unreadCount}
                  </span>
                )}
              </Button>
            </Link>

            {/* Artist Analytics */}
            {role === "artist" && (
              <>
                <div className="pt-4 pb-1">
                  <p className="px-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Artist Tools</p>
                </div>
                <Link href="/artist/analytics">
                  <Button
                    variant={isActive("/artist/analytics") ? "secondary" : "ghost"}
                    className={cn(
                      "w-full justify-start gap-3 text-sm h-9",
                      isActive("/artist/analytics") ? "font-semibold text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <BarChart3 className="w-4 h-4 flex-shrink-0" />
                    My Analytics
                  </Button>
                </Link>
              </>
            )}

            {/* Label Analytics */}
            {role === "label" && (
              <>
                <div className="pt-4 pb-1">
                  <p className="px-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Label Tools</p>
                </div>
                <Link href="/label/analytics">
                  <Button
                    variant={isActive("/label/analytics") ? "secondary" : "ghost"}
                    className={cn(
                      "w-full justify-start gap-3 text-sm h-9",
                      isActive("/label/analytics") ? "font-semibold text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <BarChart3 className="w-4 h-4 flex-shrink-0" />
                    My Analytics
                  </Button>
                </Link>
              </>
            )}

            {/* Editor section */}
            {(isEditor || isAdmin || isMasterAdmin) && (
              <>
                <div className="pt-4 pb-1">
                  <p className="px-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Editorial</p>
                </div>
                {editorLinks.map((link) => {
                  const Icon = link.icon;
                  const active = isAdminActive(link.href);
                  return (
                    <Link key={link.href} href={link.href}>
                      <Button
                        variant={active ? "secondary" : "ghost"}
                        className={cn(
                          "w-full justify-start gap-3 text-sm h-9",
                          active ? "font-semibold text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        <Icon className="w-4 h-4 flex-shrink-0" />
                        {link.label}
                      </Button>
                    </Link>
                  );
                })}
              </>
            )}

            {/* Admin section */}
            {(isAdmin || isMasterAdmin || isModerator) && (
              <>
                <div className="pt-4 pb-1">
                  <div className="flex items-center gap-2 px-3">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Admin</p>
                    {isMasterAdmin && (
                      <span className="text-[9px] font-bold bg-amber-500/20 text-amber-400 rounded px-1 py-0.5 leading-none uppercase tracking-wider">Master</span>
                    )}
                  </div>
                </div>
                {adminLinks.map((link) => {
                  const active = isAdminActive(link.href);
                  const Icon = link.icon;
                  return (
                    <Link key={link.href} href={link.href}>
                      <Button
                        variant={active ? "secondary" : "ghost"}
                        className={cn(
                          "w-full justify-start gap-3 text-sm h-9",
                          active ? "font-semibold text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        <Icon className="w-4 h-4 flex-shrink-0" />
                        {link.label}
                      </Button>
                    </Link>
                  );
                })}
                {/* Role Management — master_admin only */}
                {isMasterAdmin && (
                  <Link href="/admin/roles">
                    <Button
                      variant={isAdminActive("/admin/roles") ? "secondary" : "ghost"}
                      className={cn(
                        "w-full justify-start gap-3 text-sm h-9",
                        isAdminActive("/admin/roles") ? "font-semibold text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <Shield className="w-4 h-4 flex-shrink-0" />
                      Role Management
                    </Button>
                  </Link>
                )}
                {/* Audit Logs — master_admin only */}
                {isMasterAdmin && (
                  <Link href="/admin/audit-logs">
                    <Button
                      variant={isAdminActive("/admin/audit-logs") ? "secondary" : "ghost"}
                      className={cn(
                        "w-full justify-start gap-3 text-sm h-9",
                        isAdminActive("/admin/audit-logs") ? "font-semibold text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <ScrollText className="w-4 h-4 flex-shrink-0" />
                      Audit Logs
                    </Button>
                  </Link>
                )}
                {/* Legal Settings — master_admin only */}
                {isMasterAdmin && (
                  <Link href="/admin/legal">
                    <Button
                      variant={isAdminActive("/admin/legal") ? "secondary" : "ghost"}
                      className={cn(
                        "w-full justify-start gap-3 text-sm h-9",
                        isAdminActive("/admin/legal") ? "font-semibold text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <Scale className="w-4 h-4 flex-shrink-0" />
                      Legal Settings
                    </Button>
                  </Link>
                )}
              </>
            )}
          </>
        )}
      </div>

      {/* Bottom auth area */}
      <div className="border-t border-border/50 p-4 space-y-2">
        {user ? (
          <>
            <Link href="/profile">
              <div className="flex items-center gap-3 px-2 py-1 rounded-md hover:bg-secondary/60 transition-colors cursor-pointer">
                <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xs font-bold flex-shrink-0 overflow-hidden">
                  {user.avatarUrl
                    ? <img src={user.avatarUrl} alt={user.username} className="w-full h-full object-cover" />
                    : user.username[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold truncate flex items-center gap-0.5 flex-wrap">
                    {user.username}
                    <RoleBadges role={user.role} size="sm" isVerified={user.isVerified ?? false} />
                  </p>
                  <p className="text-[10px] text-muted-foreground capitalize">{user.role.replace("_", " ")}</p>
                </div>
              </div>
            </Link>
            <Button variant="outline" size="sm" className="w-full justify-start gap-2 text-xs" onClick={() => { logout(); navigate("/login"); }}>
              <LogOut className="w-3.5 h-3.5" />
              Sign out
            </Button>
          </>
        ) : (
          <>
            <Link href="/login">
              <Button variant="outline" size="sm" className="w-full justify-start gap-2 text-xs">
                <LogIn className="w-3.5 h-3.5" />
                Sign In
              </Button>
            </Link>
            <Link href="/register">
              <Button size="sm" className="w-full justify-start gap-2 text-xs bg-primary">
                Create Account
              </Button>
            </Link>
          </>
        )}
      </div>
    </div>
  );
}

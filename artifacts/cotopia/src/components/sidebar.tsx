import { Link, useLocation } from "wouter";
import { Home, Compass, Music, Video, Users, Mic2, Library, Building2, LayoutDashboard, LogIn, LogOut, Settings, Send, Radio, Bell } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useGetUnreadNotificationCount, getGetUnreadNotificationCountQueryKey } from "@workspace/api-client-react";

export function Sidebar() {
  const [location] = useLocation();
  const { user, logout } = useAuth();

  const { data: unreadData } = useGetUnreadNotificationCount({
    query: {
      enabled: !!user,
      queryKey: getGetUnreadNotificationCountQueryKey(),
      refetchInterval: 30_000,
    }
  });
  const unreadCount = unreadData?.count ?? 0;

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

  const isActive = (href: string) =>
    href === "/" ? location === "/" : location.startsWith(href);

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

            {/* Notifications link */}
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

            {user.role === "admin" && (
              <>
                <div className="pt-4 pb-1">
                  <p className="px-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Admin</p>
                </div>
                <Link href="/admin">
                  <Button
                    variant={isActive("/admin") ? "secondary" : "ghost"}
                    className={cn(
                      "w-full justify-start gap-3 text-sm h-9",
                      isActive("/admin") ? "font-semibold text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <LayoutDashboard className="w-4 h-4 flex-shrink-0" />
                    Dashboard
                  </Button>
                </Link>
              </>
            )}
          </>
        )}
      </div>

      {/* Bottom auth area */}
      <div className="border-t border-border/50 p-4 space-y-2">
        {user ? (
          <>
            <div className="flex items-center gap-3 px-2 py-1">
              <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xs font-bold flex-shrink-0">
                {user.avatarUrl
                  ? <img src={user.avatarUrl} alt={user.username} className="w-full h-full object-cover rounded-full" />
                  : user.username[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold truncate">{user.username}</p>
                <p className="text-[10px] text-muted-foreground capitalize">{user.role}</p>
              </div>
            </div>
            <Button variant="outline" size="sm" className="w-full justify-start gap-2 text-xs" onClick={() => logout()}>
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

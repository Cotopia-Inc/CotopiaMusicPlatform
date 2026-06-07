import { Link, useLocation } from "wouter";
import { Home, Compass, Music, Video, Users, Mic2, Library, Building2, LayoutDashboard, LogIn, LogOut, Settings } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export function Sidebar() {
  const [location] = useLocation();
  const { user, logout } = useAuth();

  const links = [
    { href: "/", label: "Home", icon: Home },
    { href: "/discover", label: "Discover", icon: Compass },
    { href: "/songs", label: "Songs", icon: Music },
    { href: "/videos", label: "Videos", icon: Video },
    { href: "/artists", label: "Artists", icon: Mic2 },
    { href: "/labels", label: "Labels", icon: Users },
  ];

  const authLinks = [
    { href: "/library", label: "My Library", icon: Library },
    { href: "/profile", label: "Profile", icon: Settings },
  ];

  return (
    <div className="w-64 h-full bg-card border-r border-border flex flex-col justify-between p-4 flex-shrink-0">
      <div>
        <div className="mb-8 px-4">
          <h1 className="text-2xl font-bold text-primary tracking-tighter">Cotopia</h1>
        </div>

        <nav className="space-y-1">
          {links.map((link) => {
            const Icon = link.icon;
            const isActive = location === link.href;
            return (
              <Link key={link.href} href={link.href}>
                <Button
                  variant={isActive ? "secondary" : "ghost"}
                  className={cn("w-full justify-start gap-3 text-base", isActive ? "font-semibold text-primary" : "text-muted-foreground")}
                >
                  <Icon className="w-5 h-5" />
                  {link.label}
                </Button>
              </Link>
            );
          })}
        </nav>

        {user && (
          <div className="mt-8">
            <h3 className="px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Your Space</h3>
            <nav className="space-y-1">
              {authLinks.map((link) => {
                const Icon = link.icon;
                const isActive = location === link.href;
                return (
                  <Link key={link.href} href={link.href}>
                    <Button
                      variant={isActive ? "secondary" : "ghost"}
                      className={cn("w-full justify-start gap-3", isActive ? "font-semibold text-primary" : "text-muted-foreground")}
                    >
                      <Icon className="w-4 h-4" />
                      {link.label}
                    </Button>
                  </Link>
                );
              })}
              {(user.role === 'admin') && (
                <Link href="/admin">
                  <Button variant="ghost" className="w-full justify-start gap-3 text-muted-foreground">
                    <LayoutDashboard className="w-4 h-4" />
                    Admin
                  </Button>
                </Link>
              )}
            </nav>
          </div>
        )}
      </div>

      <div>
        {user ? (
          <div className="flex flex-col gap-2">
            <div className="px-4 py-2 text-sm text-muted-foreground truncate">
              Signed in as <span className="text-foreground">{user.username}</span>
            </div>
            <Button variant="outline" className="w-full justify-start gap-2" onClick={() => logout()}>
              <LogOut className="w-4 h-4" />
              Sign out
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <Link href="/login">
              <Button variant="outline" className="w-full justify-start gap-2">
                <LogIn className="w-4 h-4" />
                Sign in
              </Button>
            </Link>
            <Link href="/register">
              <Button className="w-full justify-start gap-2">
                Create Account
              </Button>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

import { Sidebar } from "./sidebar";
import { Player } from "./player";

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background text-foreground">
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto relative">
          <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-background to-background pointer-events-none -z-10" />
          <div className="p-8">
            {children}
          </div>
        </main>
      </div>
      <Player />
    </div>
  );
}

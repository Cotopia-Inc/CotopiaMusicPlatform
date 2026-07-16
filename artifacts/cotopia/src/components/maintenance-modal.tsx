import { Settings } from "lucide-react";

export function MaintenanceModal() {
  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center overflow-hidden">
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at 50% 30%, #1e0a3c 0%, #0d0d14 50%, #000 100%)",
        }}
      />

      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div
          className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-primary/8 blur-3xl animate-pulse"
          style={{ animationDuration: "4s" }}
        />
        <div
          className="absolute -bottom-32 -right-32 w-[32rem] h-[32rem] rounded-full bg-primary/5 blur-3xl animate-pulse"
          style={{ animationDuration: "6s", animationDelay: "1.5s" }}
        />
      </div>

      <div className="relative z-10 max-w-md w-full mx-auto px-8 text-center">
        <div className="mx-auto mb-8 relative w-24 h-24 flex items-center justify-center">
          <div
            className="absolute inset-0 rounded-full bg-primary/15 animate-ping opacity-60"
            style={{ animationDuration: "2.5s" }}
          />
          <div className="absolute inset-0 rounded-full bg-primary/10 border border-primary/25" />
          <Settings
            className="relative w-11 h-11 text-primary"
            style={{ animation: "spin 7s linear infinite" }}
          />
        </div>

        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary mb-4">
          Cotopia
        </p>

        <h1 className="text-4xl font-bold text-white mb-4 tracking-tight">
          Under Maintenance
        </h1>

        <p className="text-muted-foreground text-base leading-relaxed mb-8 max-w-sm mx-auto">
          We're currently performing scheduled maintenance to improve your
          experience. We'll be back up and running very soon.
        </p>

        <div className="relative h-1 w-40 mx-auto rounded-full bg-white/5 overflow-hidden mb-8">
          <div
            className="absolute inset-y-0 rounded-full bg-primary/60"
            style={{
              width: "45%",
              animation: "maintenance-bar 2.4s ease-in-out infinite",
            }}
          />
        </div>

        <div className="flex items-center gap-3 mb-6">
          <div className="flex-1 h-px bg-white/5" />
          <div
            className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-pulse"
            style={{ animationDuration: "1.5s" }}
          />
          <div className="flex-1 h-px bg-white/5" />
        </div>

        <p className="text-sm text-muted-foreground/50">
          Thank you for your patience.
        </p>
      </div>

      <style>{`
        @keyframes maintenance-bar {
          0%   { left: -45%; }
          100% { left: 100%; }
        }
      `}</style>
    </div>
  );
}

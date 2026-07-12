import { Link } from "wouter";
import { Eye, ChevronLeft } from "lucide-react";

const Badge = ({ label, variant }: { label: string; variant: "live" | "beta" | "demo" | "planned" | "known" | "resolved" }) => {
  const map = {
    live:     "bg-green-500/15 text-green-400 border-green-500/30",
    beta:     "bg-amber-500/15 text-amber-400 border-amber-500/30",
    demo:     "bg-violet-500/15 text-violet-400 border-violet-500/30",
    planned:  "bg-blue-500/15 text-blue-400 border-blue-500/30",
    known:    "bg-red-500/15 text-red-400 border-red-500/30",
    resolved: "bg-slate-500/15 text-slate-400 border-slate-500/30",
  };
  return (
    <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded border ${map[variant]}`}>
      {label}
    </span>
  );
};

const features = [
  { name: "Music streaming (song playback)", status: "live" as const },
  { name: "Video streaming", status: "live" as const },
  { name: "Artist & label profiles", status: "live" as const },
  { name: "Playlists", status: "live" as const },
  { name: "Favorites & library", status: "live" as const },
  { name: "Following artists & labels", status: "live" as const },
  { name: "Content submission & review", status: "live" as const },
  { name: "Company Hub posts", status: "live" as const },
  { name: "Badge system", status: "live" as const },
  { name: "Creator Support (tipping)", status: "demo" as const, note: "Demo Mode — no real payments" },
  { name: "Support Wall", status: "demo" as const, note: "Demo Mode — no real payments" },
  { name: "Live PayPal payments", status: "planned" as const },
  { name: "Podcast support", status: "planned" as const },
  { name: "Trust Center", status: "beta" as const },
  { name: "Responsible Disclosure Program", status: "planned" as const },
  { name: "AI Change Log", status: "planned" as const },
];

export default function TrustTransparency() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/50 bg-card/80 backdrop-blur sticky top-0 z-30">
        <div className="max-w-3xl mx-auto px-6 h-14 flex items-center">
          <Link href="/trust">
            <button className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
              <ChevronLeft className="w-4 h-4" />Trust Center
            </button>
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12 pb-20 space-y-10">
        <div>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-lg bg-cyan-400/10 flex items-center justify-center">
              <Eye className="w-4.5 h-4.5 text-cyan-400" />
            </div>
            <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Platform Transparency</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight mb-3">Platform Transparency</h1>
          <p className="text-muted-foreground leading-relaxed">
            Current platform status, what's live, what's in demo mode, and what's planned.
          </p>
        </div>

        <div className="p-6 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-2">
          <p className="text-sm font-semibold text-amber-400 flex items-center gap-2">
            <Badge label="Beta" variant="beta" />
            Everyday Radio is live in Beta
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            The platform launched in Beta. Features are actively being developed. Some functionality
            is in Demo Mode or Planned for future releases. No confidential roadmap details are shared here.
          </p>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
          {(["live", "beta", "demo", "planned", "known", "resolved"] as const).map(v => (
            <Badge key={v} label={v === "demo" ? "Demo Mode" : v === "known" ? "Known Issue" : v.charAt(0).toUpperCase() + v.slice(1)} variant={v} />
          ))}
        </div>

        {/* Feature status list */}
        <div className="space-y-3">
          <h2 className="font-semibold">Feature Status</h2>
          <div className="divide-y divide-border rounded-xl border border-border overflow-hidden">
            {features.map(({ name, status, note }) => (
              <div key={name} className="flex items-center justify-between gap-3 px-5 py-3 bg-card">
                <div>
                  <p className="text-sm">{name}</p>
                  {note && <p className="text-xs text-muted-foreground mt-0.5">{note}</p>}
                </div>
                <Badge
                  label={status === "demo" ? "Demo Mode" : status.charAt(0).toUpperCase() + status.slice(1)}
                  variant={status}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="p-6 rounded-xl bg-card border border-border space-y-3">
          <h2 className="font-semibold">Known Issues & Release Notes</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            For a detailed view of reported problems and what we've shipped, see:
          </p>
          <div className="flex gap-4">
            <Link href="/trust/known-issues"><button className="text-sm text-primary font-semibold hover:underline">Known Issues →</button></Link>
            <Link href="/trust/release-notes"><button className="text-sm text-primary font-semibold hover:underline">Release Notes →</button></Link>
          </div>
        </div>
      </main>
    </div>
  );
}

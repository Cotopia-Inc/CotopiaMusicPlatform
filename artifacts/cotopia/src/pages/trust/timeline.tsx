import { Link } from "wouter";
import { Clock, ChevronLeft } from "lucide-react";
import { useListTrustTimeline } from "@workspace/api-client-react";
import { format } from "date-fns";

const CATEGORY_COLOR: Record<string, string> = {
  Promise:         "bg-amber-500/15 text-amber-400 border-amber-500/30",
  AI:              "bg-violet-500/15 text-violet-400 border-violet-500/30",
  Beta:            "bg-blue-500/15 text-blue-400 border-blue-500/30",
  "Creator Support": "bg-pink-500/15 text-pink-400 border-pink-500/30",
  Legal:           "bg-slate-500/15 text-slate-400 border-slate-500/30",
  Safety:          "bg-red-500/15 text-red-400 border-red-500/30",
  Community:       "bg-green-500/15 text-green-400 border-green-500/30",
  Product:         "bg-cyan-500/15 text-cyan-400 border-cyan-500/30",
};

export default function TrustTimeline() {
  const { data: items, isLoading } = useListTrustTimeline({
    query: { queryKey: ["trustTimeline"] },
  });

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
            <div className="w-9 h-9 rounded-lg bg-indigo-400/10 flex items-center justify-center">
              <Clock className="w-4.5 h-4.5 text-indigo-400" />
            </div>
            <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Trust Timeline</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight mb-3">Trust Timeline</h1>
          <p className="text-muted-foreground leading-relaxed">
            Key milestones in platform safety, policy, creator support, and community — in chronological order.
          </p>
        </div>

        {isLoading && (
          <div className="space-y-4">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-24 rounded-xl bg-card border border-border animate-pulse" />)}
          </div>
        )}

        {!isLoading && (!items || items.length === 0) && (
          <div className="py-16 text-center">
            <Clock className="w-8 h-8 text-muted-foreground/30 mx-auto mb-3" />
            <p className="font-semibold mb-1">Timeline coming soon</p>
            <p className="text-sm text-muted-foreground">
              We'll document key trust and safety milestones here as the platform grows.
            </p>
          </div>
        )}

        {items && items.length > 0 && (
          <div className="relative">
            <div className="absolute left-5 top-0 bottom-0 w-px bg-border" aria-hidden="true" />
            <div className="space-y-6">
              {items.map((item) => {
                const catClass = CATEGORY_COLOR[item.category] ?? "bg-secondary text-muted-foreground border-border";
                return (
                  <div key={item.id} className="flex gap-5">
                    <div className="w-10 h-10 rounded-full bg-card border-2 border-primary/30 flex items-center justify-center flex-shrink-0 z-10">
                      <span className="w-2.5 h-2.5 rounded-full bg-primary" />
                    </div>
                    <div className="flex-1 pb-2">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <p className="text-xs text-muted-foreground">{format(new Date(item.eventDate), "MMMM d, yyyy")}</p>
                        <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded border ${catClass}`}>
                          {item.category}
                        </span>
                      </div>
                      <h2 className="font-semibold mb-1">{item.title}</h2>
                      <p className="text-sm text-muted-foreground leading-relaxed">{item.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

import { Link } from "wouter";
import { MessageCircleHeart, ChevronLeft, CheckCircle } from "lucide-react";
import { useListTrustWeHeardYou } from "@workspace/api-client-react";
import { format } from "date-fns";

const STATUS_META: Record<string, { label: string; className: string }> = {
  requested:   { label: "Requested",   className: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
  planned:     { label: "Planned",     className: "bg-violet-500/15 text-violet-400 border-violet-500/30" },
  in_progress: { label: "In Progress", className: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
  released:    { label: "Released",    className: "bg-green-500/15 text-green-400 border-green-500/30" },
  not_planned: { label: "Not Planned", className: "bg-slate-500/15 text-slate-400 border-slate-500/30" },
};

export default function TrustWeHeardYou() {
  const { data: items, isLoading } = useListTrustWeHeardYou({
    query: { queryKey: ["trustWeHeardYou"] },
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
            <div className="w-9 h-9 rounded-lg bg-pink-400/10 flex items-center justify-center">
              <MessageCircleHeart className="w-4.5 h-4.5 text-pink-400" />
            </div>
            <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">We Heard You</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight mb-3">We Heard You</h1>
          <p className="text-muted-foreground leading-relaxed">
            This is how your feedback shapes Everyday Radio. Here we show you what the community asked for
            and what we did about it.
          </p>
        </div>

        {isLoading && (
          <div className="space-y-4">
            {[1, 2, 3].map(i => <div key={i} className="h-36 rounded-xl bg-card border border-border animate-pulse" />)}
          </div>
        )}

        {!isLoading && (!items || items.length === 0) && (
          <div className="py-16 text-center">
            <MessageCircleHeart className="w-8 h-8 text-muted-foreground/30 mx-auto mb-3" />
            <p className="font-semibold mb-1">Coming soon</p>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              We'll publish verified examples of how community feedback shaped the platform here.
            </p>
            <div className="flex justify-center gap-4 mt-4">
              <Link href="/suggest-feature"><button className="text-sm text-primary font-semibold hover:underline">Suggest a Feature →</button></Link>
              <Link href="/report-bug"><button className="text-sm text-primary font-semibold hover:underline">Report a Bug →</button></Link>
            </div>
          </div>
        )}

        {items && items.length > 0 && (
          <div className="space-y-5">
            {items.map(item => {
              const meta = STATUS_META[item.status] ?? { label: item.status, className: "bg-secondary text-muted-foreground border-border" };
              return (
                <div key={item.id} className="rounded-xl bg-card border border-border overflow-hidden">
                  <div className="p-6 space-y-4">
                    <div>
                      <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold mb-1.5">You Asked</p>
                      <p className="text-sm leading-relaxed">{item.youAsked}</p>
                    </div>
                    <div className="flex items-start gap-3 p-4 rounded-lg bg-primary/5 border border-primary/20">
                      <CheckCircle className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-[11px] text-primary uppercase tracking-wider font-semibold mb-1.5">We Did</p>
                        <p className="text-sm leading-relaxed">{item.weDid}</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded border ${meta.className}`}>
                          {meta.label}
                        </span>
                        {item.relatedFeature && (
                          <span className="text-xs text-muted-foreground">Related: {item.relatedFeature}</span>
                        )}
                      </div>
                      {item.dateReleased && (
                        <span className="text-xs text-muted-foreground">Released {format(new Date(item.dateReleased), "MMM d, yyyy")}</span>
                      )}
                    </div>
                    {item.link && (
                      <a href={item.link} target="_blank" rel="noopener noreferrer" className="text-sm text-primary font-semibold hover:underline block">
                        Learn more →
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="p-5 rounded-xl bg-secondary/50 border border-border text-center space-y-3">
          <p className="text-sm font-medium">Have feedback or ideas?</p>
          <div className="flex flex-wrap gap-3 justify-center">
            <Link href="/suggest-feature"><button className="text-sm text-primary font-semibold hover:underline">Suggest a Feature →</button></Link>
            <Link href="/report-bug"><button className="text-sm text-primary font-semibold hover:underline">Report a Bug →</button></Link>
          </div>
        </div>
      </main>
    </div>
  );
}

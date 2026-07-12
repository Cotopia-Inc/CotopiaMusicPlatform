import { Link } from "wouter";
import { AlertCircle, ChevronLeft, Clock } from "lucide-react";
import { useListTrustKnownIssues } from "@workspace/api-client-react";
import { format } from "date-fns";

const STATUS_META: Record<string, { label: string; className: string }> = {
  investigating:   { label: "Investigating",    className: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
  identified:      { label: "Identified",       className: "bg-orange-500/15 text-orange-400 border-orange-500/30" },
  fix_in_progress: { label: "Fix in Progress",  className: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
  monitoring:      { label: "Monitoring",       className: "bg-violet-500/15 text-violet-400 border-violet-500/30" },
  resolved:        { label: "Resolved",         className: "bg-green-500/15 text-green-400 border-green-500/30" },
};

export default function TrustKnownIssues() {
  const { data: issues, isLoading } = useListTrustKnownIssues({
    query: { queryKey: ["trustKnownIssues"] },
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
            <div className="w-9 h-9 rounded-lg bg-yellow-400/10 flex items-center justify-center">
              <AlertCircle className="w-4.5 h-4.5 text-yellow-400" />
            </div>
            <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Known Issues</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight mb-3">Known Issues</h1>
          <p className="text-muted-foreground leading-relaxed">
            Reported problems, current status, and workarounds. We publish issues here so you know we are aware of them.
          </p>
        </div>

        {isLoading && (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-28 rounded-xl bg-card border border-border animate-pulse" />
            ))}
          </div>
        )}

        {!isLoading && (!issues || issues.length === 0) && (
          <div className="py-16 text-center">
            <AlertCircle className="w-8 h-8 text-muted-foreground/30 mx-auto mb-3" />
            <p className="font-semibold mb-1">No known issues</p>
            <p className="text-sm text-muted-foreground">No public issues are currently reported. If you have found a problem, please report it.</p>
            <Link href="/report-bug">
              <button className="mt-4 text-sm text-primary font-semibold hover:underline">Report a Bug →</button>
            </Link>
          </div>
        )}

        {issues && issues.length > 0 && (
          <div className="space-y-4">
            {issues.map(issue => {
              const meta = STATUS_META[issue.status] ?? { label: issue.status, className: "bg-secondary text-muted-foreground border-border" };
              return (
                <div key={issue.id} className="p-6 rounded-xl bg-card border border-border space-y-3">
                  <div className="flex items-start gap-3 flex-wrap">
                    <h2 className="font-semibold flex-1">{issue.title}</h2>
                    <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded border flex-shrink-0 ${meta.className}`}>
                      {meta.label}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">{issue.description}</p>
                  {issue.affectedArea && (
                    <p className="text-xs text-muted-foreground"><span className="font-medium">Affected area:</span> {issue.affectedArea}</p>
                  )}
                  {issue.workaround && (
                    <div className="p-3 rounded-lg bg-secondary/50 text-sm text-muted-foreground">
                      <span className="font-medium text-foreground">Workaround: </span>{issue.workaround}
                    </div>
                  )}
                  <div className="flex items-center gap-4 text-xs text-muted-foreground pt-1">
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" />Reported {format(new Date(issue.dateReported), "MMM d, yyyy")}</span>
                    {issue.resolutionDate && (
                      <span className="flex items-center gap-1 text-green-400">Resolved {format(new Date(issue.resolutionDate), "MMM d, yyyy")}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="p-5 rounded-xl bg-secondary/50 border border-border text-center">
          <p className="text-sm text-muted-foreground">Found something we haven't listed?</p>
          <Link href="/report-bug">
            <button className="mt-2 text-sm text-primary font-semibold hover:underline">Report a Bug →</button>
          </Link>
        </div>
      </main>
    </div>
  );
}

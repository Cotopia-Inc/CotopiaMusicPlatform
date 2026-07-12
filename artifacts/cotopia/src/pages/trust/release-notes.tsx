import { Link } from "wouter";
import { ListChecks, ChevronLeft, Calendar } from "lucide-react";
import { useListTrustReleaseNotes } from "@workspace/api-client-react";
import { format } from "date-fns";

function Section({ title, content }: { title: string; content: string | null | undefined }) {
  if (!content?.trim()) return null;
  const items = content.split("\n").map(l => l.replace(/^[-•*]\s*/, "").trim()).filter(Boolean);
  return (
    <div>
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{title}</p>
      <ul className="space-y-1.5">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
            <span className="text-primary mt-0.5 flex-shrink-0">·</span>{item}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function TrustReleaseNotes() {
  const { data: notes, isLoading } = useListTrustReleaseNotes({
    query: { queryKey: ["trustReleaseNotes"] },
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
            <div className="w-9 h-9 rounded-lg bg-emerald-400/10 flex items-center justify-center">
              <ListChecks className="w-4.5 h-4.5 text-emerald-400" />
            </div>
            <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Release Notes</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight mb-3">Release Notes</h1>
          <p className="text-muted-foreground leading-relaxed">
            What we've shipped — features, improvements, bug fixes, and policy updates.
            Written in plain language for everyone.
          </p>
        </div>

        {isLoading && (
          <div className="space-y-4">
            {[1, 2].map(i => <div key={i} className="h-48 rounded-xl bg-card border border-border animate-pulse" />)}
          </div>
        )}

        {!isLoading && (!notes || notes.length === 0) && (
          <div className="py-16 text-center">
            <ListChecks className="w-8 h-8 text-muted-foreground/30 mx-auto mb-3" />
            <p className="font-semibold mb-1">No release notes yet</p>
            <p className="text-sm text-muted-foreground">We'll publish release notes here as new versions ship.</p>
          </div>
        )}

        {notes && notes.length > 0 && (
          <div className="space-y-6">
            {notes.map(note => (
              <div key={note.id} className="p-6 rounded-xl bg-card border border-border space-y-5">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <h2 className="text-xl font-bold">Version {note.version}</h2>
                    <p className="flex items-center gap-1.5 text-sm text-muted-foreground mt-1">
                      <Calendar className="w-3.5 h-3.5" />
                      {format(new Date(note.releaseDate), "MMMM d, yyyy")}
                    </p>
                  </div>
                  <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded border bg-emerald-500/15 text-emerald-400 border-emerald-500/30">
                    {note.status}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed border-l-2 border-primary/30 pl-3">{note.summary}</p>
                <div className="space-y-4">
                  <Section title="Added" content={note.newFeatures} />
                  <Section title="Improved" content={note.improvements} />
                  <Section title="Fixed" content={note.bugFixes} />
                  <Section title="Policy Updates" content={note.policyUpdates} />
                  <Section title="Known Limitations" content={note.knownLimitations} />
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

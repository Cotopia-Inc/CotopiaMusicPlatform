import { Link } from "wouter";
import { Shield, ChevronLeft, Flag, Copyright, MessageSquare, RotateCcw } from "lucide-react";

const reviewFlow = [
  { label: "Received", color: "bg-blue-500" },
  { label: "In Review", color: "bg-amber-500" },
  { label: "Additional Information Requested", color: "bg-orange-500" },
  { label: "Approved", color: "bg-green-500" },
  { label: "Scheduled", color: "bg-violet-500" },
  { label: "Published", color: "bg-emerald-500" },
  { label: "Featured", color: "bg-yellow-500" },
  { label: "Declined", color: "bg-red-500" },
];

const appealableActions = [
  "Content rejection",
  "Content removal",
  "Account restriction",
  "Badge removal",
  "Verification denial",
  "Support Wall moderation",
  "Copyright action",
];

export default function TrustModeration() {
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
            <div className="w-9 h-9 rounded-lg bg-red-400/10 flex items-center justify-center">
              <Shield className="w-4.5 h-4.5 text-red-400" />
            </div>
            <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Content & Moderation</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight mb-3">Content & Moderation</h1>
          <p className="text-muted-foreground leading-relaxed">
            How we review content, moderate the community, handle copyright, and support appeals.
          </p>
        </div>

        <div className="space-y-6">
          <div className="p-6 rounded-xl bg-card border border-border space-y-4">
            <div className="flex items-center gap-2"><Shield className="w-4 h-4 text-red-400" /><h2 className="font-semibold">Publishing Guidelines</h2></div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              All content submitted to Everyday Radio must comply with our Community Guidelines and Creator Agreement.
              Content involving hate speech, harassment, illegal activity, explicit material without appropriate disclosure,
              or copyright infringement will not be approved.
            </p>
            <Link href="/legal/community-guidelines"><button className="text-sm text-primary font-semibold hover:underline">Community Guidelines →</button></Link>
          </div>

          <div className="p-6 rounded-xl bg-card border border-border space-y-4">
            <div className="flex items-center gap-2"><RotateCcw className="w-4 h-4 text-blue-400" /><h2 className="font-semibold">Review Workflow</h2></div>
            <p className="text-sm text-muted-foreground text-sm leading-relaxed mb-3">
              Submitted content passes through these stages:
            </p>
            <div className="flex flex-wrap gap-2">
              {reviewFlow.map(({ label, color }) => (
                <span key={label} className="flex items-center gap-1.5 text-xs font-medium bg-secondary px-3 py-1.5 rounded-full">
                  <span className={`w-2 h-2 rounded-full ${color} flex-shrink-0`} />{label}
                </span>
              ))}
            </div>
            <p className="text-xs text-muted-foreground italic mt-2">
              Approval, rejection, moderation, and featured-placement decisions may involve platform guidelines,
              safety, copyright, quality, relevance, or community considerations. We do not promise that all
              decisions can be fully automated or immediately resolved.
            </p>
          </div>

          <div className="p-6 rounded-xl bg-card border border-border space-y-3">
            <div className="flex items-center gap-2"><MessageSquare className="w-4 h-4 text-violet-400" /><h2 className="font-semibold">Support Wall Moderation</h2></div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Messages posted to creator Support Walls must be approved by the creator before they appear publicly.
              Creators can approve or remove messages at any time. Platform moderators can also remove messages
              that violate community guidelines.
            </p>
          </div>

          <div className="p-6 rounded-xl bg-card border border-border space-y-3">
            <div className="flex items-center gap-2"><Copyright className="w-4 h-4 text-orange-400" /><h2 className="font-semibold">Copyright & DMCA</h2></div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              We take copyright seriously. Creators are responsible for ensuring they hold the rights to
              all uploaded content. If you believe your copyright has been infringed, you may file a DMCA
              takedown notice.
            </p>
            <div className="flex flex-wrap gap-3 pt-1">
              <Link href="/legal/dmca"><button className="text-sm text-primary font-semibold hover:underline">DMCA Policy →</button></Link>
              <Link href="/legal/copyright-complaint"><button className="text-sm text-primary font-semibold hover:underline">File a Copyright Complaint →</button></Link>
            </div>
          </div>

          <div className="p-6 rounded-xl bg-primary/5 border border-primary/20 space-y-4">
            <div className="flex items-center gap-2"><Flag className="w-4 h-4 text-primary" /><h2 className="font-semibold">Appeals Process</h2></div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              You can request a review of any of the following actions:
            </p>
            <ul className="space-y-1.5">
              {appealableActions.map(a => (
                <li key={a} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />{a}
                </li>
              ))}
            </ul>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Appeals are reviewed by platform staff. After submission you will receive a confirmation,
              and your appeal will be reviewed under one of these statuses:
            </p>
            <div className="flex flex-wrap gap-2">
              {["Received", "Under Review", "More Information Needed", "Upheld", "Reversed", "Closed"].map(s => (
                <span key={s} className="text-xs bg-secondary px-2.5 py-1 rounded-full font-medium">{s}</span>
              ))}
            </div>
            <Link href="/trust/appeals">
              <button className="mt-2 bg-primary text-primary-foreground px-4 py-2 rounded-full text-sm font-semibold hover:bg-primary/90 transition-colors">
                Submit an Appeal
              </button>
            </Link>
          </div>

          <div className="p-6 rounded-xl bg-card border border-border space-y-3">
            <h2 className="font-semibold">Reporting Tools</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              You can report content or users that violate our guidelines using the in-platform reporting
              tools. Reports are reviewed by our moderation team.
            </p>
            <Link href="/trust/contact"><button className="text-sm text-primary font-semibold hover:underline">Contact & Reporting →</button></Link>
          </div>
        </div>
      </main>
    </div>
  );
}

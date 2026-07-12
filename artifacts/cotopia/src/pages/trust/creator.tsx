import { Link } from "wouter";
import { Mic2, ChevronLeft, Heart, CreditCard, CheckCircle, Star, FileText, ShieldCheck } from "lucide-react";

const reviewSteps = [
  { step: "Received", desc: "Submission arrives and is logged in the queue." },
  { step: "In Review", desc: "Platform staff or automated checks review the content." },
  { step: "Additional Information Requested", desc: "We may ask the creator for clarification or corrections." },
  { step: "Approved", desc: "Content passes review and is queued for scheduling." },
  { step: "Scheduled", desc: "Content is set for a future publication date." },
  { step: "Published", desc: "Content is live on the platform." },
  { step: "Featured", desc: "Content is highlighted in discovery or editorial placements." },
  { step: "Declined", desc: "Content does not meet platform guidelines and is not published." },
];

export default function TrustCreator() {
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
            <div className="w-9 h-9 rounded-lg bg-green-400/10 flex items-center justify-center">
              <Mic2 className="w-4.5 h-4.5 text-green-400" />
            </div>
            <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Creator Trust</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight mb-3">Creator Trust</h1>
          <p className="text-muted-foreground leading-relaxed">
            Creators are at the center of Everyday Radio. This section explains how we protect creator
            ownership, how publishing works, and how Creator Support operates.
          </p>
        </div>

        <div className="space-y-6">
          <div className="p-6 rounded-xl bg-card border border-border space-y-3">
            <div className="flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-green-400" /><h2 className="font-semibold">Creator Ownership</h2></div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              You retain full ownership of your music and videos. Uploading content to Everyday Radio
              grants the platform a limited license to stream, display, and promote your work — nothing more.
              We will never claim ownership of your creative output.
            </p>
            <Link href="/legal/creator-agreement">
              <button className="mt-2 text-sm text-primary font-semibold hover:underline">Read the Creator Agreement →</button>
            </Link>
          </div>

          <div className="p-6 rounded-xl bg-card border border-border space-y-4">
            <div className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-blue-400" /><h2 className="font-semibold">How Publishing Review Works</h2></div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              All content submitted for publication goes through a review process. Here is the typical journey:
            </p>
            <div className="space-y-2">
              {reviewSteps.map(({ step, desc }) => (
                <div key={step} className="flex items-start gap-3 text-sm">
                  <span className="w-2 h-2 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                  <div><span className="font-medium">{step}</span> — <span className="text-muted-foreground">{desc}</span></div>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground italic mt-2">
              Approval, rejection, and featured-placement decisions may involve platform guidelines, safety,
              copyright, quality, relevance, or community considerations.
            </p>
          </div>

          <div className="p-6 rounded-xl bg-card border border-border space-y-3">
            <div className="flex items-center gap-2"><Star className="w-4 h-4 text-amber-400" /><h2 className="font-semibold">Creator Verification & Badges</h2></div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Creators can earn verification status and achievement badges recognising milestones such as
              Founding Creator, Beta Tester, and more. Badges are awarded by platform staff and are displayed
              on your public profile.
            </p>
          </div>

          <div className="p-6 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-4">
            <h2 className="font-semibold text-amber-300">Understanding Payments — Two Separate Systems</h2>

            <div className="space-y-2">
              <p className="text-sm font-medium flex items-center gap-2"><CreditCard className="w-4 h-4 text-blue-400" />Creator Services (fees to Everyday Radio)</p>
              <p className="text-sm text-muted-foreground leading-relaxed pl-6">
                Submission review fees and featured-placement fees are payments made to Everyday Radio for
                platform services. These are separate from any money flowing to creators.
              </p>
              <Link href="/legal/creator-payments-addendum">
                <button className="pl-6 text-sm text-primary font-semibold hover:underline">Creator Payments Addendum →</button>
              </Link>
            </div>

            <div className="space-y-2 pt-3 border-t border-amber-500/20">
              <p className="text-sm font-medium flex items-center gap-2"><Heart className="w-4 h-4 text-pink-400" />Creator Support (voluntary tips to creators)</p>
              <p className="text-sm text-muted-foreground leading-relaxed pl-6">
                Creator Support lets listeners and supporters voluntarily tip a creator. There is no hidden
                platform fee on direct creator tips. Everyday Radio does not take a cut of support amounts.
              </p>
              <div className="pl-6">
                <span className="inline-flex items-center gap-1 text-[11px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded font-semibold uppercase tracking-wide">
                  Demo Mode — Beta
                </span>
                <p className="text-xs text-muted-foreground mt-2">
                  During Beta, Creator Support operates in Demo Mode. No real payments are processed.
                  All support amounts shown are demonstration transactions only.
                </p>
              </div>
              <Link href="/legal/creator-support-policy">
                <button className="pl-6 text-sm text-primary font-semibold hover:underline">Creator Support Policy →</button>
              </Link>
            </div>
          </div>

          <div className="p-6 rounded-xl bg-card border border-border space-y-3">
            <div className="flex items-center gap-2"><FileText className="w-4 h-4 text-muted-foreground" /><h2 className="font-semibold">Creator Agreement Responsibilities</h2></div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              By uploading content, creators agree to our Creator Agreement, which covers content rights,
              prohibited content, payment terms, and platform rules. Creators are responsible for ensuring
              they hold the rights to any content they submit.
            </p>
            <div className="flex flex-wrap gap-3 pt-1">
              <Link href="/legal/creator-agreement"><button className="text-sm text-primary font-semibold hover:underline">Creator Agreement →</button></Link>
              <Link href="/legal/community-guidelines"><button className="text-sm text-primary font-semibold hover:underline">Community Guidelines →</button></Link>
              <Link href="/legal/submission-agreement"><button className="text-sm text-primary font-semibold hover:underline">Submission Agreement →</button></Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

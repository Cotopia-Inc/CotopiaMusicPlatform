import { Link } from "wouter";
import { ChevronLeft, XCircle, CheckCircle } from "lucide-react";

function Rule({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5 text-sm text-muted-foreground">
      <XCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
      <span>{children}</span>
    </li>
  );
}

function Good({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5 text-sm text-muted-foreground">
      <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
      <span>{children}</span>
    </li>
  );
}

export default function CommunityGuidelines() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-10 space-y-8">
      <div className="space-y-1">
        <Link href="/legal" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors mb-3">
          <ChevronLeft className="w-3 h-3" />Legal Center
        </Link>
        <h1 className="text-3xl font-extrabold">Community Guidelines</h1>
        <p className="text-xs text-muted-foreground">Everyday Radio by Cotopia · Version 1.0 · Last updated June 2026</p>
      </div>

      <p className="text-sm text-muted-foreground leading-relaxed">
        Everyday Radio exists to celebrate music, creativity, and community. These guidelines set the standard for how we treat each other and what content belongs on the Platform.
      </p>

      <section className="space-y-4">
        <h2 className="text-lg font-bold">Content That Is Not Allowed</h2>
        <ul className="space-y-2.5">
          <Rule>Copyright infringement — uploading music, videos, beats, samples, or vocals you do not own or have no rights to distribute</Rule>
          <Rule>Impersonation — pretending to be another artist, label, band, or public figure</Rule>
          <Rule>Fraud — misleading submission details, fake streaming, or inflating metrics</Rule>
          <Rule>Spam — bulk or repetitive low-quality submissions intended to game discovery</Rule>
          <Rule>Harassment — targeting, threatening, or intimidating other users</Rule>
          <Rule>Hate content — content that promotes violence or discrimination based on race, ethnicity, religion, gender, sexual orientation, disability, or nationality</Rule>
          <Rule>Illegal content — anything that violates applicable laws, including child exploitation material, which will be immediately reported to authorities</Rule>
          <Rule>Malware — files containing viruses, tracking software, or harmful code</Rule>
          <Rule>Unauthorized samples — music using samples without proper clearance</Rule>
          <Rule>Unauthorized vocals — using another person's recorded voice without consent</Rule>
          <Rule>Unauthorized beats — using production by others without a license</Rule>
          <Rule>Unauthorized AI voice or likeness — AI-generated content that impersonates, clones, or mimics another artist or public figure's voice or image without consent</Rule>
        </ul>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-bold">What We Encourage</h2>
        <ul className="space-y-2.5">
          <Good>Original music and creative content you own or have the rights to distribute</Good>
          <Good>Honest, transparent artist and label profiles</Good>
          <Good>Constructive comments that support the creative community</Good>
          <Good>Proper attribution when content is collaborative</Good>
          <Good>AI-generated and AI-assisted content — with proper rights and in compliance with our AI Policy</Good>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold">Enforcement</h2>
        <div className="text-sm text-muted-foreground leading-relaxed space-y-3">
          <p>Violations may result in:</p>
          <ul className="list-disc list-inside space-y-1 pl-2">
            <li>Content removal without notice</li>
            <li>Temporary account suspension</li>
            <li>Permanent account termination</li>
            <li>Forfeiture of submission fees</li>
            <li>Referral to law enforcement where required by law</li>
          </ul>
          <p>Repeat or egregious violations will result in immediate and permanent termination.</p>
          <p>We may act on reports from users, rights holders, or our own moderation review.</p>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold">Reporting Violations</h2>
        <p className="text-sm text-muted-foreground">
          To report a content violation, contact us at{" "}
          <a href="mailto:legal@cotopia.org" className="text-primary hover:underline">legal@cotopia.org</a>.
          For copyright-specific claims, use our{" "}
          <Link href="/legal/copyright-complaint" className="text-primary hover:underline">copyright complaint form</Link>.
        </p>
      </section>

      <div className="pt-4 border-t border-border">
        <p className="text-xs text-muted-foreground">Questions: <a href="mailto:legal@cotopia.org" className="text-primary hover:underline">legal@cotopia.org</a></p>
      </div>
    </div>
  );
}

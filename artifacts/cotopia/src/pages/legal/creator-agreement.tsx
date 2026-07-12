import { Link } from "wouter";
import { ChevronLeft, Home, FileCheck } from "lucide-react";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-bold">{title}</h2>
      <div className="text-sm text-muted-foreground leading-relaxed space-y-3">{children}</div>
    </section>
  );
}

export default function CreatorAgreement() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-10 space-y-8">
      <div className="space-y-1">
        <div className="flex items-center gap-3 mb-3">
          <Link href="/" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
            <Home className="w-3 h-3" />Home
          </Link>
          <span className="text-muted-foreground/30 text-xs">·</span>
          <Link href="/legal" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
            <ChevronLeft className="w-3 h-3" />Legal Center
          </Link>
        </div>
        <h1 className="text-3xl font-extrabold">Creator Agreement</h1>
        <p className="text-xs text-muted-foreground">Everyday Radio by Cotopia · Version 1.0 · Last updated July 2026</p>
      </div>

      <div className="rounded-xl border border-primary/20 bg-primary/5 p-5 flex gap-3">
        <FileCheck className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-primary">This agreement applies to all creators on Everyday Radio</p>
          <p className="text-xs text-muted-foreground mt-1">By creating an account or submitting content as an artist, label, or creator, you agree to the terms below in addition to our Terms of Service.</p>
        </div>
      </div>

      <Section title="1. Content Ownership">
        <p>You confirm that you own or are fully authorized to distribute all content you submit to Everyday Radio, including music, videos, artwork, and metadata.</p>
        <p>You retain full ownership of your content. Submitting content grants Cotopia a limited license as described in the Terms of Service and Content License agreement.</p>
      </Section>

      <Section title="2. Original Work and Rights Clearances">
        <p>You confirm that all submitted content is your original work or that you have obtained all necessary licenses, clearances, and permissions for samples, beats, vocals, or any third-party material included.</p>
        <p>You understand that submitting content containing unclearned third-party material may result in removal, account suspension, and loss of any fees paid.</p>
      </Section>

      <Section title="3. AI-Generated and AI-Assisted Content">
        <p>If your submission includes AI-generated or AI-assisted elements, you confirm that you have the rights to distribute the output and that you are in compliance with our AI Content Policy.</p>
        <p>You may not upload AI content that clones or mimics another artist's voice, style, or likeness without their explicit written consent.</p>
      </Section>

      <Section title="4. Accuracy of Submission Information">
        <p>You agree to provide accurate, complete, and non-misleading information in all submissions, including artist name, content title, genre, and ownership declarations.</p>
        <p>Deliberately misleading submission information may result in content removal and account termination without refund.</p>
      </Section>

      <Section title="5. Platform Conduct">
        <p>As a creator, you are expected to uphold the same community standards as all platform users. This includes respectful interaction with supporters, fans, and fellow creators.</p>
        <p>You may not use the Platform to harass, defraud, impersonate, or harm other users.</p>
      </Section>

      <Section title="6. Submission Fees">
        <p>Creator Service fees are charged for platform review, hosting, and content processing. These fees are non-refundable once review has begun, as described in our Refund Policy.</p>
        <p>Submitting content does not guarantee approval. Declined submissions do not qualify for refunds where review work has been performed.</p>
      </Section>

      <Section title="7. Creator Support">
        <p>Creators may opt in to Creator Support to allow supporters to send voluntary contributions directly through their selected payment provider.</p>
        <p>By enabling Creator Support, you agree that:</p>
        <ul className="list-disc list-inside space-y-1.5 pl-2">
          <li>You own or are fully authorized to use the connected payment account.</li>
          <li>Your payment account information is accurate and up to date.</li>
          <li>You may disable Creator Support at any time from your account settings.</li>
          <li>You are solely responsible for reporting and paying any applicable taxes on support income received.</li>
          <li>You are responsible for issuing refunds where applicable under your payment provider's policies.</li>
          <li>You are responsible for chargebacks and disputes handled through your payment provider.</li>
          <li>You authorize Everyday Radio to display a "Support This Creator" button on your profile and content pages while Creator Support is enabled.</li>
          <li>Everyday Radio does not guarantee any level of support activity, contributions, or engagement from supporters.</li>
          <li>During Beta, Creator Support operates in Demo Mode. No real money is processed during Demo Mode.</li>
        </ul>
        <p>When Creator Support transitions from Demo Mode to live mode, all terms in this section and the Creator Payments Addendum will apply to real transactions.</p>
      </Section>

      <Section title="8. Account Termination">
        <p>Cotopia reserves the right to suspend or terminate creator accounts for violations of this agreement, the Terms of Service, or Community Guidelines, at any time without prior notice.</p>
        <p>Upon termination, your content may be removed from the Platform. Submission fees already paid are non-refundable.</p>
      </Section>

      <Section title="9. Updates to This Agreement">
        <p>Cotopia may update this Creator Agreement from time to time. Material changes will be communicated through the Platform. Continued use after changes constitutes acceptance.</p>
      </Section>

      <div className="pt-4 border-t border-border">
        <p className="text-xs text-muted-foreground">Questions: <a href="mailto:legal@cotopia.org" className="text-primary hover:underline">legal@cotopia.org</a></p>
      </div>
    </div>
  );
}

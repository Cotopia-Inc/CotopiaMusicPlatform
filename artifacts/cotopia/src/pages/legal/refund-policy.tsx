import { Link } from "wouter";
import { ChevronLeft, AlertCircle, Home } from "lucide-react";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-bold">{title}</h2>
      <div className="text-sm text-muted-foreground leading-relaxed space-y-3">{children}</div>
    </section>
  );
}

export default function RefundPolicy() {
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
        <h1 className="text-3xl font-extrabold">Refund Policy</h1>
        <p className="text-xs text-muted-foreground">Everyday Radio by Cotopia · Version 1.0 · Last updated June 2026</p>
      </div>

      <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-5 flex gap-3">
        <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-red-400">Fees are non-refundable once review begins</p>
          <p className="text-xs text-muted-foreground mt-1">Please review your submission carefully before completing payment.</p>
        </div>
      </div>

      <Section title="1. Submission Fees">
        <p>Submission fees are charged to cover the cost of review, processing, and platform hosting services associated with your content batch.</p>
        <p><strong className="text-foreground">Submission fees are non-refundable once review has begun.</strong> Review begins immediately or within 24 hours of successful payment capture.</p>
        <p>In the event of a technical payment error that results in a double charge, please contact us within 7 days at <a href="mailto:legal@cotopia.org" className="text-primary hover:underline">legal@cotopia.org</a> and we will investigate and issue a correction where verified.</p>
      </Section>

      <Section title="2. Promotion Fees">
        <p>Promotion fees are charged for campaign services including featured placement, radio scheduling, social media spotlights, and related promotional activities.</p>
        <p><strong className="text-foreground">Promotion fees are non-refundable once campaign work has begun.</strong> Campaign work begins within the timeframe specified in your promotion package.</p>
        <p>If your campaign has not yet started, please contact us at <a href="mailto:legal@cotopia.org" className="text-primary hover:underline">legal@cotopia.org</a> within 24 hours of payment to request a cancellation review.</p>
      </Section>

      <Section title="3. Rejected Submissions">
        <p>If your submission is rejected during review (due to content violations, quality standards, or ineligibility), the submission fee is still non-refundable, as review work has been performed.</p>
        <p>We will provide a reason for rejection. You may resubmit corrected content by paying a new submission fee.</p>
      </Section>

      <Section title="4. Fraudulent Chargebacks">
        <p>Initiating a fraudulent chargeback or payment dispute without contacting us first is a violation of these Terms and may result in:</p>
        <ul className="list-disc list-inside space-y-1 pl-2">
          <li>Immediate account suspension</li>
          <li>Removal of all submitted content from the Platform</li>
          <li>Permanent termination of your account</li>
          <li>Loss of all platform access and any approved content</li>
          <li>Referral to collections or legal action</li>
        </ul>
        <p>If you believe a charge was made in error, contact us at <a href="mailto:legal@cotopia.org" className="text-primary hover:underline">legal@cotopia.org</a> before filing a dispute with your payment provider.</p>
      </Section>

      <Section title="5. Contact for Billing Issues">
        <p>For all billing inquiries, potential errors, or refund requests, contact us at <a href="mailto:legal@cotopia.org" className="text-primary hover:underline">legal@cotopia.org</a> with your account email, transaction reference, and a description of the issue.</p>
        <p>We aim to respond to billing inquiries within 3 business days.</p>
      </Section>

      <div className="pt-4 border-t border-border">
        <p className="text-xs text-muted-foreground">Billing questions: <a href="mailto:legal@cotopia.org" className="text-primary hover:underline">legal@cotopia.org</a></p>
      </div>
    </div>
  );
}

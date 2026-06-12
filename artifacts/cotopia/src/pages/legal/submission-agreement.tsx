import { Link } from "wouter";
import { ChevronLeft, FileCheck } from "lucide-react";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-bold">{title}</h2>
      <div className="text-sm text-muted-foreground leading-relaxed space-y-3">{children}</div>
    </section>
  );
}

export default function SubmissionAgreement() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-10 space-y-8">
      <div className="space-y-1">
        <Link href="/legal" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors mb-3">
          <ChevronLeft className="w-3 h-3" />Legal Center
        </Link>
        <h1 className="text-3xl font-extrabold">Submission Agreement</h1>
        <p className="text-xs text-muted-foreground">Everyday Radio by Cotopia · Version 1.0 · Last updated June 2026</p>
      </div>

      <div className="rounded-xl border border-primary/20 bg-primary/5 p-5 flex gap-3">
        <FileCheck className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
        <p className="text-sm text-muted-foreground">This agreement governs all content submitted to Everyday Radio by Cotopia. By completing a submission, you confirm you have read, understood, and agreed to these terms.</p>
      </div>

      <Section title="1. Rights & Ownership">
        <p>By submitting content to Everyday Radio, you confirm that:</p>
        <ul className="list-disc list-inside space-y-1 pl-2">
          <li>You own or control all rights necessary to upload, distribute, and license the submitted content</li>
          <li>The content does not infringe any copyright, trademark, right of publicity, or other third-party right</li>
          <li>You have obtained all required clearances for samples, features, collaborations, or third-party material included in the content</li>
          <li>If AI tools were used, you have the rights necessary to upload and distribute the resulting content</li>
        </ul>
        <p>You retain full ownership of your content at all times.</p>
      </Section>

      <Section title="2. License Grant to Cotopia">
        <p>By submitting content, you grant Cotopia a <strong className="text-foreground">non-exclusive, royalty-free, worldwide license</strong> to:</p>
        <ul className="list-disc list-inside space-y-1 pl-2">
          <li>Host and store your content on Cotopia's servers and CDN infrastructure</li>
          <li>Stream your content to users of the Everyday Radio platform</li>
          <li>Display your content, metadata, artwork, and artist information on the Platform</li>
          <li>Promote and feature your content through Platform discovery, editorial, and marketing channels</li>
          <li>Recommend your content to users through algorithmic and editorial playlists</li>
          <li>Create promotional excerpts (clips, previews) of up to 60 seconds for marketing purposes</li>
        </ul>
        <p>This license does not grant Cotopia the right to sell, sublicense, or distribute your content to third-party platforms or services without your separate written consent.</p>
      </Section>

      <Section title="3. Not a Royalty-Paying Service">
        <p><strong className="text-foreground">Everyday Radio does not currently pay streaming royalties, mechanical royalties, performance royalties, publishing royalties, or revenue sharing.</strong></p>
        <p>Submission fees are service fees for platform review, hosting, and promotion. They are not advances, royalties, or revenue guarantees.</p>
        <p>If Cotopia launches a compensation program in the future, separate written agreements will govern participation and payment terms.</p>
      </Section>

      <Section title="4. Non-Refundable Fees">
        <p>Submission and promotion fees are non-refundable once review or campaign work has begun. See our <Link href="/legal/refund-policy" className="text-primary hover:underline">Refund Policy</Link> for complete details.</p>
      </Section>

      <Section title="5. Content Standards">
        <p>All submitted content must comply with our <Link href="/legal/community-guidelines" className="text-primary hover:underline">Community Guidelines</Link> and <Link href="/legal/ai-policy" className="text-primary hover:underline">AI Content Policy</Link>. Cotopia reserves the right to reject, remove, or suspend content and accounts that violate platform rules.</p>
      </Section>

      <Section title="6. Indemnification">
        <p>You agree to defend, indemnify, and hold harmless Cotopia, its affiliates, officers, directors, employees, and agents from and against any claims, damages, losses, liabilities, and expenses (including reasonable legal fees) arising from:</p>
        <ul className="list-disc list-inside space-y-1 pl-2">
          <li>Your uploaded content</li>
          <li>Any claim that your content infringes a third party's intellectual property rights</li>
          <li>Your breach of this Submission Agreement or any platform policy</li>
        </ul>
      </Section>

      <Section title="7. License Duration">
        <p>This license remains in effect for as long as your content is hosted on the Platform. You may request removal of your content at any time. Upon removal, the license terminates, though Cotopia may retain copies for up to 30 days during the deletion process.</p>
      </Section>

      <div className="pt-4 border-t border-border">
        <p className="text-xs text-muted-foreground">Submission inquiries: <a href="mailto:legal@cotopia.org" className="text-primary hover:underline">legal@cotopia.org</a></p>
      </div>
    </div>
  );
}

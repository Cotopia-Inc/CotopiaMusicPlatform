import { Link } from "wouter";
import { ChevronLeft, Home, Zap } from "lucide-react";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-bold">{title}</h2>
      <div className="text-sm text-muted-foreground leading-relaxed space-y-3">{children}</div>
    </section>
  );
}

export default function BetaPolicy() {
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
        <h1 className="text-3xl font-extrabold">Beta Policy</h1>
        <p className="text-xs text-muted-foreground">Everyday Radio by Cotopia · Version 1.0 · Last updated July 2026</p>
      </div>

      <div className="rounded-xl border border-primary/20 bg-primary/5 p-5 flex gap-3">
        <Zap className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-primary">You are using Everyday Radio during its Beta period</p>
          <p className="text-xs text-muted-foreground mt-1">Beta participants help shape the future of the platform. Thank you for being here early.</p>
        </div>
      </div>

      <Section title="1. What Beta Means">
        <p>Everyday Radio is currently in Beta. During this period, the Platform is actively being developed, tested, and improved based on creator and community feedback.</p>
        <p>Beta access is available to all creators, artists, labels, and listeners who register an account during this period. Beta participants become Founding Creators and help shape the future of the Platform.</p>
      </Section>

      <Section title="2. Platform Availability">
        <p>During Beta, the Platform may experience downtime, reduced availability, or performance issues as features are built and tested.</p>
        <p>Cotopia does not guarantee uninterrupted access to the Platform during Beta. We will make reasonable efforts to minimize disruptions and communicate planned maintenance windows when possible.</p>
      </Section>

      <Section title="3. Features During Beta">
        <p>Features available during Beta may change, be added, modified, or removed as the Platform evolves. Features marked as "Beta" or "Demo Mode" are not final and may differ from their eventual live implementation.</p>
        <p>Feedback from Beta participants directly influences which features are prioritized, refined, or changed before the Platform reaches full production.</p>
      </Section>

      <Section title="4. Creator Support in Beta">
        <p>Creator Support is currently operating in Demo Mode during the Beta period.</p>
        <ul className="list-disc list-inside space-y-1.5 pl-2">
          <li><strong className="text-foreground">No real money is processed</strong> during Creator Support Demo Mode.</li>
          <li>All displayed support amounts, transactions, and Support Wall entries are simulated.</li>
          <li>No payment provider account is required to enable Creator Support during Demo Mode.</li>
          <li>The Creator Support interface and Support Wall function as they will in live mode, allowing creators and supporters to experience the full flow before real payments are activated.</li>
        </ul>
        <p>When Creator Support transitions from Demo Mode to live mode, this will be announced separately through the Platform and via account notifications. Creators will need to connect a supported payment provider account to continue receiving Creator Support in live mode.</p>
      </Section>

      <Section title="5. Data During Beta">
        <p>Content uploaded, accounts created, and activity recorded during Beta will be carried forward to the production Platform unless you delete your account or content before that time.</p>
        <p>In the unlikely event that Beta data must be reset, affected users will be notified in advance where reasonably possible.</p>
      </Section>

      <Section title="6. Fees During Beta">
        <p>Creator Service fees charged during Beta are real fees for real review and hosting services. These fees are governed by our Refund Policy and are non-refundable once review has begun.</p>
        <p>Beta participants are not exempt from Creator Service fees. Submission and promotion fees during Beta are identical to post-Beta pricing unless otherwise stated.</p>
      </Section>

      <Section title="7. Founding Creator Status">
        <p>Users who register and participate during the Beta period are recognized as Founding Creators on the Platform.</p>
        <p>Founding Creator status is a recognition of early participation. It does not confer ownership rights, governance rights, financial rights, or any special contractual status beyond what is described in these Terms.</p>
        <p>Founding Creators may receive exclusive badges, early access to new features, and other recognition as the Platform grows.</p>
      </Section>

      <Section title="8. Feedback and Improvement">
        <p>Beta participants are encouraged to share feedback, report bugs, and suggest improvements. Feedback can be submitted through the Platform or by contacting <a href="mailto:support@cotopia.org" className="text-primary hover:underline">support@cotopia.org</a>.</p>
        <p>By submitting feedback, you grant Cotopia a perpetual, royalty-free right to use your feedback to improve the Platform without obligation or compensation.</p>
      </Section>

      <Section title="9. End of Beta">
        <p>The Beta period will conclude when Cotopia determines the Platform is ready for full production. The transition from Beta to production will be announced through the Platform.</p>
        <p>All accounts, content, and agreements created during Beta will remain in effect after the Beta period unless otherwise stated.</p>
      </Section>

      <Section title="10. Changes to This Policy">
        <p>This Beta Policy may be updated at any time during the Beta period. Continued use of the Platform constitutes acceptance of any updates.</p>
      </Section>

      <div className="pt-4 border-t border-border">
        <p className="text-xs text-muted-foreground">Questions: <a href="mailto:support@cotopia.org" className="text-primary hover:underline">support@cotopia.org</a></p>
      </div>
    </div>
  );
}

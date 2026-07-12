import { Link } from "wouter";
import { ChevronLeft, Home, Heart, AlertCircle } from "lucide-react";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-bold">{title}</h2>
      <div className="text-sm text-muted-foreground leading-relaxed space-y-3">{children}</div>
    </section>
  );
}

export default function CreatorSupportPolicy() {
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
        <h1 className="text-3xl font-extrabold">Creator Support Policy</h1>
        <p className="text-xs text-muted-foreground">Everyday Radio by Cotopia · Version 1.0 · Last updated July 2026</p>
      </div>

      <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-5 flex gap-3">
        <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-amber-400">Beta Demo Mode — No real payments are processed</p>
          <p className="text-xs text-muted-foreground mt-1">Creator Support is currently operating in Demo Mode during the Everyday Radio Beta. All transactions shown are simulated. When Creator Support goes live, this policy will govern real transactions.</p>
        </div>
      </div>

      <div className="rounded-xl border border-primary/20 bg-primary/5 p-5 flex gap-3">
        <Heart className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-primary">Creator Support is voluntary and peer-to-peer</p>
          <p className="text-xs text-muted-foreground mt-1">Supporters send voluntary contributions directly to creators. Everyday Radio does not take a percentage of creator support payments and does not hold creator funds.</p>
        </div>
      </div>

      <Section title="1. What Creator Support Is">
        <p>Creator Support is a voluntary feature that allows listeners and community members to send financial contributions directly to creators they want to support on Everyday Radio.</p>
        <p>Creator Support is designed to help independent creators continue building amazing content and lasting communities. It is entirely optional for both creators and supporters.</p>
        <p>Creator Support is not a subscription service, a content paywall, a crowdfunding campaign, or an investment mechanism.</p>
      </Section>

      <Section title="2. How It Works">
        <p>Eligible creators can opt in to Creator Support from their account settings. Once enabled, a "Support This Creator" button appears on their profile and content pages.</p>
        <p>Supporters can choose a support amount, optionally leave a support message, and choose whether their support appears on the public Support Wall.</p>
        <p>In live mode, support payments are sent directly to the creator's connected payment provider account. Everyday Radio does not hold, process, or transfer creator support funds.</p>
      </Section>

      <Section title="3. Who Receives Support">
        <p>Support payments go directly to the creator who has enabled Creator Support. Everyday Radio does not take a percentage, fee, or commission on creator support payments.</p>
        <p>Creators are responsible for all obligations associated with receiving payments through their selected payment provider, including applicable taxes and compliance requirements.</p>
      </Section>

      <Section title="4. Payment Providers">
        <p>Creator support payments are processed through third-party payment providers selected by the creator (such as PayPal or other providers made available in the future).</p>
        <p>Everyday Radio does not process payments directly, act as a payment intermediary, or store supporter payment card information.</p>
        <p>The availability of specific payment providers may vary by region and is subject to change. Everyday Radio is not responsible for payment provider outages, failures, or policy changes.</p>
      </Section>

      <Section title="5. Privacy">
        <p>When you support a creator, the following information may be collected:</p>
        <ul className="list-disc list-inside space-y-1 pl-2">
          <li>Your account identity (if you are logged in)</li>
          <li>The creator and content item being supported</li>
          <li>The support message you provide (if any)</li>
          <li>Whether you chose to appear anonymously</li>
          <li>The timestamp of your support activity</li>
        </ul>
        <p>Payment card information is not stored by Everyday Radio. Payments are processed entirely through your selected payment provider.</p>
        <p>See our <Link href="/legal/privacy" className="text-primary hover:underline">Privacy Policy</Link> for full details on how support activity data is collected and used.</p>
      </Section>

      <Section title="6. Anonymous Support">
        <p>Supporters may choose to send support anonymously. When anonymous support is selected, your name and account will not appear on the public Support Wall or be disclosed to the creator through the Platform.</p>
        <p>Note that payment providers may still share your identity with the creator as part of their payment processing flow, independent of Everyday Radio's anonymity setting.</p>
      </Section>

      <Section title="7. Public Support Wall">
        <p>Creators may display a public Support Wall showing acknowledgments from supporters who chose to appear publicly. The Support Wall shows supporter names and support messages.</p>
        <p>The Support Wall is moderated. Messages that violate our Community Guidelines may be removed without notice.</p>
        <p>Creators may moderate their own Support Wall and remove messages that violate platform rules.</p>
      </Section>

      <Section title="8. Support Messages">
        <p>Supporters may include a short message with their support. Support messages must comply with Community Guidelines. Messages may not contain:</p>
        <ul className="list-disc list-inside space-y-1 pl-2">
          <li>Harassment, threats, or abusive language</li>
          <li>Spam or commercial solicitation</li>
          <li>Personal information of third parties</li>
          <li>Illegal content of any kind</li>
        </ul>
        <p>Support messages may be reviewed by Everyday Radio for moderation and platform safety. Support messages are not used to train AI systems. See our <Link href="/legal/ai-policy" className="text-primary hover:underline">AI Content Policy</Link> for details.</p>
        <p>Supporters may request removal of their own support message by contacting <a href="mailto:support@cotopia.org" className="text-primary hover:underline">support@cotopia.org</a>.</p>
      </Section>

      <Section title="9. Refund Information">
        <p>Creator support refunds are governed by the policies of the creator's selected payment provider, not by Everyday Radio's Refund Policy.</p>
        <p>Everyday Radio does not process, approve, or deny creator support refunds. If you believe you are entitled to a refund for a support payment, contact your payment provider directly.</p>
        <p>During Beta Demo Mode, no real payments are made and refunds are not applicable.</p>
      </Section>

      <Section title="10. Dispute Information">
        <p>Payment disputes and chargebacks arising from creator support transactions are handled by the payment provider involved. Everyday Radio is not a party to payment disputes between creators and supporters.</p>
        <p>For platform-level concerns (such as alleged fraud, harassment, or policy violations related to Creator Support), contact <a href="mailto:legal@cotopia.org" className="text-primary hover:underline">legal@cotopia.org</a>.</p>
      </Section>

      <Section title="11. Beta Demo Mode">
        <p>During the Everyday Radio Beta, Creator Support operates in Demo Mode. In Demo Mode:</p>
        <ul className="list-disc list-inside space-y-1 pl-2">
          <li>No real money is processed or transferred</li>
          <li>All displayed support amounts are simulated</li>
          <li>No payment provider account is required to enable Creator Support during Demo Mode</li>
          <li>Support Wall messages and acknowledgments function as they would in live mode</li>
          <li>Demo Mode allows creators and supporters to experience the Creator Support flow before live payments are activated</li>
        </ul>
      </Section>

      <Section title="12. Future Live Mode">
        <p>When Creator Support transitions from Demo Mode to live mode, creators will be required to connect a supported payment provider account before their Creator Support becomes active.</p>
        <p>The transition to live mode will be announced separately through the Platform. At that time, real payments will be processed through the creator's selected payment provider.</p>
        <p>All terms in this policy, the Creator Agreement, and the Creator Payments Addendum will apply fully to live transactions.</p>
      </Section>

      <Section title="13. Important Notices">
        <ul className="list-disc list-inside space-y-1.5 pl-2">
          <li>Creator Support is voluntary.</li>
          <li>When live, payments are handled through third-party payment providers.</li>
          <li>Everyday Radio does not hold creator support funds.</li>
          <li>Creators are responsible for their own payment accounts and applicable legal obligations.</li>
          <li>Supporting a creator does not purchase ownership rights, copyrights, royalties, licensing rights, or investment interests.</li>
          <li>Supporting a creator does not guarantee communication, services, exclusive content, or future releases unless explicitly offered by that creator.</li>
        </ul>
      </Section>

      <div className="pt-4 border-t border-border">
        <p className="text-xs text-muted-foreground">Questions: <a href="mailto:legal@cotopia.org" className="text-primary hover:underline">legal@cotopia.org</a></p>
      </div>
    </div>
  );
}

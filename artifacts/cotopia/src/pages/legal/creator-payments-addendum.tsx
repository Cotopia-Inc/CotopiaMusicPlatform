import { Link } from "wouter";
import { ChevronLeft, Home, CreditCard, AlertCircle } from "lucide-react";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-bold">{title}</h2>
      <div className="text-sm text-muted-foreground leading-relaxed space-y-3">{children}</div>
    </section>
  );
}

export default function CreatorPaymentsAddendum() {
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
        <h1 className="text-3xl font-extrabold">Creator Payments Addendum</h1>
        <p className="text-xs text-muted-foreground">Everyday Radio by Cotopia · Version 1.0 · Last updated July 2026</p>
      </div>

      <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-5 flex gap-3">
        <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-amber-400">Creator Support is currently in Demo Mode</p>
          <p className="text-xs text-muted-foreground mt-1">No real money is processed during Beta Demo Mode. This addendum governs Creator Support when live payments are enabled. By enabling Creator Support, you accept this Addendum.</p>
        </div>
      </div>

      <div className="rounded-xl border border-primary/20 bg-primary/5 p-5 flex gap-3">
        <CreditCard className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-primary">Creator Support is voluntary and peer-to-peer</p>
          <p className="text-xs text-muted-foreground mt-1">Supporters send payments directly to creators through their selected payment provider. Everyday Radio does not hold, collect, or process creator support funds.</p>
        </div>
      </div>

      <Section title="1. Scope and Acceptance">
        <p>This Creator Payments Addendum ("Addendum") supplements the Creator Agreement and Terms of Service. It applies specifically to creators who enable Creator Support on their Everyday Radio profile.</p>
        <p>By enabling Creator Support, you confirm that you have read, understood, and agree to this Addendum. Acceptance is required the first time you enable Creator Support.</p>
      </Section>

      <Section title="2. Connecting Payment Accounts">
        <p>To receive live Creator Support payments, creators must connect a supported payment provider account (such as PayPal or another provider made available in the future).</p>
        <p>You are responsible for:</p>
        <ul className="list-disc list-inside space-y-1.5 pl-2">
          <li>Providing accurate and current payment account credentials</li>
          <li>Maintaining your payment account in good standing</li>
          <li>Updating your payment information if it changes</li>
          <li>Complying with your payment provider's terms of service and account requirements</li>
        </ul>
        <p>Everyday Radio is not responsible for payment failures resulting from inaccurate, outdated, or suspended payment accounts.</p>
      </Section>

      <Section title="3. Creator Payment Responsibilities">
        <p>As a creator receiving support payments, you are solely responsible for:</p>
        <ul className="list-disc list-inside space-y-1.5 pl-2">
          <li>All obligations associated with receiving payments through your selected payment provider</li>
          <li>Maintaining compliance with your payment provider's policies</li>
          <li>Any fees charged by your payment provider for receiving funds</li>
          <li>Ensuring your payment account can legally receive funds in your jurisdiction</li>
        </ul>
      </Section>

      <Section title="4. Tax Responsibilities">
        <p>Creator support payments received through your selected payment provider may constitute taxable income depending on your jurisdiction.</p>
        <p>You are solely responsible for:</p>
        <ul className="list-disc list-inside space-y-1.5 pl-2">
          <li>Determining your tax obligations as a result of receiving creator support</li>
          <li>Reporting creator support income to applicable tax authorities</li>
          <li>Collecting and remitting any applicable sales tax, VAT, or other transaction taxes if required in your jurisdiction</li>
          <li>Maintaining accurate records of support payments received</li>
        </ul>
        <p>Everyday Radio does not provide tax advice. Consult a qualified tax professional for guidance applicable to your situation.</p>
      </Section>

      <Section title="5. Payment Provider Requirements">
        <p>Creator Support payments are processed directly through your selected third-party payment provider. Everyday Radio does not act as a payment processor, payment intermediary, or money transmitter.</p>
        <p>You must comply with all applicable terms, policies, and requirements of your selected payment provider, including:</p>
        <ul className="list-disc list-inside space-y-1.5 pl-2">
          <li>Identity verification requirements</li>
          <li>Acceptable use policies</li>
          <li>Geographic restrictions</li>
          <li>Transaction limits</li>
        </ul>
        <p>Everyday Radio is not responsible for payment provider outages, delays, errors, or policy changes that affect your ability to receive payments.</p>
      </Section>

      <Section title="6. Chargebacks and Disputes">
        <p>Chargebacks and payment disputes are governed by your payment provider's policies. Everyday Radio is not a party to payment disputes between creators and supporters.</p>
        <p>You are responsible for responding to and resolving chargebacks through your payment provider. Excessive chargebacks may result in your payment provider restricting or terminating your account, independent of any action by Everyday Radio.</p>
        <p>Fraudulent support activity — including use of stolen payment methods by supporters — should be reported to your payment provider and to <a href="mailto:legal@cotopia.org" className="text-primary hover:underline">legal@cotopia.org</a>.</p>
      </Section>

      <Section title="7. Fraud Prevention">
        <p>You may not use Creator Support to facilitate fraudulent transactions, money laundering, or any activity that violates applicable law.</p>
        <p>You may not solicit, encourage, or facilitate supporters to use stolen, unauthorized, or fraudulently obtained payment methods.</p>
        <p>Everyday Radio reserves the right to suspend or disable Creator Support for any creator suspected of engaging in or facilitating fraudulent payment activity.</p>
      </Section>

      <Section title="8. Voluntary Support">
        <p>Creator Support is entirely voluntary. Supporters are under no obligation to provide support, and creators are under no obligation to accept it.</p>
        <p>Providing support does not create any contractual relationship between the supporter and creator beyond the voluntary contribution itself.</p>
        <p>Supporting a creator does not entitle a supporter to ownership rights, copyright interests, royalties, exclusive content, guaranteed communication, or any future deliverables unless the creator has explicitly offered them through a separate written agreement.</p>
      </Section>

      <Section title="9. Platform Responsibilities">
        <p>Everyday Radio's role in Creator Support is limited to:</p>
        <ul className="list-disc list-inside space-y-1.5 pl-2">
          <li>Displaying the Creator Support interface on creator profiles and content pages</li>
          <li>Facilitating the connection between supporters and creator payment accounts</li>
          <li>Moderating the public Support Wall for violations of Community Guidelines</li>
          <li>Maintaining records of demo-mode support activity during Beta</li>
        </ul>
        <p>Everyday Radio does not hold creator support funds, guarantee payment delivery, or act as a financial institution of any kind.</p>
      </Section>

      <Section title="10. Creator Responsibilities">
        <p>As a creator enabling Creator Support, you agree to:</p>
        <ul className="list-disc list-inside space-y-1.5 pl-2">
          <li>Use Creator Support only for lawful purposes</li>
          <li>Not harass, pressure, or mislead supporters in connection with Creator Support</li>
          <li>Not promise investment returns, ownership stakes, or illegal incentives in exchange for support</li>
          <li>Not misrepresent how supporter funds will be used</li>
          <li>Promptly disable Creator Support if you become ineligible to receive payments under your payment provider's terms</li>
        </ul>
      </Section>

      <Section title="11. Future Payment Providers">
        <p>Everyday Radio may make additional payment providers available in the future. This Addendum applies to all payment providers made available through the Creator Support system, not only those currently supported.</p>
        <p>If new providers are added, any provider-specific terms will be communicated at the time of integration.</p>
      </Section>

      <Section title="12. Updates to This Addendum">
        <p>Cotopia may update this Addendum from time to time, including when Creator Support transitions from Demo Mode to live mode. Material changes will be communicated through the Platform.</p>
        <p>Continued use of Creator Support after changes constitutes acceptance of the updated Addendum.</p>
      </Section>

      <div className="pt-4 border-t border-border">
        <p className="text-xs text-muted-foreground">Questions: <a href="mailto:legal@cotopia.org" className="text-primary hover:underline">legal@cotopia.org</a></p>
      </div>
    </div>
  );
}

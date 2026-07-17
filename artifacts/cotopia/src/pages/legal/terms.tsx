import { Link } from "wouter";
import { ChevronLeft, Home } from "lucide-react";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-bold">{title}</h2>
      <div className="text-sm text-muted-foreground leading-relaxed space-y-3">{children}</div>
    </section>
  );
}

export default function TermsOfService() {
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
        <h1 className="text-3xl font-extrabold">Terms of Service</h1>
        <p className="text-xs text-muted-foreground">Everyday Radio by Cotopia · Version 1.0 · Last updated June 2026</p>
      </div>

      <Section title="1. Platform Description">
        <p>Everyday Radio by Cotopia ("Everyday Radio," "the Platform," "we," or "us") is an independent music and video streaming, hosting, discovery, promotion, and community platform operated by Cotopia.</p>
        <p>Cotopia Music & Marketing is a separate record label division of Cotopia. Everyday Radio is a distinct platform and does not automatically constitute a record label relationship.</p>
      </Section>

      <Section title="2. Acceptance of Terms">
        <p>By creating an account, submitting content, or otherwise using Everyday Radio, you agree to these Terms of Service, our Privacy Policy, and all other policies published in the Legal Center.</p>
        <p>If you do not agree to these terms, do not use the Platform.</p>
      </Section>

      <Section title="3. Not a Royalty-Paying Service">
        <p><strong className="text-foreground">Everyday Radio is not currently a royalty-paying streaming service.</strong> Cotopia does not pay streaming royalties, mechanical royalties, performance royalties, publishing royalties, or revenue sharing unless a separate written agreement exists between you and Cotopia.</p>
        <p>The Platform provides content hosting, streaming infrastructure, discovery, promotion, and community services. Submission and promotion fees are service fees, not advances or royalties.</p>
        <p>Cotopia may launch optional creator compensation programs, contests, sponsorships, or revenue sharing in the future under separate written agreements.</p>
      </Section>

      <Section title="4. Content Ownership & License">
        <p>You retain full ownership of all content you upload to Everyday Radio. By submitting content, you grant Cotopia a non-exclusive, royalty-free, worldwide license to:</p>
        <ul className="list-disc list-inside space-y-1 pl-2">
          <li>Host and store your content on our servers</li>
          <li>Stream your content to Platform users</li>
          <li>Display and present your content on the Platform</li>
          <li>Promote and feature your content on the Platform and affiliated channels</li>
          <li>Recommend and place your content in playlists and discovery features</li>
        </ul>
        <p>This license continues until you remove your content from the Platform. Removal requests may take up to 30 days to fully process across all delivery systems.</p>
      </Section>

      <Section title="5. Eligibility & Account Rules">
        <p>You must be at least 18 years old (or the age of majority in your jurisdiction) to create an account. By registering, you confirm you meet this requirement.</p>
        <p>You are responsible for maintaining the confidentiality of your account credentials. You are liable for all activity under your account.</p>
        <p>You may not create multiple accounts to circumvent suspensions or platform rules.</p>
      </Section>

      <Section title="6. Prohibited Content">
        <p>You may not upload or distribute content that:</p>
        <ul className="list-disc list-inside space-y-1 pl-2">
          <li>Infringes any copyright, trademark, or other intellectual property rights</li>
          <li>Impersonates another artist, label, or individual</li>
          <li>Contains fraud, spam, or deceptive material</li>
          <li>Constitutes harassment, threats, or hate speech</li>
          <li>Is illegal in your jurisdiction or ours</li>
          <li>Contains malware, viruses, or harmful code</li>
          <li>Includes unauthorized samples, beats, vocals, or AI-generated voice or likeness of another person</li>
        </ul>
      </Section>

      <Section title="7. Fees & Payments">
        <p>Submission fees and promotion fees are service fees charged for Platform review, hosting, and promotion services.</p>
        <p>Fees are non-refundable once review or campaign work has begun. See our Refund Policy for complete terms.</p>
        <p>Fraudulent chargebacks may result in immediate account suspension, content removal, and loss of access to the Platform.</p>
      </Section>

      <Section title="8. Enforcement & Termination">
        <p>Cotopia reserves the right to remove content, suspend accounts, or terminate access at any time for violations of these Terms or our Community Guidelines.</p>
        <p>Repeat copyright infringers will have their accounts suspended or terminated under our Repeat Infringer Policy.</p>
        <p>We may preserve records of terminated accounts as required by law or for enforcement purposes.</p>
      </Section>

      <Section title="9. Indemnification">
        <p>You agree to defend, indemnify, and hold harmless Cotopia, its affiliates, officers, directors, employees, and agents from any claims, damages, losses, liabilities, and expenses (including reasonable legal fees) arising from your content, your use of the Platform, or your violation of these Terms.</p>
      </Section>

      <Section title="10. Disclaimers">
        <p>The Platform is provided "as is" without warranty of any kind. Cotopia does not guarantee uninterrupted access, specific placement, or any promotional outcome.</p>
        <p>To the maximum extent permitted by law, Cotopia is not liable for indirect, incidental, or consequential damages.</p>
      </Section>

      <Section title="11. Governing Law">
        <p>These Terms are governed by applicable law. Disputes shall be resolved through binding arbitration or in courts of competent jurisdiction, as applicable.</p>
      </Section>

      <Section title="12. Creator Support">
        <p>Creator Support is a voluntary feature that allows supporters to send contributions directly to creators through their selected payment provider. Creator Support is entirely optional for both creators and supporters.</p>
        <p>During Beta, Creator Support operates in Demo Mode. No real money is processed during Demo Mode. When Creator Support becomes live, support payments will be sent directly to creators using their selected payment provider.</p>
        <p>Everyday Radio does not hold creator support funds, act as a payment processor for creator support transactions, or take a percentage of creator support payments.</p>
        <p>Everyday Radio is not responsible for payment provider outages, delays, or failures. Everyday Radio does not guarantee successful payment processing through third-party providers.</p>
        <p>Supporting a creator does not purchase or transfer:</p>
        <ul className="list-disc list-inside space-y-1 pl-2">
          <li>Ownership rights or investment interests in the creator or their work</li>
          <li>Copyrights, royalties, or licensing rights of any kind</li>
          <li>Commercial rights of any kind</li>
        </ul>
        <p>Supporting a creator does not guarantee communication, services, exclusive content, or future releases unless explicitly offered by that creator through a separate written agreement.</p>
        <p>Creators who enable Creator Support agree to the Creator Agreement and Creator Payments Addendum, both available in the Legal Center.</p>
      </Section>

      <Section title="13. Prohibited Automated Access & Scraping">
        <p><strong className="text-foreground">You may not use automated means to access, collect, or harvest data from the Platform without prior written permission from Cotopia.</strong></p>
        <p>Prohibited activities include, but are not limited to:</p>
        <ul className="list-disc list-inside space-y-1 pl-2">
          <li>Web scraping, crawling, spidering, or indexing any part of the Platform or API</li>
          <li>Using bots, scripts, or automated tools to access content, metadata, user profiles, or any API endpoint</li>
          <li>Systematically downloading, mirroring, or reproducing Platform content</li>
          <li>Bypassing, disabling, or circumventing any rate limit, bot-detection, or access-control mechanism</li>
          <li>Using headless browsers, browser automation tools, or API clients that impersonate legitimate users</li>
          <li>Harvesting creator content, artist metadata, catalog data, or user information for any commercial or competitive purpose</li>
        </ul>
        <p>Cotopia employs technical measures to detect and block automated access. Circumventing these protections is a violation of these Terms and may constitute unauthorized access under applicable computer fraud and abuse laws.</p>
        <p>Violations may result in immediate IP blocking, account termination, and legal action. Cotopia reserves all rights to seek injunctive relief and damages for unauthorized scraping of Platform content.</p>
        <p>If you are a researcher, developer, or data partner with a legitimate use case, contact <a href="mailto:api@cotopia.org" className="text-primary hover:underline">api@cotopia.org</a> to request authorized API access.</p>
      </Section>

      <Section title="14. Changes to Terms">
        <p>We may update these Terms at any time. Material changes will be announced on the Platform. Continued use after changes constitutes acceptance of the new Terms.</p>
      </Section>

      <div className="pt-4 border-t border-border">
        <p className="text-xs text-muted-foreground">Questions? Contact <a href="mailto:legal@cotopia.org" className="text-primary hover:underline">legal@cotopia.org</a></p>
      </div>
    </div>
  );
}

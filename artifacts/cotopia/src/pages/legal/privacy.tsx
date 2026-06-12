import { Link } from "wouter";
import { ChevronLeft } from "lucide-react";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-bold">{title}</h2>
      <div className="text-sm text-muted-foreground leading-relaxed space-y-3">{children}</div>
    </section>
  );
}

export default function PrivacyPolicy() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-10 space-y-8">
      <div className="space-y-1">
        <Link href="/legal" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors mb-3">
          <ChevronLeft className="w-3 h-3" />Legal Center
        </Link>
        <h1 className="text-3xl font-extrabold">Privacy Policy</h1>
        <p className="text-xs text-muted-foreground">Everyday Radio by Cotopia · Version 1.0 · Last updated June 2026</p>
      </div>

      <Section title="1. Information We Collect">
        <p><strong className="text-foreground">Account Information:</strong> Username, email address, password (hashed), role, and profile details you provide during registration or profile updates.</p>
        <p><strong className="text-foreground">Content Data:</strong> Music files, video files, artwork, and metadata you upload to the Platform.</p>
        <p><strong className="text-foreground">Usage Data:</strong> Pages visited, content played, search queries, play counts, favorites, playlist activity, and other interactions with the Platform.</p>
        <p><strong className="text-foreground">Payment Information:</strong> Transaction records associated with submission or promotion fees. We do not store full payment card numbers — payment processing is handled by third-party providers.</p>
        <p><strong className="text-foreground">Communications:</strong> Messages sent via Platform messaging features, comments, and support inquiries.</p>
        <p><strong className="text-foreground">Technical Data:</strong> IP address, browser type, device information, and access timestamps collected automatically when you use the Platform.</p>
      </Section>

      <Section title="2. How We Use Your Information">
        <ul className="list-disc list-inside space-y-1 pl-2">
          <li>Provide, operate, and maintain the Platform and its features</li>
          <li>Process submissions, payments, and account management</li>
          <li>Generate analytics and usage statistics for artists and labels</li>
          <li>Personalize your discovery and recommendation experience</li>
          <li>Communicate with you about your account and Platform updates</li>
          <li>Enforce our Terms of Service and Community Guidelines</li>
          <li>Comply with legal obligations</li>
        </ul>
      </Section>

      <Section title="3. AI and Your Content">
        <p><strong className="text-foreground">Cotopia does not use your uploaded content to train, fine-tune, or develop AI systems.</strong> Your music, videos, artwork, and creative materials are used solely to deliver the Platform's hosting, streaming, and promotion services.</p>
      </Section>

      <Section title="4. Data Sharing">
        <p>We do not sell your personal information to third parties.</p>
        <p>We may share information with:</p>
        <ul className="list-disc list-inside space-y-1 pl-2">
          <li>Service providers who help operate the Platform (hosting, CDN, payment processors) under confidentiality agreements</li>
          <li>Law enforcement or regulatory authorities when required by law or to protect rights and safety</li>
          <li>Successor entities in the event of a merger, acquisition, or sale of assets</li>
        </ul>
        <p>Public content (songs, videos, artist profiles) is visible to all Platform users and may be indexed by search engines.</p>
      </Section>

      <Section title="5. Data Retention">
        <p>We retain your account data for as long as your account is active. Content you upload remains on our servers until you remove it or your account is terminated.</p>
        <p>Payment records and legal agreement acceptances may be retained for up to 7 years for legal and compliance purposes.</p>
        <p>Upon account deletion, we will remove your personal data within 30 days, except where retention is required by law.</p>
      </Section>

      <Section title="6. Your Rights">
        <p>You have the right to:</p>
        <ul className="list-disc list-inside space-y-1 pl-2">
          <li>Access the personal data we hold about you</li>
          <li>Correct inaccurate or incomplete data</li>
          <li>Request deletion of your account and personal data</li>
          <li>Object to or restrict certain processing</li>
          <li>Receive a copy of your data in a portable format</li>
        </ul>
        <p>To exercise these rights, contact us at <a href="mailto:legal@cotopia.com" className="text-primary hover:underline">legal@cotopia.com</a>.</p>
      </Section>

      <Section title="7. Security">
        <p>We implement reasonable technical and organizational measures to protect your data, including encrypted storage and secure transmission. However, no system is completely secure, and we cannot guarantee absolute security.</p>
      </Section>

      <Section title="8. Cookies">
        <p>We use local storage and session tokens to maintain your login state and preferences. We do not use third-party tracking cookies.</p>
      </Section>

      <Section title="9. Changes to This Policy">
        <p>We may update this Privacy Policy from time to time. We will notify you of material changes through the Platform. Continued use after changes constitutes acceptance.</p>
      </Section>

      <div className="pt-4 border-t border-border">
        <p className="text-xs text-muted-foreground">Privacy inquiries: <a href="mailto:legal@cotopia.com" className="text-primary hover:underline">legal@cotopia.com</a></p>
      </div>
    </div>
  );
}

import { Link } from "wouter";
import { ChevronLeft, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-bold">{title}</h2>
      <div className="text-sm text-muted-foreground leading-relaxed space-y-3">{children}</div>
    </section>
  );
}

export default function DmcaPolicy() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-10 space-y-8">
      <div className="space-y-1">
        <Link href="/legal" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors mb-3">
          <ChevronLeft className="w-3 h-3" />Legal Center
        </Link>
        <h1 className="text-3xl font-extrabold">DMCA Policy</h1>
        <p className="text-xs text-muted-foreground">Everyday Radio by Cotopia · Version 1.0 · Last updated June 2026</p>
      </div>

      <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-5 flex gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
        <div className="space-y-2">
          <p className="text-sm font-semibold text-amber-400">To report infringing content</p>
          <p className="text-xs text-muted-foreground">Use our official copyright complaint form. False or bad-faith claims may expose you to legal liability.</p>
          <Link href="/legal/copyright-complaint">
            <Button size="sm" className="mt-1 bg-amber-500 hover:bg-amber-600 text-white text-xs">
              File a Copyright Complaint
            </Button>
          </Link>
        </div>
      </div>

      <Section title="1. Our DMCA Commitment">
        <p>Everyday Radio by Cotopia ("Cotopia") respects intellectual property rights and complies with the Digital Millennium Copyright Act (DMCA), 17 U.S.C. § 512. We respond promptly to valid takedown notices.</p>
      </Section>

      <Section title="2. Designated Copyright Agent">
        <p>Cotopia's designated agent for receiving DMCA notices is:</p>
        <div className="rounded-lg border border-border bg-secondary/30 p-4 space-y-1 text-foreground">
          <p className="font-medium">Cotopia Legal Team</p>
          <p>Email: <a href="mailto:legal@cotopia.com" className="text-primary hover:underline">legal@cotopia.com</a></p>
          <p className="text-xs text-muted-foreground mt-1">Subject line: DMCA Takedown Notice</p>
        </div>
      </Section>

      <Section title="3. What Must Be Included in a Valid Notice">
        <p>To be valid under the DMCA, your notice must include:</p>
        <ul className="list-disc list-inside space-y-1.5 pl-2">
          <li>Your name, address, phone number, and email address</li>
          <li>Identification of the copyrighted work(s) you claim have been infringed</li>
          <li>Identification of the material claimed to be infringing, including its URL on the Platform</li>
          <li>A statement that you have a good-faith belief that the use is not authorized by the copyright owner, its agent, or the law</li>
          <li>A statement that the information in your notice is accurate, under penalty of perjury</li>
          <li>Your physical or electronic signature</li>
        </ul>
      </Section>

      <Section title="4. Our Response Process">
        <p>Upon receiving a valid DMCA notice, we will:</p>
        <ul className="list-disc list-inside space-y-1 pl-2">
          <li>Review the claim and attempt to contact the user who uploaded the content</li>
          <li>Remove or disable access to the allegedly infringing content promptly</li>
          <li>Notify the user of the takedown and their right to file a counter-notice</li>
        </ul>
        <p>Claim statuses: <em>received → under review → removed / rejected / counter-notice received → restored / closed</em>.</p>
      </Section>

      <Section title="5. Counter-Notice Procedure">
        <p>If you believe your content was removed in error, you may submit a counter-notice. A valid counter-notice must include:</p>
        <ul className="list-disc list-inside space-y-1 pl-2">
          <li>Your name, address, and electronic signature</li>
          <li>Identification of the removed material and its prior location</li>
          <li>A statement under penalty of perjury that you have a good-faith belief the material was removed by mistake or misidentification</li>
          <li>Your consent to the jurisdiction of federal court in your district</li>
        </ul>
        <p>Upon receiving a valid counter-notice, we will notify the original claimant. If they do not file a court action within 10–14 business days, we may restore the content.</p>
      </Section>

      <Section title="6. Repeat Infringer Policy">
        <p>Cotopia maintains a repeat infringer policy. Users who receive multiple valid copyright strikes may have their accounts suspended or permanently terminated.</p>
        <p>We track copyright strikes and reserve the right to act at our discretion to protect rights holders and the Platform.</p>
      </Section>

      <Section title="7. Misuse Warning">
        <p>Filing a false or bad-faith DMCA claim is a violation of these policies and may constitute perjury. Cotopia reserves the right to pursue legal action against those who abuse the DMCA process.</p>
      </Section>

      <div className="pt-4 border-t border-border">
        <p className="text-xs text-muted-foreground">DMCA inquiries: <a href="mailto:legal@cotopia.com" className="text-primary hover:underline">legal@cotopia.com</a></p>
      </div>
    </div>
  );
}

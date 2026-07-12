import { Link } from "wouter";
import { Lock, ChevronLeft, Shield, Trash2, Database, AlertTriangle, UserCheck } from "lucide-react";

export default function TrustSecurity() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/50 bg-card/80 backdrop-blur sticky top-0 z-30">
        <div className="max-w-3xl mx-auto px-6 h-14 flex items-center">
          <Link href="/trust">
            <button className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
              <ChevronLeft className="w-4 h-4" />Trust Center
            </button>
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12 pb-20 space-y-10">
        <div>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-lg bg-orange-400/10 flex items-center justify-center">
              <Lock className="w-4.5 h-4.5 text-orange-400" />
            </div>
            <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Security & Privacy</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight mb-3">Security & Privacy</h1>
          <p className="text-muted-foreground leading-relaxed">
            How we protect your account, your data, and your payment information.
          </p>
        </div>

        <div className="space-y-6">
          <div className="p-6 rounded-xl bg-card border border-border space-y-3">
            <div className="flex items-center gap-2"><UserCheck className="w-4 h-4 text-green-400" /><h2 className="font-semibold">Account Protection</h2></div>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2"><span className="text-green-400 mt-0.5">✓</span>Passwords are hashed and never stored in plain text</li>
              <li className="flex items-start gap-2"><span className="text-green-400 mt-0.5">✓</span>Secure JWT token authentication with expiry</li>
              <li className="flex items-start gap-2"><span className="text-green-400 mt-0.5">✓</span>Email verification for new accounts</li>
              <li className="flex items-start gap-2"><span className="text-green-400 mt-0.5">✓</span>Encrypted HTTPS connections</li>
            </ul>
          </div>

          <div className="p-6 rounded-xl bg-card border border-border space-y-3">
            <div className="flex items-center gap-2"><Shield className="w-4 h-4 text-blue-400" /><h2 className="font-semibold">Data Privacy</h2></div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              We collect only the personal data needed to provide the platform. We do not sell personal data to third
              parties. Our Privacy Policy explains in full what we collect, why we collect it, and your rights.
            </p>
            <Link href="/legal/privacy"><button className="mt-2 text-sm text-primary font-semibold hover:underline">Read the Privacy Policy →</button></Link>
          </div>

          <div className="p-6 rounded-xl bg-card border border-border space-y-3">
            <div className="flex items-center gap-2"><Database className="w-4 h-4 text-violet-400" /><h2 className="font-semibold">Payment Information Protection</h2></div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Everyday Radio does not store credit card or banking details. Payment processing is handled by
              trusted third-party providers. During Beta, Creator Support operates in Demo Mode — no real
              payment transactions are processed.
            </p>
          </div>

          <div className="p-6 rounded-xl bg-card border border-border space-y-3">
            <div className="flex items-center gap-2"><Trash2 className="w-4 h-4 text-red-400" /><h2 className="font-semibold">Account Deletion & Data Requests</h2></div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              You can request deletion of your account and associated data at any time. You can also
              request a copy of your personal data or ask us to correct inaccurate information.
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              To submit a data request, contact us through the Contact & Reporting page.
            </p>
            <Link href="/trust/contact"><button className="mt-2 text-sm text-primary font-semibold hover:underline">Contact & Reporting →</button></Link>
          </div>

          <div className="p-6 rounded-xl bg-card border border-border space-y-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-yellow-400" />
              <h2 className="font-semibold">Report a Security Concern</h2>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              If you believe you have found a security vulnerability in Everyday Radio, please contact us
              privately before disclosing publicly. We take security reports seriously.
            </p>
            <Link href="/trust/contact"><button className="mt-2 text-sm text-primary font-semibold hover:underline">Contact us privately →</button></Link>
          </div>

          <div className="p-6 rounded-xl bg-secondary/50 border border-border space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-[11px] bg-muted text-muted-foreground border border-border px-2 py-0.5 rounded font-semibold uppercase tracking-wide">Future</span>
              <h2 className="font-semibold text-muted-foreground">Responsible Disclosure Program</h2>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              A formal responsible disclosure / bug bounty program is planned for a future release.
              Until it is live, please report security concerns through our contact form.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}

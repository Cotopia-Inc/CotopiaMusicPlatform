import { Link } from "wouter";
import { Brain, ChevronLeft, Shield, Lock, Eye, Rss } from "lucide-react";

export default function TrustAI() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/50 bg-card/80 backdrop-blur sticky top-0 z-30">
        <div className="max-w-3xl mx-auto px-6 h-14 flex items-center gap-4">
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
            <div className="w-9 h-9 rounded-lg bg-violet-400/10 flex items-center justify-center">
              <Brain className="w-4.5 h-4.5 text-violet-400" />
            </div>
            <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">AI & Technology</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight mb-3">AI & Technology</h1>
          <p className="text-muted-foreground leading-relaxed">
            Everyday Radio takes a careful, creator-first approach to AI and platform technology.
            This section explains how we currently handle AI, data, and platform protection.
          </p>
        </div>

        <div className="space-y-6">
          <div className="p-6 rounded-xl bg-card border border-border space-y-3">
            <div className="flex items-center gap-2">
              <Brain className="w-4 h-4 text-violet-400" />
              <h2 className="font-semibold">AI Usage Statement</h2>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Everyday Radio does not currently use creator content to train AI systems. Your uploaded
              music, videos, or creative work is not fed into AI training pipelines.
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Any meaningful future change to our AI practices will be disclosed through the
              AI Policy and the AI Change Log before it takes effect.
            </p>
            <Link href="/legal/ai-policy">
              <button className="mt-2 text-sm text-primary font-semibold hover:underline">Read the full AI Content Policy →</button>
            </Link>
          </div>

          <div className="p-6 rounded-xl bg-card border border-border space-y-3">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-green-400" />
              <h2 className="font-semibold">Scraping Protection</h2>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Everyday Radio has temporary anti-scraping protections in place during Beta. These help
              protect creator content and platform data from automated harvesting.
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              We do not publish the implementation details of these protections, as doing so would
              undermine their effectiveness.
            </p>
          </div>

          <div className="p-6 rounded-xl bg-card border border-border space-y-3">
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-orange-400" />
              <h2 className="font-semibold">Data Protection</h2>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Personal data is collected only as needed to provide the platform. We do not sell
              personal data to third parties. See our Privacy Policy for the complete picture.
            </p>
            <Link href="/legal/privacy">
              <button className="mt-2 text-sm text-primary font-semibold hover:underline">Read the Privacy Policy →</button>
            </Link>
          </div>

          <div className="p-6 rounded-xl bg-card border border-border space-y-3">
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-cyan-400" />
              <h2 className="font-semibold">Platform Security</h2>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              We use industry-standard security practices including encrypted connections, secure token
              authentication, and password hashing. We do not expose private security architecture
              or internal vulnerability details.
            </p>
            <Link href="/trust/security">
              <button className="mt-2 text-sm text-primary font-semibold hover:underline">Security & Privacy →</button>
            </Link>
          </div>

          <div className="p-6 rounded-xl bg-card border border-border space-y-3">
            <div className="flex items-center gap-2">
              <Rss className="w-4 h-4 text-yellow-400" />
              <h2 className="font-semibold">Future AI Change Log</h2>
              <span className="text-[10px] bg-amber-500/15 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded font-semibold uppercase tracking-wide">Planned</span>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Any meaningful future changes to how we use AI will be logged here for full
              transparency. This log is currently empty — no AI practice changes have occurred since launch.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}

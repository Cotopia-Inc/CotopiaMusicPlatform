import { Link } from "wouter";
import {
  Shield, Scale, Brain, Mic2, BookOpen, AlertCircle,
  Radio, ListChecks, Clock, Megaphone, MessageCircleHeart,
  Lock, Phone, ChevronRight, Star, FileText, Eye,
} from "lucide-react";

const sections = [
  {
    href: "/trust/principles",
    icon: Star,
    title: "Platform Principles",
    description: "The values that guide every decision we make.",
    color: "text-amber-400",
    bg: "bg-amber-400/10",
  },
  {
    href: "/legal",
    icon: Scale,
    title: "Legal",
    description: "Terms, Privacy Policy, Creator Agreement, and all legal documents.",
    color: "text-blue-400",
    bg: "bg-blue-400/10",
  },
  {
    href: "/trust/ai",
    icon: Brain,
    title: "AI & Technology",
    description: "How we handle AI, data, and platform security.",
    color: "text-violet-400",
    bg: "bg-violet-400/10",
  },
  {
    href: "/trust/creator",
    icon: Mic2,
    title: "Creator Trust",
    description: "Ownership, payments, review process, and creator protections.",
    color: "text-green-400",
    bg: "bg-green-400/10",
  },
  {
    href: "/trust/moderation",
    icon: Shield,
    title: "Content & Moderation",
    description: "Publishing guidelines, review workflow, appeals, and copyright.",
    color: "text-red-400",
    bg: "bg-red-400/10",
  },
  {
    href: "/trust/transparency",
    icon: Eye,
    title: "Platform Transparency",
    description: "Beta status, demo systems, known limitations, and what's live.",
    color: "text-cyan-400",
    bg: "bg-cyan-400/10",
  },
  {
    href: "/trust/security",
    icon: Lock,
    title: "Security & Privacy",
    description: "Account protection, data requests, and responsible disclosure.",
    color: "text-orange-400",
    bg: "bg-orange-400/10",
  },
  {
    href: "/trust/we-heard-you",
    icon: MessageCircleHeart,
    title: "We Heard You",
    description: "How your feedback shapes Everyday Radio.",
    color: "text-pink-400",
    bg: "bg-pink-400/10",
  },
  {
    href: "/trust/release-notes",
    icon: ListChecks,
    title: "Release Notes",
    description: "What we've shipped — features, fixes, and policy updates.",
    color: "text-emerald-400",
    bg: "bg-emerald-400/10",
  },
  {
    href: "/trust/timeline",
    icon: Clock,
    title: "Trust Timeline",
    description: "Key milestones in platform safety, policy, and community.",
    color: "text-indigo-400",
    bg: "bg-indigo-400/10",
  },
  {
    href: "/trust/known-issues",
    icon: AlertCircle,
    title: "Known Issues",
    description: "Reported problems, current status, and workarounds.",
    color: "text-yellow-400",
    bg: "bg-yellow-400/10",
  },
  {
    href: "/trust/contact",
    icon: Phone,
    title: "Contact & Reporting",
    description: "Support, legal, copyright, privacy, and security contacts.",
    color: "text-slate-400",
    bg: "bg-slate-400/10",
  },
];

export default function TrustCenter() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav bar */}
      <header className="border-b border-border/50 bg-card/80 backdrop-blur sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/">
            <div className="flex items-center gap-2 cursor-pointer">
              <img src="/logo.jpg" alt="Everyday Radio" className="w-5 h-5 rounded-sm object-cover" />
              <span className="font-extrabold tracking-tighter text-sm">Everyday Radio</span>
            </div>
          </Link>
          <nav className="flex items-center gap-4 text-sm text-muted-foreground">
            <Link href="/about" className="hover:text-foreground transition-colors">Promise</Link>
            <Link href="/legal" className="hover:text-foreground transition-colors">Legal</Link>
            <Link href="/" className="hover:text-foreground transition-colors">Home</Link>
          </nav>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 pb-20">

        {/* Hero */}
        <section className="py-16 text-center space-y-6">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary text-xs font-semibold px-3 py-1.5 rounded-full uppercase tracking-wider">
            <Radio className="w-3 h-3" />
            Everyday Radio — Trust Center
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight leading-tight">
            Trust should not be<br className="hidden sm:block" /> hidden in the fine print.
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto leading-relaxed">
            Transparency is part of our promise. The Everyday Radio Trust Center brings together our
            policies, platform commitments, safety practices, creator protections, product updates,
            and accountability tools in one place.
          </p>
          <div className="flex flex-wrap gap-3 justify-center pt-2">
            <Link href="/about">
              <button className="flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 rounded-full text-sm font-semibold hover:bg-primary/90 transition-colors">
                <FileText className="w-4 h-4" />
                Read Our Full Promise
              </button>
            </Link>
            <Link href="/trust/appeals">
              <button className="flex items-center gap-2 border border-border bg-card text-foreground px-5 py-2.5 rounded-full text-sm font-semibold hover:bg-secondary transition-colors">
                Submit an Appeal
              </button>
            </Link>
          </div>
        </section>

        {/* Our Commitments */}
        <section className="mb-14 p-8 rounded-2xl bg-primary/5 border border-primary/20">
          <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-4">Our Commitments</p>
          <h2 className="text-xl font-bold mb-5">We do not promise perfection. We promise to keep improving.</h2>
          <ul className="grid sm:grid-cols-2 gap-2 text-sm text-muted-foreground">
            {[
              "We promise to listen.",
              "We promise to communicate openly.",
              "We promise to protect creators' rights.",
              "We promise to respect your data.",
              "We promise to be transparent when we make mistakes.",
              "We promise to keep building Everyday Radio with our community, not just for our community.",
            ].map(c => (
              <li key={c} className="flex items-start gap-2">
                <span className="text-primary mt-0.5 flex-shrink-0">✦</span>
                {c}
              </li>
            ))}
          </ul>
        </section>

        {/* Our Promise summary */}
        <section className="mb-14 p-8 rounded-2xl bg-card border border-border">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Megaphone className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Our Promise</p>
              <h2 className="text-lg font-bold mb-2">Creator ownership, community, transparency.</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Everyday Radio was built around a commitment to creator ownership, community, transparency,
                responsible technology, and open communication.
              </p>
              <Link href="/about">
                <button className="mt-4 flex items-center gap-1.5 text-sm text-primary font-semibold hover:underline">
                  Read Our Full Promise <ChevronRight className="w-4 h-4" />
                </button>
              </Link>
            </div>
          </div>
        </section>

        {/* Section grid */}
        <section>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-6">All Trust Center Sections</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {sections.map(({ href, icon: Icon, title, description, color, bg }) => (
              <Link key={href} href={href}>
                <div className="group h-full p-5 rounded-xl bg-card border border-border hover:border-primary/30 hover:bg-primary/5 transition-all cursor-pointer flex flex-col gap-3">
                  <div className={`w-9 h-9 rounded-lg ${bg} flex items-center justify-center flex-shrink-0`}>
                    <Icon className={`w-4.5 h-4.5 ${color}`} />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-sm mb-1 group-hover:text-primary transition-colors">{title}</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-primary transition-colors self-end" />
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* Beta notice */}
        <section className="mt-14 p-6 rounded-xl bg-amber-500/10 border border-amber-500/30 text-center">
          <p className="text-sm font-semibold text-amber-400 mb-1">Everyday Radio is live in Beta</p>
          <p className="text-xs text-muted-foreground max-w-lg mx-auto">
            Features, policies, and the Trust Center itself are evolving. Some sections may be incomplete or subject to change.
            Thank you for being part of our early community.
          </p>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/50 bg-card/50">
        <div className="max-w-5xl mx-auto px-6 py-8 flex flex-wrap gap-4 items-center justify-between">
          <p className="text-xs text-muted-foreground">© 2026 Everyday Radio. All rights reserved.</p>
          <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
            <Link href="/about" className="hover:text-foreground transition-colors">Promise</Link>
            <Link href="/legal" className="hover:text-foreground transition-colors">Legal</Link>
            <Link href="/trust/appeals" className="hover:text-foreground transition-colors">Appeals</Link>
            <Link href="/contact" className="hover:text-foreground transition-colors">Contact</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

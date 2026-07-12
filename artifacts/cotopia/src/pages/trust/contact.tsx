import { Link } from "wouter";
import { Phone, ChevronLeft, MessageSquare, Scale, Shield, Copyright, Flag, AlertTriangle, Lightbulb, Bug } from "lucide-react";

const contacts = [
  {
    icon: MessageSquare,
    title: "General Support",
    desc: "Questions about your account, uploads, playback, or how the platform works.",
    links: [{ label: "Contact Page", href: "/contact" }],
    color: "text-blue-400", bg: "bg-blue-400/10",
  },
  {
    icon: Flag,
    title: "Appeals",
    desc: "Request a review of a content rejection, account restriction, badge removal, or other platform action.",
    links: [{ label: "Submit an Appeal", href: "/trust/appeals" }],
    color: "text-red-400", bg: "bg-red-400/10",
  },
  {
    icon: Copyright,
    title: "Copyright & DMCA",
    desc: "Report copyright infringement or submit a DMCA takedown notice.",
    links: [
      { label: "DMCA Policy", href: "/legal/dmca" },
      { label: "File a Copyright Complaint", href: "/legal/copyright-complaint" },
    ],
    color: "text-orange-400", bg: "bg-orange-400/10",
  },
  {
    icon: Scale,
    title: "Legal Questions",
    desc: "Questions about our Terms of Service, policies, or legal compliance.",
    links: [
      { label: "Legal Center", href: "/legal" },
      { label: "Contact Page", href: "/contact" },
    ],
    color: "text-violet-400", bg: "bg-violet-400/10",
  },
  {
    icon: Shield,
    title: "Privacy Questions",
    desc: "Data requests, privacy concerns, or questions about how your information is used.",
    links: [
      { label: "Privacy Policy", href: "/legal/privacy" },
      { label: "Contact Page", href: "/contact" },
    ],
    color: "text-green-400", bg: "bg-green-400/10",
  },
  {
    icon: AlertTriangle,
    title: "Security Concerns",
    desc: "Report a suspected vulnerability or security issue — privately, before public disclosure.",
    links: [{ label: "Contact Page", href: "/contact" }],
    color: "text-yellow-400", bg: "bg-yellow-400/10",
  },
  {
    icon: Bug,
    title: "Bug Reports",
    desc: "Found something broken? Let us know so we can fix it.",
    links: [{ label: "Report a Bug", href: "/report-bug" }],
    color: "text-red-400", bg: "bg-red-400/10",
  },
  {
    icon: Lightbulb,
    title: "Feature Suggestions",
    desc: "Have an idea that would make Everyday Radio better? We want to hear it.",
    links: [{ label: "Suggest a Feature", href: "/suggest-feature" }],
    color: "text-amber-400", bg: "bg-amber-400/10",
  },
];

export default function TrustContact() {
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
            <div className="w-9 h-9 rounded-lg bg-slate-400/10 flex items-center justify-center">
              <Phone className="w-4.5 h-4.5 text-slate-400" />
            </div>
            <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Contact & Reporting</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight mb-3">Contact & Reporting</h1>
          <p className="text-muted-foreground leading-relaxed">
            Find the right path for your question, report, or request.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {contacts.map(({ icon: Icon, title, desc, links, color, bg }) => (
            <div key={title} className="p-5 rounded-xl bg-card border border-border flex flex-col gap-3">
              <div className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center flex-shrink-0`}>
                <Icon className={`w-4 h-4 ${color}`} />
              </div>
              <div className="flex-1">
                <h2 className="font-semibold text-sm mb-1">{title}</h2>
                <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {links.map(({ label, href }) => (
                  <Link key={href} href={href}>
                    <button className="text-xs text-primary font-semibold hover:underline">{label} →</button>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="p-6 rounded-xl bg-primary/5 border border-primary/20 text-center">
          <p className="text-sm text-muted-foreground">
            Not sure which option fits? Start with the{" "}
            <Link href="/contact"><span className="text-primary font-semibold hover:underline cursor-pointer">Contact Page</span></Link> and describe your situation — we will route your request to the right team.
          </p>
        </div>
      </main>
    </div>
  );
}

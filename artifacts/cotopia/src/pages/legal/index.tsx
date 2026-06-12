import { Link } from "wouter";
import { Scale, Shield, Copyright, Users, Brain, RotateCcw, FileCheck, AlertTriangle, ChevronRight, Radio } from "lucide-react";

const policies = [
  {
    href: "/legal/terms",
    title: "Terms of Service",
    description: "Rules governing your use of the Everyday Radio platform.",
    icon: Scale,
  },
  {
    href: "/legal/privacy",
    title: "Privacy Policy",
    description: "How we collect, use, and protect your personal information.",
    icon: Shield,
  },
  {
    href: "/legal/dmca",
    title: "DMCA Policy",
    description: "Our Digital Millennium Copyright Act compliance and takedown procedures.",
    icon: Copyright,
  },
  {
    href: "/legal/community-guidelines",
    title: "Community Guidelines",
    description: "Standards for content and behavior on the platform.",
    icon: Users,
  },
  {
    href: "/legal/ai-policy",
    title: "AI Content Policy",
    description: "Rules for uploading AI-generated and AI-assisted creative content.",
    icon: Brain,
  },
  {
    href: "/legal/refund-policy",
    title: "Refund Policy",
    description: "Terms for submission fees, promotion fees, and chargebacks.",
    icon: RotateCcw,
  },
  {
    href: "/legal/submission-agreement",
    title: "Submission Agreement",
    description: "The license agreement covering all content submitted to the platform.",
    icon: FileCheck,
  },
  {
    href: "/legal/copyright-complaint",
    title: "File a Copyright Complaint",
    description: "Submit a DMCA takedown notice for infringing content.",
    icon: AlertTriangle,
  },
];

export default function LegalCenter() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-10 space-y-8">
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Radio className="w-3.5 h-3.5" />
          <span>Everyday Radio by Cotopia</span>
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight">Legal Center</h1>
        <p className="text-muted-foreground max-w-xl">
          Policies, terms, and legal documents governing your use of Everyday Radio by Cotopia.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {policies.map(({ href, title, description, icon: Icon }) => (
          <Link key={href} href={href}>
            <div className="group flex items-start gap-4 p-5 rounded-xl border border-border bg-card hover:border-primary/50 hover:bg-card/80 transition-all cursor-pointer">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/20 transition-colors">
                <Icon className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-semibold text-sm">{title}</h3>
                  <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                </div>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{description}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-card/50 p-6 space-y-2">
        <h2 className="font-semibold text-sm">Questions or concerns?</h2>
        <p className="text-xs text-muted-foreground leading-relaxed">
          For legal inquiries, DMCA notices, or policy questions, contact us at{" "}
          <a href="mailto:legal@cotopia.com" className="text-primary hover:underline">legal@cotopia.com</a>.
          For copyright disputes, please use the{" "}
          <Link href="/legal/copyright-complaint" className="text-primary hover:underline">copyright complaint form</Link>.
        </p>
      </div>

      <p className="text-xs text-muted-foreground text-center pb-4">
        Everyday Radio by Cotopia · Powered by Cotopia
      </p>
    </div>
  );
}

import { Link } from "wouter";
import { Star, ChevronLeft } from "lucide-react";

const principles = [
  { n: 1, title: "Creators retain ownership of their work.", detail: "We will never claim ownership of content you upload. Your music, your videos, your creative work — they belong to you." },
  { n: 2, title: "We communicate openly.", detail: "When things change, when we make mistakes, or when we have news, we tell our community directly." },
  { n: 3, title: "Transparency builds trust.", detail: "We aim to be clear about how decisions are made, how content is reviewed, and how data is used." },
  { n: 4, title: "Community matters.", detail: "Everyday Radio exists because of creators and listeners. Their feedback shapes the platform." },
  { n: 5, title: "AI should support creators, not exploit them.", detail: "We do not use creator content to train AI systems. Any change to this position will be disclosed." },
  { n: 6, title: "Feedback helps shape the platform.", detail: "We actively listen to bug reports, feature suggestions, and experience feedback — and we act on them." },
  { n: 7, title: "Innovation should be responsible.", detail: "New features are considered carefully, with creator safety and community well-being in mind." },
  { n: 8, title: "Privacy and security come first.", detail: "We protect your data, your payment information, and your account with appropriate security measures." },
  { n: 9, title: "Support for creators should be clear and voluntary.", detail: "Creator Support is a voluntary system. Supporters choose what to give. No hidden fees or deceptive practices." },
  { n: 10, title: "We will explain meaningful platform changes.", detail: "Significant changes to features, policies, or our AI practices will be communicated clearly and in advance where possible." },
];

export default function TrustPrinciples() {
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

      <main className="max-w-3xl mx-auto px-6 py-12 pb-20">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-lg bg-amber-400/10 flex items-center justify-center">
            <Star className="w-4.5 h-4.5 text-amber-400" />
          </div>
          <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Platform Principles</span>
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight mb-3">Our Platform Principles</h1>
        <p className="text-muted-foreground mb-10 leading-relaxed">
          These principles guide how Everyday Radio develops features, reviews content, communicates with
          the community, and makes platform decisions.
        </p>

        <div className="space-y-5">
          {principles.map(({ n, title, detail }) => (
            <div key={n} className="flex gap-5 p-6 rounded-xl bg-card border border-border">
              <div className="w-8 h-8 rounded-full bg-primary/10 text-primary text-sm font-bold flex items-center justify-center flex-shrink-0">
                {n}
              </div>
              <div>
                <p className="font-semibold mb-1">{title}</p>
                <p className="text-sm text-muted-foreground leading-relaxed">{detail}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-12 p-6 rounded-xl bg-primary/5 border border-primary/20">
          <p className="text-sm text-muted-foreground leading-relaxed">
            These principles are not marketing language. They are the commitments we hold ourselves to as we build
            Everyday Radio. If you feel we have fallen short of any of them, we want to hear from you.
          </p>
          <Link href="/trust/contact">
            <button className="mt-4 text-sm text-primary font-semibold hover:underline">Contact us →</button>
          </Link>
        </div>
      </main>
    </div>
  );
}

import { Link } from "wouter";
import { Heart, Users, Lightbulb, Shield, ArrowRight, Music, Video, Globe, MessageCircle, TrendingUp, Star, LogIn, UserPlus, Check, Headphones, Play } from "lucide-react";
import { useSeo } from "@/hooks/use-seo";

interface AboutProps {
  showAuthNav?: boolean;
}

export default function About({ showAuthNav = false }: AboutProps) {
  useSeo({
    title: "Everyday Radio by Cotopia — Discover. Create. Support.",
    description: "Everyday Radio is a creator-first discovery and community platform where independent creators share music, videos, podcasts, and original content while building lasting relationships with their audiences.",
  });

  return (
    <div className="min-h-screen bg-background text-foreground">
      {showAuthNav && (
        <div className="sticky top-0 z-30 flex items-center justify-between px-4 sm:px-6 py-3 border-b border-border/50 bg-background/80 backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <img src="/logo.jpg" alt="Cotopia" className="w-6 h-6 rounded-sm object-cover flex-shrink-0" />
            <span className="text-sm font-semibold tracking-tight">Everyday Radio by Cotopia</span>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/login">
              <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-foreground hover:bg-secondary transition-colors">
                <LogIn className="w-3.5 h-3.5" />
                Sign In
              </button>
            </Link>
            <Link href="/register">
              <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
                <UserPlus className="w-3.5 h-3.5" />
                Become a Creator
              </button>
            </Link>
          </div>
        </div>
      )}

      {/* Hero / Promise */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-background to-background" />
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=2070&auto=format&fit=crop')] bg-cover bg-center opacity-5" />
        <div className="relative max-w-4xl mx-auto px-6 py-24 text-center space-y-6">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium mb-2">
            <img src="/logo.jpg" alt="Cotopia" className="w-4 h-4 rounded-sm object-cover flex-shrink-0" />
            Everyday Radio by Cotopia
          </div>
          <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight leading-none">
            Our Promise
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Everyday Radio was built because too many creators feel overlooked, unheard, restricted, or pushed aside.
          </p>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            We believe great music, videos, stories, interviews, and creative works can come from anyone, anywhere.
          </p>
          <p className="text-base text-muted-foreground/80 max-w-2xl mx-auto leading-relaxed">
            Whether you're an independent artist, an emerging label, a content creator, an AI creator, a producer, a filmmaker, or simply someone with a vision — you deserve a place to be discovered.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
            <Link href="/register">
              <button className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-lg font-semibold hover:bg-primary/90 transition-colors">
                Become a Creator <ArrowRight className="w-4 h-4" />
              </button>
            </Link>
            <Link href="/discover">
              <button className="inline-flex items-center gap-2 px-6 py-3 bg-secondary text-secondary-foreground rounded-lg font-semibold hover:bg-secondary/80 transition-colors">
                Start Discovering
              </button>
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 pb-24 space-y-20">

        {/* Discover. Create. Support. */}
        <section className="space-y-8">
          <div className="text-center space-y-3">
            <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight leading-tight">
              Discover.<br />Create.<br />Support.
            </h2>
            <div className="w-12 h-0.5 bg-primary mx-auto rounded-full" />
            <p className="text-base text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              Everyday Radio is a creator-first discovery and community platform where independent creators publish music, videos, podcasts, and original content while building lasting relationships with their audiences.
            </p>
          </div>
          <div className="grid sm:grid-cols-3 gap-5">
            <div className="flex flex-col gap-4 p-6 rounded-xl bg-card border border-border hover:border-primary/30 transition-colors">
              <div className="text-3xl">🎵</div>
              <h3 className="text-lg font-bold">Discover</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">Discover independent music, videos, podcasts, and creators before everyone else.</p>
            </div>
            <div className="flex flex-col gap-4 p-6 rounded-xl bg-card border border-border hover:border-primary/30 transition-colors">
              <div className="text-3xl">🤝</div>
              <h3 className="text-lg font-bold">Connect</h3>
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li>Follow creators.</li>
                <li>Join conversations.</li>
                <li>Build playlists.</li>
                <li>Earn badges.</li>
                <li>Become part of a growing creator community.</li>
              </ul>
            </div>
            <div className="flex flex-col gap-4 p-6 rounded-xl bg-card border border-border hover:border-primary/30 transition-colors">
              <div className="text-3xl">💙</div>
              <h3 className="text-lg font-bold">Support</h3>
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li>Support creators directly.</li>
                <li>Help independent creators continue building amazing content and lasting communities.</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Featured Founding Creator — Asia Qu */}
        <section className="space-y-6">
          <div className="relative rounded-2xl overflow-hidden border border-primary/20 bg-gradient-to-br from-primary/10 via-card to-card">
            <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?q=80&w=2070&auto=format&fit=crop')] bg-cover bg-center opacity-[0.04]" />
            <div className="relative p-8 md:p-10 space-y-5">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-400/10 border border-amber-400/20 text-amber-400 text-xs font-semibold uppercase tracking-wider">
                <Star className="w-3.5 h-3.5" />
                Featured Founding Creator
              </div>
              <div className="space-y-2">
                <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight">Meet Asia Qu</h2>
                <p className="text-base text-muted-foreground max-w-xl leading-relaxed">
                  Asia Qu is one of the creators helping shape the future of Everyday Radio.
                </p>
                <p className="text-sm text-muted-foreground/80 max-w-xl leading-relaxed">
                  Discover her music, follow her journey, and see what creator-first publishing looks like.
                </p>
              </div>
              <div className="flex flex-wrap gap-3 pt-2">
                <Link href="/songs/37">
                  <button className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-lg font-semibold hover:bg-primary/90 transition-colors text-sm">
                    <Play className="w-4 h-4 fill-current" />
                    Listen to Asia Qu
                  </button>
                </Link>
                <Link href="/videos/21">
                  <button className="inline-flex items-center gap-2 px-5 py-2.5 bg-secondary text-secondary-foreground rounded-lg font-semibold hover:bg-secondary/80 transition-colors border border-border text-sm">
                    View Creator Profile
                  </button>
                </Link>
              </div>
              <a
                href="https://cotopia.org/artists/9"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block text-xs text-muted-foreground hover:text-primary underline underline-offset-4 transition-colors"
              >
                https://cotopia.org/artists/9
              </a>
            </div>
          </div>
        </section>

        {/* What We Believe */}
        <section className="space-y-8">
          <div className="text-center space-y-2">
            <h2 className="text-3xl font-bold tracking-tight">What We Believe</h2>
            <div className="w-12 h-0.5 bg-primary mx-auto rounded-full" />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            {[
              { icon: Star, text: "Creators should have opportunities." },
              { icon: Music, text: "Independent artists matter." },
              { icon: Users, text: "Communities matter." },
              { icon: Globe, text: "Discovery should be open." },
              { icon: Lightbulb, text: "Technology should empower creators, not replace them." },
              { icon: Shield, text: "AI can be a creative tool when used responsibly and legally." },
              { icon: Heart, text: "Music and media should bring people together." },
            ].map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-start gap-4 p-5 rounded-xl bg-card border border-border hover:border-primary/30 transition-colors">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Icon className="w-4 h-4 text-primary" />
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">We believe {text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* What Everyday Radio Is */}
        <section className="space-y-8">
          <div className="text-center space-y-2">
            <h2 className="text-3xl font-bold tracking-tight">What Everyday Radio Is</h2>
            <div className="w-12 h-0.5 bg-primary mx-auto rounded-full" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { icon: Music, label: "Music" },
              { icon: Video, label: "Videos" },
              { icon: Star, label: "Creative Media" },
              { icon: Globe, label: "Discovery" },
              { icon: Users, label: "Community" },
              { icon: MessageCircle, label: "Conversation" },
              { icon: TrendingUp, label: "Promotion" },
              { icon: Lightbulb, label: "Growth" },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="flex flex-col items-center gap-2 p-5 rounded-xl bg-card border border-border text-center">
                <Icon className="w-6 h-6 text-primary" />
                <span className="text-sm font-medium">{label}</span>
              </div>
            ))}
          </div>
          <div className="grid sm:grid-cols-3 gap-4 pt-2">
            {[
              "Every song can have a community.",
              "Every creator can build an audience.",
              "Every creator can discover something new.",
            ].map(text => (
              <div key={text} className="p-5 rounded-xl bg-primary/5 border border-primary/15 text-center">
                <p className="text-sm font-medium text-primary/90">{text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* What Makes Us Different */}
        <section className="space-y-8">
          <div className="text-center space-y-2">
            <h2 className="text-3xl font-bold tracking-tight">What Makes Us Different</h2>
            <div className="w-12 h-0.5 bg-primary mx-auto rounded-full" />
          </div>
          <div className="grid sm:grid-cols-2 gap-6">
            <div className="space-y-3 p-6 rounded-xl bg-red-500/5 border border-red-500/20">
              <h3 className="text-sm font-semibold text-red-400 uppercase tracking-wider">Not Focused On</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                {["Gatekeepers", "Industry politics", "Limiting creativity"].map(item => (
                  <li key={item} className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500/50 flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="space-y-3 p-6 rounded-xl bg-green-500/5 border border-green-500/20">
              <h3 className="text-sm font-semibold text-green-400 uppercase tracking-wider">Focused On</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                {["Tools, visibility, opportunity, and community", "Original creators", "AI creators", "Independent artists", "Independent labels", "People building something from the ground up"].map(item => (
                  <li key={item} className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500/50 flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* Three pillars */}
        <section className="space-y-8">
          <div className="grid sm:grid-cols-3 gap-6">
            <div className="space-y-4 p-6 rounded-xl bg-card border border-border">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Shield className="w-5 h-5 text-primary" />
              </div>
              <h3 className="text-lg font-bold">Ownership Matters</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>Creators keep ownership of their work.</li>
                <li>Creators should understand their rights and responsibilities.</li>
                <li>Transparency is important.</li>
                <li>Trust is earned.</li>
              </ul>
            </div>
            <div className="space-y-4 p-6 rounded-xl bg-card border border-border">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Users className="w-5 h-5 text-primary" />
              </div>
              <h3 className="text-lg font-bold">Community First</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>Everyday Radio is more than a streaming platform — it is a community.</li>
                <li>We encourage conversation, collaboration, discovery, and mutual respect.</li>
                <li>Every user helps shape the future of the platform.</li>
              </ul>
            </div>
            <div className="space-y-4 p-6 rounded-xl bg-card border border-border">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Lightbulb className="w-5 h-5 text-primary" />
              </div>
              <h3 className="text-lg font-bold">Innovation Matters</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>Technology changes. Media changes. Creativity evolves.</li>
                <li>We are committed to adapting, improving, and exploring new technologies.</li>
                <li>Always while supporting creators and protecting platform integrity.</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Our Commitment */}
        <section className="space-y-6">
          <div className="text-center space-y-2">
            <h2 className="text-3xl font-bold tracking-tight">Our Commitment</h2>
            <div className="w-12 h-0.5 bg-primary mx-auto rounded-full" />
          </div>
          <div className="p-8 rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 space-y-4">
            <ul className="space-y-3">
              {[
                "We will continue building tools that help creators grow.",
                "We will continue listening to our community.",
                "We will continue creating opportunities for discovery.",
                "We will continue supporting independent voices.",
                "And we will continue working to make Everyday Radio a place where creators and communities can thrive together.",
              ].map(item => (
                <li key={item} className="flex items-start gap-3 text-sm text-muted-foreground leading-relaxed">
                  <Heart className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Why Join the Beta */}
        <section className="space-y-8">
          <div className="text-center space-y-2">
            <h2 className="text-3xl font-bold tracking-tight">Why Join the Beta?</h2>
            <div className="w-12 h-0.5 bg-primary mx-auto rounded-full" />
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            {[
              "Help shape Everyday Radio",
              "Discover amazing creators",
              "Become a Founding Creator",
              "Build your audience",
              "Earn exclusive Beta badges",
              "Help improve future features",
              "Join a creator-first community",
            ].map(item => (
              <div key={item} className="flex items-center gap-3 p-4 rounded-xl bg-card border border-border hover:border-primary/30 transition-colors">
                <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Check className="w-3.5 h-3.5 text-primary" />
                </div>
                <span className="text-sm font-medium">{item}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Built for Creators. Powered by Community. */}
        <section className="space-y-6">
          <div className="text-center space-y-2">
            <h2 className="text-3xl font-bold tracking-tight leading-tight">
              Built for Creators.<br />Powered by Community.
            </h2>
            <div className="w-12 h-0.5 bg-primary mx-auto rounded-full" />
          </div>
          <div className="p-8 rounded-2xl bg-card border border-border space-y-4">
            <p className="text-sm text-muted-foreground leading-relaxed">
              Everyday Radio was built to help creators grow.
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Whether you're making music, videos, podcasts, or original content, you'll have a place to publish, connect with supporters, and build your community.
            </p>
          </div>
        </section>

        {/* Support Independent Creators */}
        <section className="space-y-8">
          <div className="text-center space-y-2">
            <h2 className="text-3xl font-bold tracking-tight">Support Independent Creators</h2>
            <div className="w-12 h-0.5 bg-primary mx-auto rounded-full" />
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { icon: Users, text: "Every follow." },
              { icon: MessageCircle, text: "Every comment." },
              { icon: Globe, text: "Every conversation." },
              { icon: TrendingUp, text: "Every share." },
              { icon: Heart, text: "Every supporter." },
              { icon: Headphones, text: "Helps creators continue doing what they love." },
            ].map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-start gap-3 p-5 rounded-xl bg-card border border-border hover:border-primary/30 transition-colors">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Icon className="w-4 h-4 text-primary" />
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">{text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Founding Creator callout */}
        <section className="space-y-6">
          <div className="p-8 md:p-10 rounded-2xl bg-gradient-to-br from-primary/15 via-primary/5 to-background border border-primary/25 text-center space-y-5">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-semibold uppercase tracking-wider">
              <Star className="w-3.5 h-3.5" />
              Founding Creator
            </div>
            <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight">Become a Founding Creator</h2>
            <p className="text-base text-muted-foreground max-w-xl mx-auto leading-relaxed">
              Join Everyday Radio during Beta and become part of the platform's foundation.
            </p>
            <p className="text-sm text-muted-foreground max-w-xl mx-auto leading-relaxed">
              Early creators will help shape future features, test new tools, and earn exclusive Founding Creator recognition.
            </p>
            <div className="pt-2">
              <Link href="/register">
                <button className="inline-flex items-center gap-2 px-7 py-3 bg-primary text-primary-foreground rounded-lg font-semibold hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20">
                  Become a Creator <ArrowRight className="w-4 h-4" />
                </button>
              </Link>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="text-center space-y-6 py-8 border-t border-border/30">
          <p className="text-2xl font-bold">Ready to Join?</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/register">
              <button className="inline-flex items-center gap-2 px-7 py-3 bg-primary text-primary-foreground rounded-lg font-semibold hover:bg-primary/90 transition-colors">
                <UserPlus className="w-4 h-4" />
                Become a Creator
              </button>
            </Link>
            <Link href="/login">
              <button className="inline-flex items-center gap-2 px-7 py-3 bg-secondary text-secondary-foreground rounded-lg font-semibold hover:bg-secondary/80 transition-colors border border-border">
                <LogIn className="w-4 h-4" />
                Sign In
              </button>
            </Link>
          </div>
          <div className="pt-4 space-y-3">
            <div className="flex items-center justify-center gap-2">
              <img src="/logo.jpg" alt="Cotopia" className="w-4 h-4 rounded-sm object-cover flex-shrink-0" />
              <span className="text-sm font-semibold">Everyday Radio by Cotopia</span>
            </div>
            <p className="text-xs text-muted-foreground/50">Powered by Cotopia.</p>
            <div className="flex flex-wrap items-center justify-center gap-4 gap-y-2 pt-2">
              <Link href="/register" className="text-xs text-primary hover:underline font-medium">Get Started</Link>
              <Link href="/discover" className="text-xs text-muted-foreground hover:text-foreground transition-colors">Discover Music</Link>
              <Link href="/company" className="text-xs text-muted-foreground hover:text-foreground transition-colors">Company Hub</Link>
              <Link href="/legal" className="text-xs text-muted-foreground hover:text-foreground transition-colors">Legal Center</Link>
            </div>
          </div>
        </section>

      </div>
    </div>
  );
}

import { Mail, Globe, Github, Instagram, ArrowLeft, Home } from "lucide-react";
import { Link } from "wouter";

const XIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current" aria-hidden>
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.748l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

const PinterestIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current" aria-hidden>
    <path d="M12 0C5.373 0 0 5.373 0 12c0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738a.36.36 0 0 1 .083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.632-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0z" />
  </svg>
);

interface ContactCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  href: string;
  description?: string;
}

function ContactCard({ icon, label, value, href, description }: ContactCardProps) {
  return (
    <a
      href={href}
      target={href.startsWith("mailto:") ? undefined : "_blank"}
      rel="noopener noreferrer"
      className="group flex items-start gap-4 p-4 rounded-xl border border-border bg-card hover:bg-secondary/40 hover:border-primary/30 transition-all"
    >
      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary flex-shrink-0 group-hover:bg-primary/20 transition-colors">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-0.5">{label}</p>
        <p className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors truncate">{value}</p>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </div>
    </a>
  );
}

export default function Contact() {
  return (
    <div className="max-w-2xl mx-auto space-y-10 pb-24">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-primary">
          <img src="/logo.jpg" alt="Cotopia" className="w-5 h-5 rounded-sm object-cover flex-shrink-0" />
          <span className="text-xs font-bold tracking-widest uppercase">Everyday Radio</span>
        </div>
        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">Contact Us</h1>
        <p className="text-muted-foreground">Get in touch with the Cotopia team — we're here to help.</p>
      </div>

      {/* Email */}
      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground px-1">Email</h2>
        <div className="space-y-3">
          <ContactCard
            icon={<Mail className="w-5 h-5" />}
            label="General Support"
            value="support@cotopia.org"
            href="mailto:support@cotopia.org"
            description="Billing, account issues, technical help"
          />
          <ContactCard
            icon={<Mail className="w-5 h-5" />}
            label="Legal"
            value="legal@cotopia.org"
            href="mailto:legal@cotopia.org"
            description="DMCA notices, licensing, compliance"
          />
        </div>
      </section>

      {/* Website */}
      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground px-1">Website</h2>
        <ContactCard
          icon={<Globe className="w-5 h-5" />}
          label="Official Site"
          value="cotopia.shop"
          href="https://cotopia.shop"
          description="Shop, merch, and more"
        />
      </section>

      {/* Social */}
      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground px-1">Follow Us</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <ContactCard
            icon={<Instagram className="w-5 h-5" />}
            label="Instagram"
            value="@cotopia_inc"
            href="https://www.instagram.com/cotopia_inc/"
          />
          <ContactCard
            icon={<XIcon />}
            label="X / Twitter"
            value="@Cotopia_Inc"
            href="https://x.com/Cotopia_Inc"
          />
          <ContactCard
            icon={<PinterestIcon />}
            label="Pinterest"
            value="cotopia"
            href="https://www.pinterest.com/cotopia/"
          />
          <ContactCard
            icon={<Github className="w-5 h-5" />}
            label="GitHub"
            value="Cotopia-Inc"
            href="https://github.com/Cotopia-Inc/CotopiaMusicPlatform"
            description="Open source & transparency"
          />
        </div>
      </section>

      <div className="p-4 rounded-xl border border-border bg-secondary/20 text-sm text-muted-foreground">
        Response times vary. For urgent account issues, email <a href="mailto:support@cotopia.org" className="text-primary hover:underline">support@cotopia.org</a> directly — we aim to respond within 1–2 business days.
      </div>
    </div>
  );
}

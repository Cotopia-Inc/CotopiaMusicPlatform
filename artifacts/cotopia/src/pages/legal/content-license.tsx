import { Link } from "wouter";
import { ChevronLeft, Home } from "lucide-react";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-bold">{title}</h2>
      <div className="text-sm text-muted-foreground leading-relaxed space-y-3">{children}</div>
    </section>
  );
}

export default function ContentLicense() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-10 space-y-8">
      <div className="space-y-1">
        <div className="flex items-center gap-3 mb-3">
          <Link href="/" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
            <Home className="w-3 h-3" />Home
          </Link>
          <span className="text-muted-foreground/30 text-xs">·</span>
          <Link href="/legal" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
            <ChevronLeft className="w-3 h-3" />Legal Center
          </Link>
        </div>
        <h1 className="text-3xl font-extrabold">Content License and Rights Grant</h1>
        <p className="text-xs text-muted-foreground">Everyday Radio by Cotopia · Version 1.0 · Last updated June 2026</p>
      </div>

      <Section title="1. Overview">
        <p>
          This Content License and Rights Grant ("License") governs all Content you upload, submit, post, transmit, display, store, share, generate, or make available through Everyday Radio by Cotopia ("the Service"). By using the Service, you grant Cotopia the rights described in this document.
        </p>
        <p>
          <strong className="text-foreground">You retain full ownership of your Content.</strong> This License does not transfer ownership — it grants Cotopia and its affiliates the rights necessary to operate, distribute, and promote the Service.
        </p>
      </Section>

      <Section title="2. Definition of Content">
        <p>"Content" means anything uploaded, submitted, posted, transmitted, displayed, stored, shared, generated, or made available through the Service, including but not limited to:</p>
        <ul className="list-disc list-inside space-y-1 pl-2 columns-1 sm:columns-2">
          <li>Music, songs, audio recordings, and sound recordings</li>
          <li>Beats, instrumentals, and vocals</li>
          <li>Albums and EPs</li>
          <li>Playlists</li>
          <li>Music videos and video recordings</li>
          <li>Livestreams, interviews, and podcasts</li>
          <li>Artwork, cover art, photographs, images, and graphics</li>
          <li>Logos, branding, and promotional materials</li>
          <li>Text, comments, and chat messages</li>
          <li>Private messages and direct communications</li>
          <li>Reports, reviews, and ratings</li>
          <li>User profiles, usernames, and display names</li>
          <li>Biographies, metadata, tags, and descriptions</li>
          <li>Name, image, likeness, persona, signature, trademarks, and publicity rights</li>
          <li>Voice recordings</li>
          <li>AI-generated and AI-assisted content</li>
          <li>Any other materials submitted to or made available through the Service</li>
        </ul>
      </Section>

      <Section title="3. Rights Grant">
        <p>
          By uploading, posting, submitting, transmitting, storing, sharing, displaying, or otherwise providing Content through the Service, you grant <strong className="text-foreground">Everyday Radio, Cotopia, Cotopia Music &amp; Marketing, their parents, subsidiaries, affiliates, successors, assigns, contractors, partners, licensees, sublicensees, service providers, and future affiliated entities</strong> a worldwide, perpetual, irrevocable, non-exclusive, royalty-free, fully-paid, transferable, sublicensable license to:
        </p>
        <ul className="list-disc list-inside space-y-1 pl-2">
          <li>Host, store, cache, archive, and reproduce the Content</li>
          <li>Stream, perform, display, and transmit the Content to users</li>
          <li>Distribute and make the Content available publicly or privately</li>
          <li>Promote, feature, advertise, and market the Content</li>
          <li>Recommend the Content through playlists, discovery features, and editorial placements</li>
          <li>Create clips, previews, excerpts, and derivative works for promotional or platform purposes</li>
          <li>Synchronize, translate, adapt, and reformat the Content for different devices, platforms, or formats</li>
          <li>Analyze the Content for quality, safety, moderation, and analytics purposes</li>
          <li>Use the Content to train, test, improve, or operate AI or machine learning systems related to the Service</li>
          <li>Sublicense these rights to service providers, partners, and third parties necessary to operate the Service</li>
        </ul>
      </Section>

      <Section title="4. Future Technologies">
        <p>
          This License applies to all current and future media, formats, technologies, distribution channels, platforms, devices, and methods of exploitation <strong className="text-foreground">whether now known or later developed</strong>. You acknowledge that new technologies may enable uses of Content not specifically listed in this document, and you grant Cotopia the right to use Content in such new contexts to the extent permitted by applicable law.
        </p>
      </Section>

      <Section title="5. No Compensation">
        <p>
          <strong className="text-foreground">You acknowledge and agree that Cotopia is not obligated to compensate you for any use of Content unless a separate written agreement expressly provides otherwise.</strong>
        </p>
        <p>
          Everyday Radio is not currently a royalty-paying service. Cotopia does not pay streaming royalties, mechanical royalties, performance royalties, publishing royalties, or revenue sharing arising from the rights granted under this License. This applies to all Content including music, videos, artwork, and promotional materials.
        </p>
        <p>
          Cotopia may, at its sole discretion, introduce optional creator compensation programs, contests, sponsorships, or revenue sharing in the future. Any such compensation will be governed by a separate written agreement.
        </p>
      </Section>

      <Section title="6. Ownership Retained">
        <p>
          <strong className="text-foreground">You retain ownership of your Content.</strong> Cotopia does not claim ownership of any Content you submit. This License grants usage rights only and does not transfer copyright, trademark, or any other intellectual property rights to Cotopia.
        </p>
        <p>
          You are responsible for ensuring you own or control all rights necessary to grant this License, including master recording rights, composition rights, synchronization rights, and any other required permissions.
        </p>
      </Section>

      <Section title="7. Representations and Warranties">
        <p>By providing Content, you represent and warrant that:</p>
        <ul className="list-disc list-inside space-y-1 pl-2">
          <li>You own or control all rights in the Content sufficient to grant this License</li>
          <li>The Content does not infringe any third-party copyright, trademark, privacy, publicity, or other rights</li>
          <li>You have obtained all necessary clearances, licenses, and permissions</li>
          <li>The Content complies with all applicable laws and the Cotopia Community Guidelines</li>
          <li>You have the legal authority to enter into this agreement</li>
        </ul>
      </Section>

      <Section title="8. Indemnification">
        <p>
          You agree to defend, indemnify, and hold harmless Cotopia, Everyday Radio, Cotopia Music &amp; Marketing, and their respective officers, directors, employees, agents, affiliates, successors, assigns, contractors, partners, licensees, and sublicensees from and against any and all claims, damages, losses, liabilities, costs, and expenses (including reasonable attorneys' fees) arising out of or related to:
        </p>
        <ul className="list-disc list-inside space-y-1 pl-2">
          <li>Your Content or any use of your Content by Cotopia under this License</li>
          <li>Your breach of any representation, warranty, or obligation under this Agreement</li>
          <li>Any infringement or misappropriation of any third-party rights arising from your Content</li>
          <li>Your violation of any applicable law or regulation</li>
        </ul>
      </Section>

      <Section title="9. Survival">
        <p>
          <strong className="text-foreground">This License survives account termination, Content removal, business restructuring, merger, acquisition, sale, assignment, or transfer of the Service</strong> to the extent necessary to preserve existing rights and uses authorized under this Agreement at the time of such event.
        </p>
        <p>
          Upon Content removal or account termination, Cotopia will cease active promotion of removed Content, but existing uses (including cached copies, promotional materials already distributed, and analytics data) are not required to be recalled.
        </p>
      </Section>

      <Section title="10. Licensees and Related Entities">
        <p>
          The rights granted under this License extend to the following entities and their successors and assigns:
        </p>
        <ul className="list-disc list-inside space-y-1 pl-2">
          <li>Everyday Radio (the Platform)</li>
          <li>Cotopia (the operating company)</li>
          <li>Cotopia Music &amp; Marketing (affiliated label division)</li>
          <li>All current and future subsidiaries and affiliates</li>
          <li>Third-party service providers and contractors engaged to operate or improve the Service</li>
          <li>Partners and distribution channels authorized by Cotopia</li>
          <li>Sublicensees authorized under this Agreement</li>
        </ul>
      </Section>

      <Section title="11. Governing Law">
        <p>
          This License is governed by the same jurisdiction and dispute resolution provisions as the Cotopia <Link href="/legal/terms" className="text-primary hover:underline">Terms of Service</Link>. In the event of a conflict between this License and the Terms of Service, the Terms of Service shall control.
        </p>
      </Section>

      <div className="rounded-xl border border-border bg-card/50 p-6 space-y-2 text-sm text-muted-foreground">
        <p className="font-semibold text-foreground text-sm">Questions about this License?</p>
        <p>
          For questions about how Cotopia uses your Content, contact{" "}
          <a href="mailto:legal@cotopia.org" className="text-primary hover:underline">legal@cotopia.org</a>.
          See also the <Link href="/legal/submission-agreement" className="text-primary hover:underline">Submission Agreement</Link> and{" "}
          <Link href="/legal/terms" className="text-primary hover:underline">Terms of Service</Link>.
        </p>
      </div>

      <p className="text-xs text-muted-foreground text-center pb-4">
        Everyday Radio by Cotopia · Powered by Cotopia
      </p>
    </div>
  );
}

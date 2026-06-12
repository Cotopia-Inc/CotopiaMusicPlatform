import { Link } from "wouter";
import { ChevronLeft, Brain } from "lucide-react";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-bold">{title}</h2>
      <div className="text-sm text-muted-foreground leading-relaxed space-y-3">{children}</div>
    </section>
  );
}

export default function AiPolicy() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-10 space-y-8">
      <div className="space-y-1">
        <Link href="/legal" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors mb-3">
          <ChevronLeft className="w-3 h-3" />Legal Center
        </Link>
        <h1 className="text-3xl font-extrabold">AI Content Policy</h1>
        <p className="text-xs text-muted-foreground">Everyday Radio by Cotopia · Version 1.0 · Last updated June 2026</p>
      </div>

      <div className="rounded-xl border border-primary/20 bg-primary/5 p-5 flex gap-3">
        <Brain className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-primary">AI content is welcome on Everyday Radio</p>
          <p className="text-xs text-muted-foreground mt-1">We accept AI-generated and AI-assisted music, video, artwork, and creative content — provided you have the necessary rights and follow this policy.</p>
        </div>
      </div>

      <Section title="1. Accepted AI Content">
        <p>Everyday Radio accepts the following types of AI content:</p>
        <ul className="list-disc list-inside space-y-1 pl-2">
          <li>Fully AI-generated music, beats, and instrumentals</li>
          <li>AI-assisted compositions, arrangements, and productions</li>
          <li>AI-generated vocal performances where you own the rights</li>
          <li>AI-created visual artwork and cover images</li>
          <li>Hybrid human-AI creative works</li>
          <li>AI-assisted mastering, mixing, or enhancement</li>
        </ul>
      </Section>

      <Section title="2. Rights Requirement">
        <p>You are responsible for ensuring you have the rights necessary to upload and distribute any AI-generated or AI-assisted content.</p>
        <p>This includes reviewing the terms of service of any AI tools you use. Some AI platforms restrict commercial use or require attribution. It is your responsibility to comply with those terms.</p>
        <p>If any component of your content was generated using a model trained on third-party copyrighted material without proper licensing, and the output reproduces or closely resembles that material, you must not upload it.</p>
      </Section>

      <Section title="3. Prohibited AI Content">
        <p>The following AI content is strictly prohibited on Everyday Radio:</p>
        <ul className="list-disc list-inside space-y-1.5 pl-2">
          <li><strong className="text-foreground">Voice cloning without consent:</strong> AI content that impersonates or clones the voice, style, or likeness of a real artist without their explicit written consent</li>
          <li><strong className="text-foreground">Infringement:</strong> AI content that substantially reproduces or infringes a specific copyrighted song, beat, or recording</li>
          <li><strong className="text-foreground">Impersonation:</strong> Presenting AI-generated content as the work of a specific named real artist without their authorization</li>
          <li><strong className="text-foreground">Deepfake likeness:</strong> AI-generated video or imagery that uses another person's likeness without consent</li>
          <li><strong className="text-foreground">Misleading origin:</strong> Claiming AI-generated content is fully human-created when directly and materially asked</li>
        </ul>
      </Section>

      <Section title="4. Cotopia's Use of AI">
        <p><strong className="text-foreground">Cotopia does not train AI systems using user-uploaded content.</strong></p>
        <p>Your music, videos, artwork, and creative materials uploaded to Everyday Radio will not be used as training data for AI models — by Cotopia or any third party we work with.</p>
        <p>We may use AI tools for internal platform operations (such as content moderation assistance or recommendation algorithms), but these do not involve training on your uploaded content.</p>
      </Section>

      <Section title="5. Disclosure">
        <p>When submitting content that includes AI-generated or AI-assisted elements, you will be asked to confirm that you have the rights to upload and distribute it via a required checkbox in the submission flow.</p>
        <p>You are not required to publicly label your content as AI-generated on your profile, but you may not actively misrepresent AI content as entirely human-made.</p>
      </Section>

      <Section title="6. Enforcement">
        <p>Violations of this AI Policy may result in content removal, account suspension, or termination. Rights holders whose work is infringed by AI content may file a DMCA claim through our standard process.</p>
      </Section>

      <div className="pt-4 border-t border-border">
        <p className="text-xs text-muted-foreground">Questions about AI content: <a href="mailto:legal@cotopia.org" className="text-primary hover:underline">legal@cotopia.org</a></p>
      </div>
    </div>
  );
}

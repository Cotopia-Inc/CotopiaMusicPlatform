/**
 * Creator self-tag selector for upload / content-settings pages.
 *
 * Allows creators to declare the origin of their content:
 * Human Created | AI Assisted | Hybrid Human + AI | Fully AI Generated
 *
 * Shows a policy warning for "Fully AI Generated" which is not accepted.
 */
import { AlertTriangle, Bot, Sparkles, User, Blend } from "lucide-react";
import { cn } from "@/lib/utils";

export type CreationMethodOption =
  | "unclassified"
  | "human_created"
  | "ai_assisted"
  | "hybrid_human_ai"
  | "fully_ai_generated";

interface OptionConfig {
  value: CreationMethodOption;
  label: string;
  icon: React.ReactNode;
  description: string;
  border: string;
  selected: string;
}

const OPTIONS: OptionConfig[] = [
  {
    value: "human_created",
    label: "Human Created",
    icon: <User className="w-4 h-4" />,
    description:
      "No generative AI was used to create the music, lyrics, vocals, composition, performance, or video content. Routine tools such as cleanup, noise reduction, or conventional editing may be disclosed separately.",
    border: "border-emerald-500/60",
    selected: "border-emerald-500 bg-emerald-500/5 ring-1 ring-emerald-500/30",
  },
  {
    value: "ai_assisted",
    label: "AI Assisted",
    icon: <Sparkles className="w-4 h-4" />,
    description:
      "AI was used as a tool, but you supplied meaningful human authorship, performance, arrangement, editing, or transformation.",
    border: "border-blue-500/60",
    selected: "border-blue-500 bg-blue-500/5 ring-1 ring-blue-500/30",
  },
  {
    value: "hybrid_human_ai",
    label: "Hybrid Human + AI",
    icon: <Blend className="w-4 h-4" />,
    description:
      "Both human-authored and AI-generated elements materially contributed to the finished work.",
    border: "border-violet-500/60",
    selected: "border-violet-500 bg-violet-500/5 ring-1 ring-violet-500/30",
  },
  {
    value: "fully_ai_generated",
    label: "Fully AI Generated",
    icon: <Bot className="w-4 h-4" />,
    description:
      "The expressive content was generated entirely or substantially entirely by AI without meaningful human creative authorship.",
    border: "border-red-500/60",
    selected: "border-red-500 bg-red-500/5 ring-1 ring-red-500/30",
  },
];

interface CreationMethodSelectorProps {
  value: CreationMethodOption;
  onChange: (v: CreationMethodOption) => void;
  disabled?: boolean;
  locked?: boolean;
  lockedMessage?: string;
  className?: string;
}

export function CreationMethodSelector({
  value,
  onChange,
  disabled = false,
  locked = false,
  lockedMessage,
  className,
}: CreationMethodSelectorProps) {
  return (
    <div className={cn("space-y-3", className)}>
      <div className="text-sm font-medium">Content Origin</div>
      <p className="text-xs text-muted-foreground">
        Accurately disclose how this content was made. You must own or control all rights, permissions,
        and licenses required to upload and authorize Everyday Radio&apos;s use of this content.
      </p>

      {locked && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2.5">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-500 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-amber-700 dark:text-amber-400">
            {lockedMessage ??
              "This classification was assigned by Everyday Radio and is locked pending administrative review or appeal."}
          </p>
        </div>
      )}

      <div className="grid gap-2">
        {OPTIONS.map((opt) => {
          const isSelected = value === opt.value;
          const isDisabled = disabled || locked;

          return (
            <button
              key={opt.value}
              type="button"
              disabled={isDisabled}
              onClick={() => !isDisabled && onChange(opt.value)}
              className={cn(
                "flex items-start gap-3 rounded-xl border px-4 py-3 text-left transition-all",
                isSelected ? opt.selected : "border-border bg-card hover:border-muted-foreground/40",
                isDisabled && "opacity-60 cursor-not-allowed",
              )}
              aria-pressed={isSelected}
            >
              <span className={cn("mt-0.5 flex-shrink-0", isSelected ? "" : "text-muted-foreground")}>
                {opt.icon}
              </span>
              <div className="min-w-0">
                <div className="text-sm font-medium">{opt.label}</div>
                <div className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{opt.description}</div>
              </div>
              <span
                className={cn(
                  "ml-auto mt-1 h-3.5 w-3.5 rounded-full border-2 flex-shrink-0 transition-colors",
                  isSelected ? "border-primary bg-primary" : "border-border",
                )}
                aria-hidden
              />
            </button>
          );
        })}
      </div>

      {value === "fully_ai_generated" && (
        <div className="flex items-start gap-2.5 rounded-xl border border-red-500/40 bg-red-500/5 px-4 py-3">
          <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
          <div className="text-sm space-y-1">
            <p className="font-medium text-red-700 dark:text-red-400">
              Fully AI-generated content is not accepted under Everyday Radio&apos;s current policy.
            </p>
            <p className="text-xs text-red-700/80 dark:text-red-400/80">
              Everyday Radio welcomes human-created, AI-assisted, and hybrid creative work. However, we do
              not accept content that is fully generated by artificial intelligence without meaningful human
              creative authorship. Your record will be saved as a draft for audit purposes, but it will not
              be published and no submission fee will be charged.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

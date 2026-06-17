import { Link } from "wouter";
import { MailWarning } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { usePlatformConfig } from "@/lib/platform-config";

interface VerifyEmailBannerProps {
  /** Short description of the action that is gated, e.g. "join the chat". */
  action?: string;
  className?: string;
}

export function VerifyEmailBanner({ action = "use this feature", className }: VerifyEmailBannerProps) {
  const { user } = useAuth();
  const config = usePlatformConfig();
  if (!user || !config.requireEmailVerification || (user as any).emailVerified) return null;

  return (
    <div className={`flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 ${className ?? ""}`}>
      <MailWarning className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
      <div className="text-sm">
        <p className="font-medium text-amber-300">Verify your email to {action}.</p>
        <p className="text-xs text-amber-200/80 mt-0.5">
          Check your inbox for a verification code, or{" "}
          <Link href="/profile" className="underline font-medium hover:text-amber-100">resend it from your profile</Link>.
        </p>
      </div>
    </div>
  );
}

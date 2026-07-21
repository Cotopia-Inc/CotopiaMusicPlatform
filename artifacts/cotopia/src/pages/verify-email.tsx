import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useSendOtp, useVerifyOtp, useGetMe, getGetMeQueryKey } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useQueryClient } from "@tanstack/react-query";
import { MailCheck, RefreshCw } from "lucide-react";

export default function VerifyEmail() {
  const { user, login } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const sendMutation = useSendOtp();
  const verifyMutation = useVerifyOtp();
  const { data: profile } = useGetMe({ query: { enabled: !!user, queryKey: getGetMeQueryKey() } });

  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const emailVerified = (profile as any)?.emailVerified;

  useEffect(() => {
    if (emailVerified) {
      setLocation("/onboarding");
    }
  }, [emailVerified, setLocation]);

  useEffect(() => {
    if (!user) { setLocation("/login"); return; }
    // Auto-send on mount
    handleSend();
  }, []);

  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  function startCountdown() {
    setCountdown(60);
    timerRef.current = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) { clearInterval(timerRef.current!); return 0; }
        return c - 1;
      });
    }, 1000);
  }

  function handleSend() {
    sendMutation.mutate({ data: { purpose: "verify_email" } }, {
      onSuccess: () => {
        setSent(true);
        startCountdown();
        toast({ title: "Code sent", description: `A 6-digit code was sent to ${user?.email ?? "your email"}.` });
      },
      onError: () => toast({ variant: "destructive", title: "Could not send code", description: "Try again in a moment." }),
    });
  }

  function handleVerify() {
    if (code.length !== 6) { toast({ variant: "destructive", title: "Enter the 6-digit code" }); return; }
    verifyMutation.mutate({ data: { code: code.trim(), purpose: "verify_email" } }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetMeQueryKey() });
        toast({ title: "Email verified!", description: "Welcome to Everyday Radio." });
        setLocation("/onboarding");
      },
      onError: () => toast({ variant: "destructive", title: "Incorrect or expired code", description: "Check the code and try again." }),
    });
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-2">
            <MailCheck className="w-8 h-8 text-primary" />
          </div>
          <div className="flex items-center gap-2">
            <img src="/logo.jpg" alt="Cotopia" className="w-4 h-4 rounded-sm object-cover flex-shrink-0" />
            <span className="text-sm font-bold tracking-tight">Everyday Radio</span>
          </div>
          <h1 className="text-2xl font-extrabold">Verify your email</h1>
          <p className="text-muted-foreground text-sm">
            We sent a 6-digit code to<br />
            <span className="font-semibold text-foreground">{user?.email}</span>
          </p>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="verify-code" className="text-sm font-medium">6-digit code</label>
            <Input
              id="verify-code"
              value={code}
              onChange={e => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="123456"
              maxLength={6}
              className="bg-secondary/50 border-secondary h-12 text-center text-2xl tracking-[0.5em] font-mono"
              onKeyDown={e => e.key === "Enter" && handleVerify()}
            />
          </div>

          <Button
            onClick={handleVerify}
            className="w-full h-11 font-semibold"
            disabled={verifyMutation.isPending || code.length !== 6}
          >
            {verifyMutation.isPending ? "Verifying…" : "Confirm Code"}
          </Button>

          <div className="text-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSend}
              disabled={countdown > 0 || sendMutation.isPending}
              className="text-xs text-muted-foreground gap-1.5"
            >
              <RefreshCw className="w-3 h-3" />
              {countdown > 0 ? `Resend in ${countdown}s` : "Resend code"}
            </Button>
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          Check your spam folder if you don't see it.
        </p>
      </div>
    </div>
  );
}

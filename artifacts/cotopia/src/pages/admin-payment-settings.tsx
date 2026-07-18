import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  CreditCard, Shield, AlertTriangle, CheckCircle2, XCircle, RefreshCw, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";

interface PaymentModeInfo {
  paymentMode: "demo" | "paypal_sandbox" | "paypal_live";
  canActivateSandbox: boolean;
  canActivateLive: boolean;
  credentialStatus: {
    sandbox: { clientId: boolean; clientSecret: boolean };
    live: { clientId: boolean; clientSecret: boolean };
  };
}

const authHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem("cotopia_token")}`,
  "Content-Type": "application/json",
});

const MODE_INFO = {
  demo: {
    label: "Demo Mode",
    badge: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    description: "All payments are simulated. No real money is processed. Demo confirmation numbers are generated. Works without any payment credentials.",
    icon: <Shield className="w-5 h-5 text-amber-400" />,
  },
  paypal_sandbox: {
    label: "PayPal Sandbox",
    badge: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    description: "PayPal sandbox environment for testing. Requires PAYPAL_SANDBOX_CLIENT_ID and PAYPAL_SANDBOX_CLIENT_SECRET environment variables. No real money is processed.",
    icon: <CreditCard className="w-5 h-5 text-blue-400" />,
  },
  paypal_live: {
    label: "PayPal Live",
    badge: "bg-green-500/20 text-green-400 border-green-500/30",
    description: "Live PayPal integration. Real money will be charged. Requires PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET environment variables.",
    icon: <CreditCard className="w-5 h-5 text-green-400" />,
  },
} as const;

export default function AdminPaymentSettings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isMasterAdmin = user?.role === "master_admin";

  const [pendingMode, setPendingMode] = useState<string | null>(null);
  const [showLiveConfirm, setShowLiveConfirm] = useState(false);
  const [liveConfirmText, setLiveConfirmText] = useState("");

  const { data, isLoading, refetch } = useQuery<PaymentModeInfo>({
    queryKey: ["admin-payment-mode"],
    queryFn: async () => {
      const res = await fetch(`${import.meta.env.BASE_URL}api/admin/payment-mode`, { headers: authHeaders() });
      if (!res.ok) throw new Error("Access denied");
      return res.json();
    },
    enabled: isMasterAdmin,
  });

  const updateMode = useMutation({
    mutationFn: async (paymentMode: string) => {
      const res = await fetch(`${import.meta.env.BASE_URL}api/admin/payment-mode`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify({ paymentMode }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to update payment mode");
      return body;
    },
    onSuccess: (result) => {
      toast({
        title: "Payment mode updated",
        description: `Now using: ${MODE_INFO[result.paymentMode as keyof typeof MODE_INFO]?.label ?? result.paymentMode}`,
      });
      queryClient.invalidateQueries({ queryKey: ["admin-payment-mode"] });
      setPendingMode(null);
      setShowLiveConfirm(false);
      setLiveConfirmText("");
    },
    onError: (err: Error) => {
      toast({ variant: "destructive", title: "Failed to update payment mode", description: err.message });
      setPendingMode(null);
    },
  });

  function handleModeSelect(mode: string) {
    if (mode === "paypal_live") {
      setPendingMode(mode);
      setShowLiveConfirm(true);
      return;
    }
    updateMode.mutate(mode);
  }

  function handleLiveConfirm() {
    if (liveConfirmText !== "ACTIVATE LIVE PAYMENTS") return;
    updateMode.mutate("paypal_live");
  }

  if (!isMasterAdmin) {
    return (
      <div className="p-6 max-w-2xl mx-auto text-center py-16">
        <XCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
        <h2 className="text-xl font-bold">Access Denied</h2>
        <p className="text-muted-foreground mt-2">Only master administrators can configure payment settings.</p>
      </div>
    );
  }

  const current = data?.paymentMode ?? "demo";

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <CreditCard className="w-6 h-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Payment Settings</h1>
            <p className="text-sm text-muted-foreground">Configure the platform payment mode. Changes are audited.</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Current mode */}
      {data && (
        <div className="rounded-lg border border-border bg-card p-5 space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Current Payment Mode</p>
          <div className="flex items-center gap-3">
            {MODE_INFO[current as keyof typeof MODE_INFO]?.icon}
            <span className="text-xl font-bold">{MODE_INFO[current as keyof typeof MODE_INFO]?.label}</span>
            <Badge className={MODE_INFO[current as keyof typeof MODE_INFO]?.badge}>Active</Badge>
          </div>
          <p className="text-sm text-muted-foreground">{MODE_INFO[current as keyof typeof MODE_INFO]?.description}</p>
        </div>
      )}

      {/* Mode options */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Change Mode</h2>

        {/* Demo */}
        <div className={`rounded-lg border p-5 space-y-3 transition-colors ${current === "demo" ? "border-amber-500/50 bg-amber-500/5" : "border-border bg-card"}`}>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <Shield className="w-5 h-5 text-amber-400 mt-0.5" />
              <div>
                <p className="font-semibold">Demo Mode</p>
                <p className="text-sm text-muted-foreground mt-0.5">Simulated payments. No credentials required. No real money.</p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {current === "demo" && <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">Active</Badge>}
              <Button
                size="sm"
                variant={current === "demo" ? "secondary" : "outline"}
                disabled={current === "demo" || updateMode.isPending}
                onClick={() => handleModeSelect("demo")}
              >
                {current === "demo" ? "Current" : "Activate"}
              </Button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
            <span className="text-xs text-muted-foreground">No credentials required</span>
          </div>
        </div>

        {/* PayPal Sandbox */}
        <div className={`rounded-lg border p-5 space-y-3 transition-colors ${current === "paypal_sandbox" ? "border-blue-500/50 bg-blue-500/5" : "border-border bg-card"}`}>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <CreditCard className="w-5 h-5 text-blue-400 mt-0.5" />
              <div>
                <p className="font-semibold">PayPal Sandbox</p>
                <p className="text-sm text-muted-foreground mt-0.5">PayPal test environment. No real money. Requires sandbox credentials.</p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {current === "paypal_sandbox" && <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">Active</Badge>}
              <Button
                size="sm"
                variant={current === "paypal_sandbox" ? "secondary" : "outline"}
                disabled={current === "paypal_sandbox" || !data?.canActivateSandbox || updateMode.isPending}
                onClick={() => handleModeSelect("paypal_sandbox")}
              >
                {current === "paypal_sandbox" ? "Current" : data?.canActivateSandbox ? "Activate" : "Missing Credentials"}
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex items-center gap-2">
              {data?.credentialStatus.sandbox.clientId
                ? <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
                : <XCircle className="w-3.5 h-3.5 text-destructive" />}
              <span className="text-xs text-muted-foreground">PAYPAL_SANDBOX_CLIENT_ID</span>
            </div>
            <div className="flex items-center gap-2">
              {data?.credentialStatus.sandbox.clientSecret
                ? <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
                : <XCircle className="w-3.5 h-3.5 text-destructive" />}
              <span className="text-xs text-muted-foreground">PAYPAL_SANDBOX_CLIENT_SECRET</span>
            </div>
          </div>
        </div>

        {/* PayPal Live */}
        <div className={`rounded-lg border p-5 space-y-3 transition-colors ${current === "paypal_live" ? "border-green-500/50 bg-green-500/5" : "border-red-500/20 bg-red-500/5"}`}>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-400 mt-0.5" />
              <div>
                <p className="font-semibold">PayPal Live</p>
                <p className="text-sm text-muted-foreground mt-0.5">
                  <strong className="text-red-400">Real money will be charged.</strong> Requires live PayPal credentials. Requires master_admin confirmation.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {current === "paypal_live" && <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Active</Badge>}
              <Button
                size="sm"
                variant={current === "paypal_live" ? "secondary" : "destructive"}
                disabled={current === "paypal_live" || !data?.canActivateLive || updateMode.isPending}
                onClick={() => handleModeSelect("paypal_live")}
              >
                {current === "paypal_live" ? "Current" : data?.canActivateLive ? "Activate Live" : "Missing Credentials"}
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex items-center gap-2">
              {data?.credentialStatus.live.clientId
                ? <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
                : <XCircle className="w-3.5 h-3.5 text-destructive" />}
              <span className="text-xs text-muted-foreground">PAYPAL_CLIENT_ID</span>
            </div>
            <div className="flex items-center gap-2">
              {data?.credentialStatus.live.clientSecret
                ? <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
                : <XCircle className="w-3.5 h-3.5 text-destructive" />}
              <span className="text-xs text-muted-foreground">PAYPAL_CLIENT_SECRET</span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Never display credentials after they are saved. Store secrets only in environment variables, never in the database.
          </p>
        </div>
      </div>

      {/* Live confirmation dialog */}
      {showLiveConfirm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-red-500/40 rounded-xl p-8 max-w-md w-full space-y-5 shadow-2xl">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-8 h-8 text-red-400 flex-shrink-0" />
              <div>
                <h3 className="text-lg font-bold text-red-400">Activate Live Payments?</h3>
                <p className="text-sm text-muted-foreground">This is irreversible until you manually switch back to demo or sandbox.</p>
              </div>
            </div>
            <div className="space-y-2 text-sm text-muted-foreground bg-red-500/10 rounded-lg p-4">
              <p>⚠ Real money will be charged to users immediately upon activating.</p>
              <p>⚠ All transactions will be recorded as real financial events.</p>
              <p>⚠ This action will be recorded in the audit log.</p>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Type <code className="bg-muted px-1 rounded text-red-400">ACTIVATE LIVE PAYMENTS</code> to confirm:</p>
              <input
                type="text"
                value={liveConfirmText}
                onChange={e => setLiveConfirmText(e.target.value)}
                className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-red-500/50"
                placeholder="ACTIVATE LIVE PAYMENTS"
                autoFocus
              />
            </div>
            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={() => { setShowLiveConfirm(false); setPendingMode(null); setLiveConfirmText(""); }}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                disabled={liveConfirmText !== "ACTIVATE LIVE PAYMENTS" || updateMode.isPending}
                onClick={handleLiveConfirm}
              >
                {updateMode.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Activating…</> : "Activate Live Payments"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Important notice */}
      <div className="rounded-lg border border-border bg-muted/30 p-5 space-y-2 text-sm text-muted-foreground">
        <p className="font-semibold text-foreground">Important Notes</p>
        <ul className="space-y-1 list-disc list-inside">
          <li>Demo payment records are always clearly labeled and never counted as real revenue.</li>
          <li>All payment mode changes are recorded in the audit log with actor, timestamp, and old/new values.</li>
          <li>Secret credentials are stored only in environment variables — never in the database.</li>
          <li>The application fully operates in demo mode without any payment credentials.</li>
          <li>PayPal sandbox and live modes require a future PayPal integration implementation.</li>
        </ul>
      </div>
    </div>
  );
}

/**
 * CoverArtScanPanel — AI detection results for cover art / thumbnails.
 *
 * Features:
 * - Visual percentage bar and risk level
 * - Full per-class breakdown from rawResult (same aggregation as AiReviewCard)
 * - Polls automatically until a new result appears after triggering a scan
 * - Prominent error banner with retry button on failure
 * - Full scan history, not just the most recent record
 * - Admin action panel: approve / flag / request replacement / clear (admins only)
 *
 * IMPORTANT: All detection scores are advisory estimates only.
 */
import { useState, useRef, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ImageIcon, Scan, Loader2, History, X, ShieldAlert, CheckCircle, AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface CoverScanRecord {
  id: number;
  scanStatus: string;
  aiLikelihoodPercent: number | null;
  confidenceLevel: string | null;
  riskLevel: string | null;
  rawResult: Record<string, unknown> | null;
  errorMessage: string | null;
  scannedAt: string | null;
  createdAt: string;
}

interface CoverArtReviewState {
  coverArtReviewDecision: string | null;
  coverArtReviewNote: string | null;
}

const COVER_ACTIONS = [
  { value: "approved", label: "Approve Cover Art" },
  { value: "flagged", label: "Flag for Review" },
  { value: "replacement_requested", label: "Request Replacement" },
  { value: "cleared", label: "Clear Decision" },
] as const;

const DECISION_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  approved: {
    label: "Approved",
    color: "text-emerald-600 dark:text-emerald-400 border-emerald-500/30 bg-emerald-500/5",
    icon: <CheckCircle className="w-3.5 h-3.5" />,
  },
  flagged: {
    label: "Flagged for Review",
    color: "text-amber-600 dark:text-amber-400 border-amber-500/30 bg-amber-500/5",
    icon: <AlertTriangle className="w-3.5 h-3.5" />,
  },
  replacement_requested: {
    label: "Replacement Requested",
    color: "text-red-600 dark:text-red-400 border-red-500/30 bg-red-500/5",
    icon: <RefreshCw className="w-3.5 h-3.5" />,
  },
};

function coverRiskBarColor(percent: number): string {
  if (percent < 25) return "bg-emerald-500";
  if (percent < 60) return "bg-amber-400";
  if (percent < 90) return "bg-orange-500";
  return "bg-red-600";
}

function coverRiskLabel(percent: number): string {
  if (percent < 25) return "Low";
  if (percent < 60) return "Moderate";
  if (percent < 90) return "High";
  return "Critical";
}

function parseCoverClassBreakdown(
  rawResult: Record<string, unknown> | null | undefined,
): Array<{ name: string; percent: number }> | null {
  if (!rawResult) return null;
  try {
    const statusArr = rawResult["status"] as Array<Record<string, unknown>> | undefined;
    const response = statusArr?.[0]?.["response"] as Record<string, unknown> | undefined;
    const output = response?.["output"] as Array<Record<string, unknown>> | undefined;
    if (!Array.isArray(output) || output.length === 0) return null;
    const maxPerClass = new Map<string, number>();
    for (const item of output) {
      const classes = item["classes"] as Array<{ class: string; score?: number; value?: number }> | undefined;
      if (!Array.isArray(classes)) continue;
      for (const cls of classes) {
        const raw = typeof cls.score === "number" ? cls.score : (typeof cls.value === "number" ? cls.value : null);
        if (raw === null) continue;
        const pct = Math.round(raw * 100);
        const existing = maxPerClass.get(cls.class) ?? 0;
        if (pct > existing) maxPerClass.set(cls.class, pct);
      }
    }
    if (maxPerClass.size === 0) return null;
    return Array.from(maxPerClass.entries())
      .map(([name, percent]) => ({ name: name.replace(/_/g, " "), percent }))
      .sort((a, b) => b.percent - a.percent);
  } catch {
    return null;
  }
}

export function CoverArtScanPanel({
  contentType,
  contentId,
  coverUrl,
  isAdmin = false,
}: {
  contentType: "song" | "video";
  contentId: number;
  coverUrl: string | null;
  isAdmin?: boolean;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [scanning, setScanning] = useState(false);
  const preScanCountRef = useRef(0);

  const [selectedAction, setSelectedAction] = useState<string>("");
  const [actionNote, setActionNote] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const coverContentType = `${contentType}_cover`;
  const scanQueryKey = ["cover-scans", contentType, contentId];
  const reviewQueryKey = ["cover-art-review", contentType, contentId];

  const { data: scans = [], isLoading } = useQuery<CoverScanRecord[]>({
    queryKey: scanQueryKey,
    queryFn: async () => {
      const token = localStorage.getItem("cotopia_token");
      const res = await fetch(
        `${import.meta.env.BASE_URL}api/admin/ai-scans/${coverContentType}/${contentId}`,
        { headers: { Authorization: `Bearer ${token ?? ""}` } },
      );
      if (!res.ok) return [];
      return res.json() as Promise<CoverScanRecord[]>;
    },
    enabled: !!contentId,
    refetchInterval: scanning ? 5_000 : false,
    staleTime: 10_000,
  });

  const { data: reviewState } = useQuery<CoverArtReviewState>({
    queryKey: reviewQueryKey,
    queryFn: async () => {
      const token = localStorage.getItem("cotopia_token");
      const res = await fetch(
        `${import.meta.env.BASE_URL}api/admin/ai-review/cover-art/${contentType}/${contentId}`,
        { headers: { Authorization: `Bearer ${token ?? ""}` } },
      );
      if (!res.ok) return { coverArtReviewDecision: null, coverArtReviewNote: null };
      return res.json() as Promise<CoverArtReviewState>;
    },
    enabled: isAdmin && !!contentId,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (scanning && scans.length > preScanCountRef.current) {
      setScanning(false);
    }
  }, [scanning, scans.length]);

  async function triggerScan() {
    if (!coverUrl) {
      toast({ variant: "destructive", title: "No cover art", description: "No cover art URL to scan." });
      return;
    }
    preScanCountRef.current = scans.length;
    setScanning(true);
    try {
      const token = localStorage.getItem("cotopia_token");
      const res = await fetch(`${import.meta.env.BASE_URL}api/admin/ai-review/scan-cover`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token ?? ""}`, "Content-Type": "application/json" },
        body: JSON.stringify({ contentType, contentId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string };
        toast({ variant: "destructive", title: "Scan failed", description: err.error ?? "Could not scan cover art" });
        setScanning(false);
        return;
      }
      toast({ title: "Cover art scan queued", description: "Results will appear automatically once the scan completes." });
      queryClient.invalidateQueries({ queryKey: scanQueryKey });
    } catch {
      toast({ variant: "destructive", title: "Scan failed", description: "Network error" });
      setScanning(false);
    }
  }

  async function deleteScan(scanId: number) {
    const token = localStorage.getItem("cotopia_token");
    await fetch(`${import.meta.env.BASE_URL}api/admin/ai-scans/${scanId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token ?? ""}` },
    });
    queryClient.invalidateQueries({ queryKey: scanQueryKey });
  }

  async function applyAction() {
    if (!selectedAction) return;
    setActionLoading(true);
    try {
      const token = localStorage.getItem("cotopia_token");
      const res = await fetch(
        `${import.meta.env.BASE_URL}api/admin/ai-review/cover-art/${contentType}/${contentId}`,
        {
          method: "PATCH",
          headers: { Authorization: `Bearer ${token ?? ""}`, "Content-Type": "application/json" },
          body: JSON.stringify({ decision: selectedAction, note: actionNote || undefined }),
        },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string };
        toast({ variant: "destructive", title: "Action failed", description: err.error ?? "Could not apply action" });
        return;
      }
      toast({ title: "Cover art decision saved" });
      setSelectedAction("");
      setActionNote("");
      queryClient.invalidateQueries({ queryKey: reviewQueryKey });
    } catch {
      toast({ variant: "destructive", title: "Action failed", description: "Network error" });
    } finally {
      setActionLoading(false);
    }
  }

  const currentDecision = reviewState?.coverArtReviewDecision ?? null;
  const currentNote = reviewState?.coverArtReviewNote ?? null;
  const decisionConfig = currentDecision ? DECISION_CONFIG[currentDecision] : null;

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <ImageIcon className="w-4 h-4 text-primary" />
          Cover Art AI Scan
          {scans.length > 0 && (
            <span className="text-[10px] text-muted-foreground font-normal">({scans.length})</span>
          )}
        </div>
        {coverUrl && (
          <button
            type="button"
            onClick={() => void triggerScan()}
            disabled={scanning}
            className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border border-border bg-secondary/50 hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
          >
            {scanning
              ? <><Loader2 className="w-3 h-3 animate-spin" />Scanning…</>
              : <><Scan className="w-3 h-3" />Scan Cover Art</>}
          </button>
        )}
      </div>

      <div className="border-t border-border px-4 py-3 space-y-3">
        {!coverUrl && (
          <p className="text-xs text-muted-foreground italic">No cover art available to scan.</p>
        )}

        {coverUrl && (
          <div className="flex items-start gap-3">
            <img
              src={coverUrl}
              alt="Cover art"
              className="w-14 h-14 rounded-lg object-cover border border-border flex-shrink-0"
            />
            <div className="flex-1 min-w-0 space-y-2">
              {isLoading && (
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Loader2 className="w-3 h-3 animate-spin" />Loading scan history…
                </p>
              )}
              {!isLoading && scans.length === 0 && (
                <p className="text-xs text-muted-foreground italic">
                  Cover art not yet scanned. Click "Scan Cover Art" to check.
                </p>
              )}
              {!isLoading && scans.length > 0 && (
                <div className="space-y-2">
                  {scans.length > 1 && (
                    <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground uppercase tracking-wider">
                      <History className="w-3 h-3" />
                      Scan History
                    </div>
                  )}
                  <div className="max-h-72 overflow-y-auto space-y-1.5 pr-0.5">
                    {scans.map((scan) => (
                      <div
                        key={scan.id}
                        className="rounded-lg border border-border bg-muted/30 px-3 py-2 space-y-1.5 text-xs"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className={cn("font-medium capitalize",
                            scan.scanStatus === "complete" ? "text-emerald-600 dark:text-emerald-400" :
                            scan.scanStatus === "failed" ? "text-red-500" :
                            "text-muted-foreground"
                          )}>
                            {scan.scanStatus}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-muted-foreground tabular-nums">
                              {scan.scannedAt
                                ? format(new Date(scan.scannedAt), "MMM d, yyyy 'at' h:mm a")
                                : "—"}
                            </span>
                            {isAdmin && (
                              <button
                                type="button"
                                onClick={() => void deleteScan(scan.id)}
                                className="text-muted-foreground hover:text-red-500 transition-colors"
                                aria-label="Delete scan record"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </div>

                        {scan.scanStatus === "complete" && (
                          <div className="space-y-2">
                            {typeof scan.aiLikelihoodPercent === "number" ? (
                              <>
                                <div className="space-y-1">
                                  <div className="flex justify-between text-[10px] text-muted-foreground">
                                    <span>Estimated AI likelihood</span>
                                    <span className="font-medium tabular-nums">{scan.aiLikelihoodPercent}%</span>
                                  </div>
                                  <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                                    <div
                                      className={cn("h-full rounded-full transition-all", coverRiskBarColor(scan.aiLikelihoodPercent))}
                                      style={{ width: `${scan.aiLikelihoodPercent}%` }}
                                      role="progressbar"
                                      aria-valuenow={scan.aiLikelihoodPercent}
                                      aria-valuemin={0}
                                      aria-valuemax={100}
                                      aria-label={`Estimated AI likelihood: ${scan.aiLikelihoodPercent}%`}
                                    />
                                  </div>
                                  <div className="flex justify-between text-[10px] text-muted-foreground">
                                    <span>0% — Low</span>
                                    <span className={cn("font-semibold",
                                      scan.aiLikelihoodPercent < 25 ? "text-emerald-600 dark:text-emerald-400" :
                                      scan.aiLikelihoodPercent < 60 ? "text-amber-600 dark:text-amber-400" :
                                      scan.aiLikelihoodPercent < 90 ? "text-orange-600 dark:text-orange-400" :
                                      "text-red-600 dark:text-red-400"
                                    )}>
                                      {coverRiskLabel(scan.aiLikelihoodPercent)} Risk
                                    </span>
                                    <span>100% — Critical</span>
                                  </div>
                                </div>
                                <div className="flex flex-wrap items-center gap-3 text-[11px]">
                                  {scan.riskLevel && (
                                    <span className="capitalize text-muted-foreground">
                                      Risk: <strong className={cn(
                                        scan.riskLevel === "critical" ? "text-red-500" :
                                        scan.riskLevel === "high" ? "text-orange-500" :
                                        scan.riskLevel === "moderate" ? "text-amber-500" : "text-emerald-500"
                                      )}>{scan.riskLevel}</strong>
                                    </span>
                                  )}
                                  {scan.confidenceLevel && scan.confidenceLevel !== "unavailable" && (
                                    <span className="capitalize text-muted-foreground">
                                      Confidence: <strong>{scan.confidenceLevel}</strong>
                                    </span>
                                  )}
                                </div>
                              </>
                            ) : (
                              <div className="text-[11px] text-muted-foreground italic">
                                Score not extracted — see class breakdown below for raw provider output.
                              </div>
                            )}
                            {(() => {
                              const breakdown = parseCoverClassBreakdown(scan.rawResult);
                              if (!breakdown || breakdown.length === 0) return null;
                              return (
                                <div className="space-y-1 pt-0.5">
                                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
                                    Full Detection Breakdown
                                  </div>
                                  {breakdown.map(({ name, percent }) => (
                                    <div key={name} className="flex items-center gap-2">
                                      <div className="text-[10px] text-muted-foreground capitalize w-40 shrink-0 truncate" title={name}>
                                        {name}
                                      </div>
                                      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                                        <div
                                          className={cn("h-full rounded-full transition-all",
                                            percent >= 90 ? "bg-red-500" :
                                            percent >= 60 ? "bg-orange-500" :
                                            percent >= 25 ? "bg-amber-400" : "bg-emerald-500"
                                          )}
                                          style={{ width: `${percent}%` }}
                                        />
                                      </div>
                                      <div className="text-[10px] font-semibold tabular-nums w-9 text-right">{percent}%</div>
                                    </div>
                                  ))}
                                </div>
                              );
                            })()}
                            {(() => {
                              const breakdown = parseCoverClassBreakdown(scan.rawResult);
                              if (breakdown && breakdown.length > 0) return null;
                              if (!scan.rawResult) return null;
                              return (
                                <details className="text-[10px] pt-0.5">
                                  <summary className="cursor-pointer text-muted-foreground hover:text-foreground select-none">
                                    Raw detection response (debug)
                                  </summary>
                                  <pre className="mt-1.5 text-[9px] text-muted-foreground bg-muted/40 rounded p-2 overflow-x-auto max-h-48 overflow-y-auto whitespace-pre-wrap break-all leading-relaxed">
                                    {JSON.stringify(scan.rawResult, null, 2)}
                                  </pre>
                                </details>
                              );
                            })()}
                          </div>
                        )}

                        {scan.scanStatus === "failed" && (
                          <div className="rounded-md border border-red-500/30 bg-red-500/5 px-3 py-2">
                            <div className="flex items-start justify-between gap-2">
                              <div className="space-y-1 min-w-0">
                                <div className="text-[11px] font-medium text-red-600 dark:text-red-400">Scan failed</div>
                                {scan.errorMessage && (
                                  <div className="text-[10px] text-red-500/80 break-all leading-relaxed">{scan.errorMessage}</div>
                                )}
                              </div>
                              {coverUrl && (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="text-[10px] h-6 px-2 shrink-0 border-red-500/40 text-red-600 dark:text-red-400 hover:bg-red-500/10"
                                  disabled={scanning}
                                  onClick={() => void triggerScan()}
                                >
                                  {scanning ? <Loader2 className="w-3 h-3 animate-spin" /> : "Retry"}
                                </Button>
                              )}
                            </div>
                          </div>
                        )}

                        {scan.scanStatus === "unavailable" && (
                          <div className="text-[10px] text-muted-foreground">
                            Provider returned no result — key may be unconfigured.
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] text-amber-600 dark:text-amber-400">
                    Advisory estimates only — not conclusive proof.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Admin action panel ───────────────────────────────────────────── */}
        {isAdmin && (
          <div className="border-t border-border pt-3 space-y-3">
            {/* Current decision banner */}
            {decisionConfig && (
              <div className={cn("flex items-start gap-2 rounded-lg border px-3 py-2.5", decisionConfig.color)}>
                {decisionConfig.icon}
                <div className="space-y-0.5">
                  <div className="text-[11px] font-semibold">{decisionConfig.label}</div>
                  {currentNote && (
                    <div className="text-[10px] opacity-80 leading-relaxed">{currentNote}</div>
                  )}
                </div>
              </div>
            )}
            {!currentDecision && (
              <div className="text-[10px] text-muted-foreground italic">No admin decision recorded yet.</div>
            )}

            {/* Action buttons */}
            <div className="space-y-2">
              <div className="text-xs font-medium flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5 text-primary" />
                Admin Actions
              </div>
              <div className="flex flex-wrap gap-2">
                {COVER_ACTIONS.map((a) => (
                  <button
                    key={a.value}
                    type="button"
                    onClick={() => setSelectedAction(selectedAction === a.value ? "" : a.value)}
                    className={cn(
                      "px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-colors",
                      selectedAction === a.value
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:border-primary/50",
                    )}
                  >
                    {a.label}
                  </button>
                ))}
              </div>

              {selectedAction && selectedAction !== "cleared" && (
                <Textarea
                  aria-label="Admin note"
                  placeholder="Optional: add a note about this decision…"
                  className="text-xs min-h-[60px]"
                  value={actionNote}
                  onChange={(e) => setActionNote(e.target.value)}
                />
              )}

              {selectedAction && (
                <Button
                  type="button"
                  size="sm"
                  className="gap-2 text-xs"
                  onClick={() => void applyAction()}
                  disabled={actionLoading}
                >
                  {actionLoading ? "Applying…" : "Apply"}
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

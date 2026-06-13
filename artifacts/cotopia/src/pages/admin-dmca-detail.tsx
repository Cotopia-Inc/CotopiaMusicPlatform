import { useState } from "react";
import { Link, useRoute } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, AlertOctagon, Save, AlertTriangle, CheckCircle, Loader2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { CopyrightStrikeModal, type StrikeTarget } from "@/components/copyright-strike-modal";

const VALID_STATUSES = [
  "received", "under_review", "removed", "rejected",
  "counter_notice_received", "restored", "closed",
] as const;

const STATUS_COLORS: Record<string, string> = {
  received: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  under_review: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  removed: "bg-red-500/20 text-red-400 border-red-500/30",
  rejected: "bg-gray-500/20 text-gray-400 border-gray-500/30",
  counter_notice_received: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  restored: "bg-green-500/20 text-green-400 border-green-500/30",
  closed: "bg-secondary text-muted-foreground border-border",
};

interface DmcaClaim {
  id: number;
  claimantName: string;
  claimantEmail: string;
  claimantCompany?: string;
  copyrightOwner: string;
  workDescription: string;
  infringingUrl: string;
  goodFaithStatement: boolean;
  accuracyStatement: boolean;
  signature: string;
  status: string;
  adminNotes?: string;
  createdAt: string;
  updatedAt: string;
}

const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem("cotopia_token")}`, "Content-Type": "application/json" });

export default function AdminDmcaDetail() {
  const [, params] = useRoute("/admin/dmca/:id");
  const claimId = params?.id;
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: claim, isLoading } = useQuery<DmcaClaim>({
    queryKey: ["admin-dmca", claimId],
    queryFn: async () => {
      const res = await fetch(`${import.meta.env.BASE_URL}api/admin/dmca/${claimId}`, { headers: authHeaders() });
      if (!res.ok) throw new Error("Not found");
      return res.json();
    },
    enabled: !!claimId,
  });

  const [selectedStatus, setSelectedStatus] = useState<string>("");
  const [adminNotes, setAdminNotes] = useState<string>("");
  const [strikeTarget, setStrikeTarget] = useState<StrikeTarget | null>(null);

  const updateMutation = useMutation({
    mutationFn: async () => {
      const body: Record<string, unknown> = {};
      if (selectedStatus) body.status = selectedStatus;
      if (adminNotes !== claim?.adminNotes) body.adminNotes = adminNotes;
      const res = await fetch(`${import.meta.env.BASE_URL}api/admin/dmca/${claimId}`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Update failed");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Claim updated" });
      qc.invalidateQueries({ queryKey: ["admin-dmca", claimId] });
    },
    onError: (err) => toast({ title: "Update failed", description: String(err instanceof Error ? err.message : err), variant: "destructive" }),
  });


  if (isLoading) return (
    <div className="flex items-center justify-center py-24">
      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );
  if (!claim) return (
    <div className="max-w-3xl mx-auto px-4 py-12 text-center text-muted-foreground">
      Claim not found. <Link href="/admin/dmca" className="text-primary hover:underline">Back to DMCA list</Link>
    </div>
  );

  const currentNotes = adminNotes || claim.adminNotes || "";
  const currentStatus = selectedStatus || claim.status;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/admin/dmca" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ChevronLeft className="w-4 h-4" />DMCA Claims
        </Link>
      </div>

      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center">
            <AlertOctagon className="w-5 h-5 text-red-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold">DMCA Claim #{claim.id}</h1>
            <p className="text-xs text-muted-foreground">Submitted {new Date(claim.createdAt).toLocaleString()}</p>
          </div>
        </div>
        <Badge className={`text-xs border ${STATUS_COLORS[claim.status] ?? ""}`}>{claim.status.replace(/_/g, " ")}</Badge>
      </div>

      <div className="bg-card rounded-xl border border-border p-6 space-y-4">
        <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Claimant</h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div><p className="text-xs text-muted-foreground mb-1">Name</p><p className="font-medium">{claim.claimantName}</p></div>
          <div><p className="text-xs text-muted-foreground mb-1">Email</p><p>{claim.claimantEmail}</p></div>
          {claim.claimantCompany && <div><p className="text-xs text-muted-foreground mb-1">Company</p><p>{claim.claimantCompany}</p></div>}
          <div><p className="text-xs text-muted-foreground mb-1">Copyright Owner</p><p className="font-medium">{claim.copyrightOwner}</p></div>
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border p-6 space-y-4">
        <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Infringement Details</h2>
        <div>
          <p className="text-xs text-muted-foreground mb-1">Work Description</p>
          <p className="text-sm leading-relaxed bg-secondary/30 rounded-lg p-3">{claim.workDescription}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-1">Infringing URL</p>
          <a href={claim.infringingUrl} target="_blank" rel="noreferrer" className="text-sm text-primary hover:underline flex items-center gap-1">
            {claim.infringingUrl} <ExternalLink className="w-3 h-3" />
          </a>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className={`flex items-center gap-2 p-2.5 rounded-lg border ${claim.goodFaithStatement ? "bg-green-500/10 border-green-500/20 text-green-400" : "bg-red-500/10 border-red-500/20 text-red-400"} text-xs`}>
            <CheckCircle className="w-3.5 h-3.5" />Good Faith Statement {claim.goodFaithStatement ? "✓" : "✗"}
          </div>
          <div className={`flex items-center gap-2 p-2.5 rounded-lg border ${claim.accuracyStatement ? "bg-green-500/10 border-green-500/20 text-green-400" : "bg-red-500/10 border-red-500/20 text-red-400"} text-xs`}>
            <CheckCircle className="w-3.5 h-3.5" />Accuracy Statement {claim.accuracyStatement ? "✓" : "✗"}
          </div>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-1">Signature</p>
          <p className="text-sm italic">{claim.signature}</p>
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border p-6 space-y-4">
        <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Admin Actions</h2>

        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Update Status</Label>
          <div className="flex flex-wrap gap-2">
            {VALID_STATUSES.map(s => (
              <button
                key={s}
                onClick={() => setSelectedStatus(s)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                  currentStatus === s
                    ? `${STATUS_COLORS[s] ?? "bg-primary border-primary text-primary-foreground"} ring-1 ring-primary/50`
                    : "bg-secondary/50 text-muted-foreground border-border hover:border-border/80"
                }`}
              >
                {s.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="notes" className="text-xs text-muted-foreground">Admin Notes</Label>
          <Textarea
            id="notes"
            placeholder="Internal notes about this claim…"
            value={currentNotes}
            onChange={e => setAdminNotes(e.target.value)}
            rows={3}
            className="bg-secondary/50 border-secondary resize-none text-sm"
          />
        </div>

        <Button
          onClick={() => updateMutation.mutate()}
          disabled={updateMutation.isPending}
          className="gap-2"
        >
          {updateMutation.isPending ? <><Loader2 className="w-4 h-4 animate-spin" />Saving…</> : <><Save className="w-4 h-4" />Save Changes</>}
        </Button>
      </div>

      <div className="bg-card rounded-xl border border-amber-500/20 p-6 space-y-4">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-400" />
          <h2 className="font-semibold text-sm">Issue Copyright Strike</h2>
        </div>
        <p className="text-xs text-muted-foreground">
          Issue a strike to the uploader of the infringing content. All strikes are logged and auditable.
        </p>
        <Button
          variant="destructive"
          size="sm"
          className="gap-2"
          onClick={() => setStrikeTarget({
            userId: 0,
            uploaderName: claim.claimantName,
            contentType: "song",
            contentTitle: claim.workDescription.slice(0, 60),
            dmcaClaimId: claim.id,
          })}
        >
          <AlertTriangle className="w-4 h-4" />
          Open Strike Form
        </Button>
      </div>

      <CopyrightStrikeModal
        target={strikeTarget}
        onClose={() => setStrikeTarget(null)}
        onSuccess={() => { toast({ title: "Strike issued" }); }}
      />
    </div>
  );
}

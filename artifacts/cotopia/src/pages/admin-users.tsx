import { useAdminListUsers, getAdminListUsersQueryKey, useAdminUpdateUser, useAdminGetUserAgreements, getAdminGetUserAgreementsQueryKey, type AgreementRecord } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { UserLink } from "@/components/user-link";
import { AlertTriangle, ScrollText, Monitor, Globe, FileText, Users, Bot, ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import { useState, type ReactNode } from "react";
import { CopyrightStrikeModal, type StrikeTarget } from "@/components/copyright-strike-modal";
import { useAuth } from "@/lib/auth";

const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem("cotopia_token")}`, "Content-Type": "application/json" });

const AGREEMENT_LABELS: Record<string, { label: string; icon: ReactNode; color: string }> = {
  terms:                { label: "Terms of Service",       icon: <FileText className="w-3.5 h-3.5" />,  color: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
  privacy:              { label: "Privacy Policy",         icon: <Globe className="w-3.5 h-3.5" />,     color: "bg-green-500/15 text-green-400 border-green-500/30" },
  community_guidelines: { label: "Community Guidelines",   icon: <Users className="w-3.5 h-3.5" />,     color: "bg-purple-500/15 text-purple-400 border-purple-500/30" },
  ai_policy:            { label: "AI Content Policy",      icon: <Bot className="w-3.5 h-3.5" />,       color: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
  submission_agreement: { label: "Submission Agreement",   icon: <ScrollText className="w-3.5 h-3.5" />, color: "bg-rose-500/15 text-rose-400 border-rose-500/30" },
};

function AgreementsDialog({ userId, username, open, onClose }: { userId: number; username: string; open: boolean; onClose: () => void }) {
  const { data: records, isLoading } = useAdminGetUserAgreements(userId, {
    query: { enabled: open && !!userId, queryKey: getAdminGetUserAgreementsQueryKey(userId) },
  });
  const [expandedId, setExpandedId] = useState<number | null>(null);

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ScrollText className="w-5 h-5 text-primary" />
            Agreement Records — <span className="font-mono text-primary">@{username}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
          {isLoading ? (
            Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-lg" />)
          ) : !records?.length ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              <ScrollText className="w-8 h-8 mx-auto mb-3 opacity-30" />
              No agreement records found for this user.
            </div>
          ) : (
            records.map((rec: AgreementRecord) => {
              const meta = AGREEMENT_LABELS[rec.agreementType] ?? { label: rec.agreementType, icon: <FileText className="w-3.5 h-3.5" />, color: "bg-secondary text-foreground border-border" };
              const expanded = expandedId === rec.id;
              return (
                <div key={rec.id} className="rounded-lg border border-border bg-secondary/20 overflow-hidden">
                  <button
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-secondary/40 transition-colors text-left"
                    onClick={() => setExpandedId(expanded ? null : rec.id)}
                  >
                    <Badge className={`gap-1.5 text-[10px] font-medium border shrink-0 ${meta.color}`}>
                      {meta.icon}
                      {meta.label}
                    </Badge>
                    <span className="text-xs text-muted-foreground font-mono">v{rec.agreementVersion}</span>
                    <span className="text-xs text-muted-foreground ml-auto">
                      {format(new Date(rec.acceptedAt), "MMM d, yyyy 'at' HH:mm 'UTC'")}
                    </span>
                    {expanded ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
                  </button>

                  {expanded && (
                    <div className="px-4 pb-4 pt-1 border-t border-border space-y-3">
                      <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
                        <div>
                          <p className="text-muted-foreground uppercase tracking-wider text-[10px] font-semibold mb-1">Record ID</p>
                          <p className="font-mono">#{rec.id}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground uppercase tracking-wider text-[10px] font-semibold mb-1">Accepted At</p>
                          <p>{format(new Date(rec.acceptedAt), "PPpp")}</p>
                        </div>
                        <div className="col-span-2">
                          <p className="text-muted-foreground uppercase tracking-wider text-[10px] font-semibold mb-1 flex items-center gap-1">
                            <Globe className="w-3 h-3" /> IP Address
                          </p>
                          <p className="font-mono">{rec.ipAddress ?? <span className="text-muted-foreground/50 italic">not captured</span>}</p>
                        </div>
                        <div className="col-span-2">
                          <p className="text-muted-foreground uppercase tracking-wider text-[10px] font-semibold mb-1 flex items-center gap-1">
                            <Monitor className="w-3 h-3" /> User Agent
                          </p>
                          <p className="font-mono text-[10px] break-all text-muted-foreground">{rec.userAgent ?? <span className="italic">not captured</span>}</p>
                        </div>
                        {rec.submissionId && (
                          <div>
                            <p className="text-muted-foreground uppercase tracking-wider text-[10px] font-semibold mb-1">Submission</p>
                            <p className="font-mono">#{rec.submissionId}</p>
                          </div>
                        )}
                        {rec.paymentId && (
                          <div>
                            <p className="text-muted-foreground uppercase tracking-wider text-[10px] font-semibold mb-1">Payment</p>
                            <p className="font-mono">#{rec.paymentId}</p>
                          </div>
                        )}
                        {rec.metadata != null && (
                          <div className="col-span-2">
                            <p className="text-muted-foreground uppercase tracking-wider text-[10px] font-semibold mb-1">Context</p>
                            <p className="font-mono text-[10px] text-muted-foreground">{JSON.stringify(rec.metadata)}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {records && records.length > 0 && (
          <p className="text-xs text-muted-foreground pt-2 border-t border-border">
            {records.length} record{records.length !== 1 ? "s" : ""} total
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function AdminUsers() {
  const { data, isLoading } = useAdminListUsers({ limit: 50 }, {
    query: { queryKey: getAdminListUsersQueryKey({ limit: 50 }) }
  });

  const updateMutation = useAdminUpdateUser();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();
  const isMasterAdmin = currentUser?.role === "master_admin";
  const [strikeTarget, setStrikeTarget] = useState<StrikeTarget | null>(null);
  const [agreementsUser, setAgreementsUser] = useState<{ id: number; username: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; username: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteUser = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}api/admin/users/${deleteTarget.id}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast({ variant: "destructive", title: "Delete failed", description: err.error ?? "Unknown error" });
      } else {
        toast({ title: `@${deleteTarget.username} has been permanently deleted` });
        queryClient.invalidateQueries({ queryKey: getAdminListUsersQueryKey({ limit: 50 }) });
        setDeleteTarget(null);
      }
    } catch {
      toast({ variant: "destructive", title: "Network error" });
    } finally {
      setIsDeleting(false);
    }
  };

  const { data: strikeCountData } = useQuery<{ items: { userId: number; count: number }[] }>({
    queryKey: ["admin-strikes-summary"],
    queryFn: async () => {
      const res = await fetch(`${import.meta.env.BASE_URL}api/admin/strikes?limit=100`, { headers: authHeaders() });
      if (!res.ok) return { items: [] };
      const d = await res.json();
      const countMap: Record<number, number> = {};
      for (const s of d.items ?? []) {
        if (s.status === "active") countMap[s.userId] = (countMap[s.userId] ?? 0) + 1;
      }
      return { items: Object.entries(countMap).map(([uid, c]) => ({ userId: Number(uid), count: c })) };
    },
  });

  const strikeCountMap = new Map((strikeCountData?.items ?? []).map(x => [x.userId, x.count]));

  const handleToggleActive = (userId: number, currentStatus: boolean) => {
    updateMutation.mutate({ id: userId, data: { isActive: !currentStatus } }, {
      onSuccess: () => {
        toast({ title: "User updated successfully" });
        queryClient.invalidateQueries({ queryKey: getAdminListUsersQueryKey({ limit: 50 }) });
      }
    });
  };

  return (
    <>
    <div className="space-y-8 pb-24 max-w-6xl mx-auto">
      <div>
        <h1 className="text-4xl font-extrabold tracking-tight mb-2">User Management</h1>
        <p className="text-muted-foreground">Manage user accounts, roles, and access.</p>
      </div>

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
        <Table>
          <TableHeader className="bg-secondary/30">
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Strikes</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array(10).fill(0).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-12 rounded-full" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-16 rounded-full" /></TableCell>
                  <TableCell className="text-right"><Skeleton className="h-8 w-20 inline-block" /></TableCell>
                </TableRow>
              ))
            ) : data?.items?.length ? (
              data.items.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-semibold">
                    <UserLink username={user.username} userId={user.id} role={user.role as string} isVerified={user.isVerified ?? false} />
                  </TableCell>
                  <TableCell className="text-muted-foreground">{user.email}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="uppercase text-[10px] tracking-widest">{user.role}</Badge>
                  </TableCell>
                  <TableCell>
                    {(strikeCountMap.get(user.id) ?? 0) > 0 ? (
                      <Badge className={`gap-1 border text-[10px] ${strikeCountMap.get(user.id)! >= 3 ? "bg-red-500/20 text-red-400 border-red-500/30" : "bg-amber-500/20 text-amber-400 border-amber-500/30"}`}>
                        <AlertTriangle className="w-2.5 h-2.5" />
                        {strikeCountMap.get(user.id)}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground/40">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{format(new Date(user.createdAt), 'MMM d, yyyy')}</TableCell>
                  <TableCell>
                    <Badge variant={user.isActive ? "default" : "destructive"}>
                      {user.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-2 justify-end flex-wrap">
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs gap-1 text-primary/80 border-primary/20 hover:bg-primary/10"
                        onClick={() => setAgreementsUser({ id: user.id, username: user.username })}
                      >
                        <ScrollText className="w-3 h-3" />Agreements
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs gap-1 text-red-400 border-red-500/20 hover:bg-red-500/10"
                        onClick={() => setStrikeTarget({
                          userId: user.id,
                          uploaderName: user.username,
                          uploaderEmail: user.email,
                          contentType: "song",
                          contentTitle: "",
                        })}
                      >
                        <AlertTriangle className="w-3 h-3" />Strike
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleToggleActive(user.id, user.isActive ?? true)}
                        disabled={updateMutation.isPending}
                      >
                        {user.isActive ? "Deactivate" : "Activate"}
                      </Button>
                      {isMasterAdmin && user.role !== "master_admin" && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs gap-1 text-red-400 border-red-500/20 hover:bg-red-500/10 hover:border-red-500/40"
                          onClick={() => setDeleteTarget({ id: user.id, username: user.username })}
                        >
                          <Trash2 className="w-3 h-3" />Delete
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                  No users found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        </div>
      </div>
    </div>

    <CopyrightStrikeModal
      target={strikeTarget}
      onClose={() => setStrikeTarget(null)}
      onSuccess={() => queryClient.invalidateQueries({ queryKey: ["admin-strikes-summary"] })}
    />

    {agreementsUser && (
      <AgreementsDialog
        userId={agreementsUser.id}
        username={agreementsUser.username}
        open={!!agreementsUser}
        onClose={() => setAgreementsUser(null)}
      />
    )}

    <Dialog open={!!deleteTarget} onOpenChange={v => { if (!v) setDeleteTarget(null); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-400">
            <Trash2 className="w-5 h-5" />
            Delete User Permanently
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <p className="text-sm text-muted-foreground">
            You are about to permanently delete{" "}
            <span className="font-semibold text-foreground">@{deleteTarget?.username}</span>.
            This will remove their account, content, and all associated data. This cannot be undone.
          </p>
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
            <p className="text-xs text-red-400 font-medium">⚠ All songs, videos, playlists, and messages belonging to this user will also be deleted.</p>
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={isDeleting}>Cancel</Button>
          <Button
            variant="destructive"
            onClick={handleDeleteUser}
            disabled={isDeleting}
            className="gap-2"
          >
            {isDeleting ? <span className="animate-spin">⏳</span> : <Trash2 className="w-4 h-4" />}
            {isDeleting ? "Deleting..." : "Delete Permanently"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}

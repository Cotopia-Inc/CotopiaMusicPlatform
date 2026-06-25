import { useListSubmissions, getListSubmissionsQueryKey, useDeleteSubmission } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

export default function Submissions() {
  const { data, isLoading } = useListSubmissions({
    query: { queryKey: getListSubmissionsQueryKey() }
  });
  const { toast } = useToast();
  const qc = useQueryClient();
  const deleteMutation = useDeleteSubmission();
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const handleWithdraw = (id: number) => {
    setDeletingId(id);
    deleteMutation.mutate({ id }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListSubmissionsQueryKey() });
        toast({ title: "Submission withdrawn and deleted" });
      },
      onError: () => toast({ variant: "destructive", title: "Failed to withdraw submission" }),
      onSettled: () => setDeletingId(null),
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
      case 'published': return 'bg-green-500/10 text-green-500 border-green-500/20';
      case 'rejected': return 'bg-red-500/10 text-red-500 border-red-500/20';
      case 'pending_review': return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
      default: return 'bg-secondary text-secondary-foreground border-secondary-foreground/20';
    }
  };

  return (
    <div className="space-y-8 pb-24 max-w-6xl mx-auto">
      <div className="space-y-2">
        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">My Submissions</h1>
        <p className="text-muted-foreground">Track the status of your submitted content.</p>
      </div>

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <Table>
          <TableHeader className="bg-secondary/30">
            <TableRow>
              <TableHead>Type</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Payment</TableHead>
              <TableHead>Submitted</TableHead>
              <TableHead>Notes</TableHead>
              <TableHead className="w-24">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array(5).fill(0).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-24 rounded-full" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                </TableRow>
              ))
            ) : data?.length ? (
              data.map((sub) => (
                <TableRow key={sub.id}>
                  <TableCell className="capitalize font-medium text-muted-foreground">{sub.type}</TableCell>
                  <TableCell className="font-semibold">{sub.title}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={getStatusColor(sub.status)}>
                      {sub.status.replace('_', ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell className="capitalize">{sub.paymentStatus || 'N/A'}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{format(new Date(sub.createdAt), 'MMM d, yyyy')}</TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                    {sub.adminNotes || '-'}
                  </TableCell>
                  <TableCell>
                    {["draft", "pending_review"].includes(sub.status) && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs text-red-500/60 hover:text-red-500 hover:bg-red-500/10 gap-1"
                        onClick={() => handleWithdraw(sub.id)}
                        disabled={deletingId === sub.id}
                        title="Withdraw and delete this submission"
                      >
                        <Trash2 className="w-3 h-3" />
                        {deletingId === sub.id ? "…" : "Withdraw"}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                  You haven't submitted any content yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

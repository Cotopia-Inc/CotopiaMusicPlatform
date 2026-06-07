import { useAdminListSubmissions, getAdminListSubmissionsQueryKey, useUpdateSubmission } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { useState } from "react";
import { Input } from "@/components/ui/input";

type SubmissionStatus = "approved" | "rejected" | "pending_review" | "draft" | "published";

export default function AdminSubmissions() {
  const { data, isLoading } = useAdminListSubmissions({ status: "pending_review" }, {
    query: { queryKey: getAdminListSubmissionsQueryKey({ status: "pending_review" }) }
  });

  const updateMutation = useUpdateSubmission();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [notes, setNotes] = useState<Record<number, string>>({});

  const handleUpdateStatus = (id: number, status: SubmissionStatus) => {
    updateMutation.mutate({ id, data: { status, adminNotes: notes[id] } }, {
      onSuccess: () => {
        toast({ title: `Submission ${status}` });
        queryClient.invalidateQueries({ queryKey: getAdminListSubmissionsQueryKey({ status: "pending_review" }) });
      }
    });
  };

  return (
    <div className="space-y-8 pb-24 max-w-6xl mx-auto">
      <div>
        <h1 className="text-4xl font-extrabold tracking-tight mb-2">Review Submissions</h1>
        <p className="text-muted-foreground">Approve or reject content submitted by artists and labels.</p>
      </div>

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <Table>
          <TableHeader className="bg-secondary/30">
            <TableRow>
              <TableHead>Type</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Submitter</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Admin Notes</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array(5).fill(0).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-8 w-40" /></TableCell>
                  <TableCell className="text-right"><Skeleton className="h-8 w-32 inline-block" /></TableCell>
                </TableRow>
              ))
            ) : data?.length ? (
              data.map((sub) => (
                <TableRow key={sub.id}>
                  <TableCell>
                    <Badge variant="outline" className="uppercase text-[10px] tracking-widest">{sub.type}</Badge>
                  </TableCell>
                  <TableCell className="font-semibold">{sub.title}</TableCell>
                  <TableCell className="text-muted-foreground">{sub.submitterName || `User ${sub.userId}`}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{format(new Date(sub.createdAt), 'MMM d, yyyy')}</TableCell>
                  <TableCell>
                    <Input 
                      placeholder="Add notes..." 
                      className="bg-secondary/50 border-secondary h-8 text-sm"
                      value={notes[sub.id] || ''}
                      onChange={(e) => setNotes(prev => ({...prev, [sub.id]: e.target.value}))}
                    />
                  </TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button 
                      variant="destructive" 
                      size="sm"
                      onClick={() => handleUpdateStatus(sub.id, "rejected")}
                      disabled={updateMutation.isPending}
                    >
                      Reject
                    </Button>
                    <Button 
                      variant="default" 
                      size="sm"
                      className="bg-green-600 hover:bg-green-700 text-white"
                      onClick={() => handleUpdateStatus(sub.id, "approved")}
                      disabled={updateMutation.isPending}
                    >
                      Approve
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                  No pending submissions to review.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

import { useListSubmissions, getListSubmissionsQueryKey } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";

export default function Submissions() {
  const { data, isLoading } = useListSubmissions({
    query: { queryKey: getListSubmissionsQueryKey() }
  });

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
        <h1 className="text-4xl font-extrabold tracking-tight">My Submissions</h1>
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
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
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

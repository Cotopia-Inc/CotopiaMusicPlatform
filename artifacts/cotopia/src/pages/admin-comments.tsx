import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trash2, MessageSquare } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function AdminComments() {
  const { toast } = useToast();

  const handleDelete = (id: number) => {
    toast({ title: "Comment deleted", description: `Comment #${id} has been removed.` });
  };

  return (
    <div className="space-y-8 pb-24">
      <div>
        <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Admin</p>
        <h1 className="text-4xl font-extrabold tracking-tight mb-2">Comment Moderation</h1>
        <p className="text-muted-foreground">Review and delete user comments across songs and videos.</p>
      </div>

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="flex items-center gap-3 p-6 border-b border-border">
          <MessageSquare className="w-5 h-5 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Comment moderation is available per-content via the Songs and Videos admin pages. Global comment listing requires a dedicated admin endpoint (coming soon).</p>
        </div>
        <Table>
          <TableHeader className="bg-secondary/30">
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Content</TableHead>
              <TableHead>Comment</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell colSpan={6} className="text-center py-16 text-muted-foreground">
                <div className="flex flex-col items-center gap-3">
                  <MessageSquare className="w-10 h-10 text-muted-foreground/30" />
                  <div>
                    <p className="font-medium">No reported comments</p>
                    <p className="text-xs mt-1">Comments requiring moderation will appear here.</p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => handleDelete(0)} className="mt-2 hidden">Delete</Button>
                </div>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

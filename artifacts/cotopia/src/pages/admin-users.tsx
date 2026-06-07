import { useAdminListUsers, getAdminListUsersQueryKey, useAdminUpdateUser } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";

export default function AdminUsers() {
  const { data, isLoading } = useAdminListUsers({ limit: 50 }, {
    query: { queryKey: getAdminListUsersQueryKey({ limit: 50 }) }
  });

  const updateMutation = useAdminUpdateUser();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleToggleActive = (userId: number, currentStatus: boolean) => {
    updateMutation.mutate({ id: userId, data: { isActive: !currentStatus } }, {
      onSuccess: () => {
        toast({ title: "User updated successfully" });
        queryClient.invalidateQueries({ queryKey: getAdminListUsersQueryKey({ limit: 50 }) });
      }
    });
  };

  return (
    <div className="space-y-8 pb-24 max-w-6xl mx-auto">
      <div>
        <h1 className="text-4xl font-extrabold tracking-tight mb-2">User Management</h1>
        <p className="text-muted-foreground">Manage user accounts, roles, and access.</p>
      </div>

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <Table>
          <TableHeader className="bg-secondary/30">
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
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
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-16 rounded-full" /></TableCell>
                  <TableCell className="text-right"><Skeleton className="h-8 w-20 inline-block" /></TableCell>
                </TableRow>
              ))
            ) : data?.items?.length ? (
              data.items.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-semibold">{user.username}</TableCell>
                  <TableCell className="text-muted-foreground">{user.email}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="uppercase text-[10px] tracking-widest">{user.role}</Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{format(new Date(user.createdAt), 'MMM d, yyyy')}</TableCell>
                  <TableCell>
                    <Badge variant={user.isActive ? "default" : "destructive"}>
                      {user.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleToggleActive(user.id, user.isActive ?? true)}
                      disabled={updateMutation.isPending}
                    >
                      {user.isActive ? "Deactivate" : "Activate"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                  No users found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

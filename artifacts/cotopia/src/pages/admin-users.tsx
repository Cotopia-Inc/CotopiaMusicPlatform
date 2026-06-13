import { useAdminListUsers, getAdminListUsersQueryKey, useAdminUpdateUser } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { UserLink } from "@/components/user-link";
import { AlertTriangle } from "lucide-react";
import { useState } from "react";
import { CopyrightStrikeModal, type StrikeTarget } from "@/components/copyright-strike-modal";

const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem("cotopia_token")}`, "Content-Type": "application/json" });

export default function AdminUsers() {
  const { data, isLoading } = useAdminListUsers({ limit: 50 }, {
    query: { queryKey: getAdminListUsersQueryKey({ limit: 50 }) }
  });

  const updateMutation = useAdminUpdateUser();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [strikeTarget, setStrikeTarget] = useState<StrikeTarget | null>(null);

  // Fetch strike counts for all users
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
                    <div className="flex gap-2 justify-end">
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
    </>
  );
}

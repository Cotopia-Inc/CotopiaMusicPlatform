import { useState } from "react";
import { useAdminListUsers, useAdminChangeUserRole } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import { useEffect } from "react";
import { Shield, Search, ChevronDown, XCircle, Ban, UserCheck, BadgeCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { getAdminListUsersQueryKey } from "@workspace/api-client-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
  DropdownMenuSeparator, DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";

const ALL_ROLES = ["listener", "artist", "label", "business", "moderator", "editor", "admin", "master_admin"] as const;
type Role = typeof ALL_ROLES[number];

const ROLE_COLORS: Record<string, string> = {
  listener: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  artist: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  label: "bg-pink-500/20 text-pink-400 border-pink-500/30",
  business: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  admin: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  master_admin: "bg-red-500/20 text-red-400 border-red-500/30",
  editor: "bg-green-500/20 text-green-400 border-green-500/30",
  moderator: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
};

const STAFF_ROLES = ["admin", "master_admin", "moderator", "editor"];

export default function AdminRoles() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (user && user.role !== "master_admin") navigate("/admin");
  }, [user, navigate]);

  const { data, isLoading } = useAdminListUsers({ q: search || undefined, role: filterRole, limit: 100 });
  const changeRole = useAdminChangeUserRole();

  async function handleRoleChange(userId: number, newRole: Role) {
    try {
      await changeRole.mutateAsync({ id: userId, data: { role: newRole } });
      queryClient.invalidateQueries({ queryKey: getAdminListUsersQueryKey() });
      toast({ title: "Role updated", description: `User role changed to ${newRole.replace("_", " ")}` });
    } catch {
      toast({ title: "Failed to update role", variant: "destructive" });
    }
  }

  async function handleVerify(userId: number, isVerified: boolean) {
    try {
      await changeRole.mutateAsync({ id: userId, data: { role: data?.items.find(u => u.id === userId)?.role as Role ?? "listener", isVerified } });
      queryClient.invalidateQueries({ queryKey: getAdminListUsersQueryKey() });
      toast({ title: isVerified ? "User verified" : "Verification removed" });
    } catch {
      toast({ title: "Failed", variant: "destructive" });
    }
  }

  async function handleSuspend(userId: number, isSuspended: boolean) {
    try {
      await changeRole.mutateAsync({ id: userId, data: { role: data?.items.find(u => u.id === userId)?.role as Role ?? "listener", isSuspended } });
      queryClient.invalidateQueries({ queryKey: getAdminListUsersQueryKey() });
      toast({ title: isSuspended ? "User suspended" : "User unsuspended" });
    } catch {
      toast({ title: "Failed", variant: "destructive" });
    }
  }

  const users = data?.items ?? [];

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Shield className="w-6 h-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Role Management</h1>
          <p className="text-sm text-muted-foreground">Master admin — assign roles and manage staff</p>
        </div>
      </div>

      {/* Staff summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {STAFF_ROLES.map(role => {
          const cnt = (data?.items ?? []).filter(u => u.role === role).length;
          return (
            <Card key={role} className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => setFilterRole(filterRole === role ? undefined : role)}>
              <CardContent className="pt-4 pb-4">
                <p className={`text-[10px] font-bold uppercase tracking-wider capitalize mb-1 ${ROLE_COLORS[role]?.split(" ")[1] ?? "text-muted-foreground"}`}>
                  {role.replace("_", " ")}
                </p>
                <p className="text-xl font-bold">{cnt}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search users..."
            className="pl-9"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="gap-2">
              {filterRole ? filterRole.replace("_", " ") : "All Roles"}
              <ChevronDown className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={() => setFilterRole(undefined)}>All Roles</DropdownMenuItem>
            <DropdownMenuSeparator />
            {ALL_ROLES.map(r => (
              <DropdownMenuItem key={r} onClick={() => setFilterRole(r)}>
                {r.replace("_", " ")}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Users table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">
            Users ({data?.total ?? 0})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="divide-y divide-border">
              {users.map(u => (
                <div key={u.id} className="flex items-center gap-4 px-6 py-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold overflow-hidden flex-shrink-0">
                    {u.avatarUrl
                      ? <img src={u.avatarUrl} alt={u.username} className="w-full h-full object-cover" />
                      : u.username[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate">{u.username}</p>
                      {(u as any).isVerified && <BadgeCheck className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />}
                      {(u as any).isSuspended && <Ban className="w-3 h-3 text-red-400 flex-shrink-0" />}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-1 rounded-md border capitalize ${ROLE_COLORS[u.role] ?? "bg-muted text-muted-foreground border-border"}`}>
                    {u.role.replace("_", " ")}
                  </span>
                  {/* Only allow role change if not same user */}
                  {u.id !== user?.id && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                          Change Role <ChevronDown className="w-3 h-3" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Assign Role</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {ALL_ROLES.filter(r => {
                            if (r === u.role) return false;
                            if (r === "master_admin" && user?.role !== "master_admin") return false;
                            if (r === "admin" && user?.role !== "admin" && user?.role !== "master_admin") return false;
                            return true;
                          }).map(r => (
                          <DropdownMenuItem key={r} onClick={() => handleRoleChange(u.id, r)}>
                            <span className={`w-2 h-2 rounded-full mr-2 inline-block ${ROLE_COLORS[r]?.split(" ")[0] ?? "bg-muted"}`} />
                            {r.replace("_", " ")}
                          </DropdownMenuItem>
                        ))}
                        <DropdownMenuSeparator />
                        {!(u as any).isVerified && (
                          <DropdownMenuItem onClick={() => handleVerify(u.id, true)}>
                            <UserCheck className="w-3.5 h-3.5 mr-2" />Verify user
                          </DropdownMenuItem>
                        )}
                        {(u as any).isVerified && (
                          <DropdownMenuItem onClick={() => handleVerify(u.id, false)}>
                            <XCircle className="w-3.5 h-3.5 mr-2" />Remove verification
                          </DropdownMenuItem>
                        )}
                        {!(u as any).isSuspended
                          ? <DropdownMenuItem className="text-red-400" onClick={() => handleSuspend(u.id, true)}>
                              <Ban className="w-3.5 h-3.5 mr-2" />Suspend
                            </DropdownMenuItem>
                          : <DropdownMenuItem onClick={() => handleSuspend(u.id, false)}>
                              <UserCheck className="w-3.5 h-3.5 mr-2" />Unsuspend
                            </DropdownMenuItem>
                        }
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              ))}
              {users.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">No users found</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

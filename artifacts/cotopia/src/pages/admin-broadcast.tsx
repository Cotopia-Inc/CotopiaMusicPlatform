import {
  useSendBroadcast,
  useAdminListBroadcasts,
  useAdminDeleteBroadcast,
  useAdminDeleteAllBroadcasts,
  getAdminListBroadcastsQueryKey,
  useAdminListUsers,
  getAdminListUsersQueryKey,
  type Broadcast,
  type User,
} from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { RoleBadges } from "@/components/role-badges";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { Megaphone, Send, Search, X, Users, UserMinus, Trash2 } from "lucide-react";
import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function AdminBroadcastPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [excluded, setExcluded] = useState<User[]>([]);

  const { data: history, isLoading: historyLoading } = useAdminListBroadcasts({
    query: { queryKey: getAdminListBroadcastsQueryKey() },
  });

  const { data: userResults, isLoading: usersLoading } = useAdminListUsers(
    { q: search, limit: 8 },
    { query: { enabled: search.trim().length > 0, queryKey: getAdminListUsersQueryKey({ q: search, limit: 8 }) } }
  );

  const sendBroadcast = useSendBroadcast();
  const deleteBroadcast = useAdminDeleteBroadcast();
  const deleteAllBroadcasts = useAdminDeleteAllBroadcasts();

  const excludedIds = new Set(excluded.map((u) => u.id));
  const searchMatches = (userResults?.items ?? []).filter((u) => !excludedIds.has(u.id));

  const addExcluded = (user: User) => {
    setExcluded((prev) => (prev.some((u) => u.id === user.id) ? prev : [...prev, user]));
    setSearch("");
  };

  const removeExcluded = (id: number) => {
    setExcluded((prev) => prev.filter((u) => u.id !== id));
  };

  const canSend = title.trim().length > 0 && message.trim().length > 0 && !sendBroadcast.isPending;

  const handleSend = () => {
    if (!canSend) return;
    sendBroadcast.mutate(
      { data: { title: title.trim(), message: message.trim(), excludedUserIds: excluded.map((u) => u.id) } },
      {
        onSuccess: (broadcast: Broadcast) => {
          toast({
            title: "Broadcast sent",
            description: `Delivered to ${broadcast.recipientCount} ${broadcast.recipientCount === 1 ? "user" : "users"}.`,
          });
          setTitle("");
          setMessage("");
          setExcluded([]);
          setSearch("");
          queryClient.invalidateQueries({ queryKey: getAdminListBroadcastsQueryKey() });
        },
        onError: () => {
          toast({ title: "Failed to send broadcast", description: "Please try again.", variant: "destructive" });
        },
      }
    );
  };

  const handleDelete = (id: number) => {
    deleteBroadcast.mutate(
      { id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getAdminListBroadcastsQueryKey() });
          toast({ title: "Broadcast deleted" });
        },
        onError: () => {
          toast({ title: "Failed to delete broadcast", variant: "destructive" });
        },
      }
    );
  };

  const handleDeleteAll = () => {
    deleteAllBroadcasts.mutate(undefined, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getAdminListBroadcastsQueryKey() });
        toast({ title: "All broadcasts deleted" });
      },
      onError: () => {
        toast({ title: "Failed to delete broadcasts", variant: "destructive" });
      },
    });
  };

  return (
    <div className="space-y-8 pb-24">
      <div>
        <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Admin</p>
        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-2 flex items-center gap-3">
          <Megaphone className="w-8 h-8 text-amber-400" />
          Broadcast
        </h1>
        <p className="text-muted-foreground">Send a public-address announcement to every active user. Exclude specific people if needed.</p>
      </div>

      <div className="grid gap-8 lg:grid-cols-5">
        {/* Compose */}
        <div className="lg:col-span-3 space-y-5 bg-card border border-border rounded-2xl p-6">
          <div className="space-y-2">
            <label htmlFor="broadcast-title" className="text-sm font-semibold">Title</label>
            <Input
              id="broadcast-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Scheduled maintenance tonight"
              maxLength={200}
            />
            <p className="text-[11px] text-muted-foreground text-right">{title.length}/200</p>
          </div>

          <div className="space-y-2">
            <label htmlFor="broadcast-message" className="text-sm font-semibold">Message</label>
            <Textarea
              id="broadcast-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Write your announcement…"
              rows={5}
              maxLength={2000}
            />
            <p className="text-[11px] text-muted-foreground text-right">{message.length}/2000</p>
          </div>

          {/* Exclude users */}
          <div className="space-y-2">
            <label className="text-sm font-semibold flex items-center gap-2">
              <UserMinus className="w-4 h-4 text-muted-foreground" />
              Exclude users <span className="text-muted-foreground font-normal">(optional)</span>
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                aria-label="Search users to exclude"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search users by name, username or email…"
                className="pl-9"
              />
              {search.trim().length > 0 && (
                <div className="absolute z-10 mt-1 w-full bg-popover border border-border rounded-lg shadow-lg max-h-64 overflow-y-auto">
                  {usersLoading ? (
                    <div className="p-3 space-y-2">
                      {Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-8 w-full rounded" />)}
                    </div>
                  ) : searchMatches.length === 0 ? (
                    <div className="p-4 text-sm text-muted-foreground text-center">No matching users.</div>
                  ) : (
                    searchMatches.map((u) => (
                      <button
                        key={u.id}
                        onClick={() => addExcluded(u)}
                        className="w-full flex items-center justify-between gap-2 px-3 py-2 hover:bg-secondary/60 transition-colors text-left"
                      >
                        <span className="min-w-0">
                          <span className="text-sm font-medium truncate flex items-center gap-0.5">{u.displayName || u.username}<RoleBadges role={u.role} size="sm" isVerified={false} /></span>
                          <span className="text-xs text-muted-foreground truncate block">@{u.username} · {u.email}</span>
                        </span>
                        <Badge variant="outline" className="text-[10px] shrink-0 capitalize">{u.role}</Badge>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            {excluded.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {excluded.map((u) => (
                  <Badge key={u.id} variant="secondary" className="gap-1.5 pl-2.5 pr-1 py-1">
                    <span className="inline-flex items-center gap-0.5">{u.displayName || u.username}<RoleBadges role={u.role} size="sm" isVerified={false} /></span>
                    <button
                      onClick={() => removeExcluded(u.id)}
                      className="rounded-full hover:bg-foreground/10 p-0.5"
                      title="Remove"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-border">
            <p className="text-xs text-muted-foreground">
              {excluded.length > 0
                ? `Excluding ${excluded.length} ${excluded.length === 1 ? "user" : "users"}. You won't be notified.`
                : "Will reach all active users. You won't be notified."}
            </p>
            <Button onClick={handleSend} disabled={!canSend} className="gap-2">
              <Send className="w-4 h-4" />
              {sendBroadcast.isPending ? "Sending…" : "Send broadcast"}
            </Button>
          </div>
        </div>

        {/* History */}
        <div className="lg:col-span-2 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              History {history && history.length > 0 && `(${history.length})`}
            </h2>
            {history && history.length > 0 && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-destructive hover:text-destructive hover:bg-destructive/10 gap-1.5"
                    disabled={deleteAllBroadcasts.isPending}
                  >
                    <Trash2 className="w-3 h-3" />
                    Delete all
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete all broadcasts?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently remove all {history.length} broadcast{history.length === 1 ? "" : "s"} from the history. This cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDeleteAll}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Delete all
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>

          <div className="overflow-y-auto max-h-[600px] space-y-3 pr-1">
            {historyLoading ? (
              Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)
            ) : history?.length ? (
              history.map((b) => (
                <div key={b.id} className="bg-card border border-border rounded-xl p-4 space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold leading-tight">{b.title}</p>
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                        {formatDistanceToNow(new Date(b.createdAt), { addSuffix: true })}
                      </span>
                      <button
                        onClick={() => handleDelete(b.id)}
                        disabled={deleteBroadcast.isPending}
                        className="rounded p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                        title="Delete broadcast"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-3">{b.message}</p>
                  <div className="flex items-center gap-3 pt-1 text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      {b.recipientCount} reached
                    </span>
                    {b.excludedUserIds.length > 0 && (
                      <span className="flex items-center gap-1">
                        <UserMinus className="w-3 h-3" />
                        {b.excludedUserIds.length} excluded
                      </span>
                    )}
                    {(b.senderDisplayName || b.senderUsername) && (
                      <span className="ml-auto truncate inline-flex items-center gap-0.5">by {b.senderDisplayName || b.senderUsername}<RoleBadges role={b.senderRole} size="sm" isVerified={false} /></span>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-12 bg-card rounded-2xl border border-border text-muted-foreground">
                <Megaphone className="w-10 h-10 mx-auto mb-3 opacity-20" />
                <p className="text-sm font-medium">No broadcasts yet</p>
                <p className="text-xs mt-1">Your sent announcements will appear here.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

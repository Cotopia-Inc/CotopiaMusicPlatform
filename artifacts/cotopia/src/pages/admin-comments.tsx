import { useState } from "react";
import {
  useAdminListChatMessages, getAdminListChatMessagesQueryKey,
  useDeleteComment,
} from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RoleBadges } from "@/components/role-badges";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MessageSquare, Search, Music, Video, Trash2 } from "lucide-react";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

function formatTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diff = (now.getTime() - d.getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return d.toLocaleDateString();
}

export default function AdminComments() {
  const [search, setSearch] = useState("");
  const [contentTypeFilter, setContentTypeFilter] = useState<"all" | "song" | "video">("all");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const queryParams = {
    limit: 100,
    contentType: contentTypeFilter !== "all" ? contentTypeFilter as "song" | "video" : undefined,
  };

  const { data: messages, isLoading } = useAdminListChatMessages(
    queryParams,
    { query: { queryKey: getAdminListChatMessagesQueryKey(queryParams) } }
  );

  const deleteMutation = useDeleteComment();

  const handleDelete = (id: number) => {
    deleteMutation.mutate(
      { id },
      {
        onSuccess: () => {
          toast({ title: "Message deleted" });
          queryClient.invalidateQueries({ queryKey: getAdminListChatMessagesQueryKey(queryParams) });
        },
        onError: () => toast({ variant: "destructive", title: "Failed to delete message" }),
      }
    );
  };

  const filtered = messages?.filter((m) =>
    !search ||
    m.username.toLowerCase().includes(search.toLowerCase()) ||
    m.message.toLowerCase().includes(search.toLowerCase())
  ) ?? [];

  return (
    <div className="space-y-8 pb-24">
      <div>
        <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Admin</p>
        <h1 className="text-4xl font-extrabold tracking-tight mb-2">Live Chat Moderation</h1>
        <p className="text-muted-foreground">Review and remove chat messages posted on songs and videos.</p>
      </div>

      <div className="flex items-center gap-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by user or message..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-secondary/50 border-secondary"
          />
        </div>
        <Select value={contentTypeFilter} onValueChange={(v) => setContentTypeFilter(v as typeof contentTypeFilter)}>
          <SelectTrigger className="w-36 bg-secondary/50 border-secondary">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="song">Songs only</SelectItem>
            <SelectItem value="video">Videos only</SelectItem>
          </SelectContent>
        </Select>
        <Badge variant="secondary" className="text-xs px-3 py-1.5">
          {filtered.length} message{filtered.length !== 1 ? "s" : ""}
        </Badge>
      </div>

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <Table>
          <TableHeader className="bg-secondary/30">
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Message</TableHead>
              <TableHead>Content</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>When</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array(8).fill(0).map((_, i) => (
                <TableRow key={i}>
                  {Array(6).fill(0).map((__, j) => (
                    <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : filtered.length ? (
              filtered.map((msg) => (
                <TableRow key={msg.id} className="hover:bg-secondary/20">
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-primary/20 overflow-hidden flex-shrink-0 flex items-center justify-center text-[11px] font-bold text-primary">
                        {msg.avatarUrl
                          ? <img src={msg.avatarUrl} alt={msg.username} className="w-full h-full object-cover" />
                          : msg.username[0].toUpperCase()}
                      </div>
                      <span className="text-sm font-medium flex items-center gap-1">{msg.username}<RoleBadges role={msg.role ?? undefined} size="sm" /></span>
                    </div>
                  </TableCell>
                  <TableCell className="max-w-xs">
                    <p className="text-sm truncate" title={msg.message}>{msg.message}</p>
                  </TableCell>
                  <TableCell>
                    <Link href={`/${msg.contentType}s/${msg.contentId}`}>
                      <span className="text-sm text-primary hover:underline cursor-pointer">
                        View {msg.contentType}
                      </span>
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="gap-1 text-xs capitalize">
                      {msg.contentType === "song"
                        ? <Music className="w-3 h-3" />
                        : <Video className="w-3 h-3" />}
                      {msg.contentType}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                    {formatTime(msg.createdAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      onClick={() => handleDelete(msg.id)}
                      disabled={deleteMutation.isPending}
                      title="Delete message"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-16 text-muted-foreground">
                  <div className="flex flex-col items-center gap-3">
                    <MessageSquare className="w-10 h-10 text-muted-foreground/30" />
                    <div>
                      <p className="font-medium">No messages found</p>
                      <p className="text-xs mt-1">
                        {search ? "Try a different search term." : "Chat messages from songs and videos will appear here."}
                      </p>
                    </div>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

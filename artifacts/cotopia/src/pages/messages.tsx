import { useState, useEffect, useRef } from "react";
import { displayRole } from "@/lib/display-role";
import { useAuth } from "@/lib/auth";
import { usePlatformConfig } from "@/lib/platform-config";
import { useLocation } from "wouter";
import {
  useListConversations,
  useSendDirectMessage,
  useGetConversationMessages,
  useMarkConversationRead,
  getListConversationsQueryKey,
  getGetConversationMessagesQueryKey,
  getGetUnreadMessageCountQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { VerifyEmailBanner } from "@/components/verify-email-banner";
import { RoleBadges } from "@/components/role-badges";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Send, MessageCircle, ArrowLeft, Search, Plus, X, Star, UserRound, Pencil, Trash2, MoreVertical, BellOff, Bell, Shield, ShieldOff } from "lucide-react";
import { ReportModal } from "@/components/report-modal";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";

type UserResult = {
  id: number;
  username: string;
  displayName?: string | null;
  avatarUrl?: string | null;
  role: string;
  isVerified: boolean;
};

function authHeaders() {
  const token = localStorage.getItem("cotopia_token");
  return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
}

export default function MessagesPage() {
  const { user } = useAuth();
  const config = usePlatformConfig();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();

  useEffect(() => {
    if (!user) navigate("/login");
  }, [user, navigate]);

  const [selectedConvId, setSelectedConvId] = useState<number | null>(null);
  const [newMsgBody, setNewMsgBody] = useState("");
  const [convSearch, setConvSearch] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // New message dialog state
  const [newMsgOpen, setNewMsgOpen] = useState(false);
  const [userSearch, setUserSearch] = useState("");
  const [userResults, setUserResults] = useState<UserResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [newConvUser, setNewConvUser] = useState<UserResult | null>(null);

  // Edit / delete state
  const [editingMsgId, setEditingMsgId] = useState<number | null>(null);
  const [editingBody, setEditingBody] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [deletingMsgId, setDeletingMsgId] = useState<number | null>(null);

  // Moderation state
  const [blockedUserIds, setBlockedUserIds] = useState<Set<number>>(new Set());
  const [convOptionsOpen, setConvOptionsOpen] = useState<number | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const convOptionsRef = useRef<HTMLDivElement>(null);

  // Handle ?new=userId URL param to pre-start conversation
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const newUserId = params.get("new");
    if (newUserId) {
      fetch(`/api/users/${newUserId}`)
        .then(r => r.ok ? r.json() : null)
        .then(u => { if (u?.id) setNewConvUser(u as UserResult); })
        .catch(() => {});
    }
  }, []);

  const { data: conversations = [], isLoading: convsLoading } = useListConversations({
    query: { queryKey: getListConversationsQueryKey(), refetchInterval: 15_000 }
  });

  const { data: messages = [], isLoading: msgsLoading } = useGetConversationMessages(
    selectedConvId ?? 0,
    { query: { enabled: !!selectedConvId, queryKey: getGetConversationMessagesQueryKey(selectedConvId ?? 0), refetchInterval: 8_000 } }
  );

  const markRead = useMarkConversationRead();
  const sendMsg = useSendDirectMessage();

  useEffect(() => {
    if (selectedConvId) {
      markRead.mutate({ id: selectedConvId });
      qc.invalidateQueries({ queryKey: getGetUnreadMessageCountQueryKey() });
      qc.invalidateQueries({ queryKey: getListConversationsQueryKey() });
    }
  }, [selectedConvId]);

  useEffect(() => {
    if (messages.length > 0) messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // When newConvUser is set, check if conversation already exists
  useEffect(() => {
    if (newConvUser && conversations.length > 0) {
      const existing = (conversations as any[]).find((c: any) => c.otherUser?.id === newConvUser.id);
      if (existing) { setSelectedConvId(existing.id); setNewConvUser(null); }
    }
  }, [newConvUser, conversations]);

  // User search (debounced)
  useEffect(() => {
    if (!userSearch || userSearch.length < 2) { setUserResults([]); return; }
    setSearchLoading(true);
    const timer = setTimeout(() => {
      fetch(`/api/users/search?q=${encodeURIComponent(userSearch)}`)
        .then(r => r.json())
        .then((data: UserResult[]) => setUserResults(data.filter(u => u.id !== user?.id)))
        .catch(() => setUserResults([]))
        .finally(() => setSearchLoading(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [userSearch, user?.id]);

  const selectedConv = (conversations as any[]).find((c: any) => c.id === selectedConvId);
  const filteredConvs = convSearch
    ? (conversations as any[]).filter((c: any) =>
        c.otherUser?.username?.toLowerCase().includes(convSearch.toLowerCase()) ||
        c.otherUser?.displayName?.toLowerCase().includes(convSearch.toLowerCase()))
    : (conversations as any[]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!newMsgBody.trim()) return;
    const toUserId = newConvUser ? newConvUser.id : (selectedConv as any)?.otherUser?.id;
    if (!toUserId) return;
    try {
      const result = await sendMsg.mutateAsync({ data: { toUserId, body: newMsgBody.trim() } });
      setNewMsgBody("");
      if (newConvUser) {
        setNewConvUser(null);
        await qc.invalidateQueries({ queryKey: getListConversationsQueryKey() });
        const convId = (result as any)?.conversationId;
        if (convId) setSelectedConvId(convId);
      } else {
        qc.invalidateQueries({ queryKey: getGetConversationMessagesQueryKey(selectedConvId ?? 0) });
        qc.invalidateQueries({ queryKey: getListConversationsQueryKey() });
      }
    } catch (err) {
      const e = err as { status?: number; data?: { code?: string } };
      if (e?.status === 403 && e?.data?.code === "email_not_verified") {
        toast({
          title: "Verify your email to send messages",
          description: "Check your inbox for a code, or resend it from your profile.",
          variant: "destructive",
        });
      } else {
        toast({ title: "Failed to send message", variant: "destructive" });
      }
    }
  }

  async function handleEditSave(msgId: number) {
    if (!editingBody.trim()) return;
    setEditSaving(true);
    try {
      await fetch(`/api/messages/msg/${msgId}`, {
        method: "PUT", headers: authHeaders(), body: JSON.stringify({ body: editingBody.trim() }),
      });
      setEditingMsgId(null);
      qc.invalidateQueries({ queryKey: getGetConversationMessagesQueryKey(selectedConvId ?? 0) });
    } catch {
      toast({ title: "Failed to edit message", variant: "destructive" });
    } finally {
      setEditSaving(false);
    }
  }

  // Load blocked users
  useEffect(() => {
    if (!user) return;
    fetch("/api/users/blocks", { headers: authHeaders() })
      .then(r => r.ok ? r.json() : [])
      .then((ids: number[]) => setBlockedUserIds(new Set(ids)))
      .catch(() => {});
  }, [user?.id]);

  // Close options dropdown on outside click
  useEffect(() => {
    if (convOptionsOpen === null) return;
    function handle(e: MouseEvent) {
      if (convOptionsRef.current && !convOptionsRef.current.contains(e.target as Node)) {
        setConvOptionsOpen(null);
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [convOptionsOpen]);

  async function handleMuteToggle(convId: number) {
    setActionLoading("mute");
    try {
      await fetch(`/api/messages/${convId}/mute`, { method: "PUT", headers: authHeaders() });
      qc.invalidateQueries({ queryKey: getListConversationsQueryKey() });
    } catch {
      toast({ title: "Failed to update", variant: "destructive" });
    } finally {
      setActionLoading(null);
      setConvOptionsOpen(null);
    }
  }

  async function handleBlockToggle(targetUserId: number, isBlocked: boolean) {
    setActionLoading("block");
    try {
      if (isBlocked) {
        await fetch(`/api/users/block/${targetUserId}`, { method: "DELETE", headers: authHeaders() });
        setBlockedUserIds(prev => { const next = new Set(prev); next.delete(targetUserId); return next; });
        toast({ title: "User unblocked" });
      } else {
        await fetch("/api/users/block", { method: "POST", headers: authHeaders(), body: JSON.stringify({ userId: targetUserId }) });
        setBlockedUserIds(prev => new Set([...prev, targetUserId]));
        toast({ title: "User blocked" });
      }
    } catch {
      toast({ title: "Failed", variant: "destructive" });
    } finally {
      setActionLoading(null);
      setConvOptionsOpen(null);
    }
  }

  async function handleDeleteConversation(convId: number) {
    setActionLoading("delete");
    try {
      await fetch(`/api/messages/${convId}`, { method: "DELETE", headers: authHeaders() });
      setSelectedConvId(null);
      setDeleteConfirmId(null);
      qc.invalidateQueries({ queryKey: getListConversationsQueryKey() });
      toast({ title: "Conversation deleted" });
    } catch {
      toast({ title: "Failed to delete", variant: "destructive" });
    } finally {
      setActionLoading(null);
      setConvOptionsOpen(null);
    }
  }

  async function handleDeleteMsg(msgId: number) {
    setDeletingMsgId(msgId);
    try {
      await fetch(`/api/messages/msg/${msgId}`, { method: "DELETE", headers: authHeaders() });
      qc.invalidateQueries({ queryKey: getGetConversationMessagesQueryKey(selectedConvId ?? 0) });
      qc.invalidateQueries({ queryKey: getListConversationsQueryKey() });
    } catch {
      toast({ title: "Failed to delete message", variant: "destructive" });
    } finally {
      setDeletingMsgId(null);
    }
  }

  function selectUserForNewConv(u: UserResult) {
    const existing = (conversations as any[]).find((c: any) => c.otherUser?.id === u.id);
    if (existing) { setSelectedConvId(existing.id); } else { setNewConvUser(u); }
    setNewMsgOpen(false);
    setUserSearch(""); setUserResults([]);
  }

  const activeUser = newConvUser ?? (selectedConv as any)?.otherUser;
  const showThread = !!selectedConvId || !!newConvUser;

  return (
    <div className="h-[calc(100vh-120px)] md:h-[calc(100vh-80px)] flex overflow-hidden">

      {/* ── Delete Confirmation Modal ─────────────────────────────────── */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setDeleteConfirmId(null)}>
          <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center flex-shrink-0">
                <Trash2 className="w-5 h-5 text-destructive" />
              </div>
              <div>
                <h3 className="font-bold">Delete conversation?</h3>
                <p className="text-xs text-muted-foreground">This permanently removes all messages for both parties.</p>
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>Cancel</Button>
              <Button variant="destructive" disabled={actionLoading === "delete"} onClick={() => handleDeleteConversation(deleteConfirmId)}>
                {actionLoading === "delete" ? "Deleting…" : "Delete"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── New Message Dialog ─────────────────────────────────────────── */}
      {newMsgOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setNewMsgOpen(false)}>
          <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h3 className="font-bold flex items-center gap-2">
                <MessageCircle className="w-4 h-4 text-primary" /> New Message
              </h3>
              <button onClick={() => setNewMsgOpen(false)} className="text-muted-foreground hover:text-foreground transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input autoFocus placeholder="Search by name or username..." className="pl-10" value={userSearch} onChange={e => setUserSearch(e.target.value)} />
              </div>
              <div className="mt-3 max-h-72 overflow-y-auto space-y-1">
                {searchLoading ? (
                  <div className="space-y-2 py-2">
                    {Array(3).fill(0).map((_, i) => (
                      <div key={i} className="flex items-center gap-3 px-2">
                        <Skeleton className="w-9 h-9 rounded-full" />
                        <div className="flex-1 space-y-1"><Skeleton className="h-3 w-24" /><Skeleton className="h-3 w-16" /></div>
                      </div>
                    ))}
                  </div>
                ) : userSearch.length >= 2 && userResults.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-sm">No users found</div>
                ) : userResults.length > 0 ? (
                  userResults.map(u => (
                    <button key={u.id} onClick={() => selectUserForNewConv(u)} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted/70 transition-colors text-left">
                      <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center text-primary text-sm font-bold overflow-hidden flex-shrink-0">
                        {u.avatarUrl ? <img src={u.avatarUrl} alt={u.username} className="w-full h-full object-cover" /> : (u.username[0] ?? "?").toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold flex items-center gap-1 flex-wrap">{u.displayName ?? u.username}<RoleBadges role={u.role} size="sm" isVerified={u.isVerified} /></p>
                        <p className="text-xs text-muted-foreground">@{u.username}</p>
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    <UserRound className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    Type to search for anyone on Cotopia
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Conversation list ─────────────────────────────────────────── */}
      <div className={cn("w-full md:w-80 flex-shrink-0 border-r border-border flex flex-col", showThread ? "hidden md:flex" : "flex")}>
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold flex items-center gap-2"><MessageCircle className="w-5 h-5 text-primary" />Messages</h2>
            <Button size="sm" className="h-8 gap-1.5 text-xs" onClick={() => setNewMsgOpen(true)}>
              <Plus className="w-3.5 h-3.5" />New
            </Button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input placeholder="Search conversations..." className="pl-8 h-8 text-sm" value={convSearch} onChange={e => setConvSearch(e.target.value)} />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {convsLoading ? (
            <div className="p-4 space-y-3">
              {Array(4).fill(0).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="w-10 h-10 rounded-full flex-shrink-0" />
                  <div className="flex-1 space-y-1.5"><Skeleton className="h-3 w-28" /><Skeleton className="h-3 w-40" /></div>
                </div>
              ))}
            </div>
          ) : filteredConvs.length === 0 && !newConvUser ? (
            <div className="flex flex-col items-center justify-center h-40 text-center px-6 gap-3">
              <MessageCircle className="w-8 h-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">{convSearch ? "No conversations match" : "No messages yet"}</p>
              {!convSearch && <Button size="sm" variant="outline" onClick={() => setNewMsgOpen(true)}><Plus className="w-3.5 h-3.5 mr-1" />Start a conversation</Button>}
            </div>
          ) : (
            <>
              {newConvUser && (
                <div className="bg-primary/10 border-l-2 border-l-primary flex items-center gap-3 px-4 py-3 border-b border-border/50">
                  <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary text-sm font-bold overflow-hidden flex-shrink-0">
                    {newConvUser.avatarUrl ? <img src={newConvUser.avatarUrl} alt={newConvUser.username} className="w-full h-full object-cover" /> : (newConvUser.username[0] ?? "?").toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold flex items-center gap-1 flex-wrap">{newConvUser.displayName ?? newConvUser.username}<RoleBadges role={newConvUser.role} size="sm" isVerified={newConvUser.isVerified} /></p>
                    <p className="text-xs text-muted-foreground">New conversation</p>
                  </div>
                  <button onClick={() => setNewConvUser(null)} className="text-muted-foreground hover:text-foreground"><X className="w-3.5 h-3.5" /></button>
                </div>
              )}

              {filteredConvs.map((conv: any) => {
                const other = conv.otherUser;
                const last = conv.lastMessage;
                const isSelected = conv.id === selectedConvId && !newConvUser;
                const hasUnread = conv.unreadCount > 0;
                return (
                  <button key={conv.id} className={cn("w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/50 transition-colors border-b border-border/50", isSelected && "bg-primary/10 border-l-2 border-l-primary", hasUnread && !isSelected && "bg-blue-500/5")} onClick={() => { setSelectedConvId(conv.id); setNewConvUser(null); }}>
                    <div className="relative flex-shrink-0">
                      <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary text-sm font-bold overflow-hidden">
                        {other?.avatarUrl ? <img src={other.avatarUrl} alt={other.username} className="w-full h-full object-cover" /> : (other?.username?.[0] ?? "?").toUpperCase()}
                      </div>
                      {hasUnread && <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-blue-500 border-2 border-background" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-sm font-semibold truncate flex items-center gap-0.5">
                          {conv.isFollowedByMe && <Star className="w-3 h-3 text-amber-400 fill-current flex-shrink-0 mr-0.5" />}
                          {other?.displayName ?? other?.username ?? "Unknown"}
                          <RoleBadges role={other?.role} size="sm" isVerified={other?.isVerified ?? false} />
                        </span>
                        {last && <span className="text-[10px] text-muted-foreground flex-shrink-0">{formatDistanceToNow(new Date(last.createdAt), { addSuffix: false })}</span>}
                      </div>
                      {last && <p className={cn("text-xs truncate mt-0.5", hasUnread ? "text-foreground font-medium" : "text-muted-foreground")}>{last.senderId === user?.id ? "You: " : ""}{last.body}</p>}
                    </div>
                    {hasUnread && <span className="flex-shrink-0 min-w-[18px] h-[18px] rounded-full bg-blue-500 text-white text-[10px] font-bold flex items-center justify-center px-0.5">{conv.unreadCount > 9 ? "9+" : conv.unreadCount}</span>}
                    {(conv as any).isMuted && <BellOff className="w-3 h-3 text-muted-foreground/40 flex-shrink-0" />}
                  </button>
                );
              })}
            </>
          )}
        </div>
      </div>

      {/* ── Message thread ────────────────────────────────────────────── */}
      <div className={cn("flex-1 flex flex-col", !showThread ? "hidden md:flex" : "flex")}>
        {!showThread ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-8 gap-4">
            <MessageCircle className="w-16 h-16 text-muted-foreground/30" />
            <h3 className="text-lg font-semibold">Your messages</h3>
            <p className="text-sm text-muted-foreground">Send private messages to anyone on Cotopia</p>
            <Button onClick={() => setNewMsgOpen(true)}><Plus className="w-4 h-4 mr-2" />New Message</Button>
          </div>
        ) : (
          <>
            {/* Thread header */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card/50 backdrop-blur flex-shrink-0 relative z-10">
              <button className="md:hidden p-1.5 rounded-md hover:bg-secondary text-muted-foreground" onClick={() => { setSelectedConvId(null); setNewConvUser(null); }}>
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary text-sm font-bold overflow-hidden flex-shrink-0">
                {activeUser?.avatarUrl ? <img src={activeUser.avatarUrl} alt={activeUser.username} className="w-full h-full object-cover" /> : (activeUser?.username?.[0] ?? "?").toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <Link href={`/users/${activeUser?.id}`}>
                  <p className="text-sm font-semibold hover:text-primary transition-colors cursor-pointer flex items-center gap-1">
                    {activeUser?.displayName ?? activeUser?.username}
                    <RoleBadges role={activeUser?.role} size="sm" isVerified={activeUser?.isVerified ?? false} />
                  </p>
                </Link>
                <p className="text-[10px] text-muted-foreground capitalize">{newConvUser ? "New conversation" : displayRole(activeUser?.role)}</p>
              </div>
              <div className="flex items-center gap-1">
                <Link href={`/users/${activeUser?.id}`}>
                  <Button variant="ghost" size="sm" className="text-xs text-muted-foreground h-7">Profile</Button>
                </Link>
                {selectedConvId && !newConvUser && (
                  <div className="relative" ref={convOptionsRef}>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setConvOptionsOpen(convOptionsOpen === selectedConvId ? null : selectedConvId)}>
                      <MoreVertical className="w-4 h-4" />
                    </Button>
                    {convOptionsOpen === selectedConvId && (
                      <div className="absolute right-0 top-8 z-50 bg-card border border-border rounded-xl shadow-xl w-52 overflow-hidden py-1">
                        <button
                          onClick={() => handleMuteToggle(selectedConvId)}
                          disabled={actionLoading === "mute"}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-muted transition-colors disabled:opacity-50 text-left"
                        >
                          {(selectedConv as any)?.isMuted ? <Bell className="w-4 h-4 text-primary" /> : <BellOff className="w-4 h-4" />}
                          {(selectedConv as any)?.isMuted ? "Unmute conversation" : "Mute conversation"}
                        </button>
                        <button
                          onClick={() => handleBlockToggle(activeUser?.id ?? -1, blockedUserIds.has(activeUser?.id ?? -1))}
                          disabled={actionLoading === "block"}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-muted transition-colors disabled:opacity-50 text-left"
                        >
                          {blockedUserIds.has(activeUser?.id ?? -1) ? <ShieldOff className="w-4 h-4 text-green-500" /> : <Shield className="w-4 h-4 text-destructive" />}
                          {blockedUserIds.has(activeUser?.id ?? -1) ? "Unblock user" : "Block user"}
                        </button>
                        <div className="border-t border-border my-1" />
                        <button
                          onClick={() => { setDeleteConfirmId(selectedConvId); setConvOptionsOpen(null); }}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-destructive hover:bg-destructive/10 transition-colors text-left"
                        >
                          <Trash2 className="w-4 h-4" />Delete conversation
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Blocked banner */}
            {activeUser && blockedUserIds.has(activeUser.id) && (
              <div className="flex items-center gap-3 px-4 py-2.5 bg-destructive/10 border-b border-destructive/20 flex-shrink-0">
                <Shield className="w-4 h-4 text-destructive flex-shrink-0" />
                <p className="text-xs text-destructive flex-1">You've blocked {activeUser.displayName ?? activeUser.username}. They can't message you.</p>
                <button onClick={() => handleBlockToggle(activeUser.id, true)} className="text-xs text-muted-foreground hover:text-foreground underline flex-shrink-0">Unblock</button>
              </div>
            )}

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {newConvUser ? (
                <div className="flex items-center justify-center h-32">
                  <p className="text-sm text-muted-foreground">Start a conversation with {newConvUser.displayName ?? newConvUser.username}</p>
                </div>
              ) : msgsLoading ? (
                <div className="space-y-3">
                  {Array(5).fill(0).map((_, i) => (
                    <div key={i} className={cn("flex", i % 2 === 0 ? "justify-start" : "justify-end")}>
                      <Skeleton className="h-10 w-48 rounded-2xl" />
                    </div>
                  ))}
                </div>
              ) : (messages as any[]).length === 0 ? (
                <div className="flex items-center justify-center h-32">
                  <p className="text-sm text-muted-foreground">No messages yet. Say hello!</p>
                </div>
              ) : (
                (messages as any[]).map((msg) => {
                  const isMe = msg.senderId === user?.id;
                  const isEditing = editingMsgId === msg.id;
                  const isDeleting = deletingMsgId === msg.id;
                  return (
                    <div key={msg.id} className={cn("flex items-end gap-2 group", isMe ? "justify-end" : "justify-start")}>
                      {!isMe && (
                        <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-primary text-[10px] font-bold overflow-hidden flex-shrink-0 mb-1">
                          {msg.senderAvatarUrl ? <img src={msg.senderAvatarUrl} alt={msg.senderUsername} className="w-full h-full object-cover" /> : (msg.senderUsername?.[0] ?? "?").toUpperCase()}
                        </div>
                      )}
                      <div className={cn("max-w-[70%] flex flex-col", isMe ? "items-end" : "items-start")}>
                        {isEditing ? (
                          <div className="flex flex-col gap-2 w-72">
                            <textarea
                              value={editingBody}
                              onChange={e => setEditingBody(e.target.value)}
                              className="w-full px-3 py-2 rounded-xl text-sm leading-relaxed bg-secondary border border-border resize-none outline-none focus:ring-1 focus:ring-primary"
                              rows={2} autoFocus
                              onKeyDown={e => {
                                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleEditSave(msg.id); }
                                if (e.key === "Escape") setEditingMsgId(null);
                              }}
                            />
                            <div className="flex gap-2 justify-end">
                              <button onClick={() => setEditingMsgId(null)} className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded transition-colors">Cancel</button>
                              <button onClick={() => handleEditSave(msg.id)} disabled={editSaving} className="text-xs bg-primary text-primary-foreground px-3 py-1 rounded transition-colors hover:bg-primary/90 disabled:opacity-50">Save</button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="relative flex items-end gap-1">
                              {/* Edit/delete actions — left of own bubbles */}
                              {isMe && !isDeleting && (
                                <div className="hidden group-hover:flex items-center gap-0.5 mb-1">
                                  <button onClick={() => { setEditingMsgId(msg.id); setEditingBody(msg.body); }} className="w-6 h-6 rounded-full bg-secondary hover:bg-border flex items-center justify-center transition-colors" title="Edit">
                                    <Pencil className="w-3 h-3 text-muted-foreground" />
                                  </button>
                                  <button onClick={() => handleDeleteMsg(msg.id)} className="w-6 h-6 rounded-full bg-secondary hover:bg-red-500/20 flex items-center justify-center transition-colors" title="Delete">
                                    <Trash2 className="w-3 h-3 text-muted-foreground" />
                                  </button>
                                </div>
                              )}
                              <div className={cn("px-3 py-2 rounded-2xl text-sm leading-relaxed", isMe ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-secondary text-foreground rounded-bl-sm", isDeleting && "opacity-40")}>
                                {isDeleting ? "Deleting…" : msg.body}
                              </div>
                              {!isMe && !isDeleting && (
                                <div className="hidden group-hover:flex items-center mb-1">
                                  <ReportModal targetType="private_message" targetId={msg.id} />
                                </div>
                              )}
                            </div>
                            <span className="text-[10px] text-muted-foreground mt-0.5 px-1 flex items-center gap-1">
                              {formatDistanceToNow(new Date(msg.createdAt), { addSuffix: true })}
                              {msg.isEdited && <span className="italic opacity-70">(edited)</span>}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Compose */}
            {activeUser && blockedUserIds.has(activeUser.id) ? (
              <div className="flex items-center gap-2 p-4 border-t border-border flex-shrink-0 bg-muted/20">
                <Shield className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <p className="text-xs text-muted-foreground">Messaging is disabled while this user is blocked.</p>
              </div>
            ) : (config.requireEmailVerification && !(user as any)?.emailVerified) ? (
              <div className="p-4 border-t border-border flex-shrink-0">
                <VerifyEmailBanner action="send messages" />
              </div>
            ) : (
              <form onSubmit={handleSend} className="flex items-center gap-2 p-4 border-t border-border flex-shrink-0">
                <Input
                  placeholder={newConvUser ? `Message ${newConvUser.displayName ?? newConvUser.username}...` : "Type a message..."}
                  value={newMsgBody} onChange={e => setNewMsgBody(e.target.value)} className="flex-1"
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(e as any); } }}
                />
                <Button type="submit" size="icon" disabled={!newMsgBody.trim() || sendMsg.isPending} className="flex-shrink-0">
                  <Send className="w-4 h-4" />
                </Button>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  );
}

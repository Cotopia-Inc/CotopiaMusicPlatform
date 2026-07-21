import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import { RoleBadges } from "@/components/role-badges";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { MessageCircle, Search, ArrowLeft, Pencil, Trash2, ShieldAlert, Users } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

const ADMIN_ROLES = ["admin", "master_admin", "moderator"];

function authHeaders() {
  const token = localStorage.getItem("cotopia_token");
  return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
}

type ConvItem = {
  id: number;
  participant1: { id: number; username: string; displayName?: string | null; avatarUrl?: string | null; role: string } | null;
  participant2: { id: number; username: string; displayName?: string | null; avatarUrl?: string | null; role: string } | null;
  lastMessage: { id: number; body: string; senderId: number; createdAt: string } | null;
  messageCount: number;
  lastMessageAt: string | null;
};

type MsgItem = {
  id: number;
  conversationId: number;
  senderId: number;
  body: string;
  isRead: boolean;
  isEdited: boolean;
  editedAt?: string | null;
  createdAt: string;
  senderUsername?: string | null;
  senderDisplayName?: string | null;
  senderAvatarUrl?: string | null;
  senderRole?: string | null;
};

export default function AdminMessages() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  useEffect(() => {
    if (user && !ADMIN_ROLES.includes(user.role)) navigate("/");
  }, [user, navigate]);

  const [conversations, setConversations] = useState<ConvItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [selectedConvId, setSelectedConvId] = useState<number | null>(null);
  const [thread, setThread] = useState<MsgItem[]>([]);
  const [threadLoading, setThreadLoading] = useState(false);

  const [editingMsgId, setEditingMsgId] = useState<number | null>(null);
  const [editingBody, setEditingBody] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [deletingMsgId, setDeletingMsgId] = useState<number | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  async function loadConversations() {
    setLoading(true);
    try {
      const r = await fetch(`/api/admin/messages?limit=100`, { headers: authHeaders() });
      const data = await r.json();
      setConversations(Array.isArray(data) ? data : []);
    } catch {
      toast({ title: "Failed to load conversations", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  async function loadThread(convId: number) {
    setThreadLoading(true);
    try {
      const r = await fetch(`/api/admin/messages/${convId}`, { headers: authHeaders() });
      const data = await r.json();
      setThread(Array.isArray(data) ? data : []);
    } catch {
      toast({ title: "Failed to load thread", variant: "destructive" });
    } finally {
      setThreadLoading(false);
    }
  }

  useEffect(() => { loadConversations(); }, []);
  useEffect(() => {
    if (selectedConvId) loadThread(selectedConvId);
  }, [selectedConvId]);
  useEffect(() => {
    if (thread.length > 0) messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [thread]);

  async function handleEditSave(msgId: number) {
    if (!editingBody.trim()) return;
    setEditSaving(true);
    try {
      await fetch(`/api/admin/messages/msg/${msgId}`, {
        method: "PUT", headers: authHeaders(), body: JSON.stringify({ body: editingBody.trim() }),
      });
      setEditingMsgId(null);
      if (selectedConvId) loadThread(selectedConvId);
      loadConversations();
    } catch {
      toast({ title: "Failed to edit", variant: "destructive" });
    } finally {
      setEditSaving(false);
    }
  }

  async function handleDelete(msgId: number) {
    setDeletingMsgId(msgId);
    try {
      await fetch(`/api/admin/messages/msg/${msgId}`, { method: "DELETE", headers: authHeaders() });
      setThread(t => t.filter(m => m.id !== msgId));
      loadConversations();
    } catch {
      toast({ title: "Failed to delete", variant: "destructive" });
    } finally {
      setDeletingMsgId(null);
    }
  }

  const filtered = search
    ? conversations.filter(c =>
        [c.participant1?.username, c.participant2?.username, c.participant1?.displayName, c.participant2?.displayName]
          .some(s => s?.toLowerCase().includes(search.toLowerCase()))
      )
    : conversations;

  const selectedConv = conversations.find(c => c.id === selectedConvId);
  const showThread = !!selectedConvId;

  return (
    <div className="h-[calc(100vh-64px)] flex overflow-hidden">

      {/* ── Conversation list ─────────────────────────────────────── */}
      <div className={cn("w-full md:w-96 flex-shrink-0 border-r border-border flex flex-col", showThread ? "hidden md:flex" : "flex")}>
        <div className="p-4 border-b border-border space-y-3">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-amber-400" />
            <h2 className="text-lg font-bold">DM Moderation</h2>
            <span className="text-xs text-muted-foreground bg-secondary rounded px-1.5 py-0.5">{conversations.length} convs</span>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input aria-label="Search by username" placeholder="Search by username..." className="pl-8 h-8 text-sm" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-4 space-y-3">
              {Array(6).fill(0).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="w-10 h-10 rounded-full flex-shrink-0" />
                  <div className="flex-1 space-y-1.5"><Skeleton className="h-3 w-32" /><Skeleton className="h-3 w-48" /></div>
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-center px-6 gap-2">
              <Users className="w-8 h-8 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">{search ? "No conversations match" : "No conversations yet"}</p>
            </div>
          ) : (
            filtered.map(conv => {
              const p1 = conv.participant1;
              const p2 = conv.participant2;
              const last = conv.lastMessage;
              const isSelected = conv.id === selectedConvId;

              return (
                <button
                  key={conv.id}
                  className={cn("w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-muted/50 transition-colors border-b border-border/50", isSelected && "bg-primary/10 border-l-2 border-l-primary")}
                  onClick={() => setSelectedConvId(conv.id)}
                >
                  {/* Avatar pair */}
                  <div className="relative flex-shrink-0 w-10 h-10">
                    <div className="absolute top-0 left-0 w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-primary text-[10px] font-bold overflow-hidden border-2 border-background">
                      {p1?.avatarUrl ? <img src={p1.avatarUrl} alt={p1.username} className="w-full h-full object-cover" /> : (p1?.username?.[0] ?? "?").toUpperCase()}
                    </div>
                    <div className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-secondary flex items-center justify-center text-muted-foreground text-[10px] font-bold overflow-hidden border-2 border-background">
                      {p2?.avatarUrl ? <img src={p2.avatarUrl} alt={p2.username} className="w-full h-full object-cover" /> : (p2?.username?.[0] ?? "?").toUpperCase()}
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-sm font-semibold truncate inline-flex items-center gap-0.5 min-w-0">
                        <span className="truncate">{p1?.displayName ?? p1?.username}</span>
                        <RoleBadges role={p1?.role ?? ""} size="sm" isVerified={false} />
                        <span className="mx-0.5 flex-shrink-0">↔</span>
                        <span className="truncate">{p2?.displayName ?? p2?.username}</span>
                        <RoleBadges role={p2?.role ?? ""} size="sm" isVerified={false} />
                      </span>
                      <span className="text-[10px] text-muted-foreground flex-shrink-0 bg-secondary rounded px-1">{conv.messageCount}</span>
                    </div>
                    {last && (
                      <p className="text-xs text-muted-foreground truncate mt-0.5">{last.body}</p>
                    )}
                    {conv.lastMessageAt && (
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {formatDistanceToNow(new Date(conv.lastMessageAt), { addSuffix: true })}
                      </p>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* ── Thread panel ──────────────────────────────────────────── */}
      <div className={cn("flex-1 flex flex-col", !showThread ? "hidden md:flex" : "flex")}>
        {!showThread ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-8 gap-4">
            <MessageCircle className="w-16 h-16 text-muted-foreground/30" />
            <h3 className="text-lg font-semibold">Select a conversation</h3>
            <p className="text-sm text-muted-foreground">Choose a conversation to view, edit, or remove messages</p>
          </div>
        ) : (
          <>
            {/* Thread header */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card/50 backdrop-blur flex-shrink-0">
              <button className="md:hidden p-1.5 rounded-md hover:bg-secondary text-muted-foreground" onClick={() => setSelectedConvId(null)}>
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold flex items-center gap-1 flex-wrap">
                  {selectedConv?.participant1?.displayName ?? selectedConv?.participant1?.username}
                  <RoleBadges role={selectedConv?.participant1?.role ?? ""} size="sm" isVerified={false} />
                  <span className="text-muted-foreground mx-1">↔</span>
                  {selectedConv?.participant2?.displayName ?? selectedConv?.participant2?.username}
                  <RoleBadges role={selectedConv?.participant2?.role ?? ""} size="sm" isVerified={false} />
                </p>
                <p className="text-[10px] text-muted-foreground">{selectedConv?.messageCount ?? 0} messages total</p>
              </div>
              <div className="flex-shrink-0 flex items-center gap-1">
                <ShieldAlert className="w-4 h-4 text-amber-400" />
                <span className="text-xs text-amber-400 font-medium">Admin View</span>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {threadLoading ? (
                <div className="space-y-3">
                  {Array(5).fill(0).map((_, i) => (
                    <div key={i} className={cn("flex", i % 2 === 0 ? "justify-start" : "justify-end")}>
                      <Skeleton className="h-10 w-48 rounded-2xl" />
                    </div>
                  ))}
                </div>
              ) : thread.length === 0 ? (
                <div className="flex items-center justify-center h-32">
                  <p className="text-sm text-muted-foreground">No messages in this conversation</p>
                </div>
              ) : (
                thread.map(msg => {
                  const isP1 = msg.senderId === selectedConv?.participant1?.id;
                  const senderUser = isP1 ? selectedConv?.participant1 : selectedConv?.participant2;
                  const isEditing = editingMsgId === msg.id;
                  const isDeleting = deletingMsgId === msg.id;

                  return (
                    <div key={msg.id} className={cn("flex items-end gap-2 group", isP1 ? "justify-start" : "justify-end")}>
                      {isP1 && (
                        <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-primary text-[10px] font-bold overflow-hidden flex-shrink-0 mb-1">
                          {msg.senderAvatarUrl ? <img src={msg.senderAvatarUrl} alt={msg.senderUsername ?? ""} className="w-full h-full object-cover" /> : (msg.senderUsername?.[0] ?? "?").toUpperCase()}
                        </div>
                      )}
                      <div className={cn("max-w-[70%] flex flex-col", isP1 ? "items-start" : "items-end")}>
                        <p className="text-[10px] text-muted-foreground mb-0.5 px-1 inline-flex items-center gap-0.5">
                          {msg.senderDisplayName ?? msg.senderUsername}
                          <RoleBadges role={msg.senderRole} size="sm" isVerified={false} />
                        </p>
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
                              <button onClick={() => setEditingMsgId(null)} className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded">Cancel</button>
                              <button onClick={() => handleEditSave(msg.id)} disabled={editSaving} className="text-xs bg-amber-500 text-white px-3 py-1 rounded hover:bg-amber-600 disabled:opacity-50">Save (Admin)</button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="relative flex items-end gap-1">
                              {!isP1 && !isDeleting && (
                                <div className="hidden group-hover:flex items-center gap-0.5 mb-1">
                                  <button onClick={() => { setEditingMsgId(msg.id); setEditingBody(msg.body); }} className="w-6 h-6 rounded-full bg-secondary hover:bg-border flex items-center justify-center transition-colors" title="Edit (admin)">
                                    <Pencil className="w-3 h-3 text-amber-400" />
                                  </button>
                                  <button onClick={() => handleDelete(msg.id)} className="w-6 h-6 rounded-full bg-secondary hover:bg-red-500/20 flex items-center justify-center transition-colors" title="Delete (admin)">
                                    <Trash2 className="w-3 h-3 text-red-400" />
                                  </button>
                                </div>
                              )}
                              <div className={cn("px-3 py-2 rounded-2xl text-sm leading-relaxed", isP1 ? "bg-secondary text-foreground rounded-bl-sm" : "bg-primary text-primary-foreground rounded-br-sm", isDeleting && "opacity-40")}>
                                {isDeleting ? "Deleting…" : msg.body}
                              </div>
                              {isP1 && !isDeleting && (
                                <div className="hidden group-hover:flex items-center gap-0.5 mb-1">
                                  <button onClick={() => { setEditingMsgId(msg.id); setEditingBody(msg.body); }} className="w-6 h-6 rounded-full bg-secondary hover:bg-border flex items-center justify-center transition-colors" title="Edit (admin)">
                                    <Pencil className="w-3 h-3 text-amber-400" />
                                  </button>
                                  <button onClick={() => handleDelete(msg.id)} className="w-6 h-6 rounded-full bg-secondary hover:bg-red-500/20 flex items-center justify-center transition-colors" title="Delete (admin)">
                                    <Trash2 className="w-3 h-3 text-red-400" />
                                  </button>
                                </div>
                              )}
                            </div>
                            <span className="text-[10px] text-muted-foreground mt-0.5 px-1 flex items-center gap-1">
                              {formatDistanceToNow(new Date(msg.createdAt), { addSuffix: true })}
                              {msg.isEdited && <span className="italic text-amber-400/70">(edited by admin)</span>}
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
          </>
        )}
      </div>
    </div>
  );
}

import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/lib/auth";
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
import { RoleBadges } from "@/components/role-badges";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Send, MessageCircle, ArrowLeft, Search } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";

export default function MessagesPage() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();

  useEffect(() => {
    if (!user) navigate("/login");
  }, [user, navigate]);

  const [selectedConvId, setSelectedConvId] = useState<number | null>(null);
  const [newMsgBody, setNewMsgBody] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: conversations = [], isLoading: convsLoading } = useListConversations({
    query: { queryKey: getListConversationsQueryKey(), refetchInterval: 15_000 }
  });

  const { data: messages = [], isLoading: msgsLoading } = useGetConversationMessages(
    selectedConvId ?? 0,
    {
      query: {
        enabled: !!selectedConvId,
        queryKey: getGetConversationMessagesQueryKey(selectedConvId ?? 0),
        refetchInterval: 8_000,
      }
    }
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
    if (messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const selectedConv = conversations.find((c: any) => c.id === selectedConvId);

  const filteredConvs = searchQuery
    ? conversations.filter((c: any) =>
        c.otherUser?.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.otherUser?.displayName?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : conversations;

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!newMsgBody.trim() || !selectedConv) return;
    const toUserId = (selectedConv as any).otherUser?.id;
    if (!toUserId) return;

    try {
      await sendMsg.mutateAsync({ data: { toUserId, body: newMsgBody.trim() } });
      setNewMsgBody("");
      qc.invalidateQueries({ queryKey: getGetConversationMessagesQueryKey(selectedConvId ?? 0) });
      qc.invalidateQueries({ queryKey: getListConversationsQueryKey() });
    } catch {
      toast({ title: "Failed to send message", variant: "destructive" });
    }
  }

  return (
    <div className="h-[calc(100vh-64px)] flex overflow-hidden">
      {/* Conversation list */}
      <div className={cn(
        "w-full md:w-80 flex-shrink-0 border-r border-border flex flex-col",
        selectedConvId ? "hidden md:flex" : "flex"
      )}>
        {/* Header */}
        <div className="p-4 border-b border-border">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-primary" />
            Messages
          </h2>
          <div className="relative mt-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              placeholder="Search conversations..."
              className="pl-8 h-8 text-sm"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Conversation items */}
        <div className="flex-1 overflow-y-auto">
          {convsLoading ? (
            <div className="p-4 space-y-3">
              {Array(4).fill(0).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="w-10 h-10 rounded-full flex-shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3 w-28" />
                    <Skeleton className="h-3 w-40" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredConvs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-center px-6">
              <MessageCircle className="w-8 h-8 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                {searchQuery ? "No conversations match your search" : "No messages yet"}
              </p>
            </div>
          ) : (
            filteredConvs.map((conv: any) => {
              const other = conv.otherUser;
              const last = conv.lastMessage;
              const isSelected = conv.id === selectedConvId;
              const hasUnread = conv.unreadCount > 0;

              return (
                <button
                  key={conv.id}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/50 transition-colors border-b border-border/50",
                    isSelected && "bg-primary/10 border-l-2 border-l-primary",
                    hasUnread && !isSelected && "bg-blue-500/5"
                  )}
                  onClick={() => setSelectedConvId(conv.id)}
                >
                  <div className="relative flex-shrink-0">
                    <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary text-sm font-bold overflow-hidden">
                      {other?.avatarUrl
                        ? <img src={other.avatarUrl} alt={other.username} className="w-full h-full object-cover" />
                        : (other?.username?.[0] ?? "?").toUpperCase()}
                    </div>
                    {hasUnread && (
                      <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-blue-500 border-2 border-background" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-sm font-semibold truncate flex items-center gap-0.5">
                        {other?.displayName ?? other?.username ?? "Unknown"}
                        <RoleBadges role={other?.role} size="sm" isVerified={other?.isVerified ?? false} />
                      </span>
                      {last && (
                        <span className="text-[10px] text-muted-foreground flex-shrink-0">
                          {formatDistanceToNow(new Date(last.createdAt), { addSuffix: false })}
                        </span>
                      )}
                    </div>
                    {last && (
                      <p className={cn("text-xs truncate mt-0.5", hasUnread ? "text-foreground font-medium" : "text-muted-foreground")}>
                        {last.senderId === user?.id ? "You: " : ""}{last.body}
                      </p>
                    )}
                  </div>
                  {hasUnread && (
                    <span className="flex-shrink-0 min-w-[18px] h-[18px] rounded-full bg-blue-500 text-white text-[10px] font-bold flex items-center justify-center px-0.5">
                      {conv.unreadCount > 9 ? "9+" : conv.unreadCount}
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Message thread */}
      <div className={cn(
        "flex-1 flex flex-col",
        !selectedConvId ? "hidden md:flex" : "flex"
      )}>
        {!selectedConvId ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-8">
            <MessageCircle className="w-16 h-16 text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-semibold">Select a conversation</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Choose a conversation from the list to start messaging
            </p>
          </div>
        ) : (
          <>
            {/* Thread header */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card/50 backdrop-blur flex-shrink-0">
              <button
                className="md:hidden p-1.5 rounded-md hover:bg-secondary text-muted-foreground"
                onClick={() => setSelectedConvId(null)}
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary text-sm font-bold overflow-hidden flex-shrink-0">
                {(selectedConv as any)?.otherUser?.avatarUrl
                  ? <img src={(selectedConv as any).otherUser.avatarUrl} alt={(selectedConv as any).otherUser.username} className="w-full h-full object-cover" />
                  : ((selectedConv as any)?.otherUser?.username?.[0] ?? "?").toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <Link href={`/users/${(selectedConv as any)?.otherUser?.id}`}>
                  <p className="text-sm font-semibold hover:text-primary transition-colors cursor-pointer flex items-center gap-1">
                    {(selectedConv as any)?.otherUser?.displayName ?? (selectedConv as any)?.otherUser?.username}
                    <RoleBadges role={(selectedConv as any)?.otherUser?.role} size="sm" isVerified={(selectedConv as any)?.otherUser?.isVerified ?? false} />
                  </p>
                </Link>
                <p className="text-[10px] text-muted-foreground capitalize">
                  {(selectedConv as any)?.otherUser?.role?.replace("_", " ")}
                </p>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {msgsLoading ? (
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
                  return (
                    <div key={msg.id} className={cn("flex items-end gap-2", isMe ? "justify-end" : "justify-start")}>
                      {!isMe && (
                        <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-primary text-[10px] font-bold overflow-hidden flex-shrink-0 mb-1">
                          {msg.senderAvatarUrl
                            ? <img src={msg.senderAvatarUrl} alt={msg.senderUsername} className="w-full h-full object-cover" />
                            : (msg.senderUsername?.[0] ?? "?").toUpperCase()}
                        </div>
                      )}
                      <div className={cn("max-w-[70%]", isMe ? "items-end" : "items-start", "flex flex-col")}>
                        <div className={cn(
                          "px-3 py-2 rounded-2xl text-sm leading-relaxed",
                          isMe
                            ? "bg-primary text-primary-foreground rounded-br-sm"
                            : "bg-secondary text-foreground rounded-bl-sm"
                        )}>
                          {msg.body}
                        </div>
                        <span className="text-[10px] text-muted-foreground mt-0.5 px-1">
                          {formatDistanceToNow(new Date(msg.createdAt), { addSuffix: true })}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <form onSubmit={handleSend} className="flex items-center gap-2 p-4 border-t border-border flex-shrink-0">
              <Input
                placeholder="Type a message..."
                value={newMsgBody}
                onChange={e => setNewMsgBody(e.target.value)}
                className="flex-1"
                onKeyDown={e => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend(e as any);
                  }
                }}
              />
              <Button type="submit" size="icon" disabled={!newMsgBody.trim() || sendMsg.isPending} className="flex-shrink-0">
                <Send className="w-4 h-4" />
              </Button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

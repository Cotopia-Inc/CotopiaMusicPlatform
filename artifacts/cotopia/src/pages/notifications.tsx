import {
  useListNotifications,
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  getListNotificationsQueryKey,
  getGetUnreadNotificationCountQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCheck, Bell, CheckCircle, XCircle, Megaphone, Trash2, BellRing, BellOff } from "lucide-react";
import { Link } from "wouter";
import { formatDistanceToNow } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { usePushNotifications } from "@/lib/usePushNotifications";

function authHeaders() {
  const token = localStorage.getItem("cotopia_token");
  return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
}

function typeIcon(type: string) {
  if (type === "submission_approved") return <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />;
  if (type === "submission_rejected") return <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />;
  if (type === "announcement") return <Megaphone className="w-4 h-4 text-amber-400 flex-shrink-0" />;
  return <Megaphone className="w-4 h-4 text-primary flex-shrink-0" />;
}

function PushNotificationBanner() {
  const { isSupported, permission, isSubscribed, isLoading, subscribe, unsubscribe } = usePushNotifications();
  const { toast } = useToast();

  if (!isSupported) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3.5">
        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
          <BellOff className="w-4 h-4 text-muted-foreground" />
        </div>
        <div>
          <p className="text-sm font-semibold leading-tight">Push notifications</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Open the app in a browser tab (not the embedded preview) to enable push notifications.
          </p>
        </div>
      </div>
    );
  }

  if (permission === "denied") {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3.5">
        <div className="w-8 h-8 rounded-full bg-destructive/10 flex items-center justify-center flex-shrink-0">
          <BellOff className="w-4 h-4 text-destructive" />
        </div>
        <div>
          <p className="text-sm font-semibold leading-tight">Notifications blocked</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Allow notifications in your browser settings to re-enable push alerts.
          </p>
        </div>
      </div>
    );
  }

  const handleToggle = async () => {
    if (isSubscribed) {
      await unsubscribe();
      toast({ title: "Push notifications disabled" });
    } else {
      const ok = await subscribe();
      if (ok) {
        toast({ title: "Push notifications enabled", description: "You'll get notified even when the app is closed." });
      } else {
        toast({ title: "Notifications blocked", description: "Allow notifications in your browser settings to enable push.", variant: "destructive" });
      }
    }
  };

  return (
    <div className={`flex items-center justify-between gap-4 rounded-xl border px-4 py-3.5 ${isSubscribed ? "border-primary/30 bg-primary/5" : "border-border bg-card"}`}>
      <div className="flex items-center gap-3">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${isSubscribed ? "bg-primary/15" : "bg-muted"}`}>
          {isSubscribed ? <BellRing className="w-4 h-4 text-primary" /> : <BellOff className="w-4 h-4 text-muted-foreground" />}
        </div>
        <div>
          <p className="text-sm font-semibold leading-tight">
            {isSubscribed ? "Push notifications on" : "Enable push notifications"}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {isSubscribed
              ? "You'll receive alerts even when the app is closed."
              : "Get notified about submissions and activity even when you're away."}
          </p>
        </div>
      </div>
      <Button
        variant={isSubscribed ? "outline" : "default"}
        size="sm"
        onClick={handleToggle}
        disabled={isLoading}
        className="flex-shrink-0"
      >
        {isLoading ? (
          <div className="w-3.5 h-3.5 border border-current border-t-transparent rounded-full animate-spin" />
        ) : isSubscribed ? (
          "Turn off"
        ) : (
          "Turn on"
        )}
      </Button>
    </div>
  );
}

export default function NotificationsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: notifications, isLoading } = useListNotifications(
    {},
    { query: { queryKey: getListNotificationsQueryKey({}) } }
  );
  const markAll = useMarkAllNotificationsRead();
  const markOne = useMarkNotificationRead();

  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [clearingAll, setClearingAll] = useState(false);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getListNotificationsQueryKey({}) });
    queryClient.invalidateQueries({ queryKey: getGetUnreadNotificationCountQueryKey() });
  };

  const handleMarkAll = () => {
    markAll.mutate(undefined, { onSuccess: invalidate });
  };

  const handleMarkOne = (id: number) => {
    markOne.mutate({ id }, { onSuccess: invalidate });
  };

  const handleDeleteOne = async (id: number) => {
    setDeletingId(id);
    try {
      await fetch(`/api/notifications/${id}`, { method: "DELETE", headers: authHeaders() });
      invalidate();
    } catch {
      toast({ title: "Failed to delete notification", variant: "destructive" });
    } finally {
      setDeletingId(null);
    }
  };

  const handleClearAll = async () => {
    setClearingAll(true);
    try {
      await fetch("/api/notifications", { method: "DELETE", headers: authHeaders() });
      invalidate();
      toast({ title: "All notifications cleared" });
    } catch {
      toast({ title: "Failed to clear notifications", variant: "destructive" });
    } finally {
      setClearingAll(false);
    }
  };

  const unreadCount = notifications?.filter((n) => !n.isRead).length ?? 0;
  const hasAny = (notifications?.length ?? 0) > 0;

  return (
    <div className="space-y-8 pb-24">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Your Space</p>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-2">Notifications</h1>
          <p className="text-muted-foreground">Updates on your submissions and activity.</p>
        </div>
        <div className="flex items-center gap-2 mt-2 flex-shrink-0">
          {unreadCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={handleMarkAll}
              disabled={markAll.isPending}
            >
              <CheckCheck className="w-3.5 h-3.5" />
              Mark all read
            </Button>
          )}
          {hasAny && (
            <Button
              variant="outline"
              size="sm"
              className="gap-2 text-destructive hover:text-destructive border-destructive/30 hover:border-destructive/60 hover:bg-destructive/5"
              onClick={handleClearAll}
              disabled={clearingAll}
            >
              <Trash2 className="w-3.5 h-3.5" />
              {clearingAll ? "Clearing…" : "Clear all"}
            </Button>
          )}
        </div>
      </div>

      <PushNotificationBanner />

      <div className="space-y-2">
        {isLoading ? (
          Array(5).fill(0).map((_, i) => (
            <div key={i} className="bg-card border border-border rounded-xl p-4 flex gap-3">
              <Skeleton className="w-8 h-8 rounded-full flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-56" />
                <Skeleton className="h-3 w-full" />
              </div>
            </div>
          ))
        ) : notifications?.length ? (
          notifications.map((n) => (
            <div
              key={n.id}
              className={`bg-card border rounded-xl px-4 py-3.5 flex items-start gap-3 transition-colors group ${
                !n.isRead ? "border-primary/30 bg-primary/5" : "border-border"
              }`}
            >
              {/* Icon */}
              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                n.type === "submission_approved" ? "bg-green-500/15" :
                n.type === "submission_rejected" ? "bg-red-500/15" : "bg-primary/15"
              }`}>
                {typeIcon(n.type)}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <p className={`text-sm font-semibold leading-tight ${!n.isRead ? "text-foreground" : "text-muted-foreground"}`}>
                    {n.title}
                  </p>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {!n.isRead && <Badge className="h-4 px-1.5 text-[9px] bg-primary text-primary-foreground">New</Badge>}
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                      {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                    </span>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{n.message}</p>
                {n.submissionId && (
                  <Link href="/submissions">
                    <span className="text-xs text-primary hover:underline cursor-pointer mt-1.5 inline-block">
                      View my reviews →
                    </span>
                  </Link>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1.5 flex-shrink-0 mt-0.5">
                {!n.isRead && (
                  <button
                    onClick={() => handleMarkOne(n.id)}
                    className="w-5 h-5 rounded-full border border-primary/40 hover:bg-primary/20 transition-colors"
                    title="Mark as read"
                  />
                )}
                <button
                  onClick={() => handleDeleteOne(n.id)}
                  disabled={deletingId === n.id}
                  className="opacity-0 group-hover:opacity-100 transition-opacity w-6 h-6 rounded flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                  title="Delete notification"
                >
                  {deletingId === n.id
                    ? <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
                    : <Trash2 className="w-3 h-3" />
                  }
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-20 bg-card rounded-2xl border border-border text-muted-foreground">
            <div className="flex flex-col items-center gap-3">
              <Bell className="w-12 h-12 text-muted-foreground/20" />
              <p className="font-medium">You're all caught up</p>
              <p className="text-xs">Notifications about your submissions will appear here.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

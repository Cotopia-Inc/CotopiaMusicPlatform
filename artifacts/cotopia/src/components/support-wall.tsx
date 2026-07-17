import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { Heart, Trash2, Loader2, MessageCircleHeart } from "lucide-react";
import {
  useGetSupportWall, useHideSupportWallMessage, useGetCreatorSupportStatus,
  getGetSupportWallQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";

const PAGE_SIZE = 10;

interface SupportWallProps {
  userId: number;
  className?: string;
}

export function SupportWall({ userId, className }: SupportWallProps) {
  const { user: me } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [pageSize, setPageSize] = useState(PAGE_SIZE);

  const { data: status } = useGetCreatorSupportStatus(userId, undefined, {
    query: { queryKey: ["getCreatorSupportStatus", userId] },
  });

  const { data, isLoading } = useGetSupportWall(userId, { page: 1, pageSize }, {
    query: {
      queryKey: getGetSupportWallQueryKey(userId, { page: 1, pageSize }),
      enabled: !!status?.supportWallEnabled,
    },
  });

  const hideMutation = useHideSupportWallMessage({
    mutation: {
      onSuccess: () => {
        toast({ title: "Message hidden from your wall" });
        queryClient.invalidateQueries({ queryKey: ["/api/creator-support/wall/" + userId] });
      },
      onError: () => toast({ variant: "destructive", title: "Could not hide message" }),
    },
  });

  if (!status?.supportWallEnabled) return null;
  if (!isLoading && (!data || data.items.length === 0) && pageSize === PAGE_SIZE) return null;

  const isOwnerOrStaff = !!me && (me.id === userId || ["admin", "master_admin", "moderator", "editor"].includes(me.role ?? ""));

  return (
    <div className={`bg-card p-6 rounded-xl border border-border space-y-4 ${className ?? ""}`}>
      <div className="flex items-center gap-2">
        <MessageCircleHeart className="w-5 h-5 text-primary" />
        <h3 className="font-semibold">Community Support</h3>
        {typeof data?.total === "number" && (
          <span className="text-xs text-muted-foreground">
            · {data.total.toLocaleString()} {data.total === 1 ? "message" : "messages"}
          </span>
        )}
      </div>

      {isLoading && pageSize === PAGE_SIZE ? (
        <div className="flex justify-center py-6">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="max-h-80 overflow-y-auto pr-1 space-y-3 scrollbar-thin">
          {data?.items.map((item) => (
            <div key={item.id} className="flex items-start gap-3 p-3 rounded-lg bg-secondary/30 border border-border/50">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Heart className="w-3.5 h-3.5 text-primary" />
              </div>
              <div className="flex-1 min-w-0 space-y-0.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium">
                    {item.isAnonymous ? "Anonymous Supporter" : item.supporterDisplayName}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
                  </span>
                </div>
                {item.message && <p className="text-sm text-muted-foreground break-words">{item.message}</p>}
                {item.contentTitle && (
                  <p className="text-xs text-muted-foreground/70">on {item.contentTitle}</p>
                )}
              </div>
              {isOwnerOrStaff && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="flex-shrink-0 text-muted-foreground hover:text-destructive"
                  disabled={hideMutation.isPending}
                  onClick={() => hideMutation.mutate({ transactionId: item.id })}
                  title="Delete this message"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
            </div>
          ))}
          {data?.hasMore && (
            <div className="flex justify-center pt-1">
              <Button variant="outline" size="sm" onClick={() => setPageSize((p) => p + PAGE_SIZE)} disabled={isLoading}>
                {isLoading ? "Loading…" : "Load More"}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

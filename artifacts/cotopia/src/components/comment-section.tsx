import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetSongComments, getGetSongCommentsQueryKey,
  useCreateSongComment,
  useGetVideoComments, getGetVideoCommentsQueryKey,
  useCreateVideoComment,
  useDeleteComment,
} from "@workspace/api-client-react";
import { UserLink } from "@/components/user-link";
import { LinkifiedText } from "@/components/linkified-text";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ReportModal } from "@/components/report-modal";
import { VerifyEmailBanner } from "@/components/verify-email-banner";
import { useAuth } from "@/lib/auth";
import { usePlatformConfig } from "@/lib/platform-config";
import { Trash2, MessageCircle, CornerDownRight } from "lucide-react";
import { Link } from "wouter";
import { formatDistanceToNow } from "date-fns";

type PrimaryBadge = { id: number; name: string; icon: string; color: string | null; category: string } | null;

interface CommentData {
  id: number;
  userId: number | null;
  username: string | null;
  avatarUrl: string | null;
  content: string;
  parentId: number | null;
  createdAt: string;
  primaryBadge?: PrimaryBadge;
  replies: CommentData[];
}

interface CommentSectionProps {
  contentType: "song" | "video";
  contentId: number;
}

function CommentItem({
  comment,
  contentType,
  contentId,
  depth,
  onReplyTo,
}: {
  comment: CommentData;
  contentType: "song" | "video";
  contentId: number;
  depth: number;
  onReplyTo: (id: number, username: string) => void;
}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const deleteMutation = useDeleteComment({
    mutation: {
      onSuccess: () => {
        const key = contentType === "song"
          ? getGetSongCommentsQueryKey(contentId)
          : getGetVideoCommentsQueryKey(contentId);
        queryClient.invalidateQueries({ queryKey: key });
      },
    },
  });

  const isOwn = user?.id === comment.userId;
  const isMod = user?.role && ["admin", "master_admin", "moderator"].includes(user.role);
  const canDelete = isOwn || isMod;

  return (
    <div className={`flex gap-3 ${depth > 0 ? "ml-6 pl-3 border-l border-border/50" : ""}`}>
      <div className="w-7 h-7 rounded-full overflow-hidden flex-shrink-0 bg-secondary mt-0.5">
        {comment.avatarUrl
          ? <img src={comment.avatarUrl} alt={comment.username ?? ""} className="w-full h-full object-cover" />
          : <div className="w-full h-full flex items-center justify-center text-xs font-semibold text-muted-foreground">
              {(comment.username ?? "?")[0]?.toUpperCase()}
            </div>}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <UserLink
            username={comment.username ?? ""}
            userId={comment.userId ?? undefined}
            primaryBadge={(comment.primaryBadge as any) ?? null}
            className="text-xs font-semibold"
          />
          <span className="text-[10px] text-muted-foreground">
            {comment.createdAt
              ? formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })
              : ""}
          </span>
        </div>

        <p className="text-sm text-foreground/80 leading-relaxed break-words"><LinkifiedText text={comment.content} /></p>

        <div className="flex items-center gap-3 mt-1.5">
          {user && depth === 0 && (
            <button
              className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => onReplyTo(comment.id, comment.username ?? "")}
            >
              Reply
            </button>
          )}
          {user && (
            <div className="opacity-0 group-hover:opacity-100 transition-opacity">
              <ReportModal targetType="comment" targetId={comment.id} />
            </div>
          )}
          {canDelete && (
            <button
              className="text-[10px] text-red-500/60 hover:text-red-500 transition-colors flex items-center gap-0.5"
              onClick={() => deleteMutation.mutate({ id: comment.id })}
              disabled={deleteMutation.isPending}
            >
              <Trash2 className="w-3 h-3" /> Delete
            </button>
          )}
        </div>

        {comment.replies?.length > 0 && (
          <div className="mt-3 space-y-3">
            {comment.replies.map(reply => (
              <CommentItem
                key={reply.id}
                comment={reply}
                contentType={contentType}
                contentId={contentId}
                depth={depth + 1}
                onReplyTo={onReplyTo}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function CommentSection({ contentType, contentId }: CommentSectionProps) {
  const { user } = useAuth();
  const config = usePlatformConfig();
  const queryClient = useQueryClient();
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<{ id: number; username: string } | null>(null);

  const { data: songComments, isLoading: songLoading } = useGetSongComments(
    contentId,
    { query: { enabled: contentType === "song", queryKey: getGetSongCommentsQueryKey(contentId) } },
  );
  const { data: videoComments, isLoading: videoLoading } = useGetVideoComments(
    contentId,
    { query: { enabled: contentType === "video", queryKey: getGetVideoCommentsQueryKey(contentId) } },
  );

  const comments = (contentType === "song" ? songComments : videoComments) as CommentData[] | undefined;
  const isLoading = contentType === "song" ? songLoading : videoLoading;

  const invalidate = () => {
    const key = contentType === "song"
      ? getGetSongCommentsQueryKey(contentId)
      : getGetVideoCommentsQueryKey(contentId);
    queryClient.invalidateQueries({ queryKey: key });
  };

  const songMutation = useCreateSongComment({
    mutation: { onSuccess: () => { setText(""); setReplyTo(null); invalidate(); } },
  });
  const videoMutation = useCreateVideoComment({
    mutation: { onSuccess: () => { setText(""); setReplyTo(null); invalidate(); } },
  });

  const isPending = contentType === "song" ? songMutation.isPending : videoMutation.isPending;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    const body = { content: text.trim(), parentId: replyTo?.id ?? undefined };
    if (contentType === "song") {
      songMutation.mutate({ id: contentId, data: body });
    } else {
      videoMutation.mutate({ id: contentId, data: body });
    }
  };

  const totalCount = comments?.reduce((n, c) => n + 1 + (c.replies?.length ?? 0), 0) ?? 0;

  return (
    <div className="space-y-5">
      <h3 className="text-sm font-semibold flex items-center gap-2">
        <MessageCircle className="w-4 h-4 text-muted-foreground" />
        Comments {totalCount > 0 && <span className="text-muted-foreground font-normal">({totalCount})</span>}
      </h3>

      {user && (
        <form onSubmit={handleSubmit} className="space-y-2">
          {config.requireEmailVerification && !(user as any).emailVerified && (
            <VerifyEmailBanner action="post a comment" className="mb-2" />
          )}
          {replyTo && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-secondary/40 rounded-lg px-3 py-1.5">
              <CornerDownRight className="w-3 h-3 flex-shrink-0" />
              Replying to <span className="font-medium text-foreground">@{replyTo.username}</span>
              <button type="button" onClick={() => setReplyTo(null)} className="ml-auto hover:text-foreground">✕</button>
            </div>
          )}
          <div className="flex gap-2 items-end">
            <div className="w-7 h-7 rounded-full overflow-hidden flex-shrink-0 bg-secondary">
              {(user as any).avatarUrl
                ? <img src={(user as any).avatarUrl} alt={user.username} className="w-full h-full object-cover" />
                : <div className="w-full h-full flex items-center justify-center text-xs font-semibold text-muted-foreground">
                    {user.username[0]?.toUpperCase()}
                  </div>}
            </div>
            <Textarea
              aria-label="Add a comment"
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder="Add a comment…"
              className="resize-none text-sm min-h-[72px] bg-secondary/30 border-secondary flex-1"
              maxLength={1000}
            />
          </div>
          <div className="flex justify-end">
            <Button type="submit" size="sm" disabled={isPending || !text.trim()} className="text-xs h-8">
              {isPending ? "Posting…" : "Post"}
            </Button>
          </div>
        </form>
      )}

      {!user && (
        <div className="text-sm text-muted-foreground text-center py-4">
          <Link href="/login" className="text-primary hover:underline">Sign in</Link> to leave a comment.
        </div>
      )}

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex gap-3 animate-pulse">
              <div className="w-7 h-7 rounded-full bg-secondary flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-24 bg-secondary rounded" />
                <div className="h-3 w-48 bg-secondary rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : comments && comments.length > 0 ? (
        <div className="space-y-5 group">
          {comments.map(c => (
            <CommentItem
              key={c.id}
              comment={c}
              contentType={contentType}
              contentId={contentId}
              depth={0}
              onReplyTo={(id, username) => setReplyTo({ id, username })}
            />
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground text-center py-6">No comments yet. Be the first!</p>
      )}
    </div>
  );
}

import { useParams } from "wouter";
import { useGetVideo, getGetVideoQueryKey, useGetVideoComments, getGetVideoCommentsQueryKey, useRateVideo, useCreateVideoComment } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Play, Heart, Star, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { useQueryClient } from "@tanstack/react-query";

export default function VideoDetail() {
  const { id } = useParams();
  const videoId = Number(id);
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: video, isLoading } = useGetVideo(videoId, {
    query: { enabled: !!videoId, queryKey: getGetVideoQueryKey(videoId) }
  });

  const { data: comments, isLoading: loadingComments } = useGetVideoComments(videoId, {
    query: { enabled: !!videoId, queryKey: getGetVideoCommentsQueryKey(videoId) }
  });

  const [commentContent, setCommentContent] = useState("");
  const createCommentMutation = useCreateVideoComment();
  const rateMutation = useRateVideo();

  const handleRate = (rating: number) => {
    rateMutation.mutate({ id: videoId, data: { rating } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetVideoQueryKey(videoId) });
      }
    });
  };

  const handleComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentContent.trim()) return;
    createCommentMutation.mutate({ id: videoId, data: { content: commentContent } }, {
      onSuccess: () => {
        setCommentContent("");
        queryClient.invalidateQueries({ queryKey: getGetVideoCommentsQueryKey(videoId) });
      }
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-8 pb-24">
        <Skeleton className="w-full aspect-video rounded-xl shadow-2xl" />
        <div className="space-y-4 max-w-3xl">
          <Skeleton className="h-12 w-3/4" />
          <Skeleton className="h-4 w-1/3" />
        </div>
      </div>
    );
  }

  if (!video) return <div className="p-8 text-center text-muted-foreground">Video not found</div>;

  return (
    <div className="space-y-12 pb-24">
      {/* Player Area */}
      <div className="w-full aspect-video rounded-xl shadow-2xl overflow-hidden bg-black border border-border relative group">
        {video.thumbnailUrl && (
          <img src={video.thumbnailUrl} alt={video.title} className="w-full h-full object-cover opacity-50" />
        )}
        <div className="absolute inset-0 flex items-center justify-center">
           <button className="bg-primary text-primary-foreground rounded-full p-6 transform hover:scale-105 transition-transform duration-300">
             <Play className="w-12 h-12 fill-current ml-2" />
           </button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-8 justify-between items-start max-w-5xl">
        <div className="space-y-4 flex-1">
          <p className="text-xs uppercase tracking-widest font-semibold text-primary">Video</p>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight">{video.title}</h1>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="font-semibold text-foreground hover:underline cursor-pointer">{video.artistName}</span>
            <span>•</span>
            <span>{Math.floor(video.duration / 60)}:{(video.duration % 60).toString().padStart(2, '0')}</span>
            <span>•</span>
            <span>{video.viewCount} views</span>
          </div>
          {video.description && (
            <p className="text-muted-foreground text-sm mt-4 leading-relaxed">{video.description}</p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-6 bg-card p-4 rounded-xl border border-border">
          <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
            <Heart className="w-6 h-6" />
          </Button>
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <Star 
                key={star} 
                className={`w-5 h-5 cursor-pointer transition-colors ${video.userRating && video.userRating >= star ? 'fill-primary text-primary' : 'text-muted-foreground hover:text-primary'}`} 
                onClick={() => handleRate(star)}
              />
            ))}
            <span className="text-sm text-muted-foreground ml-2">({video.avgRating ? video.avgRating.toFixed(1) : 'No ratings'})</span>
          </div>
        </div>
      </div>

      {/* Comments */}
      <section className="space-y-6 max-w-3xl border-t border-border pt-12">
        <h3 className="text-2xl font-bold flex items-center gap-2">
          <MessageSquare className="w-6 h-6" />
          Comments {video.commentCount ? `(${video.commentCount})` : ""}
        </h3>
        
        {user ? (
          <form onSubmit={handleComment} className="flex gap-4">
            <div className="w-10 h-10 rounded-full bg-secondary overflow-hidden flex-shrink-0">
              {user.avatarUrl && <img src={user.avatarUrl} alt={user.username} className="w-full h-full object-cover" />}
            </div>
            <div className="flex-1 flex gap-2">
              <Input 
                value={commentContent}
                onChange={(e) => setCommentContent(e.target.value)}
                placeholder="Add a comment..."
                className="bg-secondary/50 border-secondary"
              />
              <Button type="submit" disabled={createCommentMutation.isPending || !commentContent.trim()}>
                Post
              </Button>
            </div>
          </form>
        ) : (
          <div className="p-4 bg-secondary/30 rounded-md border border-border text-center text-sm text-muted-foreground">
            Please log in to leave a comment.
          </div>
        )}

        <div className="space-y-6 mt-8">
          {loadingComments ? (
            <Skeleton className="h-16 w-full" />
          ) : comments?.length ? (
            comments.map((comment) => (
              <div key={comment.id} className="flex gap-4">
                <div className="w-10 h-10 rounded-full bg-secondary overflow-hidden flex-shrink-0">
                  {comment.avatarUrl ? (
                    <img src={comment.avatarUrl} alt={comment.username} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xs">{comment.username[0].toUpperCase()}</div>
                  )}
                </div>
                <div className="flex-1 space-y-1">
                  <div className="flex items-baseline gap-2">
                    <span className="font-semibold text-sm">{comment.username}</span>
                    <span className="text-xs text-muted-foreground">{new Date(comment.createdAt).toLocaleDateString()}</span>
                  </div>
                  <p className="text-sm">{comment.content}</p>
                </div>
              </div>
            ))
          ) : (
            <p className="text-muted-foreground text-sm">No comments yet.</p>
          )}
        </div>
      </section>
    </div>
  );
}

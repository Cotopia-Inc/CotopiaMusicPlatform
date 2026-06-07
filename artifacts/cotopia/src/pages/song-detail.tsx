import { useParams } from "wouter";
import { useGetSong, getGetSongQueryKey, useGetSongComments, getGetSongCommentsQueryKey, useRateSong, useCreateSongComment } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Play, Heart, Star, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { useQueryClient } from "@tanstack/react-query";

export default function SongDetail() {
  const { id } = useParams();
  const songId = Number(id);
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: song, isLoading } = useGetSong(songId, {
    query: { enabled: !!songId, queryKey: getGetSongQueryKey(songId) }
  });

  const { data: comments, isLoading: loadingComments } = useGetSongComments(songId, {
    query: { enabled: !!songId, queryKey: getGetSongCommentsQueryKey(songId) }
  });

  const [commentContent, setCommentContent] = useState("");
  const createCommentMutation = useCreateSongComment();
  const rateMutation = useRateSong();

  const handleRate = (rating: number) => {
    rateMutation.mutate({ id: songId, data: { rating } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetSongQueryKey(songId) });
      }
    });
  };

  const handleComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentContent.trim()) return;
    createCommentMutation.mutate({ id: songId, data: { content: commentContent } }, {
      onSuccess: () => {
        setCommentContent("");
        queryClient.invalidateQueries({ queryKey: getGetSongCommentsQueryKey(songId) });
      }
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-8 pb-24">
        <div className="flex gap-8 items-end h-64">
          <Skeleton className="w-64 h-64 rounded-md shadow-2xl" />
          <div className="space-y-4 flex-1">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-12 w-3/4" />
            <Skeleton className="h-4 w-1/3" />
          </div>
        </div>
      </div>
    );
  }

  if (!song) return <div className="p-8 text-center text-muted-foreground">Song not found</div>;

  return (
    <div className="space-y-12 pb-24">
      {/* Header */}
      <div className="flex flex-col md:flex-row gap-8 items-end">
        <div className="w-64 h-64 rounded-md shadow-2xl overflow-hidden bg-secondary border border-border flex-shrink-0">
          {song.coverUrl ? (
            <img src={song.coverUrl} alt={song.title} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground">No Cover</div>
          )}
        </div>
        <div className="flex-1 space-y-4">
          <p className="text-xs uppercase tracking-widest font-semibold text-primary">Song</p>
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tighter">{song.title}</h1>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="font-semibold text-foreground hover:underline cursor-pointer">{song.artistName}</span>
            <span>•</span>
            <span>{song.albumName || "Single"}</span>
            <span>•</span>
            <span>{Math.floor(song.duration / 60)}:{(song.duration % 60).toString().padStart(2, '0')}</span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-6">
        <Button size="icon" className="w-14 h-14 rounded-full bg-primary text-primary-foreground hover:scale-105 transition-transform">
          <Play className="w-6 h-6 ml-1 fill-current" />
        </Button>
        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
          <Heart className="w-8 h-8" />
        </Button>
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((star) => (
            <Star 
              key={star} 
              className={`w-6 h-6 cursor-pointer transition-colors ${song.userRating && song.userRating >= star ? 'fill-primary text-primary' : 'text-muted-foreground hover:text-primary'}`} 
              onClick={() => handleRate(star)}
            />
          ))}
          <span className="text-sm text-muted-foreground ml-2">({song.avgRating ? song.avgRating.toFixed(1) : 'No ratings'})</span>
        </div>
      </div>

      {/* Comments */}
      <section className="space-y-6 max-w-3xl">
        <h3 className="text-2xl font-bold flex items-center gap-2">
          <MessageSquare className="w-6 h-6" />
          Comments {song.commentCount ? `(${song.commentCount})` : ""}
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
            <p className="text-muted-foreground text-sm">No comments yet. Be the first to share your thoughts.</p>
          )}
        </div>
      </section>
    </div>
  );
}

import { useListVideos, getListVideosQueryKey } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Play, Search, Video as VideoIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useState, useEffect, useRef } from "react";
import { Link } from "wouter";
import { usePlayer } from "@/lib/player";
import { UserLink } from "@/components/user-link";

interface VideoItem {
  id: number;
  title: string;
  artistName?: string | null;
  artistId: number;
  artistIsVerified?: boolean | null;
  thumbnailUrl?: string | null;
  videoUrl?: string | null;
  duration: number;
}

function VideoHoverCard({ video, onPlay }: { video: VideoItem; onPlay: () => void }) {
  const [hovering, setHovering] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  function onEnter() {
    timerRef.current = setTimeout(() => setHovering(true), 350);
  }

  function onLeave() {
    clearTimeout(timerRef.current);
    setHovering(false);
    setVideoReady(false);
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  }

  useEffect(() => {
    if (hovering && videoRef.current) {
      videoRef.current.play().catch(() => {});
    }
  }, [hovering]);

  return (
    <div
      className="aspect-video relative overflow-hidden rounded-md bg-secondary border border-border group cursor-pointer"
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
    >
      {/* Thumbnail */}
      {video.thumbnailUrl ? (
        <img
          src={video.thumbnailUrl}
          alt={video.title}
          className={`object-cover w-full h-full transition-opacity duration-300 absolute inset-0 ${hovering && videoReady ? "opacity-0" : "opacity-100"}`}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-muted-foreground absolute inset-0">
          <VideoIcon className="w-10 h-10 opacity-30" />
        </div>
      )}

      {/* Hover video preview */}
      {hovering && video.videoUrl && (
        <video
          ref={videoRef}
          src={video.videoUrl}
          muted
          loop
          playsInline
          className={`w-full h-full object-cover absolute inset-0 transition-opacity duration-300 ${videoReady ? "opacity-100" : "opacity-0"}`}
          onLoadedData={() => setVideoReady(true)}
        />
      )}

      {/* Hover badge */}
      {hovering && video.videoUrl && !videoReady && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-5 h-5 rounded-full border-2 border-white/50 border-t-white animate-spin" />
        </div>
      )}

      {/* Play overlay */}
      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
        <button
          className="bg-primary text-primary-foreground rounded-full p-4 transform scale-90 group-hover:scale-100 transition-all duration-300 shadow-lg"
          title={`Play ${video.title}`}
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onPlay(); }}
        >
          <Play className="w-8 h-8 fill-current ml-1" />
        </button>
      </div>
    </div>
  );
}

export default function Videos() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const { play } = usePlayer();

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 500);
    return () => clearTimeout(timer);
  }, [search]);

  const { data, isLoading } = useListVideos(
    { q: debouncedSearch, limit: 50 },
    { query: { queryKey: getListVideosQueryKey({ q: debouncedSearch, limit: 50 }) } }
  );

  return (
    <div className="space-y-8 pb-24">
      <div className="flex items-center justify-between">
        <h1 className="text-4xl font-extrabold tracking-tight">Videos</h1>
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search videos..."
            className="pl-9 bg-secondary/50 border-secondary"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {isLoading ? (
          Array(8).fill(0).map((_, i) => (
            <div key={i} className="space-y-3">
              <Skeleton className="aspect-video rounded-md" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          ))
        ) : data?.items?.length ? (
          data.items.map((video) => (
            <div key={video.id} className="space-y-3">
              <Link href={`/videos/${video.id}`}>
                <VideoHoverCard
                  video={video}
                  onPlay={() => play({
                    id: video.id,
                    title: video.title,
                    artistName: video.artistName ?? "",
                    artistId: video.artistId,
                    artistUserRole: video.artistUserRole ?? null, artistIsVerified: video.artistIsVerified ?? false,
                    coverUrl: video.thumbnailUrl,
                    videoUrl: video.videoUrl,
                    duration: video.duration,
                  })}
                />
              </Link>
              <div>
                <Link href={`/videos/${video.id}`}>
                  <h4 className="font-semibold text-sm truncate hover:text-primary transition-colors">{video.title}</h4>
                </Link>
                <UserLink username={video.artistName ?? ""} artistId={video.artistId} role={video.artistUserRole} isVerified={video.artistIsVerified ?? false} className="text-xs text-muted-foreground" />
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-full text-muted-foreground py-12 text-center">No videos found matching your search.</div>
        )}
      </div>
    </div>
  );
}

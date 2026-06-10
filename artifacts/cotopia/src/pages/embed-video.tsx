import { useParams } from "wouter";
import { useGetVideo, getGetVideoQueryKey } from "@workspace/api-client-react";
import { Play, Radio } from "lucide-react";
import { RoleTag } from "@/components/role-badges";
import { Skeleton } from "@/components/ui/skeleton";

export default function EmbedVideo() {
  const { id } = useParams();
  const videoId = Number(id);

  const { data: video, isLoading } = useGetVideo(videoId, {
    query: { enabled: !!videoId, queryKey: getGetVideoQueryKey(videoId) }
  });

  if (isLoading) {
    return (
      <div className="h-screen bg-black flex items-center justify-center">
        <Skeleton className="w-full h-full" />
      </div>
    );
  }

  if (!video) {
    return (
      <div className="h-screen bg-black flex items-center justify-center text-muted-foreground text-sm">
        Video not found
      </div>
    );
  }

  return (
    <div className="h-screen bg-black relative overflow-hidden">
      {/* Thumbnail */}
      {video.thumbnailUrl && (
        <img
          src={video.thumbnailUrl}
          alt={video.title}
          className="absolute inset-0 w-full h-full object-cover opacity-70"
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20" />

      {/* Play Button */}
      <div className="absolute inset-0 flex items-center justify-center">
        <button className="bg-primary/90 text-white rounded-full p-6 hover:scale-110 transition-transform shadow-2xl">
          <Play className="w-10 h-10 fill-current ml-1" />
        </button>
      </div>

      {/* Info Bar */}
      <div className="absolute bottom-0 left-0 right-0 p-4 flex items-end justify-between">
        <div className="space-y-0.5">
          <p className="font-bold text-white">{video.title}</p>
          <p className="text-sm text-white/70 flex items-center gap-1">{video.artistName}<RoleTag role="artist" size="sm" /></p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-black/60 backdrop-blur px-2.5 py-1.5 rounded-full">
            <Radio className="w-3 h-3 text-primary" />
            <span className="text-[11px] text-white font-medium">Everyday Radio</span>
          </div>
          <a
            href={`/videos/${videoId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] text-primary bg-primary/20 px-2.5 py-1.5 rounded-full hover:bg-primary/30 transition-colors font-medium"
          >
            Watch →
          </a>
        </div>
      </div>
    </div>
  );
}

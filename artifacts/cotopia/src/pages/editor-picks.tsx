import { useState } from "react";
import { useListEditorPicks, useAddEditorPick, useDeleteEditorPick, useUpdateEditorPick, useListSongs, useListVideos, useListArtists, getListEditorPicksQueryKey, getListSongsQueryKey, getListVideosQueryKey, getListArtistsQueryKey } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Sparkles, Plus, Trash2, Music, Video, User, X, Search, ChevronUp, ChevronDown, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

const EDITOR_ROLES = ["editor", "admin", "master_admin"];
type ContentType = "song" | "video" | "artist";

export default function EditorPicksPage() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();

  useEffect(() => {
    if (user && !EDITOR_ROLES.includes(user.role)) navigate("/");
  }, [user, navigate]);

  const { data: picks = [], isLoading } = useListEditorPicks({
    query: { queryKey: getListEditorPicksQueryKey() }
  });

  const addMutation = useAddEditorPick({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListEditorPicksQueryKey() });
        setShowAdd(false);
        setSearch("");
        setSelectedType("song");
        toast({ title: "Pick added" });
      },
    },
  });

  const deleteMutation = useDeleteEditorPick({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListEditorPicksQueryKey() });
        toast({ title: "Pick removed" });
      },
    },
  });

  const updateMutation = useUpdateEditorPick({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListEditorPicksQueryKey() });
        toast({ title: "Pick updated" });
      },
    },
  });

  const [showAdd, setShowAdd] = useState(false);
  const [selectedType, setSelectedType] = useState<ContentType>("song");
  const [search, setSearch] = useState("");
  const [editingNoteId, setEditingNoteId] = useState<number | null>(null);
  const [noteText, setNoteText] = useState("");

  const { data: songsData } = useListSongs({ q: search, limit: 12 }, {
    query: { enabled: selectedType === "song" && search.length > 0, queryKey: getListSongsQueryKey({ q: search, limit: 12 }) }
  });
  const { data: videosData } = useListVideos({ q: search, limit: 12 }, {
    query: { enabled: selectedType === "video" && search.length > 0, queryKey: getListVideosQueryKey({ q: search, limit: 12 }) }
  });
  const { data: artistsData } = useListArtists(undefined, {
    query: { enabled: selectedType === "artist" && search.length > 0, queryKey: getListArtistsQueryKey() }
  });

  const songs = songsData?.items ?? [];
  const videos = videosData?.items ?? [];
  const artists = (Array.isArray(artistsData) ? artistsData : []).filter((a: { stageName: string }) =>
    search ? a.stageName.toLowerCase().includes(search.toLowerCase()) : true
  ).slice(0, 12);

  function contentLabel(p: (typeof picks)[0]) {
    if (p.contentType === "song") return p.song?.title ?? `Song #${p.contentId}`;
    if (p.contentType === "video") return p.video?.title ?? `Video #${p.contentId}`;
    return (p.artist as any)?.stageName ?? `Artist #${p.contentId}`;
  }

  function contentArt(p: (typeof picks)[0]) {
    if (p.contentType === "song") return p.song?.coverUrl ?? null;
    if (p.contentType === "video") return p.video?.thumbnailUrl ?? null;
    return (p.artist as any)?.avatarUrl ?? null;
  }

  function contentSub(p: (typeof picks)[0]) {
    if (p.contentType === "song") return p.song?.artistName ?? "";
    if (p.contentType === "video") return p.video?.artistName ?? "";
    return (p.artist as any)?.genre ?? "";
  }

  const TypeIcon = ({ type }: { type: ContentType }) => {
    if (type === "song") return <Music className="w-3.5 h-3.5" />;
    if (type === "video") return <Video className="w-3.5 h-3.5" />;
    return <User className="w-3.5 h-3.5" />;
  };

  const typeColor = (type: ContentType) =>
    type === "song" ? "text-purple-400 bg-purple-400/10" :
    type === "video" ? "text-blue-400 bg-blue-400/10" :
    "text-amber-400 bg-amber-400/10";

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Sparkles className="w-5 h-5 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Editor's Picks</h1>
            <p className="text-sm text-muted-foreground">Curate recommendations shown on the Home page</p>
          </div>
        </div>
        <Button onClick={() => setShowAdd(v => !v)} className="gap-2">
          {showAdd ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {showAdd ? "Cancel" : "Add Pick"}
        </Button>
      </div>

      {/* Add pick panel */}
      {showAdd && (
        <div className="bg-card border border-border rounded-xl p-6 space-y-4">
          <h2 className="font-semibold text-sm">Add a recommendation</h2>

          {/* Type tabs */}
          <div className="flex gap-2">
            {(["song", "video", "artist"] as ContentType[]).map(t => (
              <button
                key={t}
                onClick={() => { setSelectedType(t); setSearch(""); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold capitalize transition-colors border ${
                  selectedType === t
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border text-muted-foreground hover:text-foreground hover:border-primary/50"
                }`}
              >
                <TypeIcon type={t} /> {t}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder={`Search ${selectedType}s…`}
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Results */}
          {search.length > 0 && (
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {selectedType === "song" && songs.map(s => (
                <button
                  key={s.id}
                  onClick={() => addMutation.mutate({ data: { contentType: "song", contentId: s.id } })}
                  disabled={addMutation.isPending}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-secondary/60 transition-colors text-left"
                >
                  <div className="w-9 h-9 rounded bg-secondary overflow-hidden flex-shrink-0">
                    {s.coverUrl ? <img src={s.coverUrl} alt={s.title} className="w-full h-full object-cover" /> : <Music className="w-4 h-4 m-auto mt-2.5 text-muted-foreground/40" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{s.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{s.artistName ?? ""}</p>
                  </div>
                  <Plus className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                </button>
              ))}
              {selectedType === "video" && videos.map(v => (
                <button
                  key={v.id}
                  onClick={() => addMutation.mutate({ data: { contentType: "video", contentId: v.id } })}
                  disabled={addMutation.isPending}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-secondary/60 transition-colors text-left"
                >
                  <div className="w-9 h-9 rounded bg-secondary overflow-hidden flex-shrink-0">
                    {v.thumbnailUrl ? <img src={v.thumbnailUrl} alt={v.title} className="w-full h-full object-cover" /> : <Video className="w-4 h-4 m-auto mt-2.5 text-muted-foreground/40" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{v.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{v.artistName ?? ""}</p>
                  </div>
                  <Plus className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                </button>
              ))}
              {selectedType === "artist" && artists.map(a => (
                <button
                  key={a.id}
                  onClick={() => addMutation.mutate({ data: { contentType: "artist", contentId: a.id } })}
                  disabled={addMutation.isPending}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-secondary/60 transition-colors text-left"
                >
                  <div className="w-9 h-9 rounded-full bg-secondary overflow-hidden flex-shrink-0">
                    {a.avatarUrl ? <img src={a.avatarUrl} alt={a.stageName} className="w-full h-full object-cover" /> : <User className="w-4 h-4 m-auto mt-2.5 text-muted-foreground/40" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{a.stageName}</p>
                    <p className="text-xs text-muted-foreground truncate">{a.genre ?? ""}</p>
                  </div>
                  <Plus className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                </button>
              ))}
              {search.length > 0 && selectedType === "song" && songs.length === 0 && (
                <p className="text-sm text-muted-foreground py-4 text-center">No songs found</p>
              )}
              {search.length > 0 && selectedType === "video" && videos.length === 0 && (
                <p className="text-sm text-muted-foreground py-4 text-center">No videos found</p>
              )}
              {search.length > 0 && selectedType === "artist" && artists.length === 0 && (
                <p className="text-sm text-muted-foreground py-4 text-center">No artists found</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Current picks list */}
      <div>
        <h2 className="text-base font-semibold mb-3 flex items-center gap-2">
          Current Picks
          <span className="text-xs text-muted-foreground font-normal">({picks.length})</span>
        </h2>
        {isLoading ? (
          <div className="space-y-2">
            {Array(4).fill(0).map((_, i) => (
              <div key={i} className="h-16 bg-secondary/30 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : picks.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground bg-card border border-border rounded-xl">
            <Sparkles className="w-8 h-8 mx-auto opacity-20 mb-3" />
            <p className="text-sm">No picks yet — add some above</p>
          </div>
        ) : (
          <div className="space-y-2">
            {picks.map((pick, idx) => (
              <div key={pick.id} className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="flex items-center gap-3 px-4 py-3">
                  {/* Order controls */}
                  <div className="flex flex-col gap-0.5 flex-shrink-0">
                    <button
                      onClick={() => updateMutation.mutate({ id: pick.id, data: { displayOrder: (pick.displayOrder ?? 0) - 1 } })}
                      disabled={idx === 0 || updateMutation.isPending}
                      className="text-muted-foreground hover:text-foreground disabled:opacity-20 transition-colors"
                    >
                      <ChevronUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => updateMutation.mutate({ id: pick.id, data: { displayOrder: (pick.displayOrder ?? 0) + 1 } })}
                      disabled={idx === picks.length - 1 || updateMutation.isPending}
                      className="text-muted-foreground hover:text-foreground disabled:opacity-20 transition-colors"
                    >
                      <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Art */}
                  <div className={`w-10 h-10 rounded ${pick.contentType === "artist" ? "rounded-full" : "rounded-md"} bg-secondary overflow-hidden flex-shrink-0`}>
                    {contentArt(pick)
                      ? <img src={contentArt(pick) ?? undefined} alt={contentLabel(pick)} className="w-full h-full object-cover" />
                      : <div className="w-full h-full flex items-center justify-center"><TypeIcon type={pick.contentType as ContentType} /></div>
                    }
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${typeColor(pick.contentType as ContentType)}`}>
                        <TypeIcon type={pick.contentType as ContentType} />
                        {pick.contentType}
                      </span>
                      <p className="text-sm font-semibold truncate">{contentLabel(pick)}</p>
                    </div>
                    {contentSub(pick) && (
                      <p className="text-xs text-muted-foreground truncate mt-0.5">{contentSub(pick)}</p>
                    )}
                    {pick.note && (
                      <p className="text-xs text-primary/80 italic truncate mt-0.5">"{pick.note}"</p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => {
                        setEditingNoteId(editingNoteId === pick.id ? null : pick.id);
                        setNoteText(pick.note ?? "");
                      }}
                      className="text-muted-foreground hover:text-primary transition-colors p-1.5 rounded"
                      title="Edit note"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => deleteMutation.mutate({ id: pick.id })}
                      disabled={deleteMutation.isPending}
                      className="text-muted-foreground hover:text-red-400 transition-colors p-1.5 rounded disabled:opacity-40"
                      title="Remove"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Note editor */}
                {editingNoteId === pick.id && (
                  <div className="px-4 pb-3 pt-0 flex gap-2 border-t border-border/40">
                    <Textarea
                      value={noteText}
                      onChange={e => setNoteText(e.target.value)}
                      placeholder="Add an editorial note (shown on Home page)…"
                      className="text-xs resize-none h-16 flex-1"
                    />
                    <div className="flex flex-col gap-1.5">
                      <Button
                        size="sm"
                        className="text-xs h-7"
                        onClick={() => {
                          updateMutation.mutate({ id: pick.id, data: { note: noteText || undefined } });
                          setEditingNoteId(null);
                        }}
                      >Save</Button>
                      <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => setEditingNoteId(null)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

import { useListCompanyPosts, getListCompanyPostsQueryKey, useGetCeoMessage, useSetCeoMessage, useDeleteCompanyPost } from "@workspace/api-client-react";
import { LinkifiedText } from "@/components/linkified-text";
import { Skeleton } from "@/components/ui/skeleton";
import { Megaphone, Quote, Crown, Save, Edit2, X, Trash2, ExternalLink, ArrowLeft, Home } from "lucide-react";
import { Link } from "wouter";
import { RoleBadges } from "@/components/role-badges";
import { useAuth } from "@/lib/auth";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useSeo } from "@/hooks/use-seo";

export default function CompanyHub() {
  const { user } = useAuth();

  useSeo({
    title: "Company Hub",
    description: "Announcements, spotlights, and updates from the Cotopia team.",
  });
  const { toast } = useToast();
  const qc = useQueryClient();
  const isMasterAdmin = user?.role === "master_admin";
  const isAdmin = isMasterAdmin || user?.role === "admin";
  const [deletingPostId, setDeletingPostId] = useState<number | null>(null);
  const deletePostMutation = useDeleteCompanyPost();

  const handleDeletePost = (id: number) => {
    if (!window.confirm("Delete this post permanently? This cannot be undone.")) return;
    setDeletingPostId(id);
    deletePostMutation.mutate({ id }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListCompanyPostsQueryKey({ limit: 50 }) });
        toast({ title: "Post deleted" });
      },
      onError: () => toast({ variant: "destructive", title: "Failed to delete post" }),
      onSettled: () => setDeletingPostId(null),
    });
  };

  const { data, isLoading } = useListCompanyPosts(
    { limit: 50 },
    { query: { queryKey: getListCompanyPostsQueryKey({ limit: 50 }) } }
  );

  const { data: ceoMsg, isLoading: ceoLoading } = useGetCeoMessage();

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ content: "", authorName: "CEO", authorTitle: "Chief Executive Officer", isVisible: true });

  function startEdit() {
    setForm({
      content: ceoMsg?.content ?? "",
      authorName: ceoMsg?.authorName ?? "CEO",
      authorTitle: ceoMsg?.authorTitle ?? "Chief Executive Officer",
      isVisible: ceoMsg?.isVisible ?? true,
    });
    setEditing(true);
  }

  const saveMutation = useSetCeoMessage({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: ["getCeoMessage"] });
        setEditing(false);
        toast({ title: "CEO message saved" });
      },
    },
  });

  return (
    <div className="space-y-12 pb-24 max-w-5xl mx-auto">
      <div className="space-y-4">
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight">Company Hub</h1>
        <p className="text-muted-foreground text-lg">Announcements, updates, and spotlights from Everyday Radio.</p>
      </div>

      {/* ── CEO Word ────────────────────────────────────────────────────────── */}
      {isMasterAdmin && (
        <div className="bg-card border border-amber-400/20 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Crown className="w-4 h-4 text-amber-400" />
              <h2 className="font-semibold text-sm">Word from the CEO</h2>
              <RoleBadges role="master_admin" isVerified={true} />
            </div>
            {!editing ? (
              <Button variant="ghost" size="sm" className="gap-1.5 text-xs" onClick={startEdit}>
                <Edit2 className="w-3.5 h-3.5" /> Edit
              </Button>
            ) : (
              <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-muted-foreground" onClick={() => setEditing(false)}>
                <X className="w-3.5 h-3.5" /> Cancel
              </Button>
            )}
          </div>

          {editing ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Author name</label>
                  <Input value={form.authorName} onChange={e => setForm(f => ({ ...f, authorName: e.target.value }))} className="h-8 text-sm" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Title</label>
                  <Input value={form.authorTitle} onChange={e => setForm(f => ({ ...f, authorTitle: e.target.value }))} className="h-8 text-sm" />
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Message</label>
                <Textarea
                  value={form.content}
                  onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
                  placeholder="Write your message to the community…"
                  className="resize-none text-sm min-h-[120px]"
                />
              </div>
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.isVisible}
                    onChange={e => setForm(f => ({ ...f, isVisible: e.target.checked }))}
                    className="rounded"
                  />
                  <span className="text-xs text-muted-foreground">Show to visitors</span>
                </label>
                <Button
                  size="sm"
                  className="gap-1.5 text-xs"
                  disabled={saveMutation.isPending || !form.content.trim()}
                  onClick={() => saveMutation.mutate({ data: form })}
                >
                  <Save className="w-3.5 h-3.5" />
                  {saveMutation.isPending ? "Saving…" : "Save"}
                </Button>
              </div>
            </div>
          ) : ceoLoading ? (
            <Skeleton className="h-20 w-full rounded-lg" />
          ) : ceoMsg?.content ? (
            <div className="text-sm text-muted-foreground">
              <p className="italic">"{<LinkifiedText text={ceoMsg.content} />}"</p>
              <p className="mt-2 font-semibold text-foreground not-italic">{ceoMsg.authorName}</p>
              <p className="text-xs">{ceoMsg.authorTitle}</p>
              {!ceoMsg.isVisible && (
                <p className="text-[10px] text-amber-400 mt-1.5 font-medium">⚠ Hidden from visitors</p>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No message set yet. Click Edit to add one.</p>
          )}
        </div>
      )}

      {/* CEO message visible to everyone when set */}
      {!isMasterAdmin && ceoMsg?.isVisible && ceoMsg.content && (
        <div className="relative bg-gradient-to-br from-amber-400/5 to-card border border-amber-400/20 rounded-2xl p-8 overflow-hidden">
          <div className="absolute top-4 right-6 text-amber-400/10">
            <Quote className="w-16 h-16 rotate-180" />
          </div>
          <div className="relative space-y-4">
            <div className="flex items-center gap-2">
              <Crown className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-bold uppercase tracking-wider text-amber-400">A Word from Our CEO</span>
            </div>
            <blockquote className="text-lg md:text-xl font-medium leading-relaxed text-foreground">
              "<LinkifiedText text={ceoMsg.content} />"
            </blockquote>
            <div className="flex items-center gap-3 pt-2">
              <div className="w-8 h-8 rounded-full bg-amber-400/20 flex items-center justify-center text-amber-400 font-bold text-sm">
                {ceoMsg.authorName.charAt(0)}
              </div>
              <div>
                <p className="font-semibold text-sm">{ceoMsg.authorName}</p>
                <p className="text-xs text-muted-foreground">{ceoMsg.authorTitle}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Posts */}
      <div className="space-y-12">
        {isLoading ? (
          Array(3).fill(0).map((_, i) => (
            <div key={i} className="space-y-4">
              <Skeleton className="h-8 w-1/3" />
              <Skeleton className="h-64 w-full rounded-xl" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          ))
        ) : data?.length ? (
          data.map((post) => (
            <article key={post.id} className="bg-card border border-border rounded-xl overflow-hidden shadow-lg">
              {post.imageUrl && (
                <div className="w-full aspect-[21/9] bg-secondary relative">
                  <img src={post.imageUrl} alt={post.title} className="w-full h-full object-cover" />
                  {post.isPinned && (
                    <div className="absolute top-4 right-4 bg-primary text-primary-foreground px-3 py-1 text-xs font-bold uppercase tracking-wider rounded-full shadow-lg">
                      Pinned
                    </div>
                  )}
                </div>
              )}
              <div className="p-8 space-y-4">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="px-3 py-1 bg-secondary text-secondary-foreground rounded-full text-xs font-semibold uppercase tracking-wider">
                    {post.type.replace('_', ' ')}
                  </span>
                  <span className="text-sm text-muted-foreground">{new Date(post.createdAt).toLocaleDateString()}</span>
                  {isAdmin && (
                    <div className="ml-auto flex items-center gap-1">
                      <Link href="/admin/company">
                        <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground">
                          <Edit2 className="w-3 h-3" /> Edit in Admin
                        </Button>
                      </Link>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs gap-1 text-red-500/60 hover:text-red-500 hover:bg-red-500/10"
                        onClick={() => handleDeletePost(post.id)}
                        disabled={deletingPostId === post.id}
                        title="Delete this post"
                      >
                        <Trash2 className="w-3 h-3" />
                        {deletingPostId === post.id ? "Deleting…" : "Delete"}
                      </Button>
                    </div>
                  )}
                </div>
                <h2 className="text-3xl font-bold tracking-tight">{post.title}</h2>
                <div className="prose prose-invert max-w-none text-muted-foreground" dangerouslySetInnerHTML={{ __html: post.content }} />
              </div>
            </article>
          ))
        ) : (
          <div className="text-center py-24 text-muted-foreground space-y-4 bg-card rounded-xl border border-border">
            <Megaphone className="w-12 h-12 mx-auto opacity-20" />
            <p>No posts available at the moment.</p>
          </div>
        )}
      </div>

      {/* Our Promise link */}
      <div className="mt-12 pt-8 border-t border-border/30 text-center space-y-2">
        <p className="text-sm text-muted-foreground">Learn more about what drives us.</p>
        <Link href="/about" className="inline-flex items-center gap-2 text-sm text-primary hover:underline font-medium">
          Read Our Promise →
        </Link>
      </div>
    </div>
  );
}

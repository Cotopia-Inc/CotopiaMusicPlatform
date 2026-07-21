import { useState } from "react";
import {
  useListCompanyPosts,
  getListCompanyPostsQueryKey,
  useCreateCompanyPost,
  useUpdateCompanyPost,
  useDeleteCompanyPost,
} from "@workspace/api-client-react";
import { useUpload } from "@/lib/useUpload";
import { ImageCropModal } from "@/components/image-crop-modal";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Megaphone, Plus, Pencil, Trash2, Pin, Upload, X, Loader2, ArrowLeft, ImageIcon,
} from "lucide-react";
import { Link } from "wouter";

const POST_TYPES = [
  { value: "announcement", label: "Announcement" },
  { value: "artist_spotlight", label: "Artist Spotlight" },
  { value: "label_spotlight", label: "Label Spotlight" },
  { value: "product_update", label: "Platform Update" },
  { value: "video", label: "Video Feature" },
  { value: "campaign", label: "Campaign" },
];

interface PostForm {
  title: string;
  type: string;
  content: string;
  imageUrl: string;
  isPinned: boolean;
}

const emptyForm: PostForm = {
  title: "",
  type: "announcement",
  content: "",
  imageUrl: "",
  isPinned: false,
};

function ImageUploader({ value, onChange, onCropOpenChange }: { value: string; onChange: (url: string) => void; onCropOpenChange?: (open: boolean) => void }) {
  const upload = useUpload({ onSuccess: (res) => onChange(`/api/storage${res.objectPath}`) });
  const [cropUrl, setCropUrl] = useState<string | null>(null);
  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) { setCropUrl(URL.createObjectURL(f)); onCropOpenChange?.(true); }
    e.target.value = "";
  };
  const handleCropConfirm = async (blob: Blob) => {
    if (cropUrl) URL.revokeObjectURL(cropUrl);
    setCropUrl(null);
    onCropOpenChange?.(false);
    await upload.uploadFile(new File([blob], "article.jpg", { type: "image/jpeg" }));
  };

  if (value) {
    return (
      <div className="space-y-2">
        <div className="relative rounded-lg overflow-hidden border border-border aspect-video">
          <img src={value} alt="Article" className="w-full h-full object-cover" />
          <button
            type="button"
            onClick={() => onChange("")}
            className="absolute top-2 right-2 w-7 h-7 bg-black/60 hover:bg-black/80 rounded-full flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4 text-white" />
          </button>
        </div>
        <p className="text-xs text-green-400">Image uploaded ✓</p>
      </div>
    );
  }

  return (
    <label className="flex flex-col items-center gap-3 p-6 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary/50 transition-colors">
      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
        {upload.isUploading ? <Loader2 className="w-5 h-5 text-primary animate-spin" /> : <ImageIcon className="w-5 h-5 text-primary" />}
      </div>
      <div className="text-center">
        <p className="text-sm font-medium">{upload.isUploading ? `Uploading… ${upload.progress}%` : "Click to upload article image"}</p>
        <p className="text-xs text-muted-foreground">JPG, PNG, WebP — 16:9 recommended</p>
      </div>
      {upload.isUploading && (
        <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
          <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${upload.progress}%` }} />
        </div>
      )}
      <input type="file" accept="image/*" className="hidden" onChange={handleFile} disabled={upload.isUploading} />
      {cropUrl && (
        <ImageCropModal
          imageUrl={cropUrl}
          aspectRatio={16 / 9}
          title="Crop Article Image"
          outputSize={1280}
          onConfirm={handleCropConfirm}
          onCancel={() => { URL.revokeObjectURL(cropUrl); setCropUrl(null); onCropOpenChange?.(false); }}
        />
      )}
    </label>
  );
}

function PostFormDialog({
  open,
  onClose,
  initial,
  onSave,
  isSaving,
  mode,
}: {
  open: boolean;
  onClose: () => void;
  initial: PostForm;
  onSave: (form: PostForm) => void;
  isSaving: boolean;
  mode: "create" | "edit";
}) {
  const [form, setForm] = useState<PostForm>(initial);
  const [cropping, setCropping] = useState(false);
  const set = (patch: Partial<PostForm>) => setForm(f => ({ ...f, ...patch }));

  useEffect(() => { if (open) setForm(initial); }, [open, initial]);

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent
        className="max-w-2xl max-h-[90vh] overflow-y-auto"
        onPointerDownOutside={(e) => { if (cropping) e.preventDefault(); }}
        onInteractOutside={(e) => { if (cropping) e.preventDefault(); }}
      >
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "New Article" : "Edit Article"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Title *</Label>
            <Input placeholder="Article title" value={form.title} onChange={e => set({ title: e.target.value })} />
          </div>

          <div className="space-y-2">
            <Label>Type</Label>
            <select
              className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={form.type}
              onChange={e => set({ type: e.target.value })}
            >
              {POST_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>

          <div className="space-y-2">
            <Label>Article Image <span className="text-muted-foreground text-xs">(optional)</span></Label>
            <ImageUploader value={form.imageUrl} onChange={url => set({ imageUrl: url })} onCropOpenChange={setCropping} />
          </div>

          <div className="space-y-2">
            <Label>Content * <span className="text-muted-foreground text-xs">(HTML supported)</span></Label>
            <Textarea
              placeholder="Write your article content here. Basic HTML tags like <b>, <i>, <p>, <ul>, <li>, <a> are supported."
              rows={10}
              value={form.content}
              onChange={e => set({ content: e.target.value })}
              className="font-mono text-sm resize-y"
            />
          </div>

          <div className="flex items-center justify-between p-4 rounded-lg border border-border bg-secondary/20">
            <div>
              <p className="text-sm font-medium flex items-center gap-2"><Pin className="w-3.5 h-3.5" />Pin to top</p>
              <p className="text-xs text-muted-foreground">Pinned posts always appear first</p>
            </div>
            <Switch aria-label="Pin to top" checked={form.isPinned} onCheckedChange={v => set({ isPinned: v })} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSaving}>Cancel</Button>
          <Button onClick={() => onSave(form)} disabled={isSaving || !form.title || !form.content}>
            {isSaving ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Saving…</> : mode === "create" ? "Publish Article" : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function AdminCompany() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (user && user.role !== "admin" && user.role !== "master_admin") navigate("/");
  }, [user, navigate]);

  const { data: posts, isLoading } = useListCompanyPosts(
    { limit: 100 },
    { query: { queryKey: getListCompanyPostsQueryKey({ limit: 100 }) } }
  );

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getListCompanyPostsQueryKey({ limit: 100 }) });

  const createMutation = useCreateCompanyPost();
  const updateMutation = useUpdateCompanyPost();
  const deleteMutation = useDeleteCompanyPost();

  const [createOpen, setCreateOpen] = useState(false);
  const [editPost, setEditPost] = useState<{ id: number; form: PostForm } | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  function handleCreate(form: PostForm) {
    createMutation.mutate(
      { data: { title: form.title, type: form.type as any, content: form.content, imageUrl: form.imageUrl || undefined, isPinned: form.isPinned } },
      {
        onSuccess: () => { toast({ title: "Article published!" }); invalidate(); setCreateOpen(false); },
        onError: () => toast({ title: "Failed to publish", variant: "destructive" }),
      }
    );
  }

  function handleEdit(form: PostForm) {
    if (!editPost) return;
    updateMutation.mutate(
      { id: editPost.id, data: { title: form.title, type: form.type as any, content: form.content, imageUrl: form.imageUrl || undefined, isPinned: form.isPinned } },
      {
        onSuccess: () => { toast({ title: "Article updated!" }); invalidate(); setEditPost(null); },
        onError: () => toast({ title: "Failed to update", variant: "destructive" }),
      }
    );
  }

  function handleDelete() {
    if (deleteId === null) return;
    deleteMutation.mutate(
      { id: deleteId },
      {
        onSuccess: () => { toast({ title: "Article deleted" }); invalidate(); setDeleteId(null); },
        onError: () => toast({ title: "Failed to delete", variant: "destructive" }),
      }
    );
  }

  const typeLabel = (t: string) => POST_TYPES.find(p => p.value === t)?.label ?? t.replace(/_/g, " ");

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/admin">
            <Button variant="ghost" size="icon" className="rounded-full" title="Back"><ArrowLeft className="w-4 h-4" /></Button>
          </Link>
          <div className="flex items-center gap-2">
            <Megaphone className="w-6 h-6 text-primary" />
            <div>
              <h1 className="text-xl font-bold">Company Hub</h1>
              <p className="text-sm text-muted-foreground">Manage announcements, spotlights, and news</p>
            </div>
          </div>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="gap-2">
          <Plus className="w-4 h-4" />New Article
        </Button>
      </div>

      {/* Posts list */}
      {isLoading ? (
        <div className="space-y-3">
          {Array(3).fill(0).map((_, i) => (
            <Card key={i} className="bg-card border-border animate-pulse">
              <CardContent className="h-24 p-5" />
            </Card>
          ))}
        </div>
      ) : !posts?.length ? (
        <Card className="bg-card border-border">
          <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
            <Megaphone className="w-12 h-12 text-muted-foreground opacity-20" />
            <div>
              <p className="font-semibold">No articles yet</p>
              <p className="text-sm text-muted-foreground mt-1">Create your first Company Hub post</p>
            </div>
            <Button onClick={() => setCreateOpen(true)} className="gap-2 mt-2">
              <Plus className="w-4 h-4" />Write First Article
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {posts.map((post) => (
            <Card key={post.id} className="bg-card border-border">
              <CardContent className="flex items-start gap-4 p-5">
                {post.imageUrl && (
                  <div className="w-24 h-16 rounded-lg overflow-hidden flex-shrink-0 bg-secondary">
                    <img src={post.imageUrl} alt={post.title} className="w-full h-full object-cover" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <Badge variant="secondary" className="text-xs capitalize">{typeLabel(post.type)}</Badge>
                    {post.isPinned && (
                      <Badge className="text-xs bg-primary/20 text-primary border-primary/30 gap-1">
                        <Pin className="w-2.5 h-2.5" />Pinned
                      </Badge>
                    )}
                    <span className="text-xs text-muted-foreground ml-auto">{new Date(post.createdAt).toLocaleDateString()}</span>
                  </div>
                  <p className="font-semibold text-sm leading-snug">{post.title}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-xs"
                    onClick={() => setEditPost({
                      id: post.id,
                      form: {
                        title: post.title,
                        type: post.type,
                        content: post.content,
                        imageUrl: post.imageUrl ?? "",

                        isPinned: post.isPinned ?? false,
                      },
                    })}
                  >
                    <Pencil className="w-3 h-3" />Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-xs text-destructive hover:text-destructive hover:border-destructive/40"
                    onClick={() => setDeleteId(post.id)}
                  >
                    <Trash2 className="w-3 h-3" />Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create dialog */}
      <PostFormDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        initial={emptyForm}
        onSave={handleCreate}
        isSaving={createMutation.isPending}
        mode="create"
      />

      {/* Edit dialog */}
      <PostFormDialog
        open={!!editPost}
        onClose={() => setEditPost(null)}
        initial={editPost?.form ?? emptyForm}
        onSave={handleEdit}
        isSaving={updateMutation.isPending}
        mode="edit"
      />

      {/* Delete confirmation */}
      <AlertDialog open={deleteId !== null} onOpenChange={open => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this article?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone. The article will be permanently removed from the Company Hub.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
              {deleteMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

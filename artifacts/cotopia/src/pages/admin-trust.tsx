import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Shield, AlertCircle, ListChecks, MessageCircleHeart, Clock, Flag, Plus, Pencil, Trash2, Save, X, Eye, EyeOff, Loader2 } from "lucide-react";
import { format } from "date-fns";

const authHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem("cotopia_token")}`,
  "Content-Type": "application/json",
});

const BASE = `${import.meta.env.BASE_URL}api`;

// ── Generic helpers ──────────────────────────────────────────────────────────
async function apiFetch(url: string, options?: RequestInit) {
  const res = await fetch(url, { ...options, headers: { ...authHeaders(), ...(options?.headers ?? {}) } });
  if (res.status === 204) return null;
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(json?.error ?? "Request failed");
  return json;
}

// ── Status badge helper ──────────────────────────────────────────────────────
function StatusPill({ status, map }: { status: string; map: Record<string, { label: string; className: string }> }) {
  const meta = map[status] ?? { label: status, className: "bg-secondary text-muted-foreground border-border" };
  return (
    <Badge className={`${meta.className} border text-[10px] uppercase`}>{meta.label}</Badge>
  );
}

// ── Known Issues ─────────────────────────────────────────────────────────────
const ISSUE_STATUS_MAP = {
  investigating:   { label: "Investigating",   className: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
  identified:      { label: "Identified",      className: "bg-orange-500/15 text-orange-400 border-orange-500/30" },
  fix_in_progress: { label: "Fix in Progress", className: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
  monitoring:      { label: "Monitoring",      className: "bg-violet-500/15 text-violet-400 border-violet-500/30" },
  resolved:        { label: "Resolved",        className: "bg-green-500/15 text-green-400 border-green-500/30" },
};

function KnownIssuesTab() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null);
  const [creating, setCreating] = useState(false);

  const { data: issues, isLoading } = useQuery<unknown[]>({
    queryKey: ["admin-trust-known-issues"],
    queryFn: () => apiFetch(`${BASE}/admin/trust/known-issues`),
  });

  const saveMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      data["id"]
        ? apiFetch(`${BASE}/admin/trust/known-issues/${data["id"]}`, { method: "PATCH", body: JSON.stringify(data) })
        : apiFetch(`${BASE}/admin/trust/known-issues`, { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-trust-known-issues"] }); setEditing(null); setCreating(false); toast({ title: "Saved" }); },
    onError: (e: Error) => toast({ variant: "destructive", title: e.message }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`${BASE}/admin/trust/known-issues/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-trust-known-issues"] }); toast({ title: "Deleted" }); },
    onError: (e: Error) => toast({ variant: "destructive", title: e.message }),
  });

  const blankIssue = { title: "", description: "", status: "investigating", affectedArea: "", workaround: "", isPublic: false };

  function IssueForm({ initial, onCancel }: { initial: Record<string, unknown>; onCancel: () => void }) {
    const [d, setD] = useState({ ...initial });
    const set = (k: string, v: unknown) => setD(p => ({ ...p, [k]: v }));
    return (
      <div className="p-5 rounded-xl bg-secondary/30 border border-border space-y-3">
        <input aria-label="Title" className="w-full bg-card border border-border rounded-lg px-3 py-2 text-sm" placeholder="Title *" value={d["title"] as string} onChange={e => set("title", e.target.value)} />
        <Textarea aria-label="Description" className="text-sm" rows={3} placeholder="Description *" value={d["description"] as string} onChange={e => set("description", e.target.value)} />
        <div className="grid sm:grid-cols-2 gap-3">
          <Select value={d["status"] as string} onValueChange={v => set("status", v)}>
            <SelectTrigger aria-label="Status" className="text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>{Object.entries(ISSUE_STATUS_MAP).map(([v, m]) => <SelectItem key={v} value={v}>{m.label}</SelectItem>)}</SelectContent>
          </Select>
          <input aria-label="Affected area" className="bg-card border border-border rounded-lg px-3 py-2 text-sm" placeholder="Affected area" value={d["affectedArea"] as string} onChange={e => set("affectedArea", e.target.value)} />
        </div>
        <Textarea aria-label="Workaround" className="text-sm" rows={2} placeholder="Workaround (optional)" value={d["workaround"] as string} onChange={e => set("workaround", e.target.value)} />
        <div className="flex items-center gap-3 flex-wrap">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={d["isPublic"] as boolean} onChange={e => set("isPublic", e.target.checked)} />
            Publish publicly
          </label>
          <div className="flex gap-2 ml-auto">
            <Button size="sm" variant="ghost" onClick={onCancel}><X className="w-3.5 h-3.5 mr-1" />Cancel</Button>
            <Button size="sm" disabled={saveMutation.isPending} onClick={() => saveMutation.mutate(d as Record<string, unknown>)}>
              {saveMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Save className="w-3.5 h-3.5 mr-1" />}Save
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) return <div className="py-8 text-center text-muted-foreground text-sm">Loading…</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{(issues ?? []).length} issue(s)</p>
        <Button size="sm" onClick={() => { setCreating(true); setEditing(null); }}><Plus className="w-3.5 h-3.5 mr-1" />New Issue</Button>
      </div>
      {creating && <IssueForm initial={blankIssue} onCancel={() => setCreating(false)} />}
      {(issues as Record<string, unknown>[] ?? []).map(issue => (
        editing?.["id"] === issue["id"]
          ? <IssueForm key={issue["id"] as number} initial={editing!} onCancel={() => setEditing(null)} />
          : (
            <div key={issue["id"] as number} className="flex items-start gap-3 p-4 rounded-xl bg-card border border-border">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-0.5">
                  <p className="font-medium text-sm">{issue["title"] as string}</p>
                  <StatusPill status={issue["status"] as string} map={ISSUE_STATUS_MAP} />
                  {issue["isPublic"] ? <Badge className="bg-green-500/15 text-green-400 border-green-500/30 border text-[10px] uppercase">Public</Badge> : <Badge className="bg-secondary text-muted-foreground border-border border text-[10px] uppercase">Draft</Badge>}
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2">{issue["description"] as string}</p>
              </div>
              <div className="flex gap-1 flex-shrink-0">
                <Button size="sm" variant="ghost" onClick={() => setEditing(issue)}><Pencil className="w-3.5 h-3.5" /></Button>
                <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => deleteMutation.mutate(issue["id"] as number)}><Trash2 className="w-3.5 h-3.5" /></Button>
              </div>
            </div>
          )
      ))}
    </div>
  );
}

// ── Release Notes ────────────────────────────────────────────────────────────
function ReleaseNotesTab() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null);
  const [creating, setCreating] = useState(false);

  const { data: notes, isLoading } = useQuery<unknown[]>({
    queryKey: ["admin-trust-release-notes"],
    queryFn: () => apiFetch(`${BASE}/admin/trust/release-notes`),
  });

  const saveMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      data["id"]
        ? apiFetch(`${BASE}/admin/trust/release-notes/${data["id"]}`, { method: "PATCH", body: JSON.stringify(data) })
        : apiFetch(`${BASE}/admin/trust/release-notes`, { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-trust-release-notes"] }); setEditing(null); setCreating(false); toast({ title: "Saved" }); },
    onError: (e: Error) => toast({ variant: "destructive", title: e.message }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`${BASE}/admin/trust/release-notes/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-trust-release-notes"] }); toast({ title: "Deleted" }); },
    onError: (e: Error) => toast({ variant: "destructive", title: e.message }),
  });

  const blank = { version: "", releaseDate: new Date().toISOString().split("T")[0], summary: "", newFeatures: "", improvements: "", bugFixes: "", policyUpdates: "", knownLimitations: "", status: "draft", isPublic: false };

  function NoteForm({ initial, onCancel }: { initial: Record<string, unknown>; onCancel: () => void }) {
    const [d, setD] = useState<Record<string, unknown>>({ ...initial, releaseDate: (initial["releaseDate"] as string ?? "").split("T")[0] });
    const set = (k: string, v: unknown) => setD(p => ({ ...p, [k]: v }));
    return (
      <div className="p-5 rounded-xl bg-secondary/30 border border-border space-y-3">
        <div className="grid sm:grid-cols-2 gap-3">
          <input aria-label="Version" className="bg-card border border-border rounded-lg px-3 py-2 text-sm" placeholder="Version (e.g. 0.9.4) *" value={d["version"] as string} onChange={e => set("version", e.target.value)} />
          <input type="date" aria-label="Release date" className="bg-card border border-border rounded-lg px-3 py-2 text-sm" value={d["releaseDate"] as string} onChange={e => set("releaseDate", e.target.value)} />
        </div>
        <Textarea aria-label="Summary" className="text-sm" rows={2} placeholder="Summary *" value={d["summary"] as string} onChange={e => set("summary", e.target.value)} />
        <Textarea aria-label="New features" className="text-sm" rows={3} placeholder="New Features (one per line)" value={d["newFeatures"] as string} onChange={e => set("newFeatures", e.target.value)} />
        <Textarea aria-label="Improvements" className="text-sm" rows={2} placeholder="Improvements (one per line)" value={d["improvements"] as string} onChange={e => set("improvements", e.target.value)} />
        <Textarea aria-label="Bug fixes" className="text-sm" rows={2} placeholder="Bug Fixes (one per line)" value={d["bugFixes"] as string} onChange={e => set("bugFixes", e.target.value)} />
        <Textarea aria-label="Policy updates" className="text-sm" rows={2} placeholder="Policy Updates (one per line)" value={d["policyUpdates"] as string} onChange={e => set("policyUpdates", e.target.value)} />
        <div className="flex items-center gap-3 flex-wrap">
          <Select value={d["status"] as string} onValueChange={v => set("status", v)}>
            <SelectTrigger aria-label="Status" className="text-sm w-36"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="draft">Draft</SelectItem><SelectItem value="published">Published</SelectItem><SelectItem value="archived">Archived</SelectItem></SelectContent>
          </Select>
          <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" checked={d["isPublic"] as boolean} onChange={e => set("isPublic", e.target.checked)} />Publish publicly</label>
          <div className="flex gap-2 ml-auto">
            <Button size="sm" variant="ghost" onClick={onCancel}><X className="w-3.5 h-3.5 mr-1" />Cancel</Button>
            <Button size="sm" disabled={saveMutation.isPending} onClick={() => saveMutation.mutate(d as Record<string, unknown>)}>
              {saveMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Save className="w-3.5 h-3.5 mr-1" />}Save
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) return <div className="py-8 text-center text-muted-foreground text-sm">Loading…</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{(notes ?? []).length} release(s)</p>
        <Button size="sm" onClick={() => { setCreating(true); setEditing(null); }}><Plus className="w-3.5 h-3.5 mr-1" />New Release</Button>
      </div>
      {creating && <NoteForm initial={blank} onCancel={() => setCreating(false)} />}
      {(notes as Record<string, unknown>[] ?? []).map(note => (
        editing?.["id"] === note["id"]
          ? <NoteForm key={note["id"] as number} initial={editing!} onCancel={() => setEditing(null)} />
          : (
            <div key={note["id"] as number} className="flex items-start gap-3 p-4 rounded-xl bg-card border border-border">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-0.5">
                  <p className="font-medium text-sm">v{note["version"] as string}</p>
                  <span className="text-xs text-muted-foreground">{format(new Date(note["releaseDate"] as string), "MMM d, yyyy")}</span>
                  {note["isPublic"] ? <Badge className="bg-green-500/15 text-green-400 border-green-500/30 border text-[10px] uppercase">Public</Badge> : <Badge className="bg-secondary text-muted-foreground border-border border text-[10px] uppercase">Draft</Badge>}
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2">{note["summary"] as string}</p>
              </div>
              <div className="flex gap-1 flex-shrink-0">
                <Button size="sm" variant="ghost" onClick={() => setEditing(note)}><Pencil className="w-3.5 h-3.5" /></Button>
                <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => deleteMutation.mutate(note["id"] as number)}><Trash2 className="w-3.5 h-3.5" /></Button>
              </div>
            </div>
          )
      ))}
    </div>
  );
}

// ── We Heard You ─────────────────────────────────────────────────────────────
const WHY_STATUS_MAP = {
  requested:   { label: "Requested",   className: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
  planned:     { label: "Planned",     className: "bg-violet-500/15 text-violet-400 border-violet-500/30" },
  in_progress: { label: "In Progress", className: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
  released:    { label: "Released",    className: "bg-green-500/15 text-green-400 border-green-500/30" },
  not_planned: { label: "Not Planned", className: "bg-slate-500/15 text-slate-400 border-slate-500/30" },
};

function WeHeardYouTab() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null);
  const [creating, setCreating] = useState(false);

  const { data: items, isLoading } = useQuery<unknown[]>({
    queryKey: ["admin-trust-we-heard-you"],
    queryFn: () => apiFetch(`${BASE}/admin/trust/we-heard-you`),
  });

  const saveMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      data["id"]
        ? apiFetch(`${BASE}/admin/trust/we-heard-you/${data["id"]}`, { method: "PATCH", body: JSON.stringify(data) })
        : apiFetch(`${BASE}/admin/trust/we-heard-you`, { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-trust-we-heard-you"] }); setEditing(null); setCreating(false); toast({ title: "Saved" }); },
    onError: (e: Error) => toast({ variant: "destructive", title: e.message }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`${BASE}/admin/trust/we-heard-you/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-trust-we-heard-you"] }); toast({ title: "Deleted" }); },
    onError: (e: Error) => toast({ variant: "destructive", title: e.message }),
  });

  const blank = { youAsked: "", weDid: "", status: "released", dateRequested: "", dateReleased: "", relatedFeature: "", link: "", isPublic: false };

  function WHYForm({ initial, onCancel }: { initial: Record<string, unknown>; onCancel: () => void }) {
    const fmt = (d: unknown) => d ? (d as string).split("T")[0] : "";
    const [d, setD] = useState<Record<string, unknown>>({ ...initial, dateRequested: fmt(initial["dateRequested"]), dateReleased: fmt(initial["dateReleased"]) });
    const set = (k: string, v: unknown) => setD(p => ({ ...p, [k]: v }));
    return (
      <div className="p-5 rounded-xl bg-secondary/30 border border-border space-y-3">
        <Textarea aria-label="You asked" className="text-sm" rows={3} placeholder="You Asked *" value={d["youAsked"] as string} onChange={e => set("youAsked", e.target.value)} />
        <Textarea aria-label="We did" className="text-sm" rows={3} placeholder="We Did *" value={d["weDid"] as string} onChange={e => set("weDid", e.target.value)} />
        <div className="grid sm:grid-cols-3 gap-3">
          <Select value={d["status"] as string} onValueChange={v => set("status", v)}>
            <SelectTrigger aria-label="Status" className="text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>{Object.entries(WHY_STATUS_MAP).map(([v, m]) => <SelectItem key={v} value={v}>{m.label}</SelectItem>)}</SelectContent>
          </Select>
          <input type="date" aria-label="Date requested" className="bg-card border border-border rounded-lg px-3 py-2 text-sm" placeholder="Date Requested" value={d["dateRequested"] as string} onChange={e => set("dateRequested", e.target.value)} />
          <input type="date" aria-label="Date released" className="bg-card border border-border rounded-lg px-3 py-2 text-sm" placeholder="Date Released" value={d["dateReleased"] as string} onChange={e => set("dateReleased", e.target.value)} />
        </div>
        <input aria-label="Related feature" className="w-full bg-card border border-border rounded-lg px-3 py-2 text-sm" placeholder="Related Feature" value={d["relatedFeature"] as string} onChange={e => set("relatedFeature", e.target.value)} />
        <input aria-label="Link" className="w-full bg-card border border-border rounded-lg px-3 py-2 text-sm" placeholder="Link (optional)" value={d["link"] as string} onChange={e => set("link", e.target.value)} />
        <div className="flex items-center gap-3 flex-wrap">
          <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" checked={d["isPublic"] as boolean} onChange={e => set("isPublic", e.target.checked)} />Publish publicly</label>
          <div className="flex gap-2 ml-auto">
            <Button size="sm" variant="ghost" onClick={onCancel}><X className="w-3.5 h-3.5 mr-1" />Cancel</Button>
            <Button size="sm" disabled={saveMutation.isPending} onClick={() => saveMutation.mutate(d as Record<string, unknown>)}>
              {saveMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Save className="w-3.5 h-3.5 mr-1" />}Save
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) return <div className="py-8 text-center text-muted-foreground text-sm">Loading…</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{(items ?? []).length} entries</p>
        <Button size="sm" onClick={() => { setCreating(true); setEditing(null); }}><Plus className="w-3.5 h-3.5 mr-1" />New Entry</Button>
      </div>
      {creating && <WHYForm initial={blank} onCancel={() => setCreating(false)} />}
      {(items as Record<string, unknown>[] ?? []).map(item => (
        editing?.["id"] === item["id"]
          ? <WHYForm key={item["id"] as number} initial={editing!} onCancel={() => setEditing(null)} />
          : (
            <div key={item["id"] as number} className="flex items-start gap-3 p-4 rounded-xl bg-card border border-border">
              <div className="flex-1 min-w-0 space-y-1">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">You Asked</p>
                <p className="text-sm line-clamp-2">{item["youAsked"] as string}</p>
                <div className="flex items-center gap-2 flex-wrap mt-1">
                  <StatusPill status={item["status"] as string} map={WHY_STATUS_MAP} />
                  {item["isPublic"] ? <Badge className="bg-green-500/15 text-green-400 border-green-500/30 border text-[10px] uppercase">Public</Badge> : <Badge className="bg-secondary text-muted-foreground border-border border text-[10px] uppercase">Draft</Badge>}
                </div>
              </div>
              <div className="flex gap-1 flex-shrink-0">
                <Button size="sm" variant="ghost" onClick={() => setEditing(item)}><Pencil className="w-3.5 h-3.5" /></Button>
                <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => deleteMutation.mutate(item["id"] as number)}><Trash2 className="w-3.5 h-3.5" /></Button>
              </div>
            </div>
          )
      ))}
    </div>
  );
}

// ── Timeline ─────────────────────────────────────────────────────────────────
function TimelineTab() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null);
  const [creating, setCreating] = useState(false);

  const CATEGORIES = ["Promise", "AI", "Beta", "Creator Support", "Legal", "Safety", "Community", "Product"];

  const { data: items, isLoading } = useQuery<unknown[]>({
    queryKey: ["admin-trust-timeline"],
    queryFn: () => apiFetch(`${BASE}/admin/trust/timeline`),
  });

  const saveMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      data["id"]
        ? apiFetch(`${BASE}/admin/trust/timeline/${data["id"]}`, { method: "PATCH", body: JSON.stringify(data) })
        : apiFetch(`${BASE}/admin/trust/timeline`, { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-trust-timeline"] }); setEditing(null); setCreating(false); toast({ title: "Saved" }); },
    onError: (e: Error) => toast({ variant: "destructive", title: e.message }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`${BASE}/admin/trust/timeline/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-trust-timeline"] }); toast({ title: "Deleted" }); },
    onError: (e: Error) => toast({ variant: "destructive", title: e.message }),
  });

  const blank = { eventDate: new Date().toISOString().split("T")[0], title: "", description: "", category: "Product", isPublic: false };

  function TLForm({ initial, onCancel }: { initial: Record<string, unknown>; onCancel: () => void }) {
    const [d, setD] = useState<Record<string, unknown>>({ ...initial, eventDate: (initial["eventDate"] as string ?? "").split("T")[0] });
    const set = (k: string, v: unknown) => setD(p => ({ ...p, [k]: v }));
    return (
      <div className="p-5 rounded-xl bg-secondary/30 border border-border space-y-3">
        <div className="grid sm:grid-cols-2 gap-3">
          <input type="date" aria-label="Event date" className="bg-card border border-border rounded-lg px-3 py-2 text-sm" value={d["eventDate"] as string} onChange={e => set("eventDate", e.target.value)} />
          <Select value={d["category"] as string} onValueChange={v => set("category", v)}>
            <SelectTrigger aria-label="Category" className="text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <input aria-label="Title" className="w-full bg-card border border-border rounded-lg px-3 py-2 text-sm" placeholder="Title *" value={d["title"] as string} onChange={e => set("title", e.target.value)} />
        <Textarea aria-label="Description" className="text-sm" rows={3} placeholder="Description *" value={d["description"] as string} onChange={e => set("description", e.target.value)} />
        <div className="flex items-center gap-3 flex-wrap">
          <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" checked={d["isPublic"] as boolean} onChange={e => set("isPublic", e.target.checked)} />Publish publicly</label>
          <div className="flex gap-2 ml-auto">
            <Button size="sm" variant="ghost" onClick={onCancel}><X className="w-3.5 h-3.5 mr-1" />Cancel</Button>
            <Button size="sm" disabled={saveMutation.isPending} onClick={() => saveMutation.mutate(d as Record<string, unknown>)}>
              {saveMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Save className="w-3.5 h-3.5 mr-1" />}Save
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) return <div className="py-8 text-center text-muted-foreground text-sm">Loading…</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{(items ?? []).length} events</p>
        <Button size="sm" onClick={() => { setCreating(true); setEditing(null); }}><Plus className="w-3.5 h-3.5 mr-1" />New Event</Button>
      </div>
      {creating && <TLForm initial={blank} onCancel={() => setCreating(false)} />}
      {(items as Record<string, unknown>[] ?? []).map(item => (
        editing?.["id"] === item["id"]
          ? <TLForm key={item["id"] as number} initial={editing!} onCancel={() => setEditing(null)} />
          : (
            <div key={item["id"] as number} className="flex items-start gap-3 p-4 rounded-xl bg-card border border-border">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-0.5">
                  <p className="font-medium text-sm">{item["title"] as string}</p>
                  <Badge className="bg-secondary text-muted-foreground border-border border text-[10px] uppercase">{item["category"] as string}</Badge>
                  {item["isPublic"] ? <Badge className="bg-green-500/15 text-green-400 border-green-500/30 border text-[10px] uppercase">Public</Badge> : <Badge className="bg-secondary text-muted-foreground border-border border text-[10px] uppercase">Draft</Badge>}
                </div>
                <p className="text-xs text-muted-foreground">{format(new Date(item["eventDate"] as string), "MMM d, yyyy")}</p>
              </div>
              <div className="flex gap-1 flex-shrink-0">
                <Button size="sm" variant="ghost" onClick={() => setEditing(item)}><Pencil className="w-3.5 h-3.5" /></Button>
                <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => deleteMutation.mutate(item["id"] as number)}><Trash2 className="w-3.5 h-3.5" /></Button>
              </div>
            </div>
          )
      ))}
    </div>
  );
}

// ── Appeals ──────────────────────────────────────────────────────────────────
const APPEAL_STATUS_MAP = {
  received:          { label: "Received",           className: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
  under_review:      { label: "Under Review",       className: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
  more_info_needed:  { label: "More Info Needed",   className: "bg-orange-500/15 text-orange-400 border-orange-500/30" },
  upheld:            { label: "Upheld",             className: "bg-red-500/15 text-red-400 border-red-500/30" },
  reversed:          { label: "Reversed",           className: "bg-green-500/15 text-green-400 border-green-500/30" },
  closed:            { label: "Closed",             className: "bg-slate-500/15 text-slate-400 border-slate-500/30" },
};

function AppealsTab() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState("all");
  const [expanded, setExpanded] = useState<number | null>(null);
  const [editStatus, setEditStatus] = useState<Record<number, string>>({});
  const [editNotes, setEditNotes] = useState<Record<number, string>>({});

  const { data: appeals, isLoading } = useQuery<Record<string, unknown>[]>({
    queryKey: ["admin-trust-appeals", statusFilter],
    queryFn: () => apiFetch(`${BASE}/admin/trust/appeals?status=${statusFilter}`),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, status, adminNotes }: { id: number; status: string; adminNotes?: string }) =>
      apiFetch(`${BASE}/admin/trust/appeals/${id}`, { method: "PATCH", body: JSON.stringify({ status, adminNotes }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-trust-appeals"] }); toast({ title: "Appeal updated" }); },
    onError: (e: Error) => toast({ variant: "destructive", title: e.message }),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger aria-label="Filter by status" className="text-sm w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {Object.entries(APPEAL_STATUS_MAP).map(([v, m]) => <SelectItem key={v} value={v}>{m.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <p className="text-sm text-muted-foreground">{(appeals ?? []).length} appeal(s)</p>
      </div>

      {isLoading && <div className="py-8 text-center text-muted-foreground text-sm">Loading…</div>}

      {(appeals ?? []).map(appeal => (
        <div key={appeal["id"] as number} className="rounded-xl bg-card border border-border overflow-hidden">
          <button className="w-full text-left p-4 flex items-start gap-3" onClick={() => setExpanded(expanded === (appeal["id"] as number) ? null : (appeal["id"] as number))}>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-0.5">
                <p className="font-medium text-sm">{appeal["actionType"] as string}</p>
                <StatusPill status={appeal["status"] as string} map={APPEAL_STATUS_MAP} />
              </div>
              <p className="text-xs text-muted-foreground">
                {appeal["submitterName"] ? `${appeal["submitterName"]} · ` : ""}
                {format(new Date(appeal["createdAt"] as string), "MMM d, yyyy")}
              </p>
            </div>
            {expanded === (appeal["id"] as number) ? <EyeOff className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" /> : <Eye className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />}
          </button>

          {expanded === (appeal["id"] as number) && (
            <div className="border-t border-border p-4 space-y-4">
              {Boolean(appeal["relatedContent"]) && <p className="text-sm"><span className="text-muted-foreground">Related: </span>{appeal["relatedContent"] as string}</p>}
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-1">Reason</p>
                <p className="text-sm leading-relaxed">{appeal["reason"] as string}</p>
              </div>
              {Boolean(appeal["supportingInfo"]) && (
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-1">Supporting Info</p>
                  <p className="text-sm leading-relaxed">{appeal["supportingInfo"] as string}</p>
                </div>
              )}
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Update Status</p>
                <div className="flex gap-2 flex-wrap">
                  <Select value={editStatus[appeal["id"] as number] ?? (appeal["status"] as string)} onValueChange={v => setEditStatus(p => ({ ...p, [appeal["id"] as number]: v }))}>
                    <SelectTrigger aria-label="Update appeal status" className="text-sm w-44"><SelectValue /></SelectTrigger>
                    <SelectContent>{Object.entries(APPEAL_STATUS_MAP).map(([v, m]) => <SelectItem key={v} value={v}>{m.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <Textarea aria-label="Admin notes" rows={2} placeholder="Admin notes (optional)" className="text-sm" value={editNotes[appeal["id"] as number] ?? (appeal["adminNotes"] as string ?? "")} onChange={e => setEditNotes(p => ({ ...p, [appeal["id"] as number]: e.target.value }))} />
                <Button size="sm" disabled={updateMutation.isPending} onClick={() => updateMutation.mutate({ id: appeal["id"] as number, status: editStatus[appeal["id"] as number] ?? (appeal["status"] as string), adminNotes: editNotes[appeal["id"] as number] ?? (appeal["adminNotes"] as string ?? undefined) })}>
                  {updateMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Save className="w-3.5 h-3.5 mr-1" />}Save
                </Button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────
const TABS = [
  { id: "known-issues",  label: "Known Issues",  icon: AlertCircle },
  { id: "release-notes", label: "Release Notes", icon: ListChecks },
  { id: "we-heard-you",  label: "We Heard You",  icon: MessageCircleHeart },
  { id: "timeline",      label: "Timeline",      icon: Clock },
  { id: "appeals",       label: "Appeals",       icon: Flag },
];

export default function AdminTrust() {
  const [tab, setTab] = useState("known-issues");

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
          <Shield className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Trust Center Management</h1>
          <p className="text-sm text-muted-foreground">Manage public known issues, release notes, feedback entries, timeline, and appeals.</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-1 p-1 rounded-xl bg-secondary/50 border border-border w-fit">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors ${tab === id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
          >
            <Icon className="w-3.5 h-3.5" />{label}
          </button>
        ))}
      </div>

      <div>
        {tab === "known-issues"  && <KnownIssuesTab />}
        {tab === "release-notes" && <ReleaseNotesTab />}
        {tab === "we-heard-you"  && <WeHeardYouTab />}
        {tab === "timeline"      && <TimelineTab />}
        {tab === "appeals"       && <AppealsTab />}
      </div>
    </div>
  );
}

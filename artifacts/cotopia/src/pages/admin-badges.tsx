import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { RoleBadges } from "@/components/role-badges";
import { Award, Plus, Pencil, Trash2, Loader2, Search, ShieldCheck, History, X, Check } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { BadgeData, UserBadgeData } from "@/components/badge-chip";

const authHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem("cotopia_token")}`,
  "Content-Type": "application/json",
});

const CATEGORY_OPTIONS = [
  { value: "achievement", label: "Achievement" },
  { value: "beta", label: "Beta" },
  { value: "community", label: "Community" },
  { value: "creator", label: "Creator" },
  { value: "admin", label: "Admin" },
];

const EMOJI_OPTIONS = [
  "🏆","🥇","🥈","🥉","🏅","🎖️","🏵️","⭐","🌟","💫","✨","🔥",
  "🎵","🎶","🎤","🎧","🎸","🎹","🎺","🎻","🥁","🎼","📻","🎙️",
  "👑","💎","💜","🌈","🚀","🛡️","⚡","🔮","🎀","🌙","🌞","🌊",
  "🦋","🍀","🦁","🦅","🦄","🎯","🎨","🎭","🎬","🎪","🎠","🎡",
];

const CATEGORY_META: Record<string, { label: string; className: string }> = {
  achievement: { label: "Achievement", className: "bg-violet-500/15 text-violet-400 border-violet-500/30" },
  beta: { label: "Beta", className: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
  community: { label: "Community", className: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
  creator: { label: "Creator", className: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
  admin: { label: "Admin", className: "bg-red-500/15 text-red-400 border-red-500/30" },
};

type Tab = "badges" | "assign" | "history";

export default function AdminBadges() {
  const [tab, setTab] = useState<Tab>("badges");

  return (
    <div className="space-y-8 pb-24">
      <div>
        <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Admin</p>
        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-2">Badges</h1>
        <p className="text-muted-foreground">Manage achievement badges and award them to users.</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-secondary/50 p-1 rounded-lg w-fit">
        {([
          { id: "badges" as Tab, label: "All Badges", icon: ShieldCheck },
          { id: "assign" as Tab, label: "Assign Badge", icon: Award },
          { id: "history" as Tab, label: "History", icon: History },
        ] as const).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              tab === id
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {tab === "badges" && <BadgesTab />}
      {tab === "assign" && <AssignTab />}
      {tab === "history" && <HistoryTab />}
    </div>
  );
}

// ── All Badges tab ─────────────────────────────────────────────────────────

function BadgesTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const { data: badges, isLoading } = useQuery<BadgeData[]>({
    queryKey: ["admin-badges"],
    queryFn: async () => {
      const res = await fetch(`${import.meta.env.BASE_URL}api/admin/badges`, { headers: authHeaders() });
      if (!res.ok) throw new Error("Failed to load");
      return res.json();
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, field, value }: { id: number; field: "isActive" | "isVisible"; value: boolean }) => {
      const res = await fetch(`${import.meta.env.BASE_URL}api/admin/badges/${id}`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify({ [field]: value }),
      });
      if (!res.ok) throw new Error("Failed to update");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-badges"] });
    },
    onError: () => toast({ variant: "destructive", title: "Update failed" }),
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" className="gap-1.5" onClick={() => { setShowCreate(true); setEditingId(null); }}>
          <Plus className="w-3.5 h-3.5" />
          New Badge
        </Button>
      </div>

      {showCreate && (
        <BadgeForm
          onSave={() => { setShowCreate(false); qc.invalidateQueries({ queryKey: ["admin-badges"] }); }}
          onCancel={() => setShowCreate(false)}
        />
      )}

      {isLoading ? (
        <div className="space-y-3">
          {Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
        </div>
      ) : (
        <div className="space-y-3">
          {(badges ?? []).map(badge => (
            editingId === badge.id ? (
              <BadgeForm
                key={badge.id}
                initial={badge}
                onSave={() => { setEditingId(null); qc.invalidateQueries({ queryKey: ["admin-badges"] }); }}
                onCancel={() => setEditingId(null)}
              />
            ) : (
              <div key={badge.id} className="bg-card border border-border rounded-xl p-4 flex items-center gap-4">
                <span className="text-2xl">{badge.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold">{badge.name}</span>
                    <Badge className={`${CATEGORY_META[badge.category]?.className ?? ""} border text-[10px] uppercase`}>
                      {CATEGORY_META[badge.category]?.label ?? badge.category}
                    </Badge>
                    {!badge.isActive && (
                      <Badge className="bg-secondary text-muted-foreground border border-border text-[10px]">Inactive</Badge>
                    )}
                    {!badge.isVisible && (
                      <Badge className="bg-secondary text-muted-foreground border border-border text-[10px]">Hidden</Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5 truncate">{badge.description}</p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <div className="flex flex-col gap-1 text-xs text-muted-foreground">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <Switch
                        checked={badge.isActive}
                        onCheckedChange={(v) => toggleMutation.mutate({ id: badge.id, field: "isActive", value: v })}
                        className="scale-75"
                      />
                      Active
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <Switch
                        checked={badge.isVisible}
                        onCheckedChange={(v) => toggleMutation.mutate({ id: badge.id, field: "isVisible", value: v })}
                        className="scale-75"
                      />
                      Visible
                    </label>
                  </div>
                  <Button variant="ghost" size="sm" className="w-8 h-8 p-0" onClick={() => setEditingId(badge.id)}>
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            )
          ))}
        </div>
      )}
    </div>
  );
}

function BadgeForm({ initial, onSave, onCancel }: {
  initial?: BadgeData;
  onSave: () => void;
  onCancel: () => void;
}) {
  const { toast } = useToast();
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [category, setCategory] = useState(initial?.category ?? "achievement");
  const [icon, setIcon] = useState(initial?.icon ?? "🏆");
  const [color, setColor] = useState(initial?.color ?? "#7c3aed");
  const [isVisible, setIsVisible] = useState(initial?.isVisible ?? true);
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);

  const isValidHex = (v: string) => /^#[0-9a-fA-F]{6}$/.test(v);
  const colorError = color && !isValidHex(color) ? "Color must be a hex code like #7c3aed. Use the color picker on the left." : null;

  function validate() {
    if (!name.trim()) return "Badge name is required.";
    if (!description.trim()) return "A description is required.";
    if (colorError) return colorError;
    return null;
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      const validationError = validate();
      if (validationError) throw new Error(validationError);

      const body = { name: name.trim(), description: description.trim(), category, icon, color, isVisible, isActive };
      const url = initial
        ? `${import.meta.env.BASE_URL}api/admin/badges/${initial.id}`
        : `${import.meta.env.BASE_URL}api/admin/badges`;
      const res = await fetch(url, {
        method: initial ? "PATCH" : "POST",
        headers: authHeaders(),
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        let msg = "Something went wrong. Please try again.";
        try { msg = (await res.json()).error ?? msg; } catch { /* non-JSON error */ }
        throw new Error(msg);
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: initial ? "Badge updated!" : "Badge created!" });
      onSave();
    },
    onError: (e: unknown) => toast({
      variant: "destructive",
      title: "Couldn't save badge",
      description: e instanceof Error ? e.message : "Something went wrong. Please try again.",
    }),
  });

  return (
    <div className="bg-card border border-primary/30 rounded-xl p-5 space-y-4">
      <p className="font-semibold text-sm">{initial ? "Edit Badge" : "New Badge"}</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Name</label>
          <Input value={name} onChange={e => setName(e.target.value)} placeholder="Badge name" className="bg-secondary/50 border-secondary" />
        </div>
        <div className="space-y-1.5 md:col-span-2">
          <label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Icon</label>
          <div className="flex items-center gap-3">
            <span className="text-3xl w-10 h-10 flex items-center justify-center bg-secondary/50 border border-secondary rounded-md flex-shrink-0">{icon || "🏆"}</span>
            <Input
              value={icon}
              onChange={e => setIcon(e.target.value)}
              placeholder="🏆"
              className="bg-secondary/50 border-secondary w-32 text-lg"
            />
          </div>
          <div className="flex flex-wrap gap-1 mt-2">
            {EMOJI_OPTIONS.map(e => (
              <button
                key={e}
                type="button"
                onClick={() => setIcon(e)}
                className={`text-xl w-9 h-9 flex items-center justify-center rounded-md transition-colors hover:bg-secondary ${icon === e ? "bg-primary/20 ring-1 ring-primary" : "bg-secondary/30"}`}
                title={e}
              >
                {e}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground">Click to pick, or type/paste any emoji in the field above.</p>
        </div>
        <div className="space-y-1.5 md:col-span-2">
          <label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Description</label>
          <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="What this badge represents…" rows={2} className="bg-secondary/50 border-secondary resize-none" />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Category</label>
          <select
            value={category}
            onChange={e => setCategory(e.target.value)}
            className="w-full h-9 rounded-md border border-secondary bg-secondary/50 px-3 text-sm text-foreground"
          >
            {CATEGORY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Color</label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={isValidHex(color) ? color : "#7c3aed"}
              onChange={e => setColor(e.target.value)}
              className="w-9 h-9 rounded cursor-pointer border border-secondary bg-transparent flex-shrink-0"
              title="Click to pick a color"
            />
            <div className="flex-1 space-y-1">
              <Input
                value={color}
                onChange={e => setColor(e.target.value)}
                placeholder="#7c3aed"
                className={`bg-secondary/50 font-mono text-xs ${colorError ? "border-destructive" : "border-secondary"}`}
              />
              {colorError && <p className="text-[11px] text-destructive">{colorError}</p>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <label className="flex items-center gap-2 cursor-pointer text-sm">
            <Switch checked={isActive} onCheckedChange={setIsActive} />
            Active
          </label>
          <label className="flex items-center gap-2 cursor-pointer text-sm">
            <Switch checked={isVisible} onCheckedChange={setIsVisible} />
            Visible
          </label>
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onCancel} className="gap-1">
          <X className="w-3.5 h-3.5" /> Cancel
        </Button>
        <Button size="sm" className="gap-1" disabled={saveMutation.isPending} onClick={() => saveMutation.mutate()}>
          {saveMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
          Save
        </Button>
      </div>
    </div>
  );
}

// ── Assign Badge tab ───────────────────────────────────────────────────────

interface UserResult {
  id: number;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  role: string;
}

function AssignTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [userQuery, setUserQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState<UserResult | null>(null);
  const [selectedBadgeId, setSelectedBadgeId] = useState<number | null>(null);
  const [reason, setReason] = useState("");

  const { data: userResults } = useQuery<UserResult[]>({
    queryKey: ["user-search", userQuery],
    queryFn: async () => {
      if (userQuery.length < 2) return [];
      const res = await fetch(`${import.meta.env.BASE_URL}api/users/search?q=${encodeURIComponent(userQuery)}`, { headers: authHeaders() });
      return res.ok ? res.json() : [];
    },
    enabled: userQuery.length >= 2,
  });

  const { data: badges } = useQuery<BadgeData[]>({
    queryKey: ["admin-badges"],
    queryFn: async () => {
      const res = await fetch(`${import.meta.env.BASE_URL}api/admin/badges`, { headers: authHeaders() });
      return res.ok ? res.json() : [];
    },
  });

  const assignMutation = useMutation({
    mutationFn: async () => {
      if (!selectedUser || !selectedBadgeId) throw new Error("Please select a user and badge");
      const res = await fetch(`${import.meta.env.BASE_URL}api/admin/user-badges`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ userId: selectedUser.id, badgeId: selectedBadgeId, reason: reason.trim() || undefined }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Failed to assign");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Badge assigned!" });
      setSelectedUser(null);
      setSelectedBadgeId(null);
      setReason("");
      setUserQuery("");
      qc.invalidateQueries({ queryKey: ["admin-user-badges"] });
    },
    onError: (e: unknown) => toast({ variant: "destructive", title: e instanceof Error ? e.message : "Assignment failed" }),
  });

  const selectedBadge = badges?.find(b => b.id === selectedBadgeId);

  return (
    <div className="space-y-6 max-w-lg">
      {/* User search */}
      <div className="space-y-2">
        <label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Search User</label>
        {selectedUser ? (
          <div className="flex items-center gap-3 bg-card border border-border rounded-xl p-3">
            <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-sm font-bold flex-shrink-0">
              {selectedUser.avatarUrl
                ? <img src={selectedUser.avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover" />
                : selectedUser.username[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm flex items-center gap-1">
                {selectedUser.displayName ?? selectedUser.username}
                <RoleBadges role={selectedUser.role} isVerified={false} />
              </p>
              <p className="text-xs text-muted-foreground">@{selectedUser.username}</p>
            </div>
            <Button variant="ghost" size="sm" className="w-7 h-7 p-0" onClick={() => setSelectedUser(null)}>
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>
        ) : (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              value={userQuery}
              onChange={e => setUserQuery(e.target.value)}
              placeholder="Search by username or display name…"
              className="pl-9 bg-secondary/50 border-secondary"
            />
            {(userResults ?? []).length > 0 && (
              <div className="absolute top-full left-0 right-0 z-20 bg-card border border-border rounded-xl shadow-lg overflow-hidden mt-1">
                {(userResults ?? []).map(u => (
                  <button
                    key={u.id}
                    className="flex items-center gap-2 w-full px-3 py-2 text-left hover:bg-secondary/50 transition-colors text-sm"
                    onClick={() => { setSelectedUser(u); setUserQuery(""); }}
                  >
                    <span className="font-semibold">{u.displayName ?? u.username}</span>
                    <span className="text-muted-foreground">@{u.username}</span>
                    <RoleBadges role={u.role} isVerified={false} />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Badge picker */}
      <div className="space-y-2">
        <label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Select Badge</label>
        <div className="grid grid-cols-1 gap-2">
          {(badges ?? []).filter(b => b.isActive).map(b => (
            <button
              key={b.id}
              onClick={() => setSelectedBadgeId(b.id === selectedBadgeId ? null : b.id)}
              className={`flex items-center gap-3 rounded-xl border p-3 text-left transition-colors ${
                selectedBadgeId === b.id
                  ? "border-primary bg-primary/10"
                  : "border-border hover:border-border/80 hover:bg-secondary/30"
              }`}
            >
              <span className="text-xl flex-shrink-0">{b.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm">{b.name}</p>
                <p className="text-xs text-muted-foreground truncate">{b.description}</p>
              </div>
              {selectedBadgeId === b.id && <Check className="w-4 h-4 text-primary flex-shrink-0" />}
            </button>
          ))}
        </div>
      </div>

      {/* Reason */}
      <div className="space-y-1.5">
        <label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Reason (optional)</label>
        <Textarea
          value={reason}
          onChange={e => setReason(e.target.value)}
          placeholder="Why is this badge being awarded?"
          rows={2}
          className="bg-secondary/50 border-secondary resize-none"
        />
      </div>

      {/* Preview */}
      {selectedUser && selectedBadge && (
        <div className="bg-card border border-border rounded-xl p-4 space-y-1">
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-2">Preview</p>
          <p className="text-sm">
            Awarding <span className="font-semibold" style={{ color: selectedBadge.color }}>{selectedBadge.icon} {selectedBadge.name}</span>{" "}
            to <span className="font-semibold">@{selectedUser.username}</span>
          </p>
        </div>
      )}

      <Button
        className="gap-1.5"
        disabled={!selectedUser || !selectedBadgeId || assignMutation.isPending}
        onClick={() => assignMutation.mutate()}
      >
        {assignMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Award className="w-4 h-4" />}
        Assign Badge
      </Button>
    </div>
  );
}

// ── History tab ────────────────────────────────────────────────────────────

function HistoryTab() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery<UserBadgeData[]>({
    queryKey: ["admin-user-badges"],
    queryFn: async () => {
      const res = await fetch(`${import.meta.env.BASE_URL}api/admin/user-badges`, { headers: authHeaders() });
      if (!res.ok) throw new Error("Failed to load");
      return res.json();
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`${import.meta.env.BASE_URL}api/admin/user-badges/${id}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error("Failed to remove");
    },
    onSuccess: () => {
      toast({ title: "Badge removed" });
      qc.invalidateQueries({ queryKey: ["admin-user-badges"] });
    },
    onError: () => toast({ variant: "destructive", title: "Could not remove badge" }),
  });

  const items = data ?? [];

  return (
    <div className="space-y-4">
      {isLoading ? (
        <div className="space-y-3">
          {Array(6).fill(0).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
        </div>
      ) : items.length === 0 ? (
        <div className="bg-card border border-border rounded-xl py-16 text-center text-muted-foreground">
          <History className="w-10 h-10 mx-auto mb-2 text-muted-foreground/20" />
          <p>No badge awards yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map(ub => (
            <div key={ub.id} className="bg-card border border-border rounded-xl p-4 flex items-center gap-4">
              <span className="text-xl flex-shrink-0">{ub.badge.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-sm" style={{ color: ub.badge.color }}>{ub.badge.name}</span>
                  <span className="text-muted-foreground text-xs">→</span>
                  <span className="text-sm font-semibold">@{ub.username ?? "unknown"}</span>
                </div>
                <div className="flex items-center gap-1 mt-0.5">
                  <p className="text-xs text-muted-foreground/60">
                    {formatDistanceToNow(new Date(ub.awardedAt), { addSuffix: true })}
                    {ub.awardedByUsername && (
                      <span> · by <span className="font-medium text-muted-foreground">@{ub.awardedByUsername}</span></span>
                    )}
                    {!ub.awardedByAdminId && (
                      <span className="ml-1 text-[10px] text-muted-foreground/40">(auto-awarded)</span>
                    )}
                  </p>
                </div>
                {ub.reason && <p className="text-xs text-muted-foreground mt-0.5 italic">{ub.reason}</p>}
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="w-8 h-8 p-0 text-destructive hover:text-destructive flex-shrink-0"
                onClick={() => removeMutation.mutate(ub.id)}
                disabled={removeMutation.isPending}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

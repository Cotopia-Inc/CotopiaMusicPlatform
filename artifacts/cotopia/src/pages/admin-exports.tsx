import { useState } from "react";
import { Download, FileDown, Calendar, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth";

interface ExportDataset {
  id: string;
  label: string;
  description: string;
  category: "platform" | "safety" | "legal" | "financial";
  masterOnly?: boolean;
}

const DATASETS: ExportDataset[] = [
  // Platform
  {
    id: "analytics",
    label: "Analytics Events",
    description: "Every play, view, follow, favorite, login, registration, and engagement event with timestamps.",
    category: "platform",
  },
  {
    id: "play-history",
    label: "Play / View History",
    description: "All song plays and video views recorded per user, with the exact timestamp.",
    category: "platform",
  },
  {
    id: "follows",
    label: "Follows",
    description: "All artist and label follow relationships — who followed whom and when.",
    category: "platform",
  },
  {
    id: "users",
    label: "Users",
    description: "All registered accounts: email, username, role, verification status, country, and sign-up date. Password hashes excluded.",
    category: "platform",
  },
  // Financial
  {
    id: "payments",
    label: "Payments",
    description: "All submission payment records: provider, mode, amount, status, and PayPal transaction references.",
    category: "financial",
  },
  {
    id: "submissions",
    label: "Submissions",
    description: "All content submissions (songs and videos) with status, plan, payment status, and review notes.",
    category: "financial",
  },
  {
    id: "support-transactions",
    label: "Creator Support Tips",
    description: "All Creator Support tip transactions: sender, recipient, amount, message visibility, and moderation status.",
    category: "financial",
  },
  // Safety & Enforcement
  {
    id: "reports",
    label: "Content Reports",
    description: "All user-submitted content reports: target, reason, status, and reviewer details.",
    category: "safety",
  },
  {
    id: "enforcement-actions",
    label: "Enforcement Actions",
    description: "All warnings, strikes, suspensions, and bans issued to users — manual and automated.",
    category: "safety",
  },
  // Legal
  {
    id: "dmca-claims",
    label: "DMCA Claims",
    description: "All DMCA takedown requests received: claimant, work, infringing URL, and current status.",
    category: "legal",
  },
  {
    id: "copyright-strikes",
    label: "Copyright Strikes",
    description: "All copyright strikes issued to users, with content details and resolution status.",
    category: "legal",
  },
  {
    id: "agreement-acceptances",
    label: "Agreement Acceptances",
    description: "Records of every user accepting a terms, DMCA, or submission agreement — with IP and user-agent.",
    category: "legal",
  },
  {
    id: "audit-logs",
    label: "Admin Audit Log",
    description: "Every admin action taken on the platform: who did what, on which resource, and when.",
    category: "legal",
    masterOnly: true,
  },
];

const CATEGORY_LABEL: Record<ExportDataset["category"], string> = {
  platform: "Platform",
  financial: "Financial",
  safety: "Safety & Enforcement",
  legal: "Legal & Compliance",
};

const CATEGORY_COLOR: Record<ExportDataset["category"], string> = {
  platform: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  financial: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  safety: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  legal: "bg-purple-500/15 text-purple-400 border-purple-500/30",
};

export default function AdminExports() {
  const { user } = useAuth();
  const isMasterAdmin = user?.role === "master_admin";

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [downloading, setDownloading] = useState<string | null>(null);

  const download = async (dataset: ExportDataset) => {
    if (downloading) return;
    setDownloading(dataset.id);
    try {
      const params = new URLSearchParams();
      if (from) params.set("from", from);
      if (to)   params.set("to", to);
      const qs = params.toString() ? `?${params}` : "";

      const res = await fetch(`${import.meta.env.BASE_URL}api/admin/export/${dataset.id}${qs}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("cotopia_token")}` },
      });

      if (!res.ok) {
        const msg = await res.text().catch(() => "Unknown error");
        alert(`Export failed: ${msg}`);
        return;
      }

      const blob = await res.blob();
      const date = new Date().toISOString().slice(0, 10);
      const filename = `cotopia-${dataset.id}-${date}.csv`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(`Export failed: ${String(err)}`);
    } finally {
      setDownloading(null);
    }
  };

  const categories: ExportDataset["category"][] = ["platform", "financial", "safety", "legal"];

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileDown className="w-6 h-6" />
            Data Exports
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Download timestamped CSV snapshots of any platform dataset. All exports include every column for that table.
          </p>
        </div>
      </div>

      {/* Date range filter */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Calendar className="w-4 h-4 text-muted-foreground" />
          Date Range Filter
          <span className="text-muted-foreground font-normal ml-1">— leave blank to export all records</span>
        </div>
        <div className="flex flex-wrap gap-4">
          <div className="flex flex-col gap-1">
            <Label htmlFor="from-date" className="text-xs text-muted-foreground">From</Label>
            <Input
              id="from-date"
              type="date"
              value={from}
              onChange={e => setFrom(e.target.value)}
              className="w-40 text-sm"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="to-date" className="text-xs text-muted-foreground">To</Label>
            <Input
              id="to-date"
              type="date"
              value={to}
              onChange={e => setTo(e.target.value)}
              className="w-40 text-sm"
            />
          </div>
          {(from || to) && (
            <div className="flex items-end">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setFrom(""); setTo(""); }}
                className="text-muted-foreground"
              >
                <RefreshCw className="w-3 h-3 mr-1" />
                Clear
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Export cards grouped by category */}
      {categories.map(category => {
        const datasets = DATASETS.filter(d => d.category === category && (isMasterAdmin || !d.masterOnly));
        if (datasets.length === 0) return null;
        return (
          <div key={category} className="space-y-3">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              {CATEGORY_LABEL[category]}
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {datasets.map(dataset => (
                <div
                  key={dataset.id}
                  className="rounded-xl border border-border bg-card p-4 flex flex-col gap-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm">{dataset.label}</span>
                        <Badge variant="outline" className={`text-xs ${CATEGORY_COLOR[dataset.category]}`}>
                          {CATEGORY_LABEL[dataset.category]}
                        </Badge>
                        {dataset.masterOnly && (
                          <Badge variant="outline" className="text-xs bg-yellow-500/10 text-yellow-400 border-yellow-500/30">
                            Master Admin
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                        {dataset.description}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-2 text-xs"
                      disabled={downloading === dataset.id}
                      onClick={() => download(dataset)}
                    >
                      {downloading === dataset.id ? (
                        <RefreshCw className="w-3 h-3 animate-spin" />
                      ) : (
                        <Download className="w-3 h-3" />
                      )}
                      {downloading === dataset.id ? "Downloading…" : "Download CSV"}
                    </Button>
                    <span className="text-xs text-muted-foreground">
                      {from || to
                        ? `${from || "beginning"} → ${to || "now"}`
                        : "All time"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

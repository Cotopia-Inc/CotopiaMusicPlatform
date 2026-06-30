import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Star, Inbox, User, ThumbsUp, ThumbsDown } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface ExperienceFeedbackItem {
  id: number;
  userId: number | null;
  username: string | null;
  rating: number;
  whatWorkedWell: string | null;
  whatWasConfusing: string | null;
  didAnythingBreak: string | null;
  wouldRecommend: boolean | null;
  trigger: string;
  createdAt: string;
}

const authHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem("cotopia_token")}`,
  "Content-Type": "application/json",
});

const TRIGGER_LABEL: Record<string, string> = {
  after_upload: "After Upload",
  after_submit: "After Submit",
  first_visit:  "First Visit",
  manual:       "Manual",
  general:      "General",
};

const RATING_COLORS = ["", "text-red-400", "text-orange-400", "text-amber-400", "text-lime-400", "text-green-400"];

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(s => (
        <Star
          key={s}
          className={`w-4 h-4 ${s <= rating ? `fill-current ${RATING_COLORS[rating]}` : "text-muted-foreground/20"}`}
        />
      ))}
    </div>
  );
}

export default function AdminExperienceFeedback() {
  const [triggerFilter, setTriggerFilter] = useState("all");

  const { data, isLoading } = useQuery<{ items: ExperienceFeedbackItem[]; total: number }>({
    queryKey: ["admin-experience-feedback", triggerFilter],
    queryFn: async () => {
      const params = new URLSearchParams({ trigger: triggerFilter });
      const res = await fetch(`${import.meta.env.BASE_URL}api/admin/beta-feedback/experience-feedback?${params}`, {
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error("Failed to load");
      return res.json();
    },
  });

  const items = data?.items ?? [];

  // Aggregate stats
  const avgRating = items.length > 0
    ? (items.reduce((acc, i) => acc + i.rating, 0) / items.length).toFixed(1)
    : null;
  const recommendYes = items.filter(i => i.wouldRecommend === true).length;
  const recommendNo = items.filter(i => i.wouldRecommend === false).length;

  return (
    <div className="space-y-8 pb-24">
      <div>
        <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Admin · Beta Feedback</p>
        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-2 flex items-center gap-2">
          <Star className="w-7 h-7 text-amber-400" />
          Experience Feedback
        </h1>
        <p className="text-muted-foreground">Ratings and qualitative feedback from users about their Cotopia experience.</p>
      </div>

      {/* Stats */}
      {!isLoading && items.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-card border border-border rounded-xl p-4 text-center">
            <p className="text-3xl font-extrabold text-amber-400">{avgRating}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Avg Rating (of 5)</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4 text-center">
            <p className="text-3xl font-extrabold text-green-400">{recommendYes}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Would Recommend</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4 text-center">
            <p className="text-3xl font-extrabold">{items.length}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Total Responses</p>
          </div>
        </div>
      )}

      {/* Filter */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Trigger</label>
          <Select value={triggerFilter} onValueChange={setTriggerFilter}>
            <SelectTrigger className="w-48 bg-secondary/50 border-secondary">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Triggers</SelectItem>
              {Object.entries(TRIGGER_LABEL).map(([v, l]) => (
                <SelectItem key={v} value={v}>{l}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {data && (
          <p className="text-sm text-muted-foreground self-end pb-0.5">{data.total} response{data.total !== 1 ? "s" : ""}</p>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">{Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-40 w-full rounded-xl" />)}</div>
      ) : items.length === 0 ? (
        <div className="bg-card border border-border rounded-xl py-16 text-center text-muted-foreground">
          <Inbox className="w-10 h-10 mx-auto mb-2 text-muted-foreground/20" />
          <p>No feedback responses yet.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {items.map(item => (
            <div key={item.id} className="bg-card border border-border rounded-xl p-5 space-y-3">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-3">
                    <StarRating rating={item.rating} />
                    <Badge className="bg-secondary text-muted-foreground border-border border text-[10px] uppercase">
                      {TRIGGER_LABEL[item.trigger] ?? item.trigger}
                    </Badge>
                    {item.wouldRecommend !== null && (
                      <span className={`flex items-center gap-1 text-xs font-semibold ${item.wouldRecommend ? "text-green-400" : "text-red-400"}`}>
                        {item.wouldRecommend ? <ThumbsUp className="w-3.5 h-3.5" /> : <ThumbsDown className="w-3.5 h-3.5" />}
                        {item.wouldRecommend ? "Recommends" : "Not yet"}
                      </span>
                    )}
                  </div>
                </div>
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
                </span>
              </div>

              <div className="grid gap-2">
                {item.whatWorkedWell && (
                  <div className="bg-green-500/5 border border-green-500/15 rounded-lg px-3 py-2">
                    <p className="text-xs font-semibold text-green-400 mb-0.5">What worked well</p>
                    <p className="text-sm text-muted-foreground">{item.whatWorkedWell}</p>
                  </div>
                )}
                {item.whatWasConfusing && (
                  <div className="bg-amber-500/5 border border-amber-500/15 rounded-lg px-3 py-2">
                    <p className="text-xs font-semibold text-amber-400 mb-0.5">What was confusing</p>
                    <p className="text-sm text-muted-foreground">{item.whatWasConfusing}</p>
                  </div>
                )}
                {item.didAnythingBreak && (
                  <div className="bg-red-500/5 border border-red-500/15 rounded-lg px-3 py-2">
                    <p className="text-xs font-semibold text-red-400 mb-0.5">Something broke</p>
                    <p className="text-sm text-muted-foreground">{item.didAnythingBreak}</p>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <div className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center flex-shrink-0">
                  <User className="w-3 h-3" />
                </div>
                {item.username ? (
                  <span className="font-semibold text-foreground">@{item.username}</span>
                ) : (
                  <span className="italic text-muted-foreground/50">Anonymous</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

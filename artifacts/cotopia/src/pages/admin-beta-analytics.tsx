import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  MessageSquare, Bug, Lightbulb, MessageCircle, Users, Upload,
  Send, ListMusic, Music2,
} from "lucide-react";

const authHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem("cotopia_token")}`,
  "Content-Type": "application/json",
});

interface SongCompletionRate {
  songId: number;
  title: string;
  artistName: string;
  plays: number;
  completions: number;
  rate: number;
}

interface BetaAnalytics {
  feedbackTotal: number;
  bugReports: number;
  featureRequests: number;
  generalFeedback: number;
  userRetention: { totalUsers: number; retainedUsers: number; rate: number };
  uploadCompletion: { submissionsTotal: number; submissionsApproved: number; rate: number };
  chatParticipation: { messages: number; participants: number };
  privateMessages: { total: number; senders: number };
  playlistsCreated: number;
  playlistFollows: number;
  songCompletionRates: SongCompletionRate[];
}

function fmt(n: number | undefined) {
  return (n ?? 0).toLocaleString();
}

function pct(rate: number | undefined) {
  return Math.min(100, Math.round(((rate ?? 0) * (rate && rate <= 1 ? 100 : 1))));
}

function rateColor(rate: number) {
  if (rate >= 75) return "text-emerald-400";
  if (rate >= 50) return "text-yellow-400";
  if (rate >= 25) return "text-orange-400";
  return "text-red-400";
}

function rateBarColor(rate: number) {
  if (rate >= 75) return "bg-emerald-500";
  if (rate >= 50) return "bg-yellow-500";
  if (rate >= 25) return "bg-orange-500";
  return "bg-red-500";
}

export default function AdminBetaAnalytics() {
  const { data, isLoading } = useQuery<BetaAnalytics>({
    queryKey: ["beta-analytics"],
    queryFn: async () => {
      const res = await fetch(`${import.meta.env.BASE_URL}api/admin/beta-analytics`, { headers: authHeaders() });
      if (!res.ok) throw new Error("Failed to load beta analytics");
      return res.json();
    },
  });

  const retentionPct = pct(data?.userRetention?.rate);
  const uploadPct = pct(data?.uploadCompletion?.rate);

  return (
    <div className="space-y-8 pb-24">
      <div>
        <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Admin</p>
        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-2">Beta Analytics</h1>
        <p className="text-muted-foreground">
          Engagement, retention, and feedback metrics from the Cotopia beta program.
        </p>
      </div>

      {isLoading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array(6).fill(0).map((_, i) => <Skeleton key={i} className="h-40 w-full rounded-xl" />)}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Feedback */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground font-medium">
                <MessageSquare className="w-4 h-4 text-primary" /> Feedback
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-4xl font-extrabold">{fmt(data?.feedbackTotal)}</p>
              <div className="space-y-1.5 text-sm">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-muted-foreground"><Bug className="w-3.5 h-3.5" /> Bug reports</span>
                  <span className="font-semibold">{fmt(data?.bugReports)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-muted-foreground"><Lightbulb className="w-3.5 h-3.5" /> Feature requests</span>
                  <span className="font-semibold">{fmt(data?.featureRequests)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-muted-foreground"><MessageCircle className="w-3.5 h-3.5" /> General</span>
                  <span className="font-semibold">{fmt(data?.generalFeedback)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* User Retention */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground font-medium">
                <Users className="w-4 h-4 text-primary" /> User Retention
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-4xl font-extrabold">{retentionPct}%</p>
              <p className="text-sm text-muted-foreground">
                {fmt(data?.userRetention?.retainedUsers)} of {fmt(data?.userRetention?.totalUsers)} users retained
              </p>
              <Progress value={retentionPct} />
            </CardContent>
          </Card>

          {/* Upload Completion */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground font-medium">
                <Upload className="w-4 h-4 text-primary" /> Upload Completion
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-4xl font-extrabold">{uploadPct}%</p>
              <p className="text-sm text-muted-foreground">
                {fmt(data?.uploadCompletion?.submissionsApproved)} of {fmt(data?.uploadCompletion?.submissionsTotal)} submissions approved
              </p>
              <Progress value={uploadPct} />
            </CardContent>
          </Card>

          {/* Community Chat */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground font-medium">
                <MessageCircle className="w-4 h-4 text-primary" /> Community Chat
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-4xl font-extrabold">{fmt(data?.chatParticipation?.messages)}</p>
              <p className="text-sm text-muted-foreground">messages</p>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Participants</span>
                <span className="font-semibold">{fmt(data?.chatParticipation?.participants)}</span>
              </div>
            </CardContent>
          </Card>

          {/* Private Messages */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground font-medium">
                <Send className="w-4 h-4 text-primary" /> Private Messages
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-4xl font-extrabold">{fmt(data?.privateMessages?.total)}</p>
              <p className="text-sm text-muted-foreground">messages sent</p>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Senders</span>
                <span className="font-semibold">{fmt(data?.privateMessages?.senders)}</span>
              </div>
            </CardContent>
          </Card>

          {/* Playlists */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground font-medium">
                <ListMusic className="w-4 h-4 text-primary" /> Playlists
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-4xl font-extrabold">{fmt(data?.playlistsCreated)}</p>
              <p className="text-sm text-muted-foreground">playlists created</p>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Follows</span>
                <span className="font-semibold">{fmt(data?.playlistFollows)}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Per-song completion rates */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Music2 className="w-5 h-5 text-primary" />
          <h2 className="text-xl font-bold tracking-tight">Song Completion Rates</h2>
          <span className="text-xs text-muted-foreground ml-1">ranked by completion %</span>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {Array(8).fill(0).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}
          </div>
        ) : !data?.songCompletionRates?.length ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground text-sm">
              No play data yet — completion rates will appear once creators start playing songs.
            </CardContent>
          </Card>
        ) : (
          <Card>
            <div className="divide-y divide-border">
              {/* Header */}
              <div className="grid grid-cols-[2fr_1fr_1fr_1fr_2fr] gap-4 px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                <span>Song</span>
                <span className="text-right">Plays</span>
                <span className="text-right">Completions</span>
                <span className="text-right">Rate</span>
                <span className="pl-2">Progress</span>
              </div>

              {data.songCompletionRates.map((song, i) => (
                <div
                  key={song.songId}
                  className="grid grid-cols-[2fr_1fr_1fr_1fr_2fr] gap-4 items-center px-5 py-3 hover:bg-secondary/30 transition-colors"
                >
                  {/* Song + artist */}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground/50 tabular-nums w-5 shrink-0">{i + 1}</span>
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{song.title}</p>
                        <p className="text-xs text-muted-foreground truncate">{song.artistName}</p>
                      </div>
                    </div>
                  </div>

                  {/* Plays */}
                  <p className="text-sm tabular-nums text-right text-muted-foreground">{fmt(song.plays)}</p>

                  {/* Completions */}
                  <p className="text-sm tabular-nums text-right text-muted-foreground">{fmt(song.completions)}</p>

                  {/* Rate */}
                  <p className={`text-sm tabular-nums font-bold text-right ${rateColor(song.rate)}`}>
                    {song.rate}%
                  </p>

                  {/* Progress bar */}
                  <div className="pl-2">
                    <div className="h-2 w-full rounded-full bg-secondary overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${rateBarColor(song.rate)}`}
                        style={{ width: `${song.rate}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  MessageSquare, Bug, Lightbulb, MessageCircle, Users, Upload,
  Send, ListMusic,
} from "lucide-react";

const authHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem("cotopia_token")}`,
  "Content-Type": "application/json",
});

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
}

function fmt(n: number | undefined) {
  return (n ?? 0).toLocaleString();
}

function pct(rate: number | undefined) {
  return Math.round(((rate ?? 0) * (rate && rate <= 1 ? 100 : 1)));
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
        <h1 className="text-4xl font-extrabold tracking-tight mb-2">Beta Analytics</h1>
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
    </div>
  );
}

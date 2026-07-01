import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/lib/auth";
import { PlayerProvider } from "@/lib/player";
import NotFound from "@/pages/not-found";
import { Layout } from "@/components/layout";
import { useEffect } from "react";

import Home from "@/pages/home";
import Login from "@/pages/login";
import Register from "@/pages/register";
import ForgotPassword from "@/pages/forgot-password";
import ResetPassword from "@/pages/reset-password";
import Discover from "@/pages/discover";
import Songs from "@/pages/songs";
import SongDetail from "@/pages/song-detail";
import Videos from "@/pages/videos";
import VideoDetail from "@/pages/video-detail";
import Artists from "@/pages/artists";
import ArtistDetail from "@/pages/artist-detail";
import Labels from "@/pages/labels";
import LabelDetail from "@/pages/label-detail";
import Library from "@/pages/library";
import PlaylistDetail from "@/pages/playlist-detail";
import CompanyHub from "@/pages/company";
import Submit from "@/pages/submit";
import Submissions from "@/pages/submissions";
import CreatorDashboard from "@/pages/creator-dashboard";
import Profile from "@/pages/profile";
import Messages from "@/pages/messages";

import AdminDashboard from "@/pages/admin-dashboard";
import AdminUsers from "@/pages/admin-users";
import AdminSubmissions from "@/pages/admin-submissions";
import AdminPayments from "@/pages/admin-payments";
import AdminSettings from "@/pages/admin-settings";
import AdminSongs from "@/pages/admin-songs";
import AdminVideos from "@/pages/admin-videos";
import AdminCompany from "@/pages/admin-company";
import UserProfile from "@/pages/user-profile";
import AdminComments from "@/pages/admin-comments";
import AdminMessages from "@/pages/admin-messages";
import AdminAnalytics from "@/pages/admin-analytics";
import AdminRoles from "@/pages/admin-roles";
import AdminUploadSong from "@/pages/admin-upload-song";
import AdminUploadVideo from "@/pages/admin-upload-video";
import AdminListeners from "@/pages/admin-listeners";
import AdminDmca from "@/pages/admin-dmca";
import AdminDmcaDetail from "@/pages/admin-dmca-detail";
import AdminAuditLogs from "@/pages/admin-audit-logs";
import AdminLegal from "@/pages/admin-legal";
import AdminStrikes from "@/pages/admin-strikes";
import AdminReports from "@/pages/admin-reports";
import AdminEnforcement from "@/pages/admin-enforcement";
import Feedback from "@/pages/feedback";
import AdminFeedback from "@/pages/admin-feedback";
import SuggestFeature from "@/pages/suggest-feature";
import ReportBug from "@/pages/report-bug";
import AdminFeatureSuggestions from "@/pages/admin-feature-suggestions";
import AdminExperienceFeedback from "@/pages/admin-experience-feedback";
import AdminBugReports from "@/pages/admin-bug-reports";
import AdminMembers from "@/pages/admin-members";
import AdminBetaAnalytics from "@/pages/admin-beta-analytics";
import AdminBadges from "@/pages/admin-badges";
import EditorDashboard from "@/pages/editor-dashboard";
import EditorPlaylists from "@/pages/editor-playlists";
import EditorPicks from "@/pages/editor-picks";
import ModeratorDashboard from "@/pages/moderator-dashboard";
import ModeratorCopyrightConcerns from "@/pages/moderator-copyright-concerns";
import AdminCopyrightConcerns from "@/pages/admin-copyright-concerns";
import AdminBroadcast from "@/pages/admin-broadcast";
import ArtistAnalytics from "@/pages/artist-analytics";
import LabelAnalytics from "@/pages/label-analytics";
import LabelDashboard from "@/pages/label-dashboard";
import Contact from "@/pages/contact";
import About from "@/pages/about";
import AdminDiscover from "@/pages/admin-discover";

import LegalCenter from "@/pages/legal/index";
import LegalTerms from "@/pages/legal/terms";
import LegalPrivacy from "@/pages/legal/privacy";
import LegalDmca from "@/pages/legal/dmca";
import LegalCommunityGuidelines from "@/pages/legal/community-guidelines";
import LegalAiPolicy from "@/pages/legal/ai-policy";
import LegalRefundPolicy from "@/pages/legal/refund-policy";
import LegalSubmissionAgreement from "@/pages/legal/submission-agreement";
import LegalContentLicense from "@/pages/legal/content-license";
import LegalCopyrightComplaint from "@/pages/legal/copyright-complaint";

import NotificationsPage from "@/pages/notifications";
import EmbedSong from "@/pages/embed-song";
import EmbedVideo from "@/pages/embed-video";
import EmbedPlaylist from "@/pages/embed-playlist";
import VerifyEmail from "@/pages/verify-email";
import Onboarding from "@/pages/onboarding";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const [location, navigate] = useLocation();

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      navigate("/login");
      return;
    }
    const demographicsCompleted = (user as any).demographicsCompleted;
    if (demographicsCompleted === false && location !== "/onboarding") {
      navigate("/onboarding");
    }
  }, [user, isLoading, navigate, location]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!user) return null;
  if ((user as any).demographicsCompleted === false) return null;
  return <>{children}</>;
}

const ADMIN_ROLES = ["admin", "master_admin"];
const MASTER_ROLES = ["master_admin"];
const MOD_ROLES = ["moderator", "admin", "master_admin"];
const EDITOR_ROLES = ["editor", "admin", "master_admin"];
const ARTIST_ROLES = ["artist", "admin", "master_admin"];
const LABEL_ROLES = ["label", "admin", "master_admin"];

function RoleRoute({ roles, children }: { roles: string[]; children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const [location, navigate] = useLocation();

  useEffect(() => {
    if (isLoading) return;
    if (!user) { navigate("/login"); return; }
    const demographicsCompleted = (user as any).demographicsCompleted;
    if (demographicsCompleted === false && location !== "/onboarding") { navigate("/onboarding"); return; }
    if (!roles.includes(user.role)) { navigate("/"); }
  }, [user, isLoading, navigate, location, roles]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!user) return null;
  if ((user as any).demographicsCompleted === false) return null;
  if (!roles.includes(user.role)) return null;
  return <Layout>{children}</Layout>;
}

function AuthRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!isLoading && user) {
      navigate("/");
    }
  }, [user, isLoading, navigate]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (user) return null;
  return <>{children}</>;
}

function Router() {
  return (
    <Switch>
      <Route path="/forgot-password">
        <ForgotPassword />
      </Route>
      <Route path="/reset-password">
        <ResetPassword />
      </Route>
      <Route path="/login">
        <AuthRoute><Login /></AuthRoute>
      </Route>
      <Route path="/register">
        <AuthRoute><Register /></AuthRoute>
      </Route>

      {/* Email verification + onboarding (auth required, no layout) */}
      <Route path="/verify-email">
        <VerifyEmail />
      </Route>
      <Route path="/onboarding">
        <Onboarding />
      </Route>

      {/* Embed routes (no auth needed) */}
      <Route path="/embed/song/:id" component={EmbedSong} />
      <Route path="/embed/video/:id" component={EmbedVideo} />
      <Route path="/embed/playlist/:id" component={EmbedPlaylist} />

      {/* Main app routes — all protected */}
      <Route path="/">
        <ProtectedRoute><Layout><Home /></Layout></ProtectedRoute>
      </Route>
      <Route path="/discover">
        <ProtectedRoute><Layout><Discover /></Layout></ProtectedRoute>
      </Route>
      <Route path="/songs">
        <ProtectedRoute><Layout><Songs /></Layout></ProtectedRoute>
      </Route>
      <Route path="/songs/:id">
        <ProtectedRoute><Layout><SongDetail /></Layout></ProtectedRoute>
      </Route>
      <Route path="/videos">
        <ProtectedRoute><Layout><Videos /></Layout></ProtectedRoute>
      </Route>
      <Route path="/videos/:id">
        <ProtectedRoute><Layout><VideoDetail /></Layout></ProtectedRoute>
      </Route>
      <Route path="/artists">
        <ProtectedRoute><Layout><Artists /></Layout></ProtectedRoute>
      </Route>
      <Route path="/artists/:id">
        <ProtectedRoute><Layout><ArtistDetail /></Layout></ProtectedRoute>
      </Route>
      <Route path="/labels">
        <ProtectedRoute><Layout><Labels /></Layout></ProtectedRoute>
      </Route>
      <Route path="/labels/:id">
        <ProtectedRoute><Layout><LabelDetail /></Layout></ProtectedRoute>
      </Route>
      <Route path="/library">
        <ProtectedRoute><Layout><Library /></Layout></ProtectedRoute>
      </Route>
      <Route path="/playlists/:id">
        <ProtectedRoute><Layout><PlaylistDetail /></Layout></ProtectedRoute>
      </Route>
      <Route path="/company">
        <ProtectedRoute><Layout><CompanyHub /></Layout></ProtectedRoute>
      </Route>
      <Route path="/submit">
        <ProtectedRoute><Layout><Submit /></Layout></ProtectedRoute>
      </Route>
      <Route path="/submissions">
        <ProtectedRoute><Layout><Submissions /></Layout></ProtectedRoute>
      </Route>
      <Route path="/creator-dashboard">
        <ProtectedRoute><Layout><CreatorDashboard /></Layout></ProtectedRoute>
      </Route>
      <Route path="/users/:id">
        <ProtectedRoute><Layout><UserProfile /></Layout></ProtectedRoute>
      </Route>
      <Route path="/profile">
        <ProtectedRoute><Layout><Profile /></Layout></ProtectedRoute>
      </Route>
      <Route path="/notifications">
        <ProtectedRoute><Layout><NotificationsPage /></Layout></ProtectedRoute>
      </Route>
      <Route path="/messages">
        <ProtectedRoute><Layout><Messages /></Layout></ProtectedRoute>
      </Route>
      <Route path="/feedback">
        <ProtectedRoute><Layout><Feedback /></Layout></ProtectedRoute>
      </Route>
      <Route path="/suggest-feature">
        <Layout><SuggestFeature /></Layout>
      </Route>
      <Route path="/report-bug">
        <Layout><ReportBug /></Layout>
      </Route>

      {/* About / Our Promise — public */}
      <Route path="/about" component={About} />

      {/* Legal Center — public routes */}
      <Route path="/legal" component={LegalCenter} />
      <Route path="/legal/terms" component={LegalTerms} />
      <Route path="/legal/privacy" component={LegalPrivacy} />
      <Route path="/legal/dmca" component={LegalDmca} />
      <Route path="/legal/community-guidelines" component={LegalCommunityGuidelines} />
      <Route path="/legal/ai-policy" component={LegalAiPolicy} />
      <Route path="/legal/refund-policy" component={LegalRefundPolicy} />
      <Route path="/legal/submission-agreement" component={LegalSubmissionAgreement} />
      <Route path="/legal/content-license" component={LegalContentLicense} />
      <Route path="/legal/copyright-complaint" component={LegalCopyrightComplaint} />

      {/* Admin routes — admin + master_admin only */}
      <Route path="/admin">
        <RoleRoute roles={ADMIN_ROLES}><AdminDashboard /></RoleRoute>
      </Route>
      <Route path="/admin/analytics">
        <RoleRoute roles={ADMIN_ROLES}><AdminAnalytics /></RoleRoute>
      </Route>
      <Route path="/admin/users">
        <RoleRoute roles={ADMIN_ROLES}><AdminUsers /></RoleRoute>
      </Route>
      <Route path="/admin/roles">
        <RoleRoute roles={ADMIN_ROLES}><AdminRoles /></RoleRoute>
      </Route>
      <Route path="/admin/listeners">
        <RoleRoute roles={ADMIN_ROLES}><AdminListeners /></RoleRoute>
      </Route>
      <Route path="/admin/upload-song">
        <RoleRoute roles={ADMIN_ROLES}><AdminUploadSong /></RoleRoute>
      </Route>
      <Route path="/admin/upload-video">
        <RoleRoute roles={ADMIN_ROLES}><AdminUploadVideo /></RoleRoute>
      </Route>
      <Route path="/admin/submissions">
        <RoleRoute roles={ADMIN_ROLES}><AdminSubmissions /></RoleRoute>
      </Route>
      <Route path="/admin/payments">
        <RoleRoute roles={ADMIN_ROLES}><AdminPayments /></RoleRoute>
      </Route>
      <Route path="/admin/songs">
        <RoleRoute roles={ADMIN_ROLES}><AdminSongs /></RoleRoute>
      </Route>
      <Route path="/admin/videos">
        <RoleRoute roles={ADMIN_ROLES}><AdminVideos /></RoleRoute>
      </Route>
      <Route path="/admin/company">
        <RoleRoute roles={ADMIN_ROLES}><AdminCompany /></RoleRoute>
      </Route>
      <Route path="/admin/comments">
        <RoleRoute roles={ADMIN_ROLES}><AdminComments /></RoleRoute>
      </Route>
      <Route path="/admin/messages">
        <RoleRoute roles={ADMIN_ROLES}><AdminMessages /></RoleRoute>
      </Route>
      <Route path="/admin/broadcast">
        <RoleRoute roles={ADMIN_ROLES}><AdminBroadcast /></RoleRoute>
      </Route>
      <Route path="/admin/settings">
        <RoleRoute roles={ADMIN_ROLES}><AdminSettings /></RoleRoute>
      </Route>
      <Route path="/admin/dmca/:id">
        <RoleRoute roles={ADMIN_ROLES}><AdminDmcaDetail /></RoleRoute>
      </Route>
      <Route path="/admin/dmca">
        <RoleRoute roles={ADMIN_ROLES}><AdminDmca /></RoleRoute>
      </Route>
      <Route path="/admin/audit-logs">
        <RoleRoute roles={MASTER_ROLES}><AdminAuditLogs /></RoleRoute>
      </Route>
      <Route path="/admin/legal">
        <RoleRoute roles={MASTER_ROLES}><AdminLegal /></RoleRoute>
      </Route>
      <Route path="/admin/strikes">
        <RoleRoute roles={ADMIN_ROLES}><AdminStrikes /></RoleRoute>
      </Route>
      <Route path="/admin/reports">
        <RoleRoute roles={MOD_ROLES}><AdminReports /></RoleRoute>
      </Route>
      <Route path="/admin/enforcement">
        <RoleRoute roles={MOD_ROLES}><AdminEnforcement /></RoleRoute>
      </Route>
      <Route path="/admin/members">
        <RoleRoute roles={MOD_ROLES}><AdminMembers /></RoleRoute>
      </Route>
      <Route path="/admin/feedback">
        <RoleRoute roles={ADMIN_ROLES}><AdminFeedback /></RoleRoute>
      </Route>
      <Route path="/admin/beta-analytics">
        <RoleRoute roles={ADMIN_ROLES}><AdminBetaAnalytics /></RoleRoute>
      </Route>
      <Route path="/admin/feature-suggestions">
        <RoleRoute roles={[...EDITOR_ROLES, "moderator"]}><AdminFeatureSuggestions /></RoleRoute>
      </Route>
      <Route path="/admin/experience-feedback">
        <RoleRoute roles={ADMIN_ROLES}><AdminExperienceFeedback /></RoleRoute>
      </Route>
      <Route path="/admin/bug-reports">
        <RoleRoute roles={MOD_ROLES}><AdminBugReports /></RoleRoute>
      </Route>
      <Route path="/admin/badges">
        <RoleRoute roles={ADMIN_ROLES}><AdminBadges /></RoleRoute>
      </Route>
      <Route path="/admin/discover">
        <RoleRoute roles={EDITOR_ROLES}><AdminDiscover /></RoleRoute>
      </Route>

      {/* Editor routes — editor + admin + master_admin */}
      <Route path="/editor">
        <RoleRoute roles={EDITOR_ROLES}><EditorDashboard /></RoleRoute>
      </Route>
      <Route path="/editor/playlists">
        <RoleRoute roles={EDITOR_ROLES}><EditorPlaylists /></RoleRoute>
      </Route>
      <Route path="/editor/picks">
        <RoleRoute roles={EDITOR_ROLES}><EditorPicks /></RoleRoute>
      </Route>

      {/* Moderator routes — moderator + admin + master_admin */}
      <Route path="/moderator">
        <RoleRoute roles={MOD_ROLES}><ModeratorDashboard /></RoleRoute>
      </Route>
      <Route path="/moderator/submissions">
        <RoleRoute roles={MOD_ROLES}><AdminSubmissions /></RoleRoute>
      </Route>
      <Route path="/moderator/comments">
        <RoleRoute roles={MOD_ROLES}><AdminComments /></RoleRoute>
      </Route>
      <Route path="/moderator/messages">
        <RoleRoute roles={MOD_ROLES}><AdminMessages /></RoleRoute>
      </Route>
      <Route path="/moderator/copyright-concerns">
        <RoleRoute roles={MOD_ROLES}><ModeratorCopyrightConcerns /></RoleRoute>
      </Route>
      <Route path="/admin/copyright-concerns">
        <RoleRoute roles={ADMIN_ROLES}><AdminCopyrightConcerns /></RoleRoute>
      </Route>

      {/* Artist + Label tools */}
      <Route path="/artist/analytics">
        <RoleRoute roles={ARTIST_ROLES}><ArtistAnalytics /></RoleRoute>
      </Route>
      <Route path="/label/dashboard">
        <RoleRoute roles={LABEL_ROLES}><LabelDashboard /></RoleRoute>
      </Route>
      <Route path="/label/analytics">
        <RoleRoute roles={LABEL_ROLES}><LabelAnalytics /></RoleRoute>
      </Route>
      <Route path="/contact">
        <Layout><Contact /></Layout>
      </Route>

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <PlayerProvider>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <Router />
            </WouterRouter>
          </PlayerProvider>
        </AuthProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;

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
import Profile from "@/pages/profile";
import Messages from "@/pages/messages";

import AdminDashboard from "@/pages/admin-dashboard";
import AdminUsers from "@/pages/admin-users";
import AdminSubmissions from "@/pages/admin-submissions";
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
import EditorDashboard from "@/pages/editor-dashboard";
import EditorPlaylists from "@/pages/editor-playlists";
import EditorPicks from "@/pages/editor-picks";
import ArtistAnalytics from "@/pages/artist-analytics";

import LegalCenter from "@/pages/legal/index";
import LegalTerms from "@/pages/legal/terms";
import LegalPrivacy from "@/pages/legal/privacy";
import LegalDmca from "@/pages/legal/dmca";
import LegalCommunityGuidelines from "@/pages/legal/community-guidelines";
import LegalAiPolicy from "@/pages/legal/ai-policy";
import LegalRefundPolicy from "@/pages/legal/refund-policy";
import LegalSubmissionAgreement from "@/pages/legal/submission-agreement";
import LegalCopyrightComplaint from "@/pages/legal/copyright-complaint";

import NotificationsPage from "@/pages/notifications";
import EmbedSong from "@/pages/embed-song";
import EmbedVideo from "@/pages/embed-video";
import EmbedPlaylist from "@/pages/embed-playlist";

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
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!isLoading && !user) {
      navigate("/login");
    }
  }, [user, isLoading, navigate]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!user) return null;
  return <>{children}</>;
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
      <Route path="/login">
        <AuthRoute><Login /></AuthRoute>
      </Route>
      <Route path="/register">
        <AuthRoute><Register /></AuthRoute>
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

      {/* Legal Center — public routes */}
      <Route path="/legal" component={LegalCenter} />
      <Route path="/legal/terms" component={LegalTerms} />
      <Route path="/legal/privacy" component={LegalPrivacy} />
      <Route path="/legal/dmca" component={LegalDmca} />
      <Route path="/legal/community-guidelines" component={LegalCommunityGuidelines} />
      <Route path="/legal/ai-policy" component={LegalAiPolicy} />
      <Route path="/legal/refund-policy" component={LegalRefundPolicy} />
      <Route path="/legal/submission-agreement" component={LegalSubmissionAgreement} />
      <Route path="/legal/copyright-complaint" component={LegalCopyrightComplaint} />

      {/* Admin routes */}
      <Route path="/admin">
        <ProtectedRoute><Layout><AdminDashboard /></Layout></ProtectedRoute>
      </Route>
      <Route path="/admin/analytics">
        <ProtectedRoute><Layout><AdminAnalytics /></Layout></ProtectedRoute>
      </Route>
      <Route path="/admin/users">
        <ProtectedRoute><Layout><AdminUsers /></Layout></ProtectedRoute>
      </Route>
      <Route path="/admin/roles">
        <ProtectedRoute><Layout><AdminRoles /></Layout></ProtectedRoute>
      </Route>
      <Route path="/admin/listeners">
        <ProtectedRoute><Layout><AdminListeners /></Layout></ProtectedRoute>
      </Route>
      <Route path="/admin/upload-song">
        <ProtectedRoute><Layout><AdminUploadSong /></Layout></ProtectedRoute>
      </Route>
      <Route path="/admin/upload-video">
        <ProtectedRoute><Layout><AdminUploadVideo /></Layout></ProtectedRoute>
      </Route>
      <Route path="/admin/submissions">
        <ProtectedRoute><Layout><AdminSubmissions /></Layout></ProtectedRoute>
      </Route>
      <Route path="/admin/songs">
        <ProtectedRoute><Layout><AdminSongs /></Layout></ProtectedRoute>
      </Route>
      <Route path="/admin/videos">
        <ProtectedRoute><Layout><AdminVideos /></Layout></ProtectedRoute>
      </Route>
      <Route path="/admin/company">
        <ProtectedRoute><Layout><AdminCompany /></Layout></ProtectedRoute>
      </Route>
      <Route path="/admin/comments">
        <ProtectedRoute><Layout><AdminComments /></Layout></ProtectedRoute>
      </Route>
      <Route path="/admin/messages">
        <ProtectedRoute><Layout><AdminMessages /></Layout></ProtectedRoute>
      </Route>
      <Route path="/admin/settings">
        <ProtectedRoute><Layout><AdminSettings /></Layout></ProtectedRoute>
      </Route>
      <Route path="/admin/dmca/:id">
        <ProtectedRoute><Layout><AdminDmcaDetail /></Layout></ProtectedRoute>
      </Route>
      <Route path="/admin/dmca">
        <ProtectedRoute><Layout><AdminDmca /></Layout></ProtectedRoute>
      </Route>
      <Route path="/admin/audit-logs">
        <ProtectedRoute><Layout><AdminAuditLogs /></Layout></ProtectedRoute>
      </Route>
      <Route path="/admin/legal">
        <ProtectedRoute><Layout><AdminLegal /></Layout></ProtectedRoute>
      </Route>

      {/* Editor routes */}
      <Route path="/editor">
        <ProtectedRoute><Layout><EditorDashboard /></Layout></ProtectedRoute>
      </Route>
      <Route path="/editor/playlists">
        <ProtectedRoute><Layout><EditorPlaylists /></Layout></ProtectedRoute>
      </Route>
      <Route path="/editor/picks">
        <ProtectedRoute><Layout><EditorPicks /></Layout></ProtectedRoute>
      </Route>

      {/* Artist routes */}
      <Route path="/artist/analytics">
        <ProtectedRoute><Layout><ArtistAnalytics /></Layout></ProtectedRoute>
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

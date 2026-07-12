import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/lib/auth";
import { PlayerProvider } from "@/lib/player";
import { Layout } from "@/components/layout";
import { lazy, Suspense, useEffect } from "react";

// ---------------------------------------------------------------------------
// Lazy page imports — each route loads its own chunk on first visit
// ---------------------------------------------------------------------------

const NotFound                  = lazy(() => import("@/pages/not-found"));
const Home                      = lazy(() => import("@/pages/home"));
const Login                     = lazy(() => import("@/pages/login"));
const Register                  = lazy(() => import("@/pages/register"));
const ForgotPassword            = lazy(() => import("@/pages/forgot-password"));
const ResetPassword             = lazy(() => import("@/pages/reset-password"));
const Discover                  = lazy(() => import("@/pages/discover"));
const Songs                     = lazy(() => import("@/pages/songs"));
const SongDetail                = lazy(() => import("@/pages/song-detail"));
const Videos                    = lazy(() => import("@/pages/videos"));
const VideoDetail               = lazy(() => import("@/pages/video-detail"));
const Artists                   = lazy(() => import("@/pages/artists"));
const ArtistDetail              = lazy(() => import("@/pages/artist-detail"));
const Labels                    = lazy(() => import("@/pages/labels"));
const LabelDetail               = lazy(() => import("@/pages/label-detail"));
const Library                   = lazy(() => import("@/pages/library"));
const PlaylistDetail            = lazy(() => import("@/pages/playlist-detail"));
const CompanyHub                = lazy(() => import("@/pages/company"));
const Submit                    = lazy(() => import("@/pages/submit"));
const Submissions               = lazy(() => import("@/pages/submissions"));
const CreatorDashboard          = lazy(() => import("@/pages/creator-dashboard"));
const Profile                   = lazy(() => import("@/pages/profile"));
const Messages                  = lazy(() => import("@/pages/messages"));
const UserProfile               = lazy(() => import("@/pages/user-profile"));
const NotificationsPage         = lazy(() => import("@/pages/notifications"));
const Feedback                  = lazy(() => import("@/pages/feedback"));
const SuggestFeature            = lazy(() => import("@/pages/suggest-feature"));
const ReportBug                 = lazy(() => import("@/pages/report-bug"));
const About                     = lazy(() => import("@/pages/about"));
const Contact                   = lazy(() => import("@/pages/contact"));
const VerifyEmail               = lazy(() => import("@/pages/verify-email"));
const Onboarding                = lazy(() => import("@/pages/onboarding"));

const EmbedSong                 = lazy(() => import("@/pages/embed-song"));
const EmbedVideo                = lazy(() => import("@/pages/embed-video"));
const EmbedPlaylist             = lazy(() => import("@/pages/embed-playlist"));

const LegalCenter               = lazy(() => import("@/pages/legal/index"));
const LegalTerms                = lazy(() => import("@/pages/legal/terms"));
const LegalPrivacy              = lazy(() => import("@/pages/legal/privacy"));
const LegalDmca                 = lazy(() => import("@/pages/legal/dmca"));
const LegalCommunityGuidelines  = lazy(() => import("@/pages/legal/community-guidelines"));
const LegalAiPolicy             = lazy(() => import("@/pages/legal/ai-policy"));
const LegalRefundPolicy         = lazy(() => import("@/pages/legal/refund-policy"));
const LegalSubmissionAgreement  = lazy(() => import("@/pages/legal/submission-agreement"));
const LegalContentLicense       = lazy(() => import("@/pages/legal/content-license"));
const LegalCopyrightComplaint   = lazy(() => import("@/pages/legal/copyright-complaint"));

const AdminDashboard            = lazy(() => import("@/pages/admin-dashboard"));
const AdminUsers                = lazy(() => import("@/pages/admin-users"));
const AdminSubmissions          = lazy(() => import("@/pages/admin-submissions"));
const AdminPayments             = lazy(() => import("@/pages/admin-payments"));
const AdminSettings             = lazy(() => import("@/pages/admin-settings"));
const AdminSongs                = lazy(() => import("@/pages/admin-songs"));
const AdminVideos               = lazy(() => import("@/pages/admin-videos"));
const AdminCompany              = lazy(() => import("@/pages/admin-company"));
const AdminComments             = lazy(() => import("@/pages/admin-comments"));
const AdminMessages             = lazy(() => import("@/pages/admin-messages"));
const AdminAnalytics            = lazy(() => import("@/pages/admin-analytics"));
const AdminRoles                = lazy(() => import("@/pages/admin-roles"));
const AdminUploadSong           = lazy(() => import("@/pages/admin-upload-song"));
const AdminUploadVideo          = lazy(() => import("@/pages/admin-upload-video"));
const AdminListeners            = lazy(() => import("@/pages/admin-listeners"));
const AdminDmca                 = lazy(() => import("@/pages/admin-dmca"));
const AdminDmcaDetail           = lazy(() => import("@/pages/admin-dmca-detail"));
const AdminAuditLogs            = lazy(() => import("@/pages/admin-audit-logs"));
const AdminLegal                = lazy(() => import("@/pages/admin-legal"));
const AdminStrikes              = lazy(() => import("@/pages/admin-strikes"));
const AdminReports              = lazy(() => import("@/pages/admin-reports"));
const AdminEnforcement          = lazy(() => import("@/pages/admin-enforcement"));
const AdminFeedback             = lazy(() => import("@/pages/admin-feedback"));
const AdminBetaAnalytics        = lazy(() => import("@/pages/admin-beta-analytics"));
const AdminFeatureSuggestions   = lazy(() => import("@/pages/admin-feature-suggestions"));
const AdminExperienceFeedback   = lazy(() => import("@/pages/admin-experience-feedback"));
const AdminBugReports           = lazy(() => import("@/pages/admin-bug-reports"));
const AdminMembers              = lazy(() => import("@/pages/admin-members"));
const AdminBadges               = lazy(() => import("@/pages/admin-badges"));
const AdminCreatorSupport       = lazy(() => import("@/pages/admin-creator-support"));
const AdminBroadcast            = lazy(() => import("@/pages/admin-broadcast"));
const AdminDiscover             = lazy(() => import("@/pages/admin-discover"));
const AdminCopyrightConcerns    = lazy(() => import("@/pages/admin-copyright-concerns"));

const EditorDashboard           = lazy(() => import("@/pages/editor-dashboard"));
const EditorPlaylists           = lazy(() => import("@/pages/editor-playlists"));
const EditorPicks               = lazy(() => import("@/pages/editor-picks"));

const ModeratorDashboard        = lazy(() => import("@/pages/moderator-dashboard"));
const ModeratorCopyrightConcerns = lazy(() => import("@/pages/moderator-copyright-concerns"));

const ArtistAnalytics           = lazy(() => import("@/pages/artist-analytics"));
const LabelDashboard            = lazy(() => import("@/pages/label-dashboard"));
const LabelAnalytics            = lazy(() => import("@/pages/label-analytics"));

// ---------------------------------------------------------------------------
// Shared loading fallback
// ---------------------------------------------------------------------------

function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

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

  if (isLoading) return <PageLoader />;
  if (!user) return null;
  if ((user as any).demographicsCompleted === false) return null;
  return <>{children}</>;
}

const ADMIN_ROLES  = ["admin", "master_admin"];
const MASTER_ROLES = ["master_admin"];
const MOD_ROLES    = ["moderator", "admin", "master_admin"];
const EDITOR_ROLES = ["editor", "admin", "master_admin"];
const ARTIST_ROLES = ["artist", "admin", "master_admin"];
const LABEL_ROLES  = ["label", "admin", "master_admin"];

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

  if (isLoading) return <PageLoader />;
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

  if (isLoading) return <PageLoader />;
  if (user) return null;
  return <>{children}</>;
}

function RootRoute() {
  const { user, isLoading } = useAuth();
  const [location, navigate] = useLocation();

  useEffect(() => {
    if (isLoading || !user) return;
    const demographicsCompleted = (user as any).demographicsCompleted;
    if (demographicsCompleted === false && location !== "/onboarding") {
      navigate("/onboarding");
    }
  }, [user, isLoading, navigate, location]);

  if (isLoading) return <PageLoader />;
  if (!user) return <About showAuthNav />;
  if ((user as any).demographicsCompleted === false) return null;
  return <Layout><Home /></Layout>;
}

function Router() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Switch>
        <Route path="/forgot-password"><ForgotPassword /></Route>
        <Route path="/reset-password"><ResetPassword /></Route>
        <Route path="/login"><AuthRoute><Login /></AuthRoute></Route>
        <Route path="/register"><AuthRoute><Register /></AuthRoute></Route>

        <Route path="/verify-email"><VerifyEmail /></Route>
        <Route path="/onboarding"><Onboarding /></Route>

        <Route path="/embed/song/:id" component={EmbedSong} />
        <Route path="/embed/video/:id" component={EmbedVideo} />
        <Route path="/embed/playlist/:id" component={EmbedPlaylist} />

        <Route path="/"><RootRoute /></Route>
        <Route path="/discover"><ProtectedRoute><Layout><Discover /></Layout></ProtectedRoute></Route>
        <Route path="/songs"><ProtectedRoute><Layout><Songs /></Layout></ProtectedRoute></Route>
        <Route path="/songs/:id"><ProtectedRoute><Layout><SongDetail /></Layout></ProtectedRoute></Route>
        <Route path="/videos"><ProtectedRoute><Layout><Videos /></Layout></ProtectedRoute></Route>
        <Route path="/videos/:id"><ProtectedRoute><Layout><VideoDetail /></Layout></ProtectedRoute></Route>
        <Route path="/artists"><ProtectedRoute><Layout><Artists /></Layout></ProtectedRoute></Route>
        <Route path="/artists/:id"><ProtectedRoute><Layout><ArtistDetail /></Layout></ProtectedRoute></Route>
        <Route path="/labels"><ProtectedRoute><Layout><Labels /></Layout></ProtectedRoute></Route>
        <Route path="/labels/:id"><ProtectedRoute><Layout><LabelDetail /></Layout></ProtectedRoute></Route>
        <Route path="/library"><ProtectedRoute><Layout><Library /></Layout></ProtectedRoute></Route>
        <Route path="/playlists/:id"><ProtectedRoute><Layout><PlaylistDetail /></Layout></ProtectedRoute></Route>
        <Route path="/company"><ProtectedRoute><Layout><CompanyHub /></Layout></ProtectedRoute></Route>
        <Route path="/submit"><ProtectedRoute><Layout><Submit /></Layout></ProtectedRoute></Route>
        <Route path="/submissions"><ProtectedRoute><Layout><Submissions /></Layout></ProtectedRoute></Route>
        <Route path="/creator-dashboard"><ProtectedRoute><Layout><CreatorDashboard /></Layout></ProtectedRoute></Route>
        <Route path="/users/:id"><ProtectedRoute><Layout><UserProfile /></Layout></ProtectedRoute></Route>
        <Route path="/profile"><ProtectedRoute><Layout><Profile /></Layout></ProtectedRoute></Route>
        <Route path="/notifications"><ProtectedRoute><Layout><NotificationsPage /></Layout></ProtectedRoute></Route>
        <Route path="/messages"><ProtectedRoute><Layout><Messages /></Layout></ProtectedRoute></Route>
        <Route path="/feedback"><ProtectedRoute><Layout><Feedback /></Layout></ProtectedRoute></Route>
        <Route path="/suggest-feature"><Layout><SuggestFeature /></Layout></Route>
        <Route path="/report-bug"><Layout><ReportBug /></Layout></Route>
        <Route path="/about"><About /></Route>
        <Route path="/contact"><Layout><Contact /></Layout></Route>

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

        <Route path="/admin"><RoleRoute roles={ADMIN_ROLES}><AdminDashboard /></RoleRoute></Route>
        <Route path="/admin/analytics"><RoleRoute roles={ADMIN_ROLES}><AdminAnalytics /></RoleRoute></Route>
        <Route path="/admin/users"><RoleRoute roles={ADMIN_ROLES}><AdminUsers /></RoleRoute></Route>
        <Route path="/admin/roles"><RoleRoute roles={ADMIN_ROLES}><AdminRoles /></RoleRoute></Route>
        <Route path="/admin/listeners"><RoleRoute roles={ADMIN_ROLES}><AdminListeners /></RoleRoute></Route>
        <Route path="/admin/upload-song"><RoleRoute roles={ADMIN_ROLES}><AdminUploadSong /></RoleRoute></Route>
        <Route path="/admin/upload-video"><RoleRoute roles={ADMIN_ROLES}><AdminUploadVideo /></RoleRoute></Route>
        <Route path="/admin/submissions"><RoleRoute roles={ADMIN_ROLES}><AdminSubmissions /></RoleRoute></Route>
        <Route path="/admin/payments"><RoleRoute roles={ADMIN_ROLES}><AdminPayments /></RoleRoute></Route>
        <Route path="/admin/songs"><RoleRoute roles={ADMIN_ROLES}><AdminSongs /></RoleRoute></Route>
        <Route path="/admin/videos"><RoleRoute roles={ADMIN_ROLES}><AdminVideos /></RoleRoute></Route>
        <Route path="/admin/company"><RoleRoute roles={ADMIN_ROLES}><AdminCompany /></RoleRoute></Route>
        <Route path="/admin/comments"><RoleRoute roles={ADMIN_ROLES}><AdminComments /></RoleRoute></Route>
        <Route path="/admin/messages"><RoleRoute roles={ADMIN_ROLES}><AdminMessages /></RoleRoute></Route>
        <Route path="/admin/broadcast"><RoleRoute roles={ADMIN_ROLES}><AdminBroadcast /></RoleRoute></Route>
        <Route path="/admin/settings"><RoleRoute roles={ADMIN_ROLES}><AdminSettings /></RoleRoute></Route>
        <Route path="/admin/dmca/:id"><RoleRoute roles={ADMIN_ROLES}><AdminDmcaDetail /></RoleRoute></Route>
        <Route path="/admin/dmca"><RoleRoute roles={ADMIN_ROLES}><AdminDmca /></RoleRoute></Route>
        <Route path="/admin/audit-logs"><RoleRoute roles={MASTER_ROLES}><AdminAuditLogs /></RoleRoute></Route>
        <Route path="/admin/legal"><RoleRoute roles={MASTER_ROLES}><AdminLegal /></RoleRoute></Route>
        <Route path="/admin/strikes"><RoleRoute roles={ADMIN_ROLES}><AdminStrikes /></RoleRoute></Route>
        <Route path="/admin/reports"><RoleRoute roles={MOD_ROLES}><AdminReports /></RoleRoute></Route>
        <Route path="/admin/enforcement"><RoleRoute roles={MOD_ROLES}><AdminEnforcement /></RoleRoute></Route>
        <Route path="/admin/members"><RoleRoute roles={MOD_ROLES}><AdminMembers /></RoleRoute></Route>
        <Route path="/admin/feedback"><RoleRoute roles={ADMIN_ROLES}><AdminFeedback /></RoleRoute></Route>
        <Route path="/admin/beta-analytics"><RoleRoute roles={ADMIN_ROLES}><AdminBetaAnalytics /></RoleRoute></Route>
        <Route path="/admin/feature-suggestions"><RoleRoute roles={[...EDITOR_ROLES, "moderator"]}><AdminFeatureSuggestions /></RoleRoute></Route>
        <Route path="/admin/experience-feedback"><RoleRoute roles={ADMIN_ROLES}><AdminExperienceFeedback /></RoleRoute></Route>
        <Route path="/admin/bug-reports"><RoleRoute roles={MOD_ROLES}><AdminBugReports /></RoleRoute></Route>
        <Route path="/admin/badges"><RoleRoute roles={ADMIN_ROLES}><AdminBadges /></RoleRoute></Route>
        <Route path="/admin/creator-support"><RoleRoute roles={ADMIN_ROLES}><AdminCreatorSupport /></RoleRoute></Route>
        <Route path="/admin/discover"><RoleRoute roles={EDITOR_ROLES}><AdminDiscover /></RoleRoute></Route>
        <Route path="/admin/copyright-concerns"><RoleRoute roles={ADMIN_ROLES}><AdminCopyrightConcerns /></RoleRoute></Route>

        <Route path="/editor"><RoleRoute roles={EDITOR_ROLES}><EditorDashboard /></RoleRoute></Route>
        <Route path="/editor/playlists"><RoleRoute roles={EDITOR_ROLES}><EditorPlaylists /></RoleRoute></Route>
        <Route path="/editor/picks"><RoleRoute roles={EDITOR_ROLES}><EditorPicks /></RoleRoute></Route>

        <Route path="/moderator"><RoleRoute roles={MOD_ROLES}><ModeratorDashboard /></RoleRoute></Route>
        <Route path="/moderator/submissions"><RoleRoute roles={MOD_ROLES}><AdminSubmissions /></RoleRoute></Route>
        <Route path="/moderator/comments"><RoleRoute roles={MOD_ROLES}><AdminComments /></RoleRoute></Route>
        <Route path="/moderator/messages"><RoleRoute roles={MOD_ROLES}><AdminMessages /></RoleRoute></Route>
        <Route path="/moderator/copyright-concerns"><RoleRoute roles={MOD_ROLES}><ModeratorCopyrightConcerns /></RoleRoute></Route>

        <Route path="/artist/analytics"><RoleRoute roles={ARTIST_ROLES}><ArtistAnalytics /></RoleRoute></Route>
        <Route path="/label/dashboard"><RoleRoute roles={LABEL_ROLES}><LabelDashboard /></RoleRoute></Route>
        <Route path="/label/analytics"><RoleRoute roles={LABEL_ROLES}><LabelAnalytics /></RoleRoute></Route>

        <Route component={NotFound} />
      </Switch>
    </Suspense>
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

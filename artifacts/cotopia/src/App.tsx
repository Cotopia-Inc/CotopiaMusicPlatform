import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/lib/auth";
import NotFound from "@/pages/not-found";
import { Layout } from "@/components/layout";

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

import AdminDashboard from "@/pages/admin-dashboard";
import AdminUsers from "@/pages/admin-users";
import AdminSubmissions from "@/pages/admin-submissions";
import AdminSettings from "@/pages/admin-settings";
import AdminSongs from "@/pages/admin-songs";
import AdminVideos from "@/pages/admin-videos";
import AdminComments from "@/pages/admin-comments";

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

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />

      {/* Embed routes (no layout) */}
      <Route path="/embed/song/:id" component={EmbedSong} />
      <Route path="/embed/video/:id" component={EmbedVideo} />
      <Route path="/embed/playlist/:id" component={EmbedPlaylist} />

      {/* Main app routes */}
      <Route path="/">
        <Layout><Home /></Layout>
      </Route>
      <Route path="/discover">
        <Layout><Discover /></Layout>
      </Route>
      <Route path="/songs">
        <Layout><Songs /></Layout>
      </Route>
      <Route path="/songs/:id">
        <Layout><SongDetail /></Layout>
      </Route>
      <Route path="/videos">
        <Layout><Videos /></Layout>
      </Route>
      <Route path="/videos/:id">
        <Layout><VideoDetail /></Layout>
      </Route>
      <Route path="/artists">
        <Layout><Artists /></Layout>
      </Route>
      <Route path="/artists/:id">
        <Layout><ArtistDetail /></Layout>
      </Route>
      <Route path="/labels">
        <Layout><Labels /></Layout>
      </Route>
      <Route path="/labels/:id">
        <Layout><LabelDetail /></Layout>
      </Route>
      <Route path="/library">
        <Layout><Library /></Layout>
      </Route>
      <Route path="/playlists/:id">
        <Layout><PlaylistDetail /></Layout>
      </Route>
      <Route path="/company">
        <Layout><CompanyHub /></Layout>
      </Route>
      <Route path="/submit">
        <Layout><Submit /></Layout>
      </Route>
      <Route path="/submissions">
        <Layout><Submissions /></Layout>
      </Route>
      <Route path="/profile">
        <Layout><Profile /></Layout>
      </Route>

      {/* Admin routes */}
      <Route path="/admin">
        <Layout><AdminDashboard /></Layout>
      </Route>
      <Route path="/admin/users">
        <Layout><AdminUsers /></Layout>
      </Route>
      <Route path="/admin/submissions">
        <Layout><AdminSubmissions /></Layout>
      </Route>
      <Route path="/admin/songs">
        <Layout><AdminSongs /></Layout>
      </Route>
      <Route path="/admin/videos">
        <Layout><AdminVideos /></Layout>
      </Route>
      <Route path="/admin/comments">
        <Layout><AdminComments /></Layout>
      </Route>
      <Route path="/admin/settings">
        <Layout><AdminSettings /></Layout>
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
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
        </AuthProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;

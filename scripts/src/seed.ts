import { eq } from "drizzle-orm";
import {
  db,
  usersTable,
  artistsTable,
  labelsTable,
  albumsTable,
  songsTable,
  videosTable,
  companyPostsTable,
  appSettingsTable,
  ratingsTable,
  commentsTable,
  followsTable,
  favoritesTable,
  chatMessagesTable,
} from "@workspace/db";
import bcrypt from "bcryptjs";

async function seed() {
  console.log("🌱 Seeding database...");

  // App settings
  const [existingSettings] = await db.select().from(appSettingsTable).limit(1);
  if (!existingSettings) {
    await db.insert(appSettingsTable).values({
      appName: "Cotopia",
      primaryColor: "#7c3aed",
      secondaryColor: "#6d28d9",
      accentColor: "#ec4899",
      footerText: "© 2026 Cotopia. All rights reserved.",
      songSubmissionFee: "9.99",
      videoSubmissionFee: "19.99",
    });
    console.log("✓ App settings created");
  }

  // Users
  const hash = await bcrypt.hash("password123", 10);

  const [admin] = await db.insert(usersTable).values({
    email: "admin@cotopia.com",
    passwordHash: hash,
    username: "cotopia_admin",
    displayName: "Cotopia Admin",
    role: "master_admin",
    isActive: true,
    isVerified: true,
  }).onConflictDoNothing().returning();

  // Also upsert role to master_admin for existing admin account
  await db.update(usersTable).set({ role: "master_admin", isVerified: true }).where(eq(usersTable.email, "admin@cotopia.com"));

  const [editor] = await db.insert(usersTable).values({
    email: "editor@cotopia.com",
    passwordHash: hash,
    username: "cotopia_editor",
    displayName: "Cotopia Editor",
    role: "editor",
    isActive: true,
    isVerified: true,
  }).onConflictDoNothing().returning();

  const [moderator] = await db.insert(usersTable).values({
    email: "mod@cotopia.com",
    passwordHash: hash,
    username: "cotopia_mod",
    displayName: "Cotopia Moderator",
    role: "moderator",
    isActive: true,
    isVerified: true,
  }).onConflictDoNothing().returning();

  const [listener1] = await db.insert(usersTable).values({
    email: "alex@example.com",
    passwordHash: hash,
    username: "alex_listens",
    displayName: "Alex Rivera",
    avatarUrl: "https://api.dicebear.com/7.x/personas/svg?seed=alex",
    role: "listener",
  }).onConflictDoNothing().returning();

  const [artist1User] = await db.insert(usersTable).values({
    email: "nova@example.com",
    passwordHash: hash,
    username: "nova_sounds",
    displayName: "Nova Sounds",
    avatarUrl: "https://api.dicebear.com/7.x/personas/svg?seed=nova",
    role: "artist",
  }).onConflictDoNothing().returning();

  const [artist2User] = await db.insert(usersTable).values({
    email: "midnight@example.com",
    passwordHash: hash,
    username: "midnight_echo",
    displayName: "Midnight Echo",
    avatarUrl: "https://api.dicebear.com/7.x/personas/svg?seed=midnight",
    role: "artist",
  }).onConflictDoNothing().returning();

  const [artist3User] = await db.insert(usersTable).values({
    email: "lyra@example.com",
    passwordHash: hash,
    username: "lyra_wave",
    displayName: "Lyra Wave",
    avatarUrl: "https://api.dicebear.com/7.x/personas/svg?seed=lyra",
    role: "artist",
  }).onConflictDoNothing().returning();

  const [label1User] = await db.insert(usersTable).values({
    email: "deepwave@example.com",
    passwordHash: hash,
    username: "deepwave_records",
    displayName: "Deep Wave Records",
    role: "label",
  }).onConflictDoNothing().returning();

  const [label2User] = await db.insert(usersTable).values({
    email: "neon@example.com",
    passwordHash: hash,
    username: "neon_collective",
    displayName: "Neon Collective",
    role: "label",
  }).onConflictDoNothing().returning();

  console.log("✓ Users created");

  // Labels
  const [label1] = await db.insert(labelsTable).values({
    userId: label1User?.id ?? 6,
    name: "Deep Wave Records",
    bio: "Underground electronic and ambient label. We push the boundaries of sound into new territories, championing artists who refuse to be categorized.",
    logoUrl: "https://api.dicebear.com/7.x/shapes/svg?seed=deepwave&backgroundColor=7c3aed",
    bannerUrl: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=1200&q=80",
  }).onConflictDoNothing().returning();

  const [label2] = await db.insert(labelsTable).values({
    userId: label2User?.id ?? 7,
    name: "Neon Collective",
    bio: "Indie pop and alternative music collective. Born from late-night sessions and bright city lights, we amplify voices that cut through the noise.",
    logoUrl: "https://api.dicebear.com/7.x/shapes/svg?seed=neon&backgroundColor=ec4899",
    bannerUrl: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=1200&q=80",
  }).onConflictDoNothing().returning();

  console.log("✓ Labels created");

  // Artists
  const [artist1] = await db.insert(artistsTable).values({
    userId: artist1User?.id ?? 3,
    stageName: "Nova Sounds",
    bio: "Electronic producer blending ambient soundscapes with pulsing rhythms. Based in Berlin, influenced by the city's relentless energy and long nights.",
    avatarUrl: "https://api.dicebear.com/7.x/personas/svg?seed=nova&backgroundColor=7c3aed",
    bannerUrl: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=1200&q=80",
    genre: "Electronic",
    labelId: label1?.id ?? 1,
  }).onConflictDoNothing().returning();

  const [artist2] = await db.insert(artistsTable).values({
    userId: artist2User?.id ?? 4,
    stageName: "Midnight Echo",
    bio: "Dark synthwave artist crafting nocturnal soundtracks for the modern age. Every track is a journey through neon-lit streets and forgotten dreams.",
    avatarUrl: "https://api.dicebear.com/7.x/personas/svg?seed=midnight&backgroundColor=1e1b4b",
    bannerUrl: "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=1200&q=80",
    genre: "Synthwave",
    labelId: label1?.id ?? 1,
  }).onConflictDoNothing().returning();

  const [artist3] = await db.insert(artistsTable).values({
    userId: artist3User?.id ?? 5,
    stageName: "Lyra Wave",
    bio: "Singer-songwriter weaving introspective lyrics with lush production. Her music lives in the space between silence and sound.",
    avatarUrl: "https://api.dicebear.com/7.x/personas/svg?seed=lyra&backgroundColor=ec4899",
    bannerUrl: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=1200&q=80",
    genre: "Indie Pop",
    labelId: label2?.id ?? 2,
  }).onConflictDoNothing().returning();

  console.log("✓ Artists created");

  const a1 = artist1?.id ?? 1;
  const a2 = artist2?.id ?? 2;
  const a3 = artist3?.id ?? 3;

  // Albums
  const [album1] = await db.insert(albumsTable).values({
    artistId: a1,
    title: "Synthetic Horizons",
    coverUrl: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400&q=80",
    genre: "Electronic",
  }).onConflictDoNothing().returning();

  const [album2] = await db.insert(albumsTable).values({
    artistId: a2,
    title: "Night Protocol",
    coverUrl: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400&q=80",
    genre: "Synthwave",
  }).onConflictDoNothing().returning();

  const [album3] = await db.insert(albumsTable).values({
    artistId: a3,
    title: "Soft Frequencies",
    coverUrl: "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=400&q=80",
    genre: "Indie Pop",
  }).onConflictDoNothing().returning();

  console.log("✓ Albums created");

  const al1 = album1?.id ?? 1;
  const al2 = album2?.id ?? 2;
  const al3 = album3?.id ?? 3;

  // Songs — royalty-free audio from SoundHelix (reliable, no hotlink protection)
  const SH = (n: number) => `https://www.soundhelix.com/examples/mp3/SoundHelix-Song-${n}.mp3`;
  const songData = [
    { artistId: a1, albumId: al1, title: "Pulse of the Cosmos", genre: "Electronic", duration: 214, playCount: 18420, isFeatured: true, streamUrl: SH(1), coverUrl: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400&q=80" },
    { artistId: a1, albumId: al1, title: "Neon Drift", genre: "Electronic", duration: 187, playCount: 12300, isFeatured: false, streamUrl: SH(2), coverUrl: "https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=400&q=80" },
    { artistId: a1, albumId: al1, title: "Starfield Resonance", genre: "Electronic", duration: 263, playCount: 9870, isFeatured: true, streamUrl: SH(3), coverUrl: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=400&q=80" },
    { artistId: a2, albumId: al2, title: "Nocturne Protocol", genre: "Synthwave", duration: 198, playCount: 24100, isFeatured: true, streamUrl: SH(4), coverUrl: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400&q=80" },
    { artistId: a2, albumId: al2, title: "Digital Ghost", genre: "Synthwave", duration: 221, playCount: 16700, isFeatured: false, streamUrl: SH(5), coverUrl: "https://images.unsplash.com/photo-1560094824-13b9bc472f86?w=400&q=80" },
    { artistId: a2, albumId: al2, title: "After Midnight", genre: "Synthwave", duration: 244, playCount: 31200, isFeatured: true, streamUrl: SH(6), coverUrl: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=400&q=80" },
    { artistId: a3, albumId: al3, title: "Soft Rain", genre: "Indie Pop", duration: 176, playCount: 8920, isFeatured: true, streamUrl: SH(7), coverUrl: "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=400&q=80" },
    { artistId: a3, albumId: al3, title: "Glass Heart", genre: "Indie Pop", duration: 203, playCount: 14500, isFeatured: false, streamUrl: SH(8), coverUrl: "https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=400&q=80" },
    { artistId: a3, albumId: al3, title: "Echoes of You", genre: "Indie Pop", duration: 192, playCount: 11300, isFeatured: true, streamUrl: SH(9), coverUrl: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=400&q=80" },
  ];

  const insertedSongs = await Promise.all(songData.map(s =>
    db.insert(songsTable).values({ ...s, status: "published" }).onConflictDoNothing().returning()
  ));
  const songs = insertedSongs.map(r => r[0]).filter(Boolean);
  console.log(`✓ ${songs.length} songs created`);

  // Videos
  const videoData = [
    { artistId: a1, title: "Pulse of the Cosmos — Live Visual", genre: "Electronic", duration: 234, viewCount: 45200, isFeatured: true, videoUrl: "https://www.w3schools.com/html/mov_bbb.mp4", thumbnailUrl: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&q=80", description: "Official music video for Pulse of the Cosmos. Visuals by Studio Void." },
    { artistId: a2, title: "Nocturne Protocol — Official Video", genre: "Synthwave", duration: 212, viewCount: 82100, isFeatured: true, videoUrl: "https://www.w3schools.com/html/mov_bbb.mp4", thumbnailUrl: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&q=80", description: "Directed by Neon Pictures. A journey through neon cities and digital dreams." },
    { artistId: a2, title: "After Midnight — Live at the Electric", genre: "Synthwave", duration: 318, viewCount: 38600, isFeatured: false, videoUrl: "https://www.w3schools.com/html/mov_bbb.mp4", thumbnailUrl: "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=600&q=80", description: "Live performance recorded at The Electric venue. Uncut." },
    { artistId: a3, title: "Soft Rain — Acoustic Session", genre: "Indie Pop", duration: 187, viewCount: 21400, isFeatured: true, videoUrl: "https://www.w3schools.com/html/mov_bbb.mp4", thumbnailUrl: "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=600&q=80", description: "Stripped-back acoustic session filmed at sunrise. Just the song, unfiltered." },
    { artistId: a3, title: "Echoes of You — Lyric Video", genre: "Indie Pop", duration: 198, viewCount: 17800, isFeatured: false, videoUrl: "https://www.w3schools.com/html/mov_bbb.mp4", thumbnailUrl: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=600&q=80", description: "Official lyric video with animated typography." },
  ];

  const insertedVideos = await Promise.all(videoData.map(v =>
    db.insert(videosTable).values({ ...v, status: "published" }).onConflictDoNothing().returning()
  ));
  const videos = insertedVideos.map(r => r[0]).filter(Boolean);
  console.log(`✓ ${videos.length} videos created`);

  // Ratings
  if (listener1 && songs.length > 0) {
    await Promise.all(songs.slice(0, 6).map((s, i) =>
      db.insert(ratingsTable).values({ userId: listener1.id, contentType: "song", contentId: s.id, rating: Math.min(5, 3 + (i % 3)) }).onConflictDoNothing()
    ));
  }

  // Comments
  const commentTexts = [
    "This track hits different at 2am. Pure fire.",
    "The production on this is insane. Nova Sounds always delivers.",
    "Been on repeat for three days now. Help.",
    "That bassline is everything I needed today.",
    "I don't usually like electronic music but this is something else entirely.",
    "The way this builds... absolutely stunning.",
    "Can't stop listening. This is the soundtrack to my week.",
  ];

  if (listener1 && songs.length > 0) {
    await Promise.all(commentTexts.slice(0, 4).map((content, i) =>
      db.insert(commentsTable).values({
        userId: listener1.id,
        contentType: "song",
        contentId: songs[i % songs.length].id,
        content,
      }).onConflictDoNothing()
    ));
  }

  // Resolve user IDs — fall back to DB query if inserts were no-ops (re-seed)
  const resolveUser = async (inserted: typeof listener1, email: string) => {
    if (inserted) return inserted;
    const [found] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
    return found ?? null;
  };
  const [rListener1, rArtist1, rArtist2, rArtist3] = await Promise.all([
    resolveUser(listener1, "alex@example.com"),
    resolveUser(artist1User, "nova@example.com"),
    resolveUser(artist2User, "midnight@example.com"),
    resolveUser(artist3User, "lyra@example.com"),
  ]);

  // Resolve song/video IDs similarly
  const resolveSongs = async () => {
    if (songs.length > 0) return songs;
    return db.select().from(songsTable).where(eq(songsTable.status, "published")).limit(9);
  };
  const resolveVideos = async () => {
    if (videos.length > 0) return videos;
    return db.select().from(videosTable).where(eq(videosTable.status, "published")).limit(5);
  };
  const [allSongs, allVideos] = await Promise.all([resolveSongs(), resolveVideos()]);

  // Chat messages — seed demo fan chat for songs and videos
  const chatUsers = [rListener1, rArtist1, rArtist2, rArtist3].filter(Boolean);
  const songChatLines = [
    "This hook is smooth.",
    "That beat is crazy.",
    "Adding this to my playlist.",
    "Who else replayed this twice?",
    "Love this one.",
    "Nova Sounds never misses.",
    "The way this builds up is insane.",
    "Been on repeat since it dropped.",
    "The vibes on this are immaculate.",
    "This is everything.",
  ];
  const videoChatLines = [
    "The visuals match the energy perfectly.",
    "This video is art.",
    "I've watched this like 5 times.",
    "The cinematography is stunning.",
    "Okay this is actually insane.",
    "Production value through the roof.",
    "The concept is so unique.",
    "This deserves more views fr.",
    "Midnight Echo never disappoints.",
    "The editing is fire.",
  ];

  if (chatUsers.length > 0 && allSongs.length > 0) {
    for (let si = 0; si < Math.min(allSongs.length, 4); si++) {
      const song = allSongs[si];
      const lines = songChatLines.slice(0, 5 + (si * 2) % 5);
      for (let li = 0; li < lines.length; li++) {
        const u = chatUsers[li % chatUsers.length];
        if (!u) continue;
        await db.insert(chatMessagesTable).values({
          userId: u.id,
          contentType: "song",
          contentId: song.id,
          message: lines[li],
        }).onConflictDoNothing();
      }
    }
    console.log("✓ Song chat messages seeded");
  }

  if (chatUsers.length > 0 && allVideos.length > 0) {
    for (let vi = 0; vi < Math.min(allVideos.length, 3); vi++) {
      const video = allVideos[vi];
      const lines = videoChatLines.slice(0, 4 + (vi * 2) % 4);
      for (let li = 0; li < lines.length; li++) {
        const u = chatUsers[li % chatUsers.length];
        if (!u) continue;
        await db.insert(chatMessagesTable).values({
          userId: u.id,
          contentType: "video",
          contentId: video.id,
          message: lines[li],
        }).onConflictDoNothing();
      }
    }
    console.log("✓ Video chat messages seeded");
  }

  // Company posts
  const posts = [
    {
      title: "Welcome to Cotopia — The Future of Music Discovery",
      type: "announcement",
      content: "We're thrilled to launch Cotopia, the platform built for artists, labels, and listeners who believe music should have no boundaries. Submit your music, discover new sounds, and connect with the world.",
      isPinned: true,
    },
    {
      title: "Artist Spotlight: Nova Sounds",
      type: "artist_spotlight",
      content: "This month we're shining a light on Nova Sounds, whose debut album 'Synthetic Horizons' has been turning heads across the electronic scene. Read our exclusive interview.",
      imageUrl: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=800&q=80",
      isPinned: false,
    },
    {
      title: "Submission Fees Updated — More Accessible Than Ever",
      type: "product_update",
      content: "We've lowered our submission fees to make Cotopia accessible to more artists. Song submissions are now just $9.99 and video submissions $19.99. Every voice deserves to be heard.",
      isPinned: false,
    },
    {
      title: "Deep Wave Records Joins the Platform",
      type: "label_spotlight",
      content: "We're excited to welcome Deep Wave Records to Cotopia. Their roster of electronic and ambient artists is now available to stream exclusively on our platform.",
      imageUrl: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800&q=80",
      isPinned: false,
    },
    {
      title: "Summer Campaign: Discover Your Sound",
      type: "campaign",
      content: "This summer, we're on a mission to surface 100 emerging artists. Explore the Discover page daily for new drops, live sessions, and exclusive content.",
      imageUrl: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800&q=80",
      isPinned: false,
    },
  ];

  for (const post of posts) {
    await db.insert(companyPostsTable).values({ ...post, type: post.type as any }).onConflictDoNothing();
  }
  console.log(`✓ ${posts.length} company posts created`);

  console.log("\n✅ Seed complete!");
  console.log("\nDemo accounts (all use password: password123):");
  console.log("  admin@cotopia.com    — master_admin role");
  console.log("  editor@cotopia.com   — editor role");
  console.log("  mod@cotopia.com      — moderator role");
  console.log("  alex@example.com     — listener role");
  console.log("  nova@example.com     — artist (Nova Sounds)");
  console.log("  midnight@example.com — artist (Midnight Echo)");
  console.log("  lyra@example.com     — artist (Lyra Wave)");
  console.log("  deepwave@example.com — label (Deep Wave Records)");
  console.log("  neon@example.com     — label (Neon Collective)");

  process.exit(0);
}

seed().catch(err => {
  console.error("Seed failed:", err);
  process.exit(1);
});

# Changelog

All notable changes to Cotopia will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

## [Unreleased]

### Added
- Open content submissions to all authenticated users — auto-creates an artist profile on first submission
- Full playlist editing: cover image upload, inline name/description editing, public/private toggle, drag-to-reorder songs
- Username format enforcement for new accounts: letters, numbers, underscores, and hyphens only; no spaces; case-insensitive uniqueness check
- User-friendly error messages across all API routes and the frontend error layer
- Verified checkmark badges for trusted accounts

### Changed
- Company Hub posting restricted to admin/master_admin roles only
- Updated branding to new ER logo across all pages (favicon, sidebar, login, register, mobile nav, hero section)
- Removed development-only console hint from the email verification screen

### Fixed
- Conversation dropdown menu no longer overlaps message content in the messaging view

---

## [1.0.0] — 2025-01-01

### Added
- Initial platform launch
- Listener, artist, label, editor, moderator, admin, and master_admin role system
- Music and video streaming with play count tracking
- Artist and label profiles
- Playlist creation and management
- Content submission workflow with PayPal payment integration
- Admin review queue for submissions
- Company Hub for announcements and spotlights
- Direct messaging between users
- Comment and rating system
- Follow/unfollow artists
- Favorites and play history
- Notifications
- Copyright claims and DMCA workflow
- User reporting and moderation tools
- Analytics dashboards for artists, labels, and admins
- Embed player for songs, videos, and playlists
- Email verification via OTP
- Account settings: display name, username, password, email, demographics
- Admin CMS: app settings, editorial playlists, editor picks, broadcasts

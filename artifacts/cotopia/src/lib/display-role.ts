const ROLE_LABELS: Record<string, string> = {
  listener: "Creator",
  master_admin: "Master Admin",
  admin: "Admin",
  editor: "Editor",
  moderator: "Moderator",
  artist: "Artist",
  label: "Label",
  business: "Business",
};

export function displayRole(role: string | null | undefined): string {
  if (!role) return "";
  return ROLE_LABELS[role] ?? role.replace(/_/g, " ");
}

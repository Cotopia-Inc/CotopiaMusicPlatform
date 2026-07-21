import { useQuery } from "@tanstack/react-query";

export interface PlatformConfig {
  requireEmailVerification: boolean;
  maintenanceMode: boolean;
  singleSongFee: number;
  batchSongFee: number;
  premiumSongFee: number;
  singleVideoFee: number;
  batchVideoFee: number;
  premiumVideoFee: number;
  appName: string;
  logoUrl: string;
  primaryColor: string;
}

const DEFAULT_CONFIG: PlatformConfig = {
  requireEmailVerification: true,
  maintenanceMode: false,
  singleSongFee: 9.99,
  batchSongFee: 19.99,
  premiumSongFee: 49.99,
  singleVideoFee: 14.99,
  batchVideoFee: 29.99,
  premiumVideoFee: 79.99,
  appName: "",
  logoUrl: "",
  primaryColor: "#7c3aed",
};

async function fetchPlatformConfig(): Promise<PlatformConfig> {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}api/platform-config`);
    if (!res.ok) return DEFAULT_CONFIG;
    return res.json() as Promise<PlatformConfig>;
  } catch {
    return DEFAULT_CONFIG;
  }
}

export function usePlatformConfig(): PlatformConfig {
  const { data } = useQuery({
    queryKey: ["platform-config"],
    queryFn: fetchPlatformConfig,
    staleTime: 30 * 1000,
  });
  return data ?? DEFAULT_CONFIG;
}

/** Convert a 6-digit hex colour (#rrggbb) to the HSL triplet used by CSS vars.
 *  Returns a string like "262 80% 50%" (no "hsl()" wrapper). */
export function hexToHsl(hex: string): string {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

import { useQuery } from "@tanstack/react-query";

interface PlatformConfig {
  requireEmailVerification: boolean;
  maintenanceMode: boolean;
  singleSongFee: number;
  batchSongFee: number;
  premiumSongFee: number;
  singleVideoFee: number;
  batchVideoFee: number;
  premiumVideoFee: number;
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

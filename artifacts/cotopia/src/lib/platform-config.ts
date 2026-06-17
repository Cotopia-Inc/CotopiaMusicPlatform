import { useQuery } from "@tanstack/react-query";

interface PlatformConfig {
  requireEmailVerification: boolean;
}

async function fetchPlatformConfig(): Promise<PlatformConfig> {
  try {
    const res = await fetch("/api/platform-config");
    if (!res.ok) return { requireEmailVerification: true };
    return res.json() as Promise<PlatformConfig>;
  } catch {
    return { requireEmailVerification: true };
  }
}

export function usePlatformConfig(): PlatformConfig {
  const { data } = useQuery({
    queryKey: ["platform-config"],
    queryFn: fetchPlatformConfig,
    staleTime: 5 * 60 * 1000,
  });
  return data ?? { requireEmailVerification: true };
}

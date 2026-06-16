/**
 * Centralised query-key factory. Keeping keys here means we can invalidate
 * related caches from anywhere without typo'ing a key tuple.
 */
export const queryKeys = {
  packages: {
    all: ["packages"] as const,
    search: (params: unknown) => ["packages", "search", params] as const,
    detail: (slug: string) => ["packages", slug] as const,
  },
  agents: {
    all: ["agents"] as const,
    detail: (slug: string) => ["agents", slug] as const,
  },
  reviews: {
    all: ["reviews"] as const,
    forAgent: (agentId: string, page: number) =>
      ["reviews", agentId, page] as const,
  },
  rfqs: {
    all: ["rfqs"] as const,
    mine: (pilgrimId: string) => ["rfqs", pilgrimId] as const,
  },
  leads: {
    all: ["leads"] as const,
    forAgent: (agentId: string) => ["leads", agentId] as const,
  },
  watchlist: {
    forUser: (pilgrimId: string | null | undefined) =>
      ["watchlist", pilgrimId ?? "anon"] as const,
  },
} as const;

/**
 * Re-export shim — the watchlist now lives under the unified TanStack Query
 * hook layer at @/hooks/queries/useWatchlist. This file is kept so existing
 * imports of `@/lib/watchlist` continue to work.
 */
export { useWatchlist } from "@/hooks/queries/useWatchlist";

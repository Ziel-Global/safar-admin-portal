import { queryOptions, useQuery } from "@tanstack/react-query";
import { fetchAgentReviewsPage, REVIEWS_PAGE_SIZE } from "./useAgents";
import { queryKeys } from "./keys";

/**
 * Paged reviews for an agent. Spec: 10-minute staleTime, cache key includes
 * page index so each load-more page is independently cached.
 */
export const agentReviewsQuery = (agentId: string, page: number) =>
  queryOptions({
    queryKey: queryKeys.reviews.forAgent(agentId, page),
    queryFn: () => fetchAgentReviewsPage(agentId, page * REVIEWS_PAGE_SIZE, REVIEWS_PAGE_SIZE),
    staleTime: 10 * 60 * 1000,
  });

export function useAgentReviews(agentId: string, page: number) {
  return useQuery(agentReviewsQuery(agentId, page));
}

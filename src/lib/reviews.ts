export const REVIEW_DIMENSIONS = [
  { key: "hotel_accuracy", label: "Hotel accuracy", prompt: "Did the hotel match the description?" },
  { key: "transport_quality", label: "Transport quality", prompt: "How was the transport organisation?" },
  { key: "guide_quality", label: "Guide quality", prompt: "How knowledgeable and helpful was your guide?" },
  { key: "communication", label: "Communication", prompt: "How clearly and quickly did the agent respond?" },
  { key: "value_for_money", label: "Value for money", prompt: "Was the package good value?" },
] as const;

export type ReviewDimensionKey = (typeof REVIEW_DIMENSIONS)[number]["key"];

export type DimensionScores = Partial<Record<ReviewDimensionKey, { rating: number; comment?: string }>>;

export function averageRating(scores: DimensionScores): number {
  const values = REVIEW_DIMENSIONS.map((d) => scores[d.key]?.rating).filter(
    (v): v is number => typeof v === "number" && v > 0,
  );
  if (values.length === 0) return 0;
  return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10;
}

export const MAX_PHOTOS = 10;
export const MAX_VIDEOS = 2;
export const MAX_HIGHLIGHTS = 5;

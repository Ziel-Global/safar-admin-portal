import { supabase } from "@/integrations/supabase/client";

export type GuideType = "hajj" | "umrah";

export type RitualStep = {
  order: number;
  text: string;
  dua_arabic?: string | null;
  dua_transliteration?: string | null;
  dua_translation?: string | null;
};

export type Ritual = {
  id: string;
  guide_type: GuideType;
  name: string;
  slug: string;
  sort_order: number;
  description: string | null;
  steps: RitualStep[];
  common_mistakes: string[];
  header_image_url: string | null;
};

export async function fetchRituals(guideType: GuideType): Promise<Ritual[]> {
  const { data, error } = await supabase
    .from("guide_rituals")
    .select(
      "id, guide_type, name, slug, sort_order, description, steps, common_mistakes, header_image_url",
    )
    .eq("guide_type", guideType)
    .order("sort_order", { ascending: true });

  if (error) throw error;
  return (data ?? []).map((r) => ({
    ...r,
    guide_type: r.guide_type as GuideType,
    steps: (Array.isArray(r.steps) ? r.steps : []) as unknown as RitualStep[],
    common_mistakes: r.common_mistakes ?? [],
  }));
}

export async function fetchRitualBySlug(slug: string): Promise<Ritual | null> {
  const { data, error } = await supabase
    .from("guide_rituals")
    .select(
      "id, guide_type, name, slug, sort_order, description, steps, common_mistakes, header_image_url",
    )
    .eq("slug", slug)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return {
    ...data,
    guide_type: data.guide_type as GuideType,
    steps: (Array.isArray(data.steps) ? data.steps : []) as unknown as RitualStep[],
    common_mistakes: data.common_mistakes ?? [],
  };
}

const GRADIENTS: Record<string, string> = {
  "umrah-ihram": "from-sky-600 to-indigo-700",
  "umrah-tawaf": "from-emerald-600 to-teal-700",
  "umrah-sai": "from-amber-600 to-orange-700",
  "umrah-halq-taqsir": "from-rose-600 to-pink-700",
  "hajj-ihram": "from-sky-600 to-indigo-700",
  "hajj-mina": "from-violet-600 to-purple-700",
  "hajj-arafat": "from-amber-500 to-red-600",
  "hajj-muzdalifah": "from-slate-700 to-slate-900",
  "hajj-rami": "from-stone-600 to-stone-800",
  "hajj-qurbani": "from-rose-600 to-red-700",
  "hajj-tawaf-ifadah": "from-emerald-600 to-teal-700",
  "hajj-tashriq": "from-orange-600 to-amber-700",
  "hajj-tawaf-wada": "from-indigo-600 to-blue-800",
};

export function ritualGradient(slug: string): string {
  return GRADIENTS[slug] ?? "from-primary to-primary/70";
}

import { supabase } from "@/integrations/supabase/client";

export interface AgentArticle {
  id: string;
  agent_id: string;
  title: string;
  slug: string;
  body: string;
  featured_image: string | null;
  tags: string[];
  meta_title: string | null;
  meta_description: string | null;
  status: string;
  is_pinned: boolean;
  views: number;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export async function listAgentArticles(agentId: string, opts?: { publishedOnly?: boolean }): Promise<AgentArticle[]> {
  let q = supabase
    .from("agent_articles")
    .select("*")
    .eq("agent_id", agentId)
    .order("is_pinned", { ascending: false })
    .order("published_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (opts?.publishedOnly) q = q.eq("status", "published");
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as AgentArticle[];
}

export async function getAgentArticleBySlug(agentId: string, slug: string): Promise<AgentArticle | null> {
  const { data, error } = await supabase
    .from("agent_articles")
    .select("*")
    .eq("agent_id", agentId)
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  return (data as AgentArticle | null) ?? null;
}

export async function incrementArticleViews(id: string): Promise<void> {
  const { data } = await supabase.from("agent_articles").select("views").eq("id", id).maybeSingle();
  const next = (data?.views ?? 0) + 1;
  await supabase.from("agent_articles").update({ views: next }).eq("id", id);
}

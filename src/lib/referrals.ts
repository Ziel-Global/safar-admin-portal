import { supabase } from "@/integrations/supabase/client";

export interface ReferralCode {
  agent_id: string;
  code: string;
  created_at: string;
}

export interface ReferralRow {
  id: string;
  agent_id: string;
  pilgrim_id: string;
  status: string;
  credit_amount: number | null;
  created_at: string;
  pilgrim_name?: string | null;
}

export async function getOrCreateReferralCode(agentId: string): Promise<ReferralCode> {
  const { data, error } = await supabase
    .from("referral_codes")
    .select("*")
    .eq("agent_id", agentId)
    .maybeSingle();
  if (error) throw error;
  if (data) return data as ReferralCode;
  // Fallback: try to insert; the trigger may not have fired (legacy agent)
  const fallback = randomCode();
  const { data: created, error: insErr } = await supabase
    .from("referral_codes")
    .insert({ agent_id: agentId, code: fallback })
    .select("*")
    .single();
  if (insErr) throw insErr;
  return created as ReferralCode;
}

export async function listReferrals(agentId: string): Promise<ReferralRow[]> {
  const { data, error } = await supabase
    .from("referrals")
    .select("id, agent_id, pilgrim_id, status, credit_amount, created_at")
    .eq("agent_id", agentId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as ReferralRow[];
}

export function buildReferralLink(code: string): string {
  if (typeof window === "undefined") return `/?ref=${code}`;
  return `${window.location.origin}/?ref=${code}`;
}

function randomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 8; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

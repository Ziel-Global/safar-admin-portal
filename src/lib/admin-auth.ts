import { createClient } from "@supabase/supabase-js";

type AdminAuthResult =
  | { adminId: string; error?: never }
  | { adminId?: never; error: Response };

/** Verify Bearer JWT and ensure profiles.role === 'admin'. Server API routes only. */
export async function requireAdmin(request: Request): Promise<AdminAuthResult> {
  const authHeader = request.headers.get("authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return { error: Response.json({ error: "Missing session token" }, { status: 401 }) };
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY;
  if (!supabaseUrl || !publishableKey) {
    return { error: Response.json({ error: "Authentication is temporarily unavailable" }, { status: 500 }) };
  }

  const token = authHeader.slice("Bearer ".length);
  const verifier = createClient(supabaseUrl, publishableKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userError } = await verifier.auth.getUser(token);
  if (userError || !userData.user) {
    return { error: Response.json({ error: "Invalid or expired session" }, { status: 401 }) };
  }

  const { data: profile, error: profileError } = await verifier
    .from("profiles")
    .select("role")
    .eq("id", userData.user.id)
    .maybeSingle();

  if (profileError) {
    return { error: Response.json({ error: profileError.message }, { status: 500 }) };
  }
  if (profile?.role !== "admin") {
    return { error: Response.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return { adminId: userData.user.id };
}

import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

export const Route = createFileRoute("/api/auth/signout-all-devices")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authHeader = request.headers.get("authorization") ?? "";
        if (!authHeader.startsWith("Bearer ")) {
          return Response.json({ error: "Missing session token" }, { status: 401 });
        }

        const token = authHeader.slice("Bearer ".length);
        const supabaseUrl = process.env.SUPABASE_URL;
        const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY;
        if (!supabaseUrl || !publishableKey) {
          return Response.json({ error: "Authentication is temporarily unavailable" }, { status: 500 });
        }

        const verifier = createClient(supabaseUrl, publishableKey, {
          global: { headers: { Authorization: authHeader } },
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const { data: userData, error: userError } = await verifier.auth.getUser(token);
        if (userError || !userData.user) {
          return Response.json({ error: "Invalid or expired session" }, { status: 401 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const revokedAt = new Date().toISOString();

        const { error: updateError } = await supabaseAdmin
          .from("profiles")
          .update({ session_revoked_at: revokedAt })
          .eq("id", userData.user.id);
        if (updateError) {
          return Response.json({ error: updateError.message }, { status: 500 });
        }

        const { error: signOutError } = await supabaseAdmin.auth.admin.signOut(token, "global");
        if (signOutError) {
          return Response.json({ error: signOutError.message }, { status: 500 });
        }

        return Response.json({ success: true, revoked_at: revokedAt });
      },
    },
  },
});
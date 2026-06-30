import { createFileRoute } from "@tanstack/react-router";
import { inviteCorsHeaders, isInviteTokenValid, jsonWithCors, type InviteMetadata } from "@/lib/invite";

export const Route = createFileRoute("/api/invite/verify")({
  server: {
    handlers: {
      OPTIONS: async ({ request }) =>
        new Response(null, { status: 204, headers: inviteCorsHeaders(request) }),
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const token = url.searchParams.get("token")?.trim();
        if (!token) {
          return jsonWithCors(request, { error: "token is required" }, { status: 400 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin
          .from("invite_tokens")
          .select("email, role, metadata, expires_at, used")
          .eq("token", token)
          .maybeSingle();

        if (error) {
          return jsonWithCors(request, { error: error.message }, { status: 500 });
        }
        if (!data || !isInviteTokenValid(data)) {
          return jsonWithCors(
            request,
            { valid: false, error: "Invite link is invalid or expired" },
            { status: 404 },
          );
        }

        const meta = (data.metadata ?? {}) as InviteMetadata;
        return jsonWithCors(request, {
          valid: true,
          email: data.email,
          role: data.role,
          fullName: meta.full_name ?? null,
          businessName: meta.business_name ?? null,
        });
      },
    },
  },
});

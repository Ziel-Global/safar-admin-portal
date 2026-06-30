import { createFileRoute } from "@tanstack/react-router";
import { requireAdmin } from "@/lib/admin-auth";
import {
  buildInviteUrl,
  generateInviteToken,
  getInviteExpiryDate,
  sendAgentInviteEmail,
  type InviteMetadata,
} from "@/lib/invite";

export const Route = createFileRoute("/api/admin/agent-access/approve")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await requireAdmin(request);
        if (auth.error) return auth.error;

        let body: { requestId?: string };
        try {
          body = (await request.json()) as { requestId?: string };
        } catch {
          return Response.json({ error: "Invalid JSON body" }, { status: 400 });
        }

        const requestId = body.requestId?.trim();
        if (!requestId) {
          return Response.json({ error: "requestId is required" }, { status: 400 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: req, error: fetchError } = await supabaseAdmin
          .from("agent_access_requests")
          .select("*")
          .eq("id", requestId)
          .eq("status", "pending")
          .maybeSingle();

        if (fetchError) {
          return Response.json({ error: fetchError.message }, { status: 500 });
        }
        if (!req) {
          return Response.json({ error: "Request not found or not pending" }, { status: 404 });
        }

        const email = req.email.trim().toLowerCase();
        const token = generateInviteToken();
        const expiresAt = getInviteExpiryDate().toISOString();
        const metadata: InviteMetadata = {
          access_request_id: req.id,
          full_name: req.full_name,
          business_name: req.business_name,
          city: req.city ?? undefined,
          country_code: req.country_code ?? undefined,
        };

        await supabaseAdmin
          .from("invite_tokens")
          .update({ used: true, used_at: new Date().toISOString() })
          .eq("email", email)
          .eq("used", false);

        const { error: tokenError } = await supabaseAdmin.from("invite_tokens").insert({
          email,
          token,
          role: "agent",
          metadata,
          expires_at: expiresAt,
        });

        if (tokenError) {
          return Response.json({ error: tokenError.message }, { status: 500 });
        }

        const inviteUrl = buildInviteUrl(token);
        try {
          await sendAgentInviteEmail({
            to: email,
            inviteUrl,
            fullName: req.full_name,
            businessName: req.business_name,
          });
        } catch (err) {
          await supabaseAdmin.from("invite_tokens").delete().eq("token", token);
          const message = err instanceof Error ? err.message : "Failed to send invite email";
          return Response.json({ error: message }, { status: 500 });
        }

        const now = new Date().toISOString();
        const { error: updateError } = await supabaseAdmin
          .from("agent_access_requests")
          .update({
            status: "invited",
            reviewed_by: auth.adminId,
            reviewed_at: now,
            invited_at: now,
          })
          .eq("id", requestId)
          .eq("status", "pending");

        if (updateError) {
          return Response.json({ error: updateError.message }, { status: 500 });
        }

        await supabaseAdmin.from("admin_audit_log").insert({
          admin_id: auth.adminId,
          action: "agent_access.approve",
          entity_type: "agent_access_request",
          entity_id: requestId,
          details: { email, invite_method: "smtp" },
        });

        return Response.json({ success: true });
      },
    },
  },
});

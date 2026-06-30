import { createFileRoute } from "@tanstack/react-router";
import { requireAdmin } from "@/lib/admin-auth";

export const Route = createFileRoute("/api/admin/agent-access/reject")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await requireAdmin(request);
        if (auth.error) return auth.error;

        let body: { requestId?: string; reason?: string };
        try {
          body = (await request.json()) as { requestId?: string; reason?: string };
        } catch {
          return Response.json({ error: "Invalid JSON body" }, { status: 400 });
        }

        const requestId = body.requestId?.trim();
        if (!requestId) {
          return Response.json({ error: "requestId is required" }, { status: 400 });
        }

        const reason = body.reason?.trim() || null;
        const now = new Date().toISOString();
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: req, error: fetchError } = await supabaseAdmin
          .from("agent_access_requests")
          .select("id, email, business_name, status")
          .eq("id", requestId)
          .eq("status", "pending")
          .maybeSingle();

        if (fetchError) {
          return Response.json({ error: fetchError.message }, { status: 500 });
        }
        if (!req) {
          return Response.json({ error: "Request not found or not pending" }, { status: 404 });
        }

        const { error: updateError } = await supabaseAdmin
          .from("agent_access_requests")
          .update({
            status: "rejected",
            rejection_reason: reason,
            reviewed_by: auth.adminId,
            reviewed_at: now,
          })
          .eq("id", requestId)
          .eq("status", "pending");

        if (updateError) {
          return Response.json({ error: updateError.message }, { status: 500 });
        }

        await supabaseAdmin.from("admin_audit_log").insert({
          admin_id: auth.adminId,
          action: "agent_access.reject",
          entity_type: "agent_access_request",
          entity_id: requestId,
          details: { email: req.email, reason },
        });

        return Response.json({ success: true });
      },
    },
  },
});

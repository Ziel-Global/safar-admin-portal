import { createFileRoute } from "@tanstack/react-router";
import {
  inviteCorsHeaders,
  isInviteTokenValid,
  jsonWithCors,
  type InviteMetadata,
} from "@/lib/invite";

export const Route = createFileRoute("/api/invite/accept")({
  server: {
    handlers: {
      OPTIONS: async ({ request }) =>
        new Response(null, { status: 204, headers: inviteCorsHeaders(request) }),
      POST: async ({ request }) => {
        let body: { token?: string; password?: string };
        try {
          body = (await request.json()) as { token?: string; password?: string };
        } catch {
          return jsonWithCors(request, { error: "Invalid JSON body" }, { status: 400 });
        }

        const token = body.token?.trim();
        const password = body.password ?? "";
        if (!token) {
          return jsonWithCors(request, { error: "token is required" }, { status: 400 });
        }
        if (password.length < 8) {
          return jsonWithCors(
            request,
            { error: "Password must be at least 8 characters" },
            { status: 400 },
          );
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: invite, error: inviteError } = await supabaseAdmin
          .from("invite_tokens")
          .select("*")
          .eq("token", token)
          .maybeSingle();

        if (inviteError) {
          return jsonWithCors(request, { error: inviteError.message }, { status: 500 });
        }
        if (!invite || !isInviteTokenValid(invite)) {
          return jsonWithCors(
            request,
            { error: "Invite link is invalid or expired" },
            { status: 400 },
          );
        }

        const meta = (invite.metadata ?? {}) as InviteMetadata;
        const email = invite.email.trim().toLowerCase();

        const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: {
            agent_invite: "true",
            access_request_id: meta.access_request_id,
            full_name: meta.full_name,
            business_name: meta.business_name,
            city: meta.city,
            country_code: meta.country_code,
          },
        });

        if (createError) {
          const alreadyExists =
            createError.message.toLowerCase().includes("already") ||
            createError.message.toLowerCase().includes("registered");
          return jsonWithCors(
            request,
            {
              error: alreadyExists
                ? "An account with this email already exists"
                : createError.message,
            },
            { status: 400 },
          );
        }

        const userId = created.user?.id;
        if (!userId) {
          return jsonWithCors(request, { error: "Failed to create user account" }, { status: 500 });
        }

        const { error: profileError } = await supabaseAdmin
          .from("profiles")
          .update({
            role: invite.role,
            full_name: meta.full_name ?? null,
            country_code: meta.country_code ?? null,
          })
          .eq("id", userId);

        if (profileError) {
          await supabaseAdmin.auth.admin.deleteUser(userId);
          return jsonWithCors(request, { error: profileError.message }, { status: 500 });
        }

        if (invite.role === "agent") {
          const { error: agentError } = await supabaseAdmin.from("agents").upsert(
            {
              user_id: userId,
              business_name: meta.business_name ?? meta.full_name ?? "New Agency",
              city: meta.city ?? null,
              country_code: meta.country_code ?? null,
              status: "active",
            },
            { onConflict: "user_id" },
          );

          if (agentError) {
            await supabaseAdmin.auth.admin.deleteUser(userId);
            return jsonWithCors(request, { error: agentError.message }, { status: 500 });
          }
        }

        const now = new Date().toISOString();
        const { error: tokenUsedError } = await supabaseAdmin
          .from("invite_tokens")
          .update({ used: true, used_at: now })
          .eq("token", token)
          .eq("used", false);

        if (tokenUsedError) {
          return jsonWithCors(request, { error: tokenUsedError.message }, { status: 500 });
        }

        if (meta.access_request_id) {
          await supabaseAdmin
            .from("agent_access_requests")
            .update({
              status: "completed",
              user_id: userId,
              completed_at: now,
            })
            .eq("id", meta.access_request_id)
            .eq("status", "invited");
        }

        return jsonWithCors(request, { success: true, userId });
      },
    },
  },
});

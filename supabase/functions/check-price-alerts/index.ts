// Supabase Edge Function: check-price-alerts
// Scans active price alerts and triggers notifications when target prices are reached.
// Schedule via pg_cron every 30 minutes, or invoke manually from admin panel.

// @ts-nocheck — Deno runtime types
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface AlertRow {
  id: string;
  pilgrim_id: string;
  package_id: string;
  target_price: number;
  currency: string;
  packages: {
    id: string;
    title: string;
    slug: string | null;
    base_price: number | null;
    currency: string;
  } | null;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendKey = Deno.env.get("RESEND_API_KEY"); // optional

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Fetch all active alerts with their package info
    const { data: alerts, error } = await admin
      .from("price_alerts")
      .select(
        `id, pilgrim_id, package_id, target_price, currency,
         packages:package_id ( id, title, slug, base_price, currency )`,
      )
      .eq("is_active", true);

    if (error) throw error;

    const triggered: Array<{ alertId: string; pilgrim_id: string; pkg: AlertRow["packages"] }> = [];
    const list = (alerts ?? []) as AlertRow[];

    for (const a of list) {
      const current = a.packages?.base_price;
      if (current != null && current <= a.target_price) {
        triggered.push({ alertId: a.id, pilgrim_id: a.pilgrim_id, pkg: a.packages });
      }
    }

    // Mark triggered alerts inactive + create in-app notifications
    for (const t of triggered) {
      await admin
        .from("price_alerts")
        .update({ is_active: false, triggered_at: new Date().toISOString() })
        .eq("id", t.alertId);

      const link = t.pkg?.slug ? `/packages/${t.pkg.slug}` : "/dashboard/saved";
      await admin.from("notifications").insert({
        user_id: t.pilgrim_id,
        type: "price_alert",
        title: "Price drop! 🎉",
        body: `${t.pkg?.title ?? "A package you watched"} is now ${t.pkg?.currency ?? ""} ${t.pkg?.base_price}`,
        link_url: link,
      });

      // Optional: email via Resend
      if (resendKey) {
        try {
          const { data: profile } = await admin
            .from("profiles")
            .select("full_name")
            .eq("id", t.pilgrim_id)
            .maybeSingle();
          const { data: userRes } = await admin.auth.admin.getUserById(t.pilgrim_id);
          const email = userRes?.user?.email;
          if (email) {
            await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${resendKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                from: "Safar <onboarding@resend.dev>",
                to: [email],
                subject: `Price drop: ${t.pkg?.title}`,
                html: `<p>Hi ${profile?.full_name ?? "there"},</p>
                  <p>Good news — <strong>${t.pkg?.title}</strong> is now <strong>${t.pkg?.currency} ${t.pkg?.base_price}</strong>, at or below your target.</p>
                  <p><a href="${link}">View the package</a></p>`,
              }),
            });
          }
        } catch (e) {
          console.error("Email send failed", e);
        }
      }
    }

    return new Response(
      JSON.stringify({
        scanned: list.length,
        triggered: triggered.length,
        timestamp: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("check-price-alerts error", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});

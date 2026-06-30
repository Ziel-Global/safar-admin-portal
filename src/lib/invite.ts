import { randomBytes } from "node:crypto";
import { sendInviteEmail } from "@/lib/mail";

export type InviteRole = "pilgrim" | "agent" | "admin";

export type InviteMetadata = {
  access_request_id?: string;
  full_name?: string;
  business_name?: string;
  city?: string;
  country_code?: string;
};

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

export function generateInviteToken(): string {
  return randomBytes(32).toString("hex");
}

export function getInviteExpiryHours(): number {
  const raw = process.env.INVITE_TOKEN_EXPIRY_HOURS?.trim();
  const hours = raw ? Number(raw) : 48;
  if (!Number.isFinite(hours) || hours <= 0) return 48;
  return hours;
}

export function getInviteExpiryDate(): Date {
  return new Date(Date.now() + getInviteExpiryHours() * 60 * 60 * 1000);
}

export function buildInviteUrl(token: string): string {
  const base = requireEnv("AGENTS_PORTAL_URL").replace(/\/$/, "");
  return `${base}/accept-invite?token=${encodeURIComponent(token)}`;
}

export function isInviteTokenValid(row: { used: boolean; expires_at: string }): boolean {
  if (row.used) return false;
  return new Date(row.expires_at).getTime() > Date.now();
}

export async function sendAgentInviteEmail(params: {
  to: string;
  inviteUrl: string;
  fullName?: string | null;
  businessName?: string | null;
}): Promise<void> {
  const name = params.fullName?.trim() || "there";
  const agency = params.businessName?.trim();

  await sendInviteEmail({
    to: params.to,
    subject: "You're invited to Safar Agents",
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #1a1a1a; max-width: 560px;">
        <h2 style="margin: 0 0 16px;">Welcome to Safar Agents</h2>
        <p>Hi ${escapeHtml(name)},</p>
        <p>
          You've been approved to join the Safar agents portal
          ${agency ? ` for <strong>${escapeHtml(agency)}</strong>` : ""}.
        </p>
        <p>Click the button below to set your password and activate your account.</p>
        <p style="margin: 28px 0;">
          <a href="${params.inviteUrl}"
             style="background: #1f4d3a; color: #fff; text-decoration: none; padding: 12px 20px; border-radius: 8px; display: inline-block;">
            Accept invite
          </a>
        </p>
        <p style="font-size: 13px; color: #666;">
          This link expires in ${getInviteExpiryHours()} hours. If you didn't expect this email, you can ignore it.
        </p>
        <p style="font-size: 12px; color: #999; word-break: break-all;">${params.inviteUrl}</p>
      </div>
    `,
  });
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function inviteCorsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get("Origin");
  const allowed = process.env.AGENTS_PORTAL_URL?.replace(/\/$/, "");
  if (!origin || !allowed || origin !== allowed) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

export function jsonWithCors(
  request: Request,
  body: unknown,
  init?: ResponseInit,
): Response {
  const headers = new Headers(init?.headers);
  for (const [key, value] of Object.entries(inviteCorsHeaders(request))) {
    headers.set(key, value);
  }
  headers.set("Content-Type", "application/json");
  return Response.json(body, { ...init, headers });
}

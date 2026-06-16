import { supabase } from "@/integrations/supabase/client";

export interface Message {
  id: string;
  rfq_id: string;
  sender_id: string | null;
  sender_type: "pilgrim" | "agent" | "system";
  body: string;
  attachments: string[];
  is_read: boolean;
  created_at: string;
}

export async function fetchMessages(rfqId: string): Promise<Message[]> {
  const { data, error } = await supabase
    .from("messages")
    .select("id, rfq_id, sender_id, sender_type, body, attachments, is_read, created_at")
    .eq("rfq_id", rfqId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Message[];
}

export async function sendMessage(opts: {
  rfqId: string;
  senderId: string;
  senderType: "pilgrim" | "agent";
  body: string;
}) {
  const { error } = await supabase.from("messages").insert({
    rfq_id: opts.rfqId,
    sender_id: opts.senderId,
    sender_type: opts.senderType,
    body: opts.body,
  });
  if (error) throw error;
}

export async function markMessagesRead(rfqId: string, viewerType: "pilgrim" | "agent") {
  // Mark messages from the *other* party as read
  const otherType = viewerType === "pilgrim" ? "agent" : "pilgrim";
  await supabase
    .from("messages")
    .update({ is_read: true })
    .eq("rfq_id", rfqId)
    .eq("sender_type", otherType)
    .eq("is_read", false);
}

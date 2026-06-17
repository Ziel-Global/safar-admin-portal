import { useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { fetchMessages, markMessagesRead, sendMessage, type Message } from "@/lib/messages";

interface MessageThreadProps {
  rfqId: string;
  viewerType: "pilgrim" | "agent";
  className?: string;
  emptyHint?: string;
  /** When true, the composer is hidden and the thread is view-only. */
  readOnly?: boolean;
}

export function MessageThread({ rfqId, viewerType, className, emptyHint, readOnly }: MessageThreadProps) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchMessages(rfqId)
      .then((m) => {
        if (!active) return;
        setMessages(m);
        setLoading(false);
        markMessagesRead(rfqId, viewerType).catch(() => null);
      })
      .catch(() => {
        if (!active) return;
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [rfqId, viewerType]);

  useEffect(() => {
    const channel = supabase
      .channel(`rfq-messages-${rfqId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `rfq_id=eq.${rfqId}`,
        },
        (payload) => {
          const m = payload.new as Message;
          setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
          if (m.sender_type !== viewerType) {
            markMessagesRead(rfqId, viewerType).catch(() => null);
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [rfqId, viewerType]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length]);

  async function submit() {
    if (!user || !body.trim() || sending) return;
    setSending(true);
    try {
      await sendMessage({ rfqId, senderId: user.id, senderType: viewerType, body: body.trim() });
      setBody("");
    } catch (err) {
      toast.error("Could not send", {
        description: err instanceof Error ? err.message : "Please try again",
      });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className={cn("flex h-full min-h-[420px] flex-col rounded-md border border-border bg-card", className)}>
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
        {loading ? (
          <>
            <Skeleton className="h-12 w-2/3" />
            <Skeleton className="ml-auto h-12 w-1/2" />
            <Skeleton className="h-12 w-3/5" />
          </>
        ) : messages.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            {emptyHint ?? "No messages yet - say hello to get the conversation started."}
          </p>
        ) : (
          messages.map((m) => {
            const mine = m.sender_type === viewerType;
            const isSystem = m.sender_type === "system";
            return (
              <div
                key={m.id}
                className={cn(
                  "flex flex-col",
                  isSystem ? "items-center" : mine ? "items-end" : "items-start",
                )}
              >
                <div
                  className={cn(
                    "max-w-[85%] rounded-2xl px-3 py-2 text-sm shadow-sm",
                    isSystem
                      ? "bg-muted text-muted-foreground text-xs italic"
                      : mine
                        ? "bg-primary text-primary-foreground rounded-br-sm"
                        : "bg-secondary text-foreground rounded-bl-sm",
                  )}
                >
                  <p className="whitespace-pre-wrap break-words">{m.body}</p>
                </div>
                <span className="mt-1 text-[10px] text-muted-foreground">
                  {format(new Date(m.created_at), "PPp")}
                </span>
              </div>
            );
          })
        )}
      </div>

      {readOnly ? (
        <div className="border-t border-border p-3">
          <p className="text-center text-xs text-muted-foreground">
            You'll be notified of new messages from agents. Direct replies aren't available yet.
          </p>
        </div>
      ) : (
        <div className="border-t border-border p-3">
          <div className="flex items-end gap-2">
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                }
              }}
              rows={2}
              placeholder="Write a message..."
              className="min-h-[44px] flex-1 resize-none"
              disabled={sending}
            />
            <Button onClick={submit} disabled={sending || !body.trim()} className="gap-2">
              <Send className="h-4 w-4" />
              Send
            </Button>
          </div>
          <p className="mt-1 text-[10px] text-muted-foreground">Enter to send · Shift+Enter for newline</p>
        </div>
      )}
    </div>
  );
}

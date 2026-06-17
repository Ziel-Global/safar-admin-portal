import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export function AvailabilityToggle({ agentId }: { agentId: string }) {
  const [status, setStatus] = useState<"online" | "away">("online");
  const [autoReply, setAutoReply] = useState("");
  const [returnDate, setReturnDate] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("agent_availability")
        .select("status, auto_reply, return_date")
        .eq("agent_id", agentId)
        .maybeSingle();
      if (cancelled) return;
      if (data) {
        setStatus(data.status as "online" | "away");
        setAutoReply(data.auto_reply ?? "");
        setReturnDate(data.return_date ? data.return_date.slice(0, 10) : "");
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [agentId]);

  const persist = async (next: "online" | "away", reply: string, ret: string) => {
    setSaving(true);
    const { error } = await supabase.from("agent_availability").upsert(
      {
        agent_id: agentId,
        status: next,
        auto_reply: next === "away" ? reply : null,
        return_date: next === "away" && ret ? new Date(ret).toISOString() : null,
      },
      { onConflict: "agent_id" },
    );
    setSaving(false);
    if (error) {
      toast.error("Couldn't update availability", { description: error.message });
      return false;
    }
    return true;
  };

  const onToggle = async (checked: boolean) => {
    if (checked) {
      // switching to online
      const ok = await persist("online", "", "");
      if (ok) {
        setStatus("online");
        toast.success("You're online");
      }
    } else {
      // switching to away → open dialog
      setOpen(true);
    }
  };

  const onSaveAway = async () => {
    if (!autoReply.trim()) {
      toast.error("Please enter an auto-reply message");
      return;
    }
    const ok = await persist("away", autoReply.trim(), returnDate);
    if (ok) {
      setStatus("away");
      setOpen(false);
      toast.success("Set to away - auto-replies enabled");
    }
  };

  if (loading) return <div className="h-9 w-32 animate-pulse rounded-md bg-secondary" />;

  return (
    <>
      <div className="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs">
        <span
          className={cn(
            "h-2 w-2 rounded-full",
            status === "online" ? "bg-emerald-500" : "bg-amber-500",
          )}
        />
        <span className="font-semibold">{status === "online" ? "Online" : "Away"}</span>
        <Switch
          checked={status === "online"}
          onCheckedChange={onToggle}
          aria-label="Toggle availability"
        />
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set yourself to Away</DialogTitle>
            <DialogDescription>
              Pilgrims will see an "Away" badge on your profile. New leads will get an automatic
              reply with your message.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="auto-reply">Auto-reply message</Label>
              <Textarea
                id="auto-reply"
                value={autoReply}
                onChange={(e) => setAutoReply(e.target.value)}
                placeholder="Thanks for your enquiry - I'm currently away and will reply when I'm back."
                rows={4}
                maxLength={500}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="return-date">Return date (optional)</Label>
              <Input
                id="return-date"
                type="date"
                value={returnDate}
                onChange={(e) => setReturnDate(e.target.value)}
                min={new Date().toISOString().slice(0, 10)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={onSaveAway} disabled={saving}>
              {saving ? "Saving…" : "Set to Away"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

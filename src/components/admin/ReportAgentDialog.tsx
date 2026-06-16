import { useState } from "react";
import { Loader2, Flag } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const REPORT_TYPES = [
  { value: "unlicensed", label: "Operating without a licence" },
  { value: "misleading", label: "Misleading or false information" },
  { value: "bait_switch", label: "Bait-and-switch tactics" },
  { value: "harassment", label: "Harassment or abuse" },
  { value: "other", label: "Other concern" },
] as const;

type ReportType = (typeof REPORT_TYPES)[number]["value"];

export function ReportAgentDialog({
  agentId,
  agentName,
}: {
  agentId: string;
  agentName: string;
}) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [reportType, setReportType] = useState<ReportType>("misleading");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!user) {
      toast.error("Please sign in to report an agent");
      return;
    }
    if (description.trim().length < 20) {
      toast.error("Please describe the issue (min 20 characters)");
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from("fraud_reports").insert({
      reporter_id: user.id,
      agent_id: agentId,
      report_type: reportType,
      description: description.trim(),
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Report submitted. Our team will review it shortly.");
    setOpen(false);
    setDescription("");
    setReportType("misleading");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive">
          <Flag className="h-4 w-4" /> Report
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Report {agentName}</DialogTitle>
          <DialogDescription>
            Help us keep the platform safe. Reports are confidential and reviewed by our trust team.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="report-type">Type of concern</Label>
            <Select value={reportType} onValueChange={(v) => setReportType(v as ReportType)}>
              <SelectTrigger id="report-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REPORT_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="report-description">What happened?</Label>
            <Textarea
              id="report-description"
              rows={5}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Please share specific details, dates, and any evidence we should review."
            />
            <p className="text-xs text-muted-foreground">{description.length} characters</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleSubmit} disabled={submitting}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Submit report
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

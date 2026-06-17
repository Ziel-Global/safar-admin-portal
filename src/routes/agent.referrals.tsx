import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Copy, Check, Users, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  buildReferralLink,
  getOrCreateReferralCode,
  listReferrals,
  type ReferralCode,
  type ReferralRow,
} from "@/lib/referrals";

export const Route = createFileRoute("/agent/referrals")({
  head: () => ({
    meta: [
      { title: "Referrals - Safar" },
      { name: "description", content: "Invite pilgrims to Safar with your referral code and track sign-ups." },
    ],
  }),
  component: () => (
    <ProtectedRoute requireRole="agent">
      <ReferralsPage />
    </ProtectedRoute>
  ),
});

function ReferralsPage() {
  const { agent } = useAuth();
  const [code, setCode] = useState<ReferralCode | null>(null);
  const [refs, setRefs] = useState<ReferralRow[]>([]);
  const [copied, setCopied] = useState<"code" | "link" | null>(null);

  useEffect(() => {
    if (!agent) return;
    getOrCreateReferralCode(agent.id).then(setCode).catch((e) => toast.error(e.message));
    listReferrals(agent.id).then(setRefs).catch(() => null);
  }, [agent]);

  const link = code ? buildReferralLink(code.code) : "";
  const completed = refs.filter((r) => r.status === "completed").length;
  const totalCredit = refs.reduce((s, r) => s + (Number(r.credit_amount) || 0), 0);

  function copy(value: string, kind: "code" | "link") {
    if (!value) return;
    navigator.clipboard.writeText(value);
    setCopied(kind);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopied(null), 1500);
  }

  return (
    <DashboardLayout variant="agent" title="Referrals">
      <div className="mx-auto w-full max-w-5xl space-y-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard label="Total referrals" value={refs.length} icon={<Users className="h-4 w-4 text-primary" />} />
          <StatCard label="Completed" value={completed} icon={<Sparkles className="h-4 w-4 text-primary" />} />
          <StatCard label="Pending credit" value={`£${totalCredit.toFixed(2)}`} icon={<Sparkles className="h-4 w-4 text-primary" />} />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Your referral code</CardTitle>
            <CardDescription>Share this with other agents or pilgrims to earn credit.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-muted-foreground">CODE</label>
              <div className="mt-1 flex gap-2">
                <Input readOnly value={code?.code ?? "Generating..."} className="font-mono text-lg tracking-widest" />
                <Button onClick={() => copy(code?.code ?? "", "code")} variant="outline">
                  {copied === "code" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground">SHAREABLE LINK</label>
              <div className="mt-1 flex gap-2">
                <Input readOnly value={link} />
                <Button onClick={() => copy(link, "link")} variant="outline">
                  {copied === "link" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Referral history</CardTitle>
            <CardDescription>Pilgrims who signed up using your code.</CardDescription>
          </CardHeader>
          <CardContent>
            {refs.length === 0 ? (
              <p className="rounded-md border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                No referrals yet. Share your link to start earning.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Pilgrim</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Credit</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {refs.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(r.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {r.pilgrim_id.slice(0, 8)}…
                      </TableCell>
                      <TableCell>
                        <Badge variant={r.status === "completed" ? "default" : "secondary"}>
                          {r.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {r.credit_amount ? `£${Number(r.credit_amount).toFixed(2)}` : "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          Need help? <Link to="/about" className="underline">Learn how referrals work</Link>
        </p>
      </div>
    </DashboardLayout>
  );
}

function StatCard({ label, value, icon }: { label: string; value: string | number; icon: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardDescription>{label}</CardDescription>
          {icon}
        </div>
        <CardTitle className="text-2xl">{value}</CardTitle>
      </CardHeader>
    </Card>
  );
}

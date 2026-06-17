import { createFileRoute, Link } from "@tanstack/react-router";
import { ClipboardList, Luggage, PhoneCall } from "lucide-react";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/tools/")({
  head: () => ({
    meta: [
      { title: "Pilgrim Tools - Safar" },
      {
        name: "description",
        content:
          "Free tools for Hajj and Umrah pilgrims: document checklist, packing list, and offline emergency contacts.",
      },
      { property: "og:title", content: "Pilgrim Tools - Safar" },
      {
        property: "og:description",
        content: "Document checklist, packing list and emergency contacts for your pilgrimage.",
      },
    ],
  }),
  component: ToolsIndex,
});

const tools = [
  {
    to: "/tools/checklist" as const,
    icon: ClipboardList,
    title: "Document Checklist",
    description: "Personalised passport, visa, vaccination and Mahram checklist by country.",
  },
  {
    to: "/tools/packing" as const,
    icon: Luggage,
    title: "Packing List",
    description: "Smart packing checklist tailored to your trip length, season and needs.",
  },
  {
    to: "/tools/emergency" as const,
    icon: PhoneCall,
    title: "Emergency Contacts",
    description:
      "Saudi emergency numbers, hospitals and your embassy - with offline access.",
  },
];

function ToolsIndex() {
  return (
    <PublicLayout>
      <div className="mx-auto w-full max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-10">
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Pilgrim Tools
          </h1>
          <p className="mt-3 max-w-2xl text-base text-muted-foreground">
            Free tools to help you prepare, pack and stay safe during Hajj and Umrah.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tools.map(({ to, icon: Icon, title, description }) => (
            <Link key={to} to={to} className="group">
              <Card className="h-full transition-all hover:border-primary hover:shadow-lg">
                <CardHeader>
                  <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <CardTitle className="text-lg group-hover:text-primary">{title}</CardTitle>
                  <CardDescription className="leading-relaxed">{description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <span className="text-sm font-medium text-primary">Open tool →</span>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </PublicLayout>
  );
}

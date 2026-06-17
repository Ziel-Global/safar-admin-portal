import { createFileRoute, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { GuideViewer } from "@/components/guides/GuideViewer";
import { fetchRituals, type GuideType } from "@/lib/guides";
import { Skeleton } from "@/components/ui/skeleton";

const VALID: GuideType[] = ["hajj", "umrah"];

export const Route = createFileRoute("/guides/$guideType/")({
  beforeLoad: ({ params }) => {
    if (!VALID.includes(params.guideType as GuideType)) throw notFound();
  },
  head: ({ params }) => {
    const isHajj = params.guideType === "hajj";
    const title = isHajj
      ? "Hajj Step-by-Step Guide - Rituals, Duas & Common Mistakes | Safar"
      : "Umrah Step-by-Step Guide - Rituals, Duas & Common Mistakes | Safar";
    const description = isHajj
      ? "Complete Hajj guide covering Ihram, Mina, Arafat, Muzdalifah, Rami, Qurbani, Tawaf and more - with authentic duas and common mistakes to avoid."
      : "Complete Umrah guide: Ihram, Tawaf, Sa'i and Halq - with transliterated duas, step-by-step instructions and common mistakes to avoid.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "article" },
      ],
    };
  },
  component: GuideIndex,
});

function GuideIndex() {
  const { guideType } = Route.useParams();
  const type = guideType as GuideType;
  const { data, isLoading } = useQuery({
    queryKey: ["guide-rituals", type],
    queryFn: () => fetchRituals(type),
    staleTime: 1000 * 60 * 60,
  });

  return (
    <PublicLayout>
      {isLoading ? (
        <div className="mx-auto w-full max-w-4xl space-y-4 px-4 py-10 sm:px-6">
          <Skeleton className="h-10 w-2/3" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-[60vh] w-full rounded-2xl" />
        </div>
      ) : (
        <GuideViewer guideType={type} rituals={data ?? []} />
      )}
    </PublicLayout>
  );
}

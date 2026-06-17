import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { PackageEditorPage } from "./agent.packages.new";

export const Route = createFileRoute("/agent/packages/$id/edit")({
  head: () => ({
    meta: [
      { title: "Edit Package - Safar" },
      { name: "description", content: "Edit your Hajj or Umrah package." },
    ],
  }),
  component: EditPackageRoute,
});

function EditPackageRoute() {
  const { id } = Route.useParams();
  return (
    <ProtectedRoute requireRole="agent">
      <PackageEditorPage existingId={id} />
    </ProtectedRoute>
  );
}

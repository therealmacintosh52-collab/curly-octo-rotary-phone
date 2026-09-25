import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { Dashboard } from "@/components/dashboard/dashboard";

export default async function HomePage() {
  const session = await getSession();
  if (!session.isAdmin) redirect("/jobs/new");
  return <Dashboard />;
}

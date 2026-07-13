import { redirect } from "next/navigation";
import { requireActivePageSession } from "@/lib/auth/page-access";

export default async function SettingsIndexPage() {
  await requireActivePageSession();
  redirect("/app/settings/profile");
}

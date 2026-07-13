import { Button } from "@fugue/ui/components/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@fugue/ui/components/empty";
import Link from "next/link";
import { requireActivePageSession } from "@/lib/auth/page-access";
import { getRequestI18n } from "@/lib/i18n/server";

export default async function ConsoleNotFound() {
  await requireActivePageSession();
  const { t } = await getRequestI18n();

  return (
    <Empty>
      <EmptyHeader>
        <EmptyTitle>{t("Console page not found")}</EmptyTitle>
        <EmptyDescription>
          {t("The requested workspace page does not exist or is no longer available.")}
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button render={<Link href="/app" />}>{t("Return to projects")}</Button>
      </EmptyContent>
    </Empty>
  );
}

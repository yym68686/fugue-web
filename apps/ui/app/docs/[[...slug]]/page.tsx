import { notFound } from "next/navigation";

import { source } from "@/lib/source";
import { mdxComponents } from "@/mdx-components";

export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return source.generateParams();
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug?: string[] }>;
}) {
  const page = source.getPage((await params).slug);
  if (!page) notFound();
  return { title: page.data.title, description: page.data.description };
}

export default async function DocsPage({
  params,
}: {
  params: Promise<{ slug?: string[] }>;
}) {
  const page = source.getPage((await params).slug);
  if (!page) notFound();
  const Content = page.data.body;

  return (
    <article className="registry-content">
      <header className="mb-10 border-b pb-6">
        <h1 className="text-3xl font-semibold">{page.data.title}</h1>
        {page.data.description ? (
          <p className="mt-3 text-muted-foreground">{page.data.description}</p>
        ) : null}
      </header>
      <div className="space-y-4 leading-7">
        <Content components={mdxComponents} />
      </div>
    </article>
  );
}

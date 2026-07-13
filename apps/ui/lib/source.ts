import { loader, type StaticSource } from "fumadocs-core/source";

import { docs } from "@/.source/server";

// Bun's isolated peer graph can materialize the same fumadocs-core version in
// two peer contexts. Rebind the MDX source to this app's core type so loader()
// preserves the compiled `body`/`toc` fields instead of falling back to the
// minimal PageData shape. The runtime value is unchanged.
const docsSource = docs.toFumadocsSource() as unknown as StaticSource<{
  pageData: (typeof docs.docs)[number];
  metaData: (typeof docs.meta)[number];
}>;

export const source = loader(docsSource, {
  baseUrl: "/docs",
});

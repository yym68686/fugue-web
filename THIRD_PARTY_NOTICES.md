# Third-party notices

## COSS UI registry source

Selected files under `apps/ui/registry/` are derived from the MIT-licensed `apps/ui/` directory of [`cosscom/coss`](https://github.com/cosscom/coss) at commit `1664a7f0b3be9f25f5ff0ac846667633b4ccd6b4`.

Copyright (c) COSS contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

The complete imported-file manifest, upstream hashes and local modifications are recorded in `docs/upstream/coss-files.json`. Upstream's `LICENSING.md` applies the MIT license to `apps/ui/`; the repository root and other default paths remain AGPL-3.0-or-later and are not copied into this integration.

## Fonts and runtime libraries

- Inter is distributed through `@fontsource-variable/inter` under the SIL Open Font License 1.1. Its package WOFF2 asset is consumed by the shared `next/font/local` runtime; no font binary is vendored in this repository.
- Geist Mono is distributed through the `geist` package under the SIL Open Font License. Its package WOFF2 asset is consumed by the same shared runtime and is not vendored.
- Exact dependency versions, integrity records and hashes remain reproducible from `bun.lock`, the package manifests and the generated SBOM/license report.
- Base UI, React, Next.js, Tailwind CSS, shadcn, Fumadocs and other JavaScript dependencies retain the licenses recorded by `bun.lock` and the generated SBOM/license report.

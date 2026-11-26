# AWP website

Static site for https://agenticworkflowprotocol.org, built with Astro Starlight.

```sh
cd site
npm ci               # install scripts are disabled by .npmrc (ignore-scripts=true)
npm run build        # sync -> astro build -> dist/ (+ Pagefind index, sitemap, CNAME)
npm test             # marked examples, offline link check, size budget, axe-core accessibility check
npm run dev          # local development server
```

- **Checked examples.** A YAML block directly after an `awp-check` comment is run through the
  reference checker by `npm run check:examples` (no build needed; uses the root `npm ci`).
  `<!-- awp-check -->` means valid under all profiles; `profiles=core,governance` narrows the
  profiles, and `expect=<code>` requires a rejection with that diagnostic code. In `.mdx` pages use
  `{/* awp-check ... */}`. Mark every complete manifest; fragments and proposals stay unmarked.

- **Content.** The specification, glossary, CLI formats, changelog and community files are rendered
  from the repository files by `scripts/sync-content.mjs` into git-ignored paths; they are not
  copied into Git. Example manifests on the site are imported from `spec/v1alpha1/examples/`.
  Hand-written pages are in `src/content/docs/`, the introduction page is `src/content/docs/index.mdx`; `scripts/build-llms.mjs` writes `llms.txt` and `llms-full.txt` into `dist/` at build time.
- **No external requests.** System fonts, no CDN, no analytics; search is a static Pagefind index.
  `check:links` and `check:a11y` fail if any page references or requests an external resource.
- **Node.** Astro 7.3.3 and Starlight 0.42.6 are pinned and need Node 22.12 or later.
  The a11y check needs a system Chromium or Chrome (`CHROME_PATH`); no browser is downloaded.
- **Languages.** English only. Add a `de` locale in `astro.config.mjs` and a `src/content/docs/de/` tree.
- **Deploy.** Cloudflare Pages builds and serves the site from `main`. `.github/workflows/pages.yml`
  only builds and checks it (GitHub-hosted runners) and does not deploy.

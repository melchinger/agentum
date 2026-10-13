### Policy: Static SEO Baseline

- Every public page must have one meaningful H1, a unique title, a useful meta description,
  a canonical URL, and the correct document language.
- Keep `meta.base_url` real before deployment. The static build generates `robots.txt`,
  `sitemap.xml`, and WebSite/WebPage JSON-LD automatically; do not remove them from `dist/`.
- Use `noindex: true` and/or `sitemap: false` for private, temporary, preview, or duplicate pages.
- Set `meta.og_image` to a local absolute or site-relative image when social previews need a
  custom image. Do not add third-party image, font, or script URLs.
- Keep page titles and descriptions specific to the page and language. Do not reuse the project
  name as the only title on every page.
- Markdown images must have meaningful alt text unless they are genuinely decorative. Prefer
  local WebP/AVIF images, and keep explicit dimensions/aspect ratios in styles for content images.

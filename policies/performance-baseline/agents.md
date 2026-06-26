# Performance Baseline Policy

Wende diese Vorgaben bei jedem Code-Generierungs- und Refactoring-Prozess zwingend an.

## 1. Backend & Datenbanken
* **Query-Analyse:** N+1-Queries sind verboten. Verwende `EXPLAIN` oder `EXPLAIN ANALYZE` zur Überprüfung von Indizes bei komplexen Abfragen.
* **Parallelisierung:** Führe unabhängige asynchrone Aufrufe zwingend parallel via `Promise.all()` aus, um Waterfall-Requests zu blockieren.
* **Caching:** Integriere Distributed Caching (z.B. Redis) für zustandslose, hochfrequente Lesezugriffe.
* **Data Fetching:** Listen-Endpoints müssen standardmäßig paginiert sein (Take/Skip oder Cursor). Unbounded Queries sind unzulässig.

## 2. Frontend & Rendering
* **Rendering-Strategien:** Definiere explizit, ob SSR, SSG, ISR oder React Server Components genutzt werden, basierend auf Caching-Potenzial und SEO-Bedarf.
* **Main Thread:** Lagere blockierende, rechenintensive Client-Operationen in Web Workers aus.
* **Assets:** Bilder erfordern Größenangaben (`width`/`height`), Lazy Loading (Below-the-Fold) und responsives Art Direction/Resolution Switching (WebP/AVIF via `<picture>`).
* **State & Rendering:** Verhindere unnötige Re-renders durch stabile Referenzen. Nutze `React.memo` und `useMemo` gezielt, vermeide Over-Engineering.

## 3. Architektur & Observability
* **Edge & CDN:** Konfiguriere Edge Caching für statische Assets (Immutable Cache-Control) und geeignete API-Responses.
* **Distributed Tracing:** Integriere OpenTelemetry-Header und Span-Generierung für End-to-End Request-Tracking.
* **Load Testing:** Bereite k6- oder Artillery-Testskripte für neue, ressourcenintensive Endpoints vor.

## 4. Performance Budgets (Hard Limits)
Code-Vorschläge müssen darauf ausgelegt sein, folgende Budgets in der CI/CD zu bestehen:
* JS Bundle (Initial Load): < 200KB gzipped
* CSS: < 50KB gzipped
* API Response Time: < 200ms (p95)
* Time to Interactive (TTI): < 3.5s auf 4G
* Lighthouse Performance Score: ≥ 90

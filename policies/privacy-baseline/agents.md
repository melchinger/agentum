# Privacy Baseline Policy (DSGVO/GDPR)

Diese Policy stellt sicher, dass generierter Code standardmäßig datenschutzkonform ist ("Privacy by Design"). Drittanbieter-Verbindungen, die ungefragt Nutzer-IP-Adressen übertragen könnten, sind untersagt.

## 1. Schriften & Assets (Striktes Verbot von CDNs)
* **Keine Google Fonts CDNs:** Es ist untersagt, Schriften über `fonts.googleapis.com` oder ähnliche CDNs einzubinden.
* **Local Hosting:** Schriften müssen zwingend lokal im Projekt (z. B. unter `public/fonts/` oder via npm `@fontsource`) bereitgestellt und über CSS `@font-face` referenziert werden.
* **Standard-Stacks:** Nutze primär System-Fonts oder lokal gehostete Varianten.

## 2. Libraries & Dependencies
* **Keine Frontend-CDNs:** Verwende niemals externe CDNs wie `unpkg.com`, `cdnjs.com` oder `jsdelivr.net` in `<script>` oder `<link>` Tags.
* **Bundling:** Alle Abhängigkeiten müssen über den jeweiligen Paketmanager (npm, yarn, composer, pip) installiert und lokal gebündelt (Vite, Webpack, etc.) ausgeliefert werden.

## 3. Tracking, Analytics & Cookies
* **Kein ungefragtes Tracking:** Die Integration von Google Analytics, Facebook Pixel oder ähnlichen Diensten im Standard-Scaffold ist verboten.
* **Consent Management:** Falls Tracking-Funktionen explizit angefordert werden, muss zwingend ein Consent-Management-System (Cookie-Banner) vorgeschaltet werden, das die Skripte erst nach Einwilligung lädt.
* **IP-Anonymisierung:** Bei der Konfiguration von Backend-Logging oder Analytics-Tools muss die IP-Anonymisierung (z. B. `anonymize_ip: true`) standardmäßig aktiviert sein.

## 4. Externe Ressourcen
* **Gravatar/Avatare:** Vermeide die direkte Einbindung von Gravatar-URLs. Nutze lokale Platzhalter oder biete eine Option zum Proxying/Caching von Avataren an.
* **YouTube/Vimeo:** Videos dürfen nur im "erweiterten Datenschutzmodus" (z. B. `youtube-nocookie.com`) oder vorzugsweise hinter einer "Zwei-Klick-Lösung" (Vorschaubild lokal) eingebunden werden.

## 5. Verifizierung
Jeder generierte Code muss folgende Checks bestehen:
- [ ] Enthält der HTML-Header externe Links zu Fonts oder Libraries? (Muss: Nein)
- [ ] Werden Drittanbieter-Cookies ohne Consent gesetzt? (Muss: Nein)
- [ ] Werden statische Assets lokal ausgeliefert? (Muss: Ja)

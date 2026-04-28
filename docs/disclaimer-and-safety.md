# Disclaimer And Safety

Diese Datei ergänzt die technische Dokumentation um klare Sicherheits- und Haftungshinweise.

## Kein Rechtsrat

`agentum` und diese Dokumentation stellen keine Rechtsberatung dar.

Wenn du rechtliche Anforderungen hast (Datenschutz, Compliance, Lizenzpflichten, regulatorische Vorgaben), musst du diese separat prüfen lassen.

## Keine Garantie

Das Tool wird ohne Garantie bereitgestellt.

Das gilt insbesondere für:

- Vollständigkeit der Analyse
- Korrektheit aller Refactoring-Empfehlungen
- Kompatibilität mit jeder Legacy-Codebasis
- Eignung für einen bestimmten Produktionszweck

## Verantwortung beim Einsatz

Du bleibst verantwortlich für:

- Code-Reviews
- Sicherheitstests
- Last- und Integrationstests
- Deployments in Produktion
- Freigaben und Rollback-Strategien

## Sicherheitsempfehlungen vor Änderungen

Vor jedem `retrofit-apply`:

1. In einem eigenen Branch arbeiten
2. Plan-Dateien lesen
3. `manualReviewItems` abarbeiten
4. Bei kritischen Systemen Backup/Snapshot erstellen

## Sicherheitsempfehlungen nach Änderungen

Nach Änderungen:

1. Projekt-spezifische Tests ausführen
2. Security-relevante Flows manuell prüfen
3. `doctor` ausführen
4. Erst danach deployen

## Besonders sensible Bereiche

In diesen Bereichen ist zusätzliche Sorgfalt Pflicht:

- Authentifizierung und Session-Logik
- Zugriff auf personenbezogene Daten
- Zahlungs- und Abrechnungssysteme
- produktive CI/CD-Pipelines
- externe API-Schlüssel und Secrets

## Secrets und Zugangsdaten

- nie Secrets in Git committen
- `.env.example` nur mit Platzhaltern versionieren
- produktive Schlüssel nur in sicheren Secret-Stores halten

## Öffentliche Repositories

Wenn das Repo öffentlich ist:

- gehe davon aus, dass alles dauerhaft sichtbar ist
- prüfe Lizenz-, Security- und Konfigurationsdateien besonders gründlich
- veröffentliche keine internen URLs, Tokens oder personenbezogenen Daten

## Empfehlung für Teams

Lege vor dem ersten Einsatz einen Team-Standard fest:

- wann `retrofit-apply` erlaubt ist
- wer `manualReviewItems` freigibt
- welche Tests mindestens grün sein müssen
- wann ein Security-Review verpflichtend ist

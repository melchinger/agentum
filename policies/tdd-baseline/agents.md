# TDD Baseline Policy

Wende TDD bei jeder Logik-Implementierung zwingend an.

## 1. Workflow (Red-Green-Refactor)
* Schreibe zuerst den fehlschlagenden Test, der das geforderte Verhalten definiert.
* Generiere erst danach den minimalen Code, um den Test zu bestehen.
* Refaktorisiere anschließend den Code nach Performance- und Clean-Code-Standards.

## 2. Test-Ebenen
* **Unit-Tests:** Für Geschäftslogik, Helper und isolierte Komponenten (z. B. Vitest, Jest, PyTest). Mocks für externe Abhängigkeiten verwenden.
* **Integration-Tests:** Für API-Endpunkte und Datenbankabfragen.
* **E2E-Tests:** Nur für kritische User-Journeys (z. B. via Playwright).

## 3. Test-Qualität
* Jeder Test prüft exakt ein Konzept.
* Keine magischen Zahlen oder unklaren Mock-Daten. Aussagekräftige Fixtures nutzen.
* Benennung nach dem Muster: `should [expected behavior] when [state/input]`.

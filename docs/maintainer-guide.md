# Maintainer Guide

## Dokumentation für Public Repos

- `README.md` muss den sicheren Standard-Flow und den korrekten WordPress-Variant-Namen enthalten.
- `docs/usage-guide.md` ist die ausführliche Anleitung für Endanwender.
- `docs/quick-reference.md` ist die kurze Copy/Paste-Einstiegsseite.
- `docs/disclaimer-and-safety.md` enthält Sicherheits- und Haftungshinweise und darf bei Public-Releases nicht fehlen.

## Architektur

- `templates/base/` enthält alle gemeinsamen Dateien und Basisregeln.
- `variants/<name>/variant.json` beschreibt eine Variante maschinenlesbar.
- `variants/<name>/agents.md` enthält nur den stack-spezifischen Instruktions-Overlay.
- `variants/<name>/files/` enthält zusätzliche Dateien für das Ziel-Repository.

## Erweiterung einer neuen Variante

1. Neues Verzeichnis `variants/<name>/` anlegen.
2. `variant.json` mit Beschreibung, Kommandos, Verzeichnissen und Pflichtdateien ergänzen.
3. `agents.md` für stack-spezifische Regeln hinzufügen.
4. Unter `files/` nur echte Abweichungen vom Basis-Template ablegen.
5. Tests für `list-variants`, `new`, `apply` und `doctor` ergänzen.

## Pflege-Regeln

- Änderungen an gemeinsamen Regeln nur in `templates/base/agents/base.md`.
- Spiegeldateien niemals direkt pflegen; sie werden aus `AGENTS.md` abgeleitet.
- Wenn ein Variant-Manifest neue Dateipfade referenziert, müssen sie auch im Dateisystem existieren.
- Generator-Optionen immer erst in `templates/manifest.json` modellieren und danach im CLI auswerten.
- Für Bestandsrepos zuerst den Analysepfad pflegen: `scan`, `retrofit-plan`, `retrofit-apply`, `refactor-plan`.
- Bei Änderungen am UX-Flow immer auch `README.md`, `docs/usage-guide.md` und `docs/quick-reference.md` gemeinsam aktualisieren.

# Best Practices Referenz

Diese Datei ist ein Maintainer-Hintergrunddokument und nicht Teil der generierten Laufzeit-Instruktionen.

## Kernaussagen

- Agenten brauchen persistente Regeln für Architektur, Sicherheit, Testen und operative Grenzen.
- Eine zentrale `AGENTS.md` reduziert Wiederholungen und verhindert Drift zwischen Tools.
- Projektstrukturen sollten getrennte Verantwortlichkeiten vorgeben.
- Sicherheitsregeln, A11y und Review-Checklisten müssen Standard sein.
- Gemeinsame Regeln gehören in Basis-Templates, stack-spezifische Regeln in Overlays.

## Abgeleitete Designprinzipien für Agentum

- Basisregeln einmal definieren, danach per Overlay verfeinern.
- Generatorlogik datengetrieben halten.
- Katalogeinträge klein und klar halten.
- Templates professionell und minimal halten statt vollständige Produkte zu generieren.
- Doku für Menschen und Instruktionen für Agenten getrennt pflegen.

## Praktische Folgerungen

- Bei neuen Stacks zuerst prüfen, ob ein Manifest reicht.
- Neue Generatorlogik nur dann einführen, wenn Datenmodell und Regeln nicht ausreichen.
- Legacy-Varianten und Composition-Modell bewusst getrennt halten, solange beide unterstützt werden.
- Jede neue Runtime, jedes Modul und jedes Profile braucht Tests und valide Doku.
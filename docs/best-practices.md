# Best Practices Referenz

Diese Datei übernimmt die frühere Langreferenz als Hintergrunddokument für Maintainer. Sie ist bewusst **nicht** Teil der generierten Laufzeit-Instruktionen.

## Kernaussagen

- Agenten brauchen persistente Regeln für Architektur, Sicherheit, Testen und operative Grenzen.
- Eine zentrale `AGENTS.md` reduziert Wiederholungen und verhindert Drift zwischen Tools.
- Für skalierbare Ergebnisse sollte die Projektstruktur strikt getrennte Verantwortlichkeiten vorgeben.
- Sicherheitsregeln, A11y und Review-Checklisten müssen Standard sein und nicht erst nachträglich ergänzt werden.
- Varianten sollten gemeinsame Regeln erben und nur stack-spezifische Ergänzungen hinzufügen.

## Abgeleitete Designprinzipien für dieses Repository

- Basisregeln einmal definieren, danach per Overlay verfeinern.
- Den Generator datengetrieben aufbauen.
- Templates klein halten und professionalisieren statt komplette App-Generatoren nachzubauen.
- Dokumentation für Menschen und Instruktionen für Agenten getrennt pflegen.

## Historie

Die frühere Datei `KI-Agenten für Web-Apps_ Best Practices.md` wurde in dieses kompaktere Referenzdokument überführt. Falls tiefere Hintergrundtexte benötigt werden, können sie später unter `docs/research/` ergänzt werden.

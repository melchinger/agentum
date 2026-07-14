# Documentation Baseline Policy

Code muss selbsterklärend sein. Dokumentation erklärt das "Warum", nicht das "Was".

## 1. Inline-Kommentare
* Verboten für triviale Logik.
* Zwingend für komplexe Algorithmen, Workarounds oder unkonventionelle Performance-Hacks.

## 2. Strukturierte Code-Dokumentation
* Öffentliche Klassen, Schnittstellen und Funktionen benötigen zwingend strukturierte Docstrings (JSDoc, PEP 257, PHPDoc, Rustdoc).
* Parameter, Rückgabewerte und mögliche Exceptions müssen typisiert und beschrieben sein.

## 3. API & Architektur
* APIs müssen maschinenlesbar dokumentiert werden (OpenAPI/Swagger, GraphQL-Schema).
* Signifikante Systemänderungen erfordern einen Architecture Decision Record (ADR) im `docs/`-Verzeichnis.

## 4. Struktur
* Jedes isolierte Modul benötigt eine eigene `README.md` mit minimalen Verwendungsbeisp

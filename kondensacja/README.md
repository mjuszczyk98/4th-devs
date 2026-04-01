# Kondensacja — destylowana wiedza z kursu AI Devs

## Struktura

```
kondensacja/
├── README.md                    ← ten plik
├── s01e01.md .. s01e05.md       ← Tydzień 1: lekcje (szczegółowe)
├── s02e01.md .. s02e05.md       ← Tydzień 2: lekcje (szczegółowe)
├── s03e01.md .. s03e05.md       ← Tydzień 3: lekcje (szczegółowe)
├── s04e01.md .. s04e02.md       ← Tydzień 4: lekcje (dotychczasowe)
├── t01-konsolidacja.md          ← Tydzień 1: konsolidacja tematyczna
├── t02-konsolidacja.md          ← Tydzień 2: konsolidacja tematyczna
├── t03-konsolidacja.md          ← Tydzień 3: konsolidacja tematyczna
└── t04-konsolidacja.md          ← Tydzień 4: konsolidacja tematyczna
```

## Filozofia

- **Destylacja, nie streszczenie** — koncepty, nie przepisywanie
- **Pliki lekcji (`s0Xe0Y.md`)** — niezmienne po utworzeniu, źródło prawdy per lekcja
- **Konsolidacje (`t0X-konsolidacja.md`)** — reorganizacja tematyczna z deduplikacją między lekcjami
- **Nowe lekcje dodawane inkrementalnie** — konsolidacja aktualizowana gdy cały tydzień jest kompletny

## Spis treści kursu

### Tydzień 1: Fundamenty interakcji z LLM → [t01-konsolidacja.md](t01-konsolidacja.md)

| Lekcja | Temat | Plik |
|--------|-------|------|
| e01 | Programowanie interakcji z modelem językowym | s01e01.md |
| e02 | Techniki łączenia modelu z narzędziami | s01e02.md |
| e03 | Projektowanie API dla efektywnej pracy z modelem | s01e03.md |
| e04 | Wsparcie multimodalności oraz załączników | s01e04.md |
| e05 | Zarządzanie jawnymi oraz niejawnymi limitami modeli | s01e05.md |

### Tydzień 2: Kontekst, pamięć i projektowanie agentów → [t02-konsolidacja.md](t02-konsolidacja.md)

| Lekcja | Temat | Plik |
|--------|-------|------|
| e01 | Zarządzanie kontekstem w konwersacji | s02e01.md |
| e02 | Zewnętrzny kontekst narzędzi i dokumentów | s02e02.md |
| e03 | Dokumenty oraz pamięć długoterminowa jako narzędzia | s02e03.md |
| e04 | Organizowanie kontekstu dla wielu wątków | s02e04.md |
| e05 | Projektowanie agentów | s02e05.md |

### Tydzień 3: Obserwacja, ewaluacja i narzędzia → [t03-konsolidacja.md](t03-konsolidacja.md)

| Lekcja | Temat | Plik |
|--------|-------|------|
| e01 | Obserwowanie i ewaluacja | s03e01.md |
| e02 | Ograniczenia modeli na etapie założeń projektu | s03e02.md |
| e03 | Kontekstowy feedback wspierający skuteczność agentów | s03e03.md |
| e04 | Budowanie narzędzi na podstawie danych testowych | s03e04.md |
| e05 | Niedeterministyczna natura modeli jako przewaga | s03e05.md |

### Tydzień 4: Wdrożenia i współpraca z AI → [t04-konsolidacja.md](t04-konsolidacja.md)

| Lekcja | Temat | Plik |
|--------|-------|------|
| e01 | Wdrożenia rozwiązań AI | s04e01.md |
| e02 | Aktywna współpraca z AI | s04e02.md |

### Tydzień 5: (nadchodzący)

---

## Aktualizacja (inkrementalna)

Gdy pojawi się nowa lekcja:
1. Utwórz `s0Xe0Y.md` (subagent analizuje lekcję + przykłady)
2. Gdy cały tydzień kompletny — zaktualizuj `t0X-konsolidacja.md`
3. Zaktualizuj ten README (dodaj lekcję do tabeli, odznacz tydzień jako kompletny)

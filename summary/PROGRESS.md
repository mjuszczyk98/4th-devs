# PROGRESS — Baza wiedzy AI Devs

## Zadanie

Stworzyć finalną bazę wiedzy z kursu AI Devs na podstawie dwóch istniejących źródeł destylacji:
- `../analiza/S0XE0Y.md` — notatki stylu 1
- `../kondensacja/s0XeY.md` — notatki stylu 2

Dla każdej z 25 lekcji (s01e01 — s05e05) powstaje:
1. **`summary/s0XeY.md`** — finalna, zsyntetyzowana notatka (destylacja, nie streszczenie, nie konkatenacja źródeł)
2. **`summary/concepts/_raw/s0XeY.md`** — per-lekcja lista konceptów wyodrębnionych przez agenta

Po każdym batchu 3 lekcji główny wątek konsoliduje koncepty do `summary/concepts/_working.md` — zbiorczego pliku roboczego, który agenci z kolejnych batchów czytają **przed** wyodrębnieniem swoich konceptów (żeby spójnie nazywać rzeczy i dopisywać do istniejących wiader zamiast duplikować).

Finalny krok (po wszystkich 25 lekcjach): decyzja z użytkownikiem czy rozbić `_working.md` na osobne pliki per-koncept czy zostawić jako 1 plik.

## Zasady notatek (wspólne dla wszystkich agentów)

- **Destylacja, nie streszczenie** — każde zdanie wnosi wartość
- **Synteza, nie konkatenacja** — oba źródła omawiają te same koncepty; wybierz lepsze framowanie, połącz unikalne szczegóły. Rezultat: krótszy lub porównywalny długościowo do dłuższego ze źródeł, NIE sumą
- Struktura: (1) koncepty pogrupowane tematycznie, (2) przykłady kodu na końcu — każdy = delta względem poprzedniego
- Język precyzyjny, techniczny, bezpośredni. Bez wstępów, podsumowań, fraz typu "warto zauważyć"
- Snippety kodu tylko gdy pokazują coś czego nie da się opisać słowami. Max kilka linii
- Tabele dla >2 opcji
- Mermaid/XML OK jako dodatek, nie jedyna forma
- Pomiń informacje o zadaniu z lekcji
- Czytelność dla człowieka (to baza wiedzy na lata)

## Zasady wyodrębniania konceptów

- Wybierać **ważne, rozbudowywalne elementy wiedzy** — takie które pojawią się w wielu lekcjach
- Nazwy zwięzłe, kategoryzujące (żeby inne lekcje dopisywały do tego samego wiadra)
- Pomijać trywialne (czym jest token, czym jest LLM) i skrajne detale (konkretne nazwy parametrów API)
- W opisie skupiać się na tym CO o koncepcie mówi konkretna lekcja
- Przed wyodrębnieniem (od batch 2) agent czyta `concepts/_working.md` i używa istniejących nazw dla zbieżnych tematów

## Plan batchy (max 3 agenty równolegle)

| Batch | Lekcje | Status |
|-------|--------|--------|
| 1 | s01e01, s01e02, s01e03 | ✅ done |
| 2 | s01e04, s01e05, s02e01 | ✅ done |
| 3 | s02e02, s02e03, s02e04 | ✅ done |
| 4 | s02e05, s03e01, s03e02 | ✅ done |
| 5 | s03e03, s03e04, s03e05 | ✅ done |
| 6 | s04e01, s04e02, s04e03 | ✅ done |
| 7 | s04e04, s04e05, s05e01 | ✅ done |
| 8 | s05e02, s05e03, s05e04 | ✅ done |
| 9 | s05e05 | ✅ done |
| finał | konsolidacja konceptów | ✅ done |

## Stan

- **Ukończone summaries**: s01e01–s01e05, s02e01–s02e05, s03e01–s03e05, s04e01–s04e05, s05e01–s05e05 (ALL)
- **Ukończone concepts/_raw**: s01e01–s01e05, s02e01–s02e05, s03e01–s03e05, s04e01–s04e05, s05e01–s05e05 (ALL)
- **concepts/_working.md**: zaktualizowany po batchu 9 (wszystkie 25 lekcji)
- **Następny krok**: projekt zakończony

## Struktura plików

```
summary/
├── PROGRESS.md              ← ten plik
├── s01e01.md .. s05e05.md   ← finalne notatki lekcji (25 plików)
└── concepts/
    ├── _working.md          ← zbiorcza lista konceptów (roboczy)
    └── _raw/
        └── s0XeY.md         ← per-lekcja koncepty (input do konsolidacji)
```

## Prompt subagenta (szablon)

Każdy agent dostaje taki prompt (z podmienionym `{LESSON}`):

```
Jesteś częścią pipeline'u budującego bazę wiedzy z kursu AI Devs. Twoim zadaniem jest
stworzenie finalnej notatki dla JEDNEJ lekcji ({LESSON}) na podstawie dwóch źródeł, oraz
wyodrębnienie konceptów z tej lekcji do osobnego pliku.

## Kontekst
Lekcje są w dwóch folderach, każdy z inną wersją destylacji tej samej lekcji:
- C:\Users\mcjus\_repos\4th-devs\analiza\{LESSON_UPPER}.md
- C:\Users\mcjus\_repos\4th-devs\kondensacja\{LESSON_LOWER}.md

Oba pliki SĄ JUŻ zdestylowane — różnymi stylami. Nie są surowymi transkryptami.
Twoim zadaniem jest PRZECZYTAĆ oba, zsyntetyzować, i stworzyć JEDNĄ finalną notatkę,
która bierze najlepsze framowanie i nie-zduplikowane szczegóły z obu.

## (Batch 2+) Przed wyodrębnieniem konceptów przeczytaj:
C:\Users\mcjus\_repos\4th-devs\summary\concepts\_working.md
— to zbiorcza lista z poprzednich lekcji. Jeśli Twoja lekcja porusza ten sam koncept
(nawet pod inną nazwą w źródłach), użyj nazwy z _working.md dla spójności.
Nowe koncepty dodawaj swobodnie.

## Output 1: notatka lekcji
Ścieżka: C:\Users\mcjus\_repos\4th-devs\summary\{LESSON_LOWER}.md

Zasady:
- Destylacja, nie streszczenie — każde zdanie wnosi wartość
- Synteza, nie konkatenacja — wybierz lepsze framowanie, połącz unikalne szczegóły
- Struktura: (1) koncepty pogrupowane tematycznie, (2) przykłady kodu na końcu,
  każdy = delta względem poprzedniego
- Język precyzyjny, techniczny, bezpośredni. Bez wstępów/podsumowań/fraz typu "warto zauważyć"
- Snippety tylko gdy pokazują coś nie-opisywalnego słowami (max kilka linii, w code fence)
- Tabele dla >2 opcji
- Mermaid/XML OK jako dodatek, nigdy jedyna forma
- Bez informacji o zadaniach z lekcji
- Bez powielania konceptów między sekcjami
- Nie opisuj "co kod robi" zamiast "czego uczy"
- Czytelność dla człowieka (baza wiedzy na lata)

## Output 2: plik konceptów (per-lekcja, roboczy)
Ścieżka: C:\Users\mcjus\_repos\4th-devs\summary\concepts\_raw\{LESSON_LOWER}.md

Format:
# {LESSON_LOWER} — koncepty

## [Nazwa konceptu]
Krótki opis (1-3 zdania) — jak ten konkretny koncept pojawia się w tej lekcji.

## [Kolejny koncept]
...

Zasady:
- Ważne, rozbudowywalne elementy wiedzy (pojawią się w wielu lekcjach)
- Przykłady dobrych: MCP, Structured Outputs, Tool Calling, Memory Management, RAG,
  Chunking, Embeddings, Prompt Caching, Multimodalność, Ewaluacja, Observability,
  Context Engineering, Agent Design Patterns, Few-shot, Vector Search
- Pomiń trywialne (czym jest token, LLM) i skrajne detale (konkretne nazwy parametrów API)
- Nazwy zwięzłe i kategoryzujące
- Opis skoncentrowany na TYM CO mówi ta lekcja o koncepcie

## Raport końcowy
Maksymalnie 100 słów: lista konceptów + jednozdaniowe info o rozbieżnościach/
komplementarności źródeł.
```

# VERIFY — Weryfikacja bazy wiedzy AI Devs

## Cel

Zweryfikować kompletność i jakość destylacji 25 lekcji kursu AI Devs (s01e01–s05e05) przez porównanie trzech źródeł danych z wyprodukowanymi notatkami i konceptami. Identyfikować braki — nie duplikaty. **Dodawać, nie usuwać.** Zachować umiar — nie pompować sztucznie.

## Kontekst projektu

Z 25 lekcji kursu powstały:
1. **Notatki lekcji**: `summary/s01e01.md` – `summary/s05e05.md` — zsyntetyzowane destylacje
2. **Koncepty per-lekcja**: `summary/concepts/_raw/s01e01.md` – `s05e05.md`
3. **Koncepty zbiorcze**: `summary/concepts/_working.md` — jeden plik ze wszystkimi konceptami
4. **Koncepty tematyczne**: 8 plików w `summary/concepts/` (architecture.md, context-memory.md, tools-design.md, prompting.md, security-deployment.md, evaluation-observability.md, frontend-streaming.md, product-strategy.md) — podział _working.md na grupy

## Trzy źródła danych (do porównania)

Dla każdej lekcji `{LESSON}` (np. s01e01) istnieją trzy źródła:

| Źródło | Ścieżka | Opis |
|--------|---------|------|
| **Analiza** | `C:\Users\mcjus\_repos\4th-devs\analiza\{LESSON_UPPER}.md` | Destylacja stylu 1 (uppercase, np. S01E01.md) |
| **Kondensacja** | `C:\Users\mcjus\_repos\4th-devs\kondensacja\{LESSON}.md` | Destylacja stylu 2 (lowercase, np. s01e01.md) |
| **Oryginał** | `C:\Users\mcjus\_repos\ai_devs\lekcje\s0Xe0Y-*.md` | Pełna lekcja z kursu (surowy materiał) |

**Ważne — oryginały**: Pliki lekcji mają spójną strukturę. POMIJAMY całkowicie:
- **YAML frontmatter** (`---` na początku) — metadane lekcji
- **`## Film do lekcji`** — link do Vimeo
- **`## Fabuła`** — element fabularny kursu
- **`## Transkrypcja filmu z Fabułą`** — transkrypcja fabuły
- **`## Zadanie praktyczne`** i wszystko po nim do końca pliku — zadania zaliczeniowe
- **Obrazki/URL-e** (`![](...)`, `https://...`) — wizualizacje, nie treść merytoryczna
- **Wzmianki o przykładach kodu** typu "przykład 05_04_ui" — referencje do repo, nie koncepty

Treść merytoryczna zaczyna się po `## Film do lekcji` i trwa do `## Fabuła` lub `## Zadanie praktyczne` (cokolwiek wystąpi pierwsze). Pomiędzy tymi znacznikami znajdują się nagłówki `## ...` z właściwym materiałem — to jest to, co weryfikujemy.

## Proces weryfikacji (per lekcja)

Dla KAŻDEJ z 25 lekcji wykonaj następujące kroki:

### Krok 1: Przeczytaj wszystkie 3 źródła + wyprodukowane notatki

1. Przeczytaj oryginalną lekcję (POMIŃ sekcję zadań zaliczeniowych — wszystko od `## Zadanie praktyczne` do końca pliku)
2. Przeczytaj analizę (`analiza/S0XE0Y.md`)
3. Przeczytaj kondensację (`kondensacja/s0XeY.md`)
4. Przeczytaj wyprodukowaną notatkę (`summary/s0XeY.md`)
5. Przeczytaj wyprodukowane koncepty (`summary/concepts/_raw/s0XeY.md`)

### Krok 2: Weryfikacja notatki (summary/s0XeY.md)

Porównaj treść notatki z trzema źródłami. Odpowiedz na pytania:

**a) Kompletność faktów**: Czy w notatce są wszystkie kluczowe koncepcje techniczne, wzorce projektowe, architektoniczne decyzje i praktyczne wnioski obecne w źródłach? W szczególności sprawdź czy oryginał zawiera koncepcje nieobecne w analizie ani kondensacji (bo to oznaczałoby że zostały utracone na etapie destylacji).

**b) Braki krytyczne**: Czy jest coś w źródłach co jest istotną, rozbudowywalną wiedzą a nie znalazło się w notatce? Odróżnij:
- Wiedzę koncepcyjną (wzorce, zasady, architektury) — **MUSI być** w notatce
- Przykłady implementacyjne — powinny być gdy ilustrują nową koncepcję
- Detale specyficzne dla platformy/API — opcjonalne, zależnie od ważności
- Opisy zadań z lekcji — **POMIJAMY**

**c) Jakość syntezy**: Czy notatka jest synteza obu źródeł, czy przypadkiem blisko się do jednego z nich? Czy oba źródła zostały wykorzystane?

### Krok 3: Weryfikacja konceptów (concepts/_raw/s0XeY.md)

Porównaj listę konceptów z treścią trzech źródeł. Odpowiedz:

**a) Kompletność**: Czy każdy ważny, rozbudowywalny element wiedzy z lekcji ma swój koncept? Sprawdź w szczególności oryginał — czy są tam tematy nieobecne w analizie/kondensacji które zasługują na koncept.

**b) Jakość nazw**: Czy nazwy konceptów są zwięzłe, kategoryzujące i spójne z `_working.md`?

**c) Brak trywialiów**: Czy nie ma konceptów opisujących trywialne informacje (czym jest token, czym jest LLM)?

### Krok 4: Raport

Dla każdej lekcji wyprodukuj raport w formacie:

```
## {LESSON}
### Notatka: [OK / BRAKI]
- [lista braków jeśli istnieją, z wskazaniem źródła (oryginał/analiza/kondensacja)]
### Koncepty: [OK / BRAKI]
- [lista brakujących konceptów z propozycją nazwy i opisu]
### Uwagi: [wolne pole]
```

## Proces weryfikacji (globalny)

Po weryfikacji per-lekcja:

### Krok 5: Weryfikacja _working.md

1. Przeczytaj `summary/concepts/_working.md`
2. Sprawdź czy każdy koncept z plików `_raw/` ma odpowiadający mu wpis w `_working.md`
3. Sprawdź czy tagi lekcji ( `- **sXXeYY**` ) w `_working.md` pokrywają się z treścią `_raw/` — czy lekcja jest oznaczona tam gdzie jej treść rzeczywiście rozszerza dany koncept

### Krok 6: Weryfikacja plików tematycznych

1. Sprawdź czy suma konceptów w 8 plikach tematycznych = suma konceptów w `_working.md` (obecnie 170)
2. Sprawdź czy żaden koncept z `_working.md` nie został pominięty w podziale

## Zasady dodawania (gdy znajdziesz braki)

1. **Notatki**: Jeśli w notatce brakuje kluczowej informacji z oryginału/źródeł — dodaj ją w odpowiednim miejscu tematycznym, zachowując styl istniejącej notatki
2. **Koncepty _raw/**: Jeśli brakuje konceptu — dodaj nową sekcję `## [Nazwa]` z opisem
3. **Koncepty _working.md**: Jeśli brakuje konceptu — dodaj nową sekcję. Jeśli lekcja rozszerza istniejący koncept — dodaj tag `- **sXXeYY**` z opisem
4. **Koncepty tematyczne**: Jeśli _working.md się zmienił — zaktualizuj odpowiedni plik tematyczny

## Kryteria "czy to jest brak"

Odróżnij prawdziwy brak od świadomej decyzji odestylowania:

- **Prawdziwy brak**: ważny wzorzec, zasada, mechanizm architektoniczny obecny w oryginale/źródłach, nieobecny w notatce ani konceptach, i niebędący trywialnym / zadaniam / detalem API
- **Świadoma destylacja**: konkretny snippet kodu, nazwa biblioteki, URL, szczegóły konfiguracyjne — te mogą być pominięte
- **Szary obszar**: gdy nie jesteś pewien — ZAZNACZ w raporcie jako "być może brak" z uzasadnieniem

## Ograniczenia

- **Nie usuwaj** żadnej treści z istniejących plików — tylko dodawaj
- **Nie restrukturyzuj** notatek — dodaj informację na końcu odpowiedniej sekcji tematycznej
- **Nie pompuj sztucznie** — jeśli informacja jest marginesowa lub trywialna, nie dodawaj jej
- **Pomiń zadania zaliczeniowe** z oryginalnych lekcji — to jest krytyczne
- **Maksymalnie 3 nowe koncepty** per lekcja — jeśli widzisz więcej, raportuj je ale dodaj tylko te 3 najważniejsze; resztę opisz w raporcie jako "dodatkowe do rozważenia"

## Kolejność pracy

1. Zacznij od s01e01, idź sekwencyjnie do s05e05
2. Per lekcja: czytaj 3 źródła → porównaj z wyprodukowanym → raportuj → ew. dodaj
3. Po ukończeniu wszystkich 25: Krok 5 (weryfikacja _working.md) + Krok 6 (pliki tematyczne)
4. Na końcu: globalny raport podsumowujący z statystykami (ile braków znaleziono, ile dodano, ile konceptów nowych)

## Raport końcowy

Po zakończeniu weryfikacji wyprodukuj raport z:

1. **Statystyki**: ile lekcji sprawdzone, ile braków w notatkach, ile braków w konceptach, ile nowych konceptów dodanych
2. **Lista wszystkich zmian**: co dokładnie zostało dodane i gdzie (ścieżka pliku + opis zmiany)
3. **Uwagi globalne**: ewentualne problemy ze spójnością nazewnictwa konceptów, podwójne koncepty, niespójności między _working.md a plikami tematycznymi
4. **Rekomendacje**: czy coś wymaga ręcznej uwagi użytkownika

## Struktura plików (referencja)

```
C:\Users\mcjus\_repos\4th-devs\
├── analiza\                              # Źródło 1 (S0XE0Y.md)
├── kondensacja\                          # Źródło 2 (s0XeY.md)
└── summary\
    ├── s01e01.md .. s05e05.md            # Notatki do weryfikacji
    └── concepts/
        ├── _working.md                   # Zbiorcze koncepty (170)
        ├── architecture.md               # Tematyczna grupa 1
        ├── context-memory.md             # Tematyczna grupa 2
        ├── tools-design.md               # Tematyczna grupa 3
        ├── prompting.md                  # Tematyczna grupa 4
        ├── security-deployment.md        # Tematyczna grupa 5
        ├── evaluation-observability.md   # Tematyczna grupa 6
        ├── frontend-streaming.md         # Tematyczna grupa 7
        ├── product-strategy.md           # Tematyczna grupa 8
        └── _raw/
            └── s01e01.md .. s05e05.md    # Per-lekcja koncepty

C:\Users\mcjus\_repos\ai_devs\lekcje\     # Źródło 3 (oryginały lekcji)
```

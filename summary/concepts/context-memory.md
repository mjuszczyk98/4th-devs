# Kontekst, Pamięć i Systemy Wiedzy
> Koncepty związane z zarządzaniem kontekstem, pamięcią agenta, bazami wiedzy, RAG i wyszukiwaniem.

---

## Context Engineering
Sterowanie zachowaniem modelu = zarządzanie kontekstem. Dwa znaczenia: (1) poziom użytkownika — praca z narzędziami typu Claude Code/Cursor, (2) poziom aplikacji — kontrola interakcji, narzędzi, komunikacji między agentami. Kurs skupia się na (2). Obejmuje routing kontekstu, kompozycję promptów, kaskadowe zapytania, zarządzanie pamięcią, dobór informacji do okna. Sygnał vs szum = wypadkowa jakości danych, logiki aplikacji, dynamicznych komponentów promptu, generycznych mechanizmów (kompresja/planowanie/monitorowanie) i przestrzeni na interwencję człowieka. Zarządzanie oknem w agentach długożyciowych: jawne limity (input+output), middle-cut truncation, turn dropping, LLM summarization usuniętych tur.
- **s01e01** — fundament: API bezstanowe, routing kontekstu przez kaskadowe zapytania
- **s01e02** — dwa znaczenia terminu, system plików jako pamięć, kontrola okna kontekstowego
- **s01e05** — zarządzanie oknem w agentach długożyciowych, 3-etapowa strategia kompresji, konfiguracja per-model
- **s02e01** — sygnał vs szum jako wypadkowa detali systemu, balans kod vs AI w workflow→agent→multi-agent
- **s02e02** — instruction dropout od zewnętrznych danych, subagenci jako dekompozycja, RAG jako źródło przeładowania
- **s02e04** — konflikty współbieżne w multi-agent, degradacja komunikacji, pięć strategii konfliktów, zasada najprostszego systemu
- **s03e02** — izolacja kontekstu (scoped access), fazowa kontrola widoczności danych, runtime mutex z `try/finally`, AI nie może eskalować uprawnień
- **s03e03** — pasywne odkrywanie otoczenia (metadane wstrzykiwane programistycznie), `<metadata>` doklejany do wiadomości, scope'owanie do potrzeb, content overflow zapisywany do pliku
- **s03e04** — kontrola szczegółowości przez parametr `details` jako mechanizm zarządzania oknem, domyślnie compact metadata
- **s03e05** — temporal grounding (metadane czasowe wstrzykiwane w każdą wiadomość), nudge w metadanych zachęcający do aktywności, cache-safe bo system prompt stabilny
- **s04e01** — server-side kontekst przez `previous_response_id` w OpenAI Responses API — referencja zamiast re-sendu pełnej historii, redukcja zużycia tokenów z liniowego do stałego per tura
- **s04e04** — self-sufficient notes jako zasada jakości kontekstu, cztery typy luk (niejawne referencje, nierozpoznawalne linki, nadpisane wersje, brak powtórzeń), scatter/gather: wyniki do plików, czytanie tylko potrzebnych fragmentów
- **s05e01** — czterowarstwowa kompozycja promptu aktora: prompt prefix, task memory (sealed), task snapshot (pełny stan sesji), raw items od lastObservedSeq. Actor nie zarządza kontekstem — scheduler wstrzykuje snapshot
- **s05e03** — rolling memory z proaktywną kompakcją przez tańszy model, dwa progi wyzwalania (liczba wiadomości + długość tekstowa), zachowanie K ostatnich wiadomości, reszta kompresowana do summary, dwumodelowa architektura: główny (reasoning) + memory (tani, streszczanie)

## Prompt Caching
Natywny mechanizm providerów redukujący koszt i latencję przy powtarzających się prefiksach promptów. Stabilny system prompt + stabilny początek wątku = automatyczny cache u OpenAI/Gemini. Dynamiczne dane (data, godzina) w system prompcie niszczą cache — wprowadzaj je przez wyniki narzędzi na końcu wątku. Dodatkowo aplikacyjny caching wyników etapów pipeline'u przez hashe inputu. Definicje narzędzi siedzą pod system promptem — każda zmiana promptu invaliduje cache narzędzi.
- **s01e01** — cache natywny jako krytyczny dla skali + aplikacyjny caching etapów
- **s01e02** — implikacje dla stabilności system promptu
- **s02e01** — dynamiczne dane w wiadomościach usera oddzielone tagami XML, starsze metadane odświeżane przez narzędzia
- **s02e03** — Observational Memory jako architektoniczny killer feature: append-only → pełny cache hit, kontrast z grafowym RAG generującym nowy kontekst per zapytanie
- **s05e01** — SHA-256 z `session_id:task_id:actor_id` jako `prompt_cache_key` w Responses API, stabilny klucz per task-actor, cache hit rate raportowany w podsumowaniu

## Observational Memory
Architektura pamięci długoterminowej oparta na kompresji tekstu, nie wyszukiwaniu. Dwa agenty: Observer (kompresuje po 30k tokenów raw) i Reflector (garbage collection po 40k–60k tokenów obserwacji). Obserwacje z temporal model (trzy daty) i priorytetyzacją. ~95% LongMemEval bez wektorów/grafów. Filozofia: "Text is the universal interface". Natywne wykorzystanie prompt caching (append-only, full cache hit).
- **s02e03** — Observer/Reflector, temporal model, ~95% LongMemEval, append-only cache
- **s02e05** — trójpoziomowa kompresja (user nigdy usuwane, assistant kondensowane pierwsze), head/tail split z ochroną koherencji, generation count śledzi stratę
- **s03e02** — per-agent-session nie globalnie, komunikacja między agentami przez filesystem, progresywna kompresja z priorytetyzacją 🔴/🟡/🟢
- **s03e05** — workspace jako pamięć kognitywna z trzema kategoriami: epizodyczna (snapshoty interakcji), faktyczna (trwałe fakty), proceduralna (wyuczone reguły), plus warstwa tożsamości (`profile/`) i `system/index.md` jako mapa nawigacyjna
- **s05e01** — per-task-thread kompresja dwufazowa: Observer (raw items → split head/tail ~30% chronione → LLM → obserwacje XML z priorytetami 🔴🟡🟢), Reflector (gentle→aggressive→heavy gdy przekroczony threshold), generation counter śledzi stratę

## Chunking
Strategie podziału dokumentów na przeszukiwalne fragmenty: znaki (stałe okno), separatory (rekurencyjna hierarchia), kontekst (separatory + LLM prefix), tematy (LLM dzieli od podstaw). Tradeoff jakości/metadanych/kosztu API. Rekurencyjny podział z hierarchią separatorów (nagłówki → akapity → zdania), ~4000 znaków, ~500 overlap, automatyczna detekcja sekcji z nagłówków markdown.
- **s02e02** — cztery strategie, tabelaryczne porównanie, heading index, resilient JSON parsing
- **s02e03** — rekursywny podział z konkretnymi parametrami (4000 zn, 500 overlap), zbalansowany punkt wyjścia

## Embeddings
Model embeddingowy zamienia tekst na wektor liczb opisujący znaczenie. Wybór modelu: wielkość, wymiary, okno kontekstowe, dane treningowe. Ograniczenie: terminy spoza treningu (żargon, nazwy wewnętrzne). Relevant ≠ Similar — podobieństwo wektorowe nie oznacza istotności, co uzasadnia hybrydę z FTS.
- **s02e02** — wektory znaczeniowe, cosine similarity, ograniczenia modeli, relevant vs similar

## Hybrid Search
Łączenie FTS5 (BM25, leksykalny) i wyszukiwania wektorowego (cosine, semantyczny) przez Reciprocal Rank Fusion. RRF: `score = Σ 1/(k + rank)`, k=60. Agent generuje dwa zapytania: keywords dla FTS, natural language dla embeddingu. Cross-language: embedding ratuje gdy FTS zawodzi na różnych językach. Graceful degradation: błąd API → FTS-only. Overfetch (`limit * 3`) przed fuzją zwiększa szansę trafień z obu strumieni.
- **s02e02** — FTS5+sqlite-vec+RRF, dual queries, cross-language, graceful degradation
- **s02e03** — overfetch przed fuzją, kluczowanie po unikalnym identyfikatorze dokumentu

## RAG
Retrieval-Augmented Generation — pipeline od surowych dokumentów do odpowiedzi agenta. Komponenty: indeksowanie, chunking, embedding, wyszukiwanie, prezentacja kontekstu. Sześć wyzwań skuteczności: wiedza bazowa przesłania search, niekompletne wyniki, brak świadomości zasobów, brak kontekstu użytkownika, multimodalność, instruction dropout od masy wyników. Inkrementalna indeksacja (SHA256), FTS triggers, batch embedding.
- **s02e02** — pełny pipeline w SQLite, architektura od filesystem do dedykowanych silników, wyzwania skuteczności

## Agentic RAG / Agentic Search
Agent domyślnie nie wie, o czym wie — buduje kontekst przez iteracyjne wyszukiwanie. Czterofazowa strategia: **Skanowanie** (struktura, nagłówki), **Pogłębianie** (pętla szukaj→czytaj→zbierz terminy→szukaj), **Eksplorowanie** (tropy przyczyna/skutek, część/całość), **Weryfikacja pokrycia**. Zasady działają niezależnie od źródła danych — jedyny specyficzny fragment to charakter danych. Operujemy w obszarze prawdopodobieństwa, nie pewności.
- **s02e01** — czterofazowa strategia, niezależna od źródła danych, prawdopodobieństwo nie pewność
- **s02e02** — infrastruktura RAG (indeksowanie, chunking, embedding, hybrid search, RRF), progresja architektury od filesystem do dedykowanych silników

## Knowledge Base Design
Dwa podejścia: **podłączana** (istniejące dokumenty → chunki, embeddingi, RAG, problem odnajdywania) vs **budowana** (dokumenty tworzone dla agentów ze strukturą i linkowaniem wewnętrznym). Meta-rozróżnienie: "łączenie ze źródłem" (fragmenty pozbawione powiązań) vs "nauka ze źródła" (odnośniki prowadzą agenta krok po kroku). Cztery wymiary nawigacji: perspektywa, nawigacja, powiązania, szczegóły — kod posiada wszystkie, dokumenty biznesowe prawie nigdy. Baza wiedzy = kod źródłowy agenta — pytanie "co agent musi wiedzieć?" nie "jak zbudować bazę?". Pięć stref odpowiedzialności (Me/World/Craft/Ops/System), jawny podział właściciela, konstytucja vaultu w `mind.md`. Self-sufficient notes — notatki pisane jakby czytelnik nie miał kontekstu. Trzecia strefa obok "nasza" i "agentowa": wiedza obecna jako kontekst, nie do automatyzacji.
- **s02e03** — podłączana vs budowana baza, łączenie vs nauka ze źródła, cztery wymiary nawigacji
- **s04e04** — baza wiedzy = kod źródłowy agenta, pięć stref (Me/World/Craft/Ops/System), self-sufficient notes, konstytucja vaultu w `mind.md`, szablony w `system/templates/`

## Graph RAG
Baza grafowa (Neo4j) jako pamięć agenta — sieć encji z relacjami umożliwiająca nawigację po powiązaniach. Łączy FTS (BM25), semantyczne (vector) i nawigację po relacjach. Uzasadnione przy wielopoziomowych powiązaniach między rozproszonymi dokumentami. Koszt infrastruktury i złożoności sprawia, że nie jest domyślnym wyborem. Komplementarny z Observational Memory.
- **s02e03** — Neo4j, trzy strumienie wyszukiwania, komplementarność z OM, nie jest domyślny

## Entity Deduplication
Wielowarstwowa deduplikacja encji ekstrahowanych przez LLM: normalizacja per chunk → globalna deduplikacja przez klucz → merge w bazie (ON MATCH) → runtime kuracja (audit + merge_entities). Bez deduplikacji graf staje się szumem — LLM generuje wiele wariantów tego samego konceptu.
- **s02e03** — cztery warstwy deduplikacji, normalizacja, merge, runtime kuracja

## Instruction Dropout
Zjawisko: rozbudowany kontekst z zewnętrznych źródeł powoduje pomijanie instrukcji systemowych. Uwaga modelu przesuwa się na nowe treści kosztem zasad. Potwierdzone w "How Many Instructions LLMs Follow at Once" i "Reasoning on Multiple Needles In A Haystack". Kontrmiary: krótkie chunki, subagenci z własnymi oknami, powtarzanie kluczowych instrukcji w wynikach narzędzi.
- **s02e02** — definicja zjawiska, paper evidence, kontrmiary środowiskowe

## Context Masking (Manus technique)
Uzupełnianie początku wypowiedzi modelu tokenami wymuszającymi konkretne narzędzie (prefill tool call) — ogranicza dostępne akcje bez usuwania definicji z kontekstu. Deterministyczne zdjęcie po zakończeniu sesji. Deprecated w API Anthropic, ale ilustruje zasadę: niekonwencjonalne podejścia adresują całe klasy problemów.
- **s02e01** — prefill tool call, ograniczenie akcji bez usuwania definicji, deprecated ale ilustratywne

## Context Budget Calibration
`usage_ledger` śledzi tokeny per thread. Estymacje budżetu kalibrowane na podstawie rzeczywanych zużyć z poprzednich tur. Mechanizm zapobiegający cichemu przepełnieniu okna kontekstowego.
- **s05e04** — usage_ledger, estymacje kalibrowane z rzeczywistych zużyć, zapobieganie przepełnieniu

## Query Transformation
Zapytanie użytkownika rzadko pasuje 1:1 do zasobów. Ekspansja przez synonimy i powiązane zagadnienia zwiększa hit rate. Agent musi mieć ogólną mapę bazy wiedzy (np. `_index.md`). Pytania doprecyzowujące jako pierwszy krok. Agent generuje warianty słów kluczowych, synonimy i terminy z wcześniejszych wyników w pętli pogłębiania. Problem języka rozwiązany jedną linią w prompcie o języku treści, nie logiką translacji.
- **s01e02** — ekspansja, mapa wiedzy, pytania doprecyzowujące
- **s02e01** — warianty słów kluczowych z wyników, problem języka rozwiązany w prompcie
- **s02e02** — cross-language retrieval, `_index.md`, synonimy i pod-zapytania w RAG, embedding wielojęzyczny gdy FTS zawodzi

## Scatter/Gather
Wzorzec researchu: wyniki narzędzi zapisywane jako pliki (`outputMode: "file"`), nie inline. Agent czyta tylko potrzebne fragmenty. Kontrola wielkości kontekstu — pełne dokumenty nigdy nie trafiają do conversation history.
- **s04e04** — wyniki do plików nie inline, agent czyta tylko potrzebne fragmenty, pełne dokumenty nigdy w conversation history

## Knowledge Categorization
Sześć kategorii wiedzy w systemie wieloagentowym: dokumenty sesji, wiedza publiczna/prywatna/agentów, pamięć podręczna, runtime. Ta sama informacja może należeć do wielu kategorii zależnie od kontekstu. Proste zasady organizacji ważniejsze niż złożone systemy kategoryzacji.
- **s02e05** — sześć kategorii, proste zasady > złożone systemy

## Knowledge Anti-patterns
Pliki knowledge zawierają anty-wzorce i edge cases (co idzie źle), nie instrukcje "jak zrobić". Wynik trial-and-error. Prompt wymusza czytanie jako pierwszy krok. RAG, ale retrieval domain to failure modes, nie surowa wiedza.
- **s03e02** — anty-wzorce w plikach knowledge, failure modes jako RAG domain

## Deep Research / Deep Action
Wzorzec iteracyjnego pogłębiania zapytań: doprecyzowanie → parafraza → dekompozycja → pętla szukaj/analizuj/identyfikuj braki → synteza. "Deep action" rozszerza poza research — audyty, generowanie kodu, analiza logów. Każdy proces wymagający eksploracji i niebędący natychmiastowy.
- **s02e03** — iteracyjne pogłębianie, deep action poza research, wstępne przeszukiwanie

## Frontmatter Metadata Model
Wieloosiowa kontrola metadanych w YAML frontmatter: publish (cykl publikacji), status (dojrzałość treści), access (dziedziczone z sekcji), attention (sygnał handoffu), tags (płaskie, opisują co nie gdzie). Każda oś niezależna. Uprawnienia dziedziczone per sekcja w `mind.md`, nadpisywane per notatka.
- **s04e04** — pięć osi metadanych w frontmatter, dziedziczenie uprawnień per sekcja

## Temporal Grounding
Wstrzykiwanie metadanych czasowych i sytuacyjnych w każdą wiadomość jako fundamentalny building block agentów "świadomych". Agent wie kiedy jest, co może odkryć, dostaje nudge zachęcający do aktywności. Sterowanie uwagą bez modyfikacji system promptu — cache-safe, zmienia się co turę.
- **s03e05** — metadane (`now_iso`, `weekday`, `local_time`, `timezone`, `recallable`, nudge), cache-safe, co turę

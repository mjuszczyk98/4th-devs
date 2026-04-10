# Tydzień 5: Architektura, narzędzia, rozwój i produkcja

## Spis treści
- [Prymitywy architektoniczne](#prymitywy-architektoniczne)
- [Decyzje architektoniczne](#decyzje-architektoniczne)
- [Pewniaki architektoniczne](#pewniaki-architektoniczne)
- [Integracja z wieloma providerami](#integracja-z-wieloma-providerami)
- [Architektura systemu wieloagentowego](#architektura-systemu-wieloagentowego)
- [UI agenta — Event Sourcing i streaming](#ui-agenta--event-sourcing-i-streaming)
- [Narzędzia do budowania aplikacji generatywnych](#narzędzia-do-budowania-aplikacji-generatywnych)
- [Agent głosowy](#agent-głosowy)
- [Rozwój generatywnych aplikacji](#rozwój-generatywnych-aplikacji)
- [Migracje na nowsze modele](#migracje-na-nowsze-modele)
- [Autonomiczna optymalizacja promptów](#autonomiczna-optymalizacja-promptów)
- [Coding Agent od zera](#coding-agent-od-zera)
- [Produkcja — detale mają znaczenie](#produkcja--detale-mają-znaczenie)
- [Agent Runtime — pełna logika produkcyjna](#agent-runtime--pełna-logika-produkcyjna)
- [Front-end na produkcję](#front-end-na-produkcję)
- [Projekt Wonderlands — system osobisty](#projekt-wonderlands--system-osobisty)
- [Integracje MCP w praktyce](#integracje-mcp-w-praktyce)
- [Współpraca z agentem — wskazówki](#współpraca-z-agentem--wskazówki)
- [Lekcje z produkcji](#lekcje-z-produkcji)
- [Progresja przykładów kodu (e01 → e05)](#progresja-przykładów-kodu-e01--e05)

---

## Prymitywy architektoniczne

- Zamiast projektować wokół **funkcjonalności** (np. "czat"), projektować wokół **prymitywów** — najprostszych elementów z których buduje się struktury wyższego rzędu.
- Przykład: "wiadomości między użytkownikiem a asystentem" → "zdarzenia między aktorami". Zdarzenia mogą dotyczyć nie tylko tekstu, ale też wywołań narzędzi, reasoningu, kompresji kontekstu. Aktor może być użytkownikiem, agentem, systemem.
- Artefakty = metadane reprezentujące treść dowolnego typu (plik, obraz, interaktywny interfejs ze stanem). Zamiast osobnych struktur per typ — jeden prymityw z polem `kind`.

## Decyzje architektoniczne

| Obszar | Kluczowa decyzja |
|---|---|
| **Gateway** | Scentralizowana komunikacja z AI. Przełączanie modeli/providerów przez AI SDK, LiteLLM lub własny format |
| **API** | Klient nie ma bezpośredniego dostępu do modelu. Wyspecjalizowane endpointy zamiast generycznych |
| **System plików** | Uprawnienia i zakresy dostępu dla agentów. Ryzyko nieprzewidzianych akcji wymaga sandboxingu |
| **Baza danych** | Dodatkowe struktury: interakcje, zaplanowane zadania, definicje agentów i ich narzędzi |
| **Zależności** | Biblioteki: ewaluacja, observability, transformacja markdown, wyszukiwanie semantyczne, renderowanie streamów do HTML, frameworki AI |

## Pewniaki architektoniczne

- Centralizacja interakcji z AI — rozproszone wywołania blokują zarządzanie ustawieniami i przełączanie modeli
- Obsługa wielu providerów — otwartość na lepsze modele innych dostawców
- Strumieniowanie (SSE) — informowanie o postępach, mniejszy czas reakcji
- Multimodalność — projektować struktury danych tak, by dodanie obrazu/audio było trywialne
- Logika agentów od dnia zero — np. tabela `items` zamiast `messages`
- Zdarzenia długoterminowe — użytkownik zamknie kartę, czas przekroczy limit połączenia
- Ostrożność przy frameworkach AI — ich fundamenty wciąż się zmieniają

## Integracja z wieloma providerami

Problem: więcej niż jeden provider w tej samej logice. Wymaga warstwy tłumaczeń:
- Różnice w strukturze API: system prompt (OpenAI = element listy, Anthropic = oddzielne pole, Gemini = `system_instruction`)
- Różnice w ustawieniach: `budget_tokens` vs `reasoning_effort`
- Thought Signatures — wymagane przez Gemini przy narzędziach

| Podejście | Zalety | Wady |
|---|---|---|
| **OpenRouter** | Wygoda, jeden endpoint | Tylko podstawowe funkcje, sporadyczne błędy |
| **Biblioteki (AI SDK, LiteLLM)** | Abstrakcja nad providerami | Blokują dostęp do najnowszych funkcji |
| **Własna logika** | Pełna kontrola | Cały ciężar utrzymania |

## Architektura systemu wieloagentowego

Łączy cztery wzorce: **Orchestrator** (agent z narzędziami zarządzania), **Blackboard** (współdzielony stan), **DAG** (relacje zależności), **Zdarzenia** (każda zmiana emituje event).

### Scheduler — cykl życia zadania

Stany: `todo → in_progress → done | waiting | blocked`

- **todo**: brak zależności lub spełnione → scheduler promuje do `in_progress`
- **waiting**: actor kończy pracę, ale aktywne subzadania → czeka
- **blocked**: nieusuwalna przeszkoda lub limit prób
- Recovery: transient errors → automatyczny retry z exponential backoff (max 3 próby)

### Actor loop

```
for step 1..maxSteps:
  processTaskMemory()        // compress history if needed
  buildTaskRunInput()         // assemble prompt from prefix + memory + snapshot + raw items
  generateToolStep()          // LLM call with tools
  if no tool calls → return completed/blocked
  for each tool call → execute → record as Items
  if terminal outcome → return
```

### Observational Memory

Dwufazowy cykl kompresji:
- **Observer** — gdy raw items > threshold, dzieli na head (compress) + tail (keep raw). Head → LLM → ustrukturyzowane obserwacje z priorytetami
- **Reflector** — gdy obserwacje > threshold, kompresuje wielopoziomowo (level 0–2, coraz bardziej agresywnie)

## UI agenta — Event Sourcing i streaming

Agent UI oparty na strumieniu zdarzeń (SSE), nie na modelu wiadomości. Dwie ścieżki materializacji:
- **Pełna** — hydratacja historii z serwera
- **Inkrementalna** — mutacja istniejącej listy bloków na każde zdarzenie SSE

**Streaming Markdown:** `committedSegments` (sfinalizowane) + `liveTail` (re-renderowany). Tylko liveTail parsowany na deltę. Naprawa niekompletnego MD przez `remend`.

**Wirtualizacja:** chunk-based (12 wiadomości), `ResizeObserver`, overscan, scroll anchoring z pin/unpin.

**rAF Batching:** zdarzenia SSE trafiają do bufora, flush raz na `requestAnimationFrame` — DOM aktualizuje się max 60fps.

## Narzędzia do budowania aplikacji generatywnych

| Kategoria | Narzędzia |
|---|---|
| **Plik system** | just-bash — wirtualny FS z bash API, bez sandboxa |
| **Przeglądarka** | agent-browser (lokalna), browserbase (chmura) |
| **Wyszukiwanie** | Firecrawl, Jina, Brave — często sens łączyć >1 usługę |
| **Sandbox** | Daytona, e2b, Deno Sandbox, secure-exec |
| **Audio/Video** | Livekit (framework), ElevenLabs (TTS, STT) |
| **Dokumenty** | markitdown (PDF/docx → MD), pyodide (Python w przeglądarce) |
| **Wektorowe** | sqlite-vec, Qdrant — zawsze łączyć z FTS, dedykowane bazy tylko przy skali |
| **CLI/infra** | chokidar (file watching), commander/zx (CLI), croner (CRON), winston/tslog |

## Agent głosowy

| Aspekt | STT/LLM/TTS (OpenAI) | Realtime (Gemini) |
|---|---|---|
| Modele | 3 osobne | 1 multimodalny |
| Latencja | Wyższa (3 skoki) | Niższa (native audio) |
| Koszt | Niższy | Wyższy |

**Livekit** — framework z `AgentSession`, VAD (Silero), `Agent` (instrukcje + narzędzia). Kluczowe zjawiska: detekcja ciszy (VAD), barge-in, rozpoznawanie końca wypowiedzi.

## Rozwój generatywnych aplikacji

- Fundamenty modeli stabilne przez 3 lata (transformery, autoregresja, tokenizacja). Warstwy wyższe bardzo dynamiczne.
- Dwie przeciwstawne tendencje: **uproszczenie** (logika oddelegowana do modelu, Agentic RAG) vs **wzrost złożoności** (potrzeba środowisk, multimodalność, długie horyzonty czasowe).
- Zmiany produkcyjne: wyścig dostawców, rozwój agentów, multimodalność, rozwój narzędzi, integracja z systemem.

## Migracje na nowsze modele

- Responses API po 11 miesiącach przyjął się u wielu providerów
- Modele mini/nano mogą tylko "sprawiać wrażenie" — poświęcić więcej czasu na ewaluację
- Nowsze modele mogą gorzej radzić sobie z wcześniej rekomendowanymi praktykami (np. "agresywny ton" w Anthropic już nie rekomendowany)
- Sprawdzać nie tylko stabilność, ale też uproszczenie instrukcji lub nowe możliwości
- Obserwować modele Open Source przez OpenRouter

## Autonomiczna optymalizacja promptów

### Autoprompt (własna implementacja)

- Pętla hill-climbing z **Best-of-N kandydatami** — każdy z inną strategią (balanced, coverage, simplify, boundary, salience)
- **LLM-as-Judge** — ocena semantyczna, nie deterministyczna
- **Noise floor** — ochrona przed fałszywym postępem (delta musi przekraczać spread)
- **Stuck detection** — jeśli 3 ostatnie iteracje odrzucone z tą samą operacją, injectuj zakaz
- **Train/Verify split** — zapobiega overfittingowi
- Separacja ról: execution (tani), judge (mocny), improver (mocny)
- 10 rund optymalizacji: 60% → 90% skuteczności
- Zero zewnętrznych zależności — czysty fetch do API

### AX (DSPy dla TypeScript)

- **Sygnatura** = deklaratywna definicja I/O — framework sam generuje prompt
- **BootstrapFewShot** — automatycznie znajduje najlepsze few-shot przykłady przez iteracyjne uruchamianie i filtrowanie
- Metryka z **consistency bonus** — nagroda za wewnętrzną spójność predykcji
- Progressive enhancement: sygnatura → ręczne przykłady → zoptymalizowane demoso
- Plik `demos.json` jako artefakt kompilacji — usunięcie = powrót do baseline'u

## Coding Agent od zera

Kompletny, minimalistyczny agent (~650 linii TypeScript):
- **Explicit agent loop** — bez frameworków, `MAX_TURNS = 30`, `parallel_tool_calls: false`, `store: false`
- **MCP dynamic discovery** — łączenie z serwerem, translacja formatów, sandboxing (`FS_ROOT`)
- **Rolling memory** — kompakcja przez tańszy model, zachowanie 10 ostatnich wiadomości, inkrementalne podsumowanie
- **Strukturalne logowanie** — JSONL per sesja, schemat zdarzeń (user.message → turn.done)
- **Dwumodelowa architektura** — główny model do reasoningu, tańszy do kompakcji

## Produkcja — detale mają znaczenie

- Usuwanie wiadomości ze środka zaburza historię — lepiej rozgałęzianie/przywracanie
- Edytowanie wypowiedzi modelu → many-shot jailbreaking risk
- Whisper halucynuje na ciszy ("Thanks for watching!")
- Wzmianki o niedostępnych możliwościach → model może zachować się jak gdyby były dostępne
- Długie treści w polu tekstowym → spadek wydajności — obsługiwać jak załączony plik
- 1-3% użytkowników generuje większość kosztów — twarde limity
- Agent bez czatu często łatwiejszy w budowie i kontroli

## Agent Runtime — pełna logika produkcyjna

### Architektura (05_04_api)

Clean Architecture: `app/` → `adapters/` → `application/` → `domain/` → `db/` → `shared/`. Adaptery zależą od domeny, nie odwrotnie.

- **Result Monad** — błędy są wartościami, nie przepływem sterowania
- **Branded Types** — kompilator nie pozwala pomylić RunId z JobId
- **Prefixed IDs** — acc_, run_, job_, ses_, thr_, msg_, agt_, ten_
- **SQLite z WAL mode** — zero latency na zapis, pełna trwałość

### Agent Runtime Flow

Żądanie → Inicjalizacja (zapis danych) → Kolejka (queued/pending) → Scheduler (priorytetyzacja: dzieci → wznowienia → recovery → nowe) → Claim (lease z heartbeat) → Pętla Agenta → Delegacja (child run, parent waiting) → Dostarczenie wyniku → Zapis → Odzyskiwanie (stale detection + backoff)

### Kluczowe mechanizmy

- **Heartbeat + Claim** — martwy proces nie blokuje zadań
- **Hierarchia delegacji** — wielopoziomowa, przezroczysta dla użytkownika (child run: threadId=null)
- **Event Sourcing + Outbox** — każda zmiana emituje event w tej samej transakcji
- **Tenant-scoped FK** — `(id, tenant_id)` na poziomie bazy danych
- **Tool outcomes mogą być `waiting`** — run suspendowany na asynchroniczne interakcje

## Front-end na produkcję

### Svelte 5 Runes

`$state` poza komponentami — reactive stores jako zwykłe obiekty TS. Trzy warstwy wiadomości: durable (REST), optimistic (natychmiast), live (SSE).

### Streaming Markdown

committedSegments + liveTail. `remend` do naprawy niekompletnego MD. `marked` Lexer + highlight.js + DOMPurify (XSS prevention).

### Wirtualizacja

Chunk-based (12 wiadomości), `@chenglou/pretext` do pre-DOM line measurement, overscan, scroll anchoring z asymetrycznymi progami pin/unpin.

### Inne wzorce

- **Flash-less theme switching** — synchronicznie w `<head>`
- **Command Palette z Provider Pattern** — generyczna, funkcjonalność wstrzykiwana
- **Shortcut Layer Stack** — palette dezaktywuje skróty globalne
- **Optimistic UI ze stable keys** — mapowanie lokalnych ID na serwerowe bez remountingu
- **GPU-promoted scrolling** — CSS containment (`contain: layout style`)

## Projekt Wonderlands — system osobisty

Agent z bazą wiedzy jako cyfrowy ogród — strona generowana z FS połączonych katalogami, tagami, wikilinkami. Elementy: API, czat, agent, narzędzia (native + MCP), obrazy, sandbox, przeglądarka, garden.

- **Zespół agentów** z dostępem do wybranych obszarów FS i narzędzi
- **Działanie w tle** — zapytania z zewnętrznych źródeł, wyświetlanie w historii
- **Code Mode** — narzędzia przez pisanie/wykonanie kodu, definicje nie wczytywane do kontekstu
- **Referencje** — przekazywanie plików między agentami i narzędziami

### Daily Ops — przykład schematu

Agent Calendar → Agent Tasks → Agent Mail → Agent Newsfeed → transkrypt + audio → urządzenie mobilne

## Integracje MCP w praktyce

Linear, Google Calendar, Gmail (tylko wybrane etykiety), Maps, Replicate, Resend, ElevenLabs, YouTube, Firecrawl, Spotify — wszystkie na bazie tego samego szablonu MCP.

Wartość rośnie gdy spersonalizujemy przez opisy procesów, procedury, skrypty. Rozszerzanie przez dokumenty w cyfrowym ogrodzie.

## Współpraca z agentem — wskazówki

- Wskaż ścieżki (#), doprecyzuj zadania (konkretne pliki, narzędzia, foldery)
- Krótkie interakcje — przekłada się na skuteczność i koszty
- Proste opisy workflow — pamiętaj o ograniczonej zdolności utrzymania uwagi
- Dopracowanie instrukcji = jednorazowy wysiłek z wielokrotnym zwrotem
- Nawyk pracy z treściami — dopasowanie otoczenia, łączenie z tym co już robimy
- Takich struktur nie buduje się "w jeden wieczór" — zacząć od jednego prostego procesu

## Lekcje z produkcji

- Nowe możliwości, ale zasady są takie same — pytania "co ma znaczenie?", "co nam umyka?" nadal trudne
- Wszyscy eksplorujemy — przekonania należy bardzo często aktualizować
- Zrozumienie zasad po to, aby je łamać — szukać własnych ścieżek
- Zawsze zakładaj, że użytkownicy nie wiedzą nic o modelach
- Jakość jako wyróżnik — AI nie tylko by szybciej, ale by lepiej
- Agent bez czatu — łatwiejsza kontrola nad danymi i scenariuszami
- Budowanie "dla agentów" — aplikacje z myślą o agentach działających w imieniu użytkowników
- Zmiana paradygmatu: to my wspieramy AI w generowaniu kodu

---

## Progresja przykładów kodu (e01 → e05)

**e01** — architektura od podstaw: prymitywy architektoniczne (zdarzenia, aktorzy, artefakty), decyzje architektoniczne (gateway, API, FS, DB), system wieloagentowy z DAG schedulerem, Observational Memory, model domenowy z generycznymi relacjami, agent registry, prompt caching, stale task recovery.

**e02** — interfejs i narzędzia: Event Sourcing UI, streaming markdown z inkrementalnym rendering, wirtualizacja listy wiadomości, rAF batching, agent server ze streaming, agent głosowy (OpenAI vs Gemini Realtime), narzędzia generatywne (sandbox, przeglądarka, wyszukiwanie, audio/video, dokumenty, wektorowe), spektrum podejść do wyszukiwania.

**e03** — rozwój funkcjonalności: fundamenty vs warstwy wyższe, dwie tendencje (uproszczenie vs wzrost złożoności), migracje modeli i zmiany API, przykłady porażek wdrożeń, autoprompt (hill-climbing z Best-of-N, LLM-as-Judge, noise floor, stuck detection, separacja ról), AX/DSPy (sygnatury, BootstrapFewShot, consistency bonus), coding agent od zera (explicit loop, MCP dynamic discovery, rolling memory, JSONL logging).

**e04** — produkcja: detale mające znaczenie (usuwanie wiadomości, halucynacje Whisper, many-shot jailbreaking), architektura produkcyjna (Clean Architecture, Result Monad, Branded Types, SQLite WAL, tenant-scoped FK), Agent Runtime (scheduler, claim/heartbeat, delegacja, outbox pattern), front-end (Svelte 5 Runes, streaming markdown, wirtualizacja, optimistic UI, command palette, flash-less theme).

**e05** — nowa rzeczywistość: zmiana paradygmatu (my wspieramy AI), projekt Wonderlands jako pełny monorepo (apps/client + apps/server + packages/contracts + packages/sandbox-runtime-lo), agenci jako Markdown z pełnym DSL konfiguracyjnym (sandbox/kernel/memory/garden policy, subagent declarations, tool profiles), Digital Garden — wbudowany SSG (Markdown → HTML z sidebar, TOC, Pagefind search, protected access), context compaction z boundary integrity, sandbox writeback jako explicit consent, multi-lane event outbox (realtime/projection/background/observability), polling workers z wake support, delegation handoff envelope, 60+ event types, readiness engine jako unified scheduling abstraction, integracje MCP w praktyce, Daily Ops, wskazówki współpracy z agentem, lekcje z produkcji.

**Delta:** e01 definiuje **jak zbudować architekturę** agentową. e02 rozszerza o **jak zbudować interfejs i zestaw narzędzi**. e03 pokazuje **jak rozwijać i optymalizować** systemy agentowe. e04 adresuje **jak przenieść na produkcję** z pełną dbałością o detale. e05 łączy wszystko w **kompletny system osobisty** z Digital Garden jako knowledge base, pełnym DSL konfiguracyjnym agentów i praktycznymi wzorcami wdrażania.

## Uzupełnienia

### Web search — dwa mechanizmy zależne od providera [e01]

OpenAI: `{ type: 'web_search_preview' }` w tablicy narzędzi. OpenRouter: sufiks `:online` do nazwy modelu. Konkretny przykład różnic API między providerami.

### Mock/demo mode w agent server [e02]

Serwer wspiera tryb `mock` z predefiniowanymi scenariuszami. `ScenarioBuilder` generuje sekwencję `StreamEvent`ów z konfigurowalnymi opóźnieniami. Umożliwia testowanie UI z 1500+ wiadomościami bez kosztów API.

### Store: false w Responses API [e02]

Serwer wysyła `store: false` — konwersacja nie persystowana po stronie providera. Pełna historia utrzymywana wyłącznie lokalnie, pełna kontrola nad kontekstem.

### Observability: pełne API tracing w autoprompt [e03]

Każde wywołanie LLM logowane z pełnym request/response/timing i zapisywane per-stage w `traces/`. Umożliwia debugowanie konkretnych wywołań, analizę kosztów i audyt decyzji judge'a.

### Context jako prior state w ewaluacji autoprompt [e03]

Test case z `context` ma "prior state" z poprzedniego spotkania — model musi skopiować stan i aplikować tylko zmiany, nie usuwać wymienionych elementów ("silence = unchanged").

### Idempotency keys w API [e04]

`http_idempotency_keys` — klucze idempotencji per tenant+scope, z requestHash i responseDataJson. Gwarantuje bezpieczne ponawianie żądań.

### Agent Markdown jako source of truth [e04]

Agenci definiowani jako Markdown z frontmatter (gray-matter). Każda zmiana tworzy nową rewizję z checksum SHA256. Frontmatter: model, tools, memory policy, workspace policy, subagent links.

### Współdzielenie root job między turami [e04]

Ten sam root job jest reopenowany dla kolejnych wiadomości — job jest jednostką szeregowalną, nie jednorazową.

### Stale recovery z exponential backoff [e04]

Gdy run stale (expired claim), system nie restartuje natychmiast — `staleRecoveryBaseDelayMs * 2^(count-2)`. Limit: `maxStaleRecoveries` (domyślnie 5), po czym run = failed.

### Config setup w Wonderlands [e05]

`npm run setup` — instalator z pytaniami o konto i klucze. System generuje początkowe rekordy i `.env`. Domyślny agent i cyfrowy ogród. Folder workspace można otworzyć w Obsidian. Github Actions do publikacji.

### Uruchamianie sesji w tle przez API [e05]

`POST /v1/sessions/bootstrap` — zapytanie osadzone w kontekście użytkownika i agenta, realizowane w tle. Gdy akcja wymaga interwencji — pojawia się w "Activity Bar".

### Refleksja końcowa AI_devs 4 [e05]

Szkolenie o **budowaniu** — koniec lekcji nie oznacza końca przygody. Nie ma odpowiedzi na "która ścieżka jest właściwa" — powinno brzmieć "która ścieżka jest właściwa DLA MNIE?".

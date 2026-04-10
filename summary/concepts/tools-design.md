# Projektowanie Narzędzi i Wykonywanie
> Koncepty związane z projektowaniem narzędzi agenta, schematami, sandboxami i wzorcami wykonywania kodu.

---

## Tool Design
Narzędzia LLM to NIE mapowanie API 1:1 — API pisane dla programistów, narzędzia dla modelu bez dokumentacji. Zasady: proste nazwy, minimalna liczba parametrów, opcjonalny `details`, auto-resolucja niepełnych danych, konsolidacja akcji przez parametr `mode`/`operation`, signal-to-noise w opisach, aliasy i defaulty, operacje batchowe, pomijanie hashy/wewnętrznych IDs, podział pól na obowiązkowe/programowe/zabronione. Tool Response Envelope `{ data, hint }` jako standaryzowana koperta z nextActions, confidence scoringiem i recovery. Narzędzia jako cognitive scaffolding — `think` (zero I/O, zmienia zachowanie samą obecnością) i `recall` (delegacja do sub-agenta). Tool visibility scoping przez `visibility: ["app"]`. Zawężanie pełnego API do dedykowanych narzędzi per przypadek użycia. Tool Registry jako `Map<string, Tool>` z per-skill scopingiem — agent fizycznie nie może użyć narzędzia spoza scope'u aktywnego skilla.
- **s01e02** — projektowanie narzędzi dla agenta (bez 1:1 mapowania API)
- **s01e03** — cztery perspektywy projektowania, API audit, tool consolidation (13 → 4 narzędzia Filesystem), dynamic responses (hints), destructive action safeguards
- **s03e04** — Tool Envelope `{ data, hint }` z nextActions/confidence, `.describe()` na polach Zod jako źródło semantyki, zawężanie API per przypadek użycia, modify zwracający stan po zmianie
- **s03e05** — narzędzia jako cognitive scaffolding (`think` zero I/O, `recall` delegacja do scouta), visibility scoping, separation of concerns: conversationalist + retrieval specialist
- **s04e01** — Tool Registry jako `Map<string, Tool>` z `findTool(name)` i `definitions(names?)`, per-skill scoping — agent nie może użyć narzędzi spoza scope'u aktywnego skilla

## Error Handling w narzędziach
Błąd nie przerywa pętli agenta — serializuj wyjątek do wyniku narzędzia i zwróć modelowi jak normalny output. Standard wyższy niż dla API: komunikaty opisowe z sugestią następnego kroku (`"team_id nieprawidłowy. Pobierz przez workspace_metadata"`). Obsługa literówek i wariantów. 4-warstwowa walidacja (registry → JSON parse → Zod → handler) z ustandaryzowanym błędem na każdej warstwie. Klasyfikacja błędów przez pattern matching (AUTH_REQUIRED, RATE_LIMITED, TRANSIENT_FAILURE, NOT_FOUND, INVALID_ARGUMENT) ze strategią recovery per kategorię. Zod `.refine()` dla reguł zależnościowych między polami.
- **s01e02** — błąd serializowany jako output, opisowe komunikaty
- **s01e03** — Dynamic Tool Responses (hints): recovery dla błędów, automatyczne korekty, dostępne wartości przy walidacji
- **s03e04** — 4-warstwowa walidacja, klasyfikacja błędów pattern matching, Zod `.refine()` dla reguł zależnościowych
- **s05e01** — trójpoziomowa obsługa: API (retry z exponential backoff na 429/5xx) → Actor (`RecoverableActorError`) → Task (recovery state z `explicit_block`/`llm_transient`/`runtime_error`), stale task recovery

## Function Calling / Tool Use
Mechanizm łączenia LLM z otoczeniem: model generuje JSON z nazwą funkcji + argumentami, aplikacja wykonuje i zwraca wynik do kontekstu. Minimum dwa round-tripy per wywołanie. Schematy wszystkich narzędzi liczą się do kontekstu przy każdym zapytaniu. Limit praktyczny: 10-15 narzędzi na agenta. Natywne (web search, code execution) vs własne — można mieszać w jednym zapytaniu.
- **s01e01** — wspomniane jako alternatywa dla Structured Outputs, natywne narzędzia providerów
- **s01e02** — pełny mechanizm, limit narzędzi, mieszanie natywnych i własnych

## Tool Response Envelope
Standaryzowana koperta odpowiedzi narzędzia `{ data: T, hint: ToolHint }` z polami status, reasonCode, summary, nextActions, recovery, diagnostics. LLM dostaje kontekst decyzyjny zamiast gołych danych — nie zgaduje co zrobić po błędzie/braku wyników, dostaje propozycję kolejnej akcji. Zmniejsza halucynacje i bezcelowe tury agenta.
- **s03e04** — pełna definicja envelope, nextActions z confidence, recovery, diagnostics

## Schema-driven Development
Zod jako single source of truth: definicja raz → automatyczna konwersja do JSON Schema (function calling), `.describe()` dla semantyki widocznej dla modelu, `.refine()` dla walidacji biznesowej. Eliminuje podwójne definicje parametrów.
- **s03e04** — Zod jako SSOT, `.describe()` na polach, `.refine()` dla reguł biznesowych

## Progressive Tool Discovery
Meta-narzędzia (`list_servers`, `list_tools`, `get_tool_schema`, `execute_code`) pozwalają agentowi odkrywać narzędzia MCP w runtime. Rejestr z pełnymi sygnaturami TypeScript — agent ładuje tylko potrzebne do `loadedTools` Map. Narzędzia nieładowane nie zajmują okna kontekstu.
- **s02e05** — meta-narzędzia do odkrywania MCP w runtime, leniwe ładowanie do `loadedTools` Map

## Tool-chaining
Narzędzia mogą samoistnie wywoływać dodatkowe zapytania do modeli/API — nie są tylko proxy do danych. Jedno narzędzie enkapsułuje cały sub-pipeline modeli i API, ukrywając złożoność przed pętlą agenta. W MCP odpowiada za to mechanizm Sampling.
- **s03e03** — narzędzia enkapsulują sub-pipelines (`listen`→ASR+analiza, `feedback`→TTS), MCP Sampling jako mechanizm

## Mock-first Development
Testowanie UI agenta bez dostępu do LLM: `ScenarioBuilder` generuje deterministyczne sekwencje `StreamEvent`ów z konfigurowalnymi opóźnieniami. `detectScenario()` dopasowuje prompt regexem. Zerowy koszt tokenów przy pełnym pokryciu UI.
- **s05e02** — ScenarioBuilder, detectScenario regex, zerowy koszt tokenów

## Search Decision Ladder
Czteropoziomowe spektrum wyszukiwania: kontekst → grep/ripgrep → hybrydowe (FTS + semantyczne) → grafy. Samodzielne bazy wektorowe nierekomendowane. Rozszerzenia SQLite/PostgreSQL wystarczają na większość projektów; dedykowane (Qdrant, Chroma) dopiero przy skali.
- **s05e02** — cztery poziomy, rozszerzenia DB wystarczają, dedykowane dopiero przy skali

## Agent Tooling Ecosystem
Kategoryzacja narzędzi agentowych: przeglądarki (agent-browser, browser-use/browserbase), sandbox'y (daytona, e2b), scrapowanie (firecrawl, jina, brave), dokumenty (markitdown), CLI (commander, zx), monitoring (chokidar). Łączenie >1 usługi celowe — różne silniki radzą sobie z różnymi typami stron.
- **s05e02** — kategoryzacja narzędzi, łączenie wielu usług celowe

## Mock → Real Strategy
Jedna zmienna env przełącza między realnym API a in-memory mockiem z pełną funkcjonalnością (parser zapytań, paginacja, mutowalny stan). Mock nie jest statycznym fixturem — deterministyczny, pozwala testować edge case'y bez dostępu do backendu.
- **s03e04** — env toggle, in-memory mock z pełną funkcjonalnością, deterministyczny, edge case testing

## Resilient JSON Parsing
Wielokrotne podejście do parsowania outputu LLM: `JSON.parse` → fallback `jsonrepair` (trailing commas, brakujące cudzysłowy) → `extractJsonCandidates()` z 3 strategiami (raw text → fenced code block → first `{` to last `}`). Pierwsza która parsuje wygrywa. Must-have w każdym agentic system — LLM regularnie generuje niepoprawny JSON.
- **s03e03** — dwuetapowe parsowanie z `jsonrepair`, hint po naprawie
- **s03e05** — `extractJsonCandidates()` z 3 strategiami, reusable pattern

## File Reference Resolver Pattern
Wzorzec `{{file:path}}` — zamiast kodować binaria base64 w argumentach narzędzia, model deklaruje intencję placeholderem. Resolver rekurencyjnie podmienia placeholdery tuż przed wywołaniem MCP tool. Redukuje użycie kontekstu i koszty.
- **s01e03** — wzorzec placeholderów zamiast base64
- **s05e01** — agenci referencjonują artefakty przez `{{file:path}}` zamiast kopiować treść — oszczędność tokenów + unikanie niespójności

## Skill Plugin System
Katalogi `vault/system/skills/<name>/` z `SKILL.md` (YAML frontmatter + instrukcje). Frontmatter definiuje: `allowed-tools` (scope'owanie narzędzi), `runtime-scripts` (deterministyczne transformacje danych zamiast LLM step-by-step), `user-invocable`, `disable-model-invocation`, `argument-hint`. Komunikat parsowany jako `/skill-name args` → `<metadata>` doklejany do wiadomości + narzędzia ograniczane. Auto-discovery: system skanuje `scripts/` w folderze skilla.
- **s04e01** — pełny system skilli z SKILL.md, per-skill tool scoping, runtime-scripts, auto-discovery

## Sandbox Code Execution
Agent generuje kod zamiast bezpośrednich tool calls, uruchamia w izolowanym środowisku. QuickJS (128MB RAM, 5s timeout) lub Deno (4 poziomy uprawnień: safe/standard/network/full). Architektura 3-procesowa: proces główny ↔ MCP (STDIO) ↔ Sandbox. HTTP Tool Bridge pozwala kodowi w sandboxie wywoływać narzędzia hosta. Kluczowe: redukcja halucynacji, kosztów tokenów i czasu — dane jako zmienne w sandboxie, nigdy w kontekście LLM. Asyncified host functions: asynchroniczne MCP wywoływane synchronicznie z perspektywy QuickJS.
- **s02e05** — QuickJS sandbox, asyncified host functions, executePendingJobs()
- **s03e02** — Deno sandbox, HTTP Tool Bridge, 4 poziomy uprawnień, 150K+ linii danych → 6-10 kroków zamiast setek, dual runtime Bun+Deno
- **s04e01** — Code Mode: inline script LUB script_path, helper API (`codemode.vault.*`, `runtime.exec`), marker-based IPC (`__CODE_MODE_RESULT__=`), output parsowany od końca, wzorzec podobny do Anthropic Code Mode
- **s05e05** — MCP Code Mode: agent wywołuje MCP przez pisanie kodu nie function calling, definicje narzędzi nie w kontekście, odkrywanie przez file-based IPC bridge (write request JSON → poll response JSON), konfigurowalne per agent, sandbox writeback wymaga `commit_sandbox_writeback`

## Structured Outputs
Wymuszanie odpowiedzi w JSON przez JSON Schema. Dwa wymiary: struktura (gwarantowana przez `strict: true`) i wartości (generowane na podstawie nazw/opisów pól). Kolejność pól ma znaczenie — autoregresja. Wartości neutralne (`null`, `"unknown"`) jako mechanizm redukcji halucynacji. Gemini `response_format` wymusza schemę na całej odpowiedzi modelu, nie tylko argumentach narzędzi.
- **s01e01** — dwa wymiary schemy, wartości neutralne, nazwa/opis jako mikroprompt
- **s03e03** — Gemini `response_format` wymusza JSON na całej odpowiedzi (nie tylko tool params), natywne w Interactions API

## Reasoning Models Compatibility
Modele reasoning emitują reasoning items z server-side IDs — przy `store=false` IDs nie replikowalne w kolejnych turach (404). Rozróżnienie parametrów reasoning/non-reasoning konieczne w Responses API.
- **s03e04** — reasoning items z server-side IDs, `store=false` powoduje 404, rozróżnienie parametrów

## Parallelism & Batching
Równoległe wywołania API w grupach (`Promise.all`) dla skrócenia czasu i unikania rate-limit. Batchowanie w obrębie etapu pipeline'u lub parallel function calling w agencie.
- **s01e01** — `Promise.all` w batchach po 5
- **s01e02** — parallel function calling

## Capability Packs
Biblioteki ładowane do LLM-generated artifacts jako prelude — model wybiera z manifestu, system resolwuje i wstrzykuje. Wybór wersji pod kątem capabilities modelu (np. Tailwind v3 nie v4), nie "najlepszych standardów".
- **s03e05** — prelude biblioteki z manifestu, 11 pakietów, wersje pod kątem modelu

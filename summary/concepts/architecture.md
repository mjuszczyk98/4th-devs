# Architektura Agentów i Orkiestracja

---

## Agent Loop / Agentic Loop
Podstawowa pętla agenta: chat → extract tool calls → execute (parallel) → append results → repeat. `MAX_TOOL_STEPS` jako obowiązkowy guard (np. 80). Po wyczerpaniu rzuć błąd, nie zwracaj cicho. Niezależne wywołania parallelize przez `Promise.all`. Conversation state to `[...messages, ...toolCalls, ...toolResults]`. Trójpodział odpowiedzialności: REPL zarządza cyklem sesji, agent loop jednym zapytaniem, system prompt zachowaniem modelu.
- **s01e02** — pętla, guard, parallel function calling, error jako zwykły wynik
- **s01e03** — elementy produkcyjne: limit iteracji, stan per zadanie, model jako decydent
- **s02e01** — konkretna implementacja z MCP, `MAX_STEPS = 50`, trójpodział odpowiedzialności
- **s02e04** — rekurencyjna delegacja `runAgent(agent, task, depth+1)`, `MAX_DEPTH = 3`, `MAX_TURNS = 15`, narzędzie delegate jako JSON Schema interceptowane w pętli
- **s03e04** — pętla z `maxTurns` guard, wynik jako struktura (finalText, turns, reachedMaxTurns, toolCalls), trace zapisuje turn/name/callId/rawArguments/parsedArguments/output
- **s04e01** — bounded turn-based pętla (max 20 tur), server-side kontekst przez `previous_response_id`, reasoning effort z fallbackiem (xhigh→high), paralelne tool execution
- **s04e04** — bounded z conversation accumulation `[...current, ...calls, ...results]`, `Promise.all` na parallel tool calls, depth-aware filtracja narzędzi, pełny kontekst re-sendowany co turn
- **s05e01** — actor loop z maxSteps: processTaskMemory → buildTaskRunInput → LLM → tool execution, terminal tools (`complete_task`, `block_task`) przerywają loop, invocation+result jako Items z sekwencją
- **s05e02** — server-side streaming loop: query → text + tool_calls → execute tools → results → continue (max 6 kroków), `parallel_tool_calls: true`, serwer na czystym `node:http`
- **s05e03** — bounded `for` z `MAX_TURNS=30`, model decyduje o zakończeniu (brak tool calls = odpowiedź końcowa), `parallel_tool_calls: false` dla sekwencyjnych operacji, `store: false`

## MCP (Model Context Protocol)
Otwarty protokół komunikacji host ↔ serwer narzędzi. Trzy role: Host, Client, Server. Pięć capabilities: Tools, Resources, Prompts, Sampling, Elicitation. Dwa transporty: STDIO (subprocess, lokalny, jeden user per proces) i Streamable HTTP (multi-user, OAuth 2.1 z PKCE, produkcyjny default). MCP jest komplementarny wobec natywnego function-callingu — schemy scalają się w jedną listę, model nie widzi różnicy. MCPB pakietuje serwer STDIO w jeden plik. Multi-server routing przez prefixowanie nazw narzędzi (`files__fs_read`). MCP jako abstrakcja narzędzi w agencie — narzędzia pobierane z serwera i konwertowane na format OpenAI. Zmiana źródła danych = zmiana `mcp.json`, zero zmian w kodzie agenta. MCP Apps: serwer MCP wystawia interaktywny HTML jako resource z MIME `text/html;profile=mcp-app`, `structuredContent` zwraca dane dla UI obok `content.text` dla agenta.
- **s01e02** — pozycjonowanie jako wzorzec proxy API ↔ LLM
- **s01e03** — pełne wprowadzenie (role/capabilities/transporty), multi-server routing, declarative config (`mcp.json`)
- **s02e01** — narzędzia z serwera MCP konwertowane na format OpenAI, `StdioClientTransport`, zmiana danych bez zmiany kodu
- **s03e05** — MCP Apps z `registerAppTool`/`registerAppResource`, `visibility: ['app']` scope, `structuredContent` dual-mode, standalone (REST) i embedded (iframe)
- **s04e02** — ograniczenia gotowych klientów MCP: brak samplingu, personalizacja tylko przez opisy narzędzi, brak dwukierunkowej komunikacji z użytkownikiem, problemy z uprawnieniami i wielowątkowością — pełne wsparcie protokołu rzadkie
- **s04e04** — dynamiczna rejestracja narzędzi z serwerów MCP przez stdio, namespace collision prevention przez prefix, scoped access: filesystem rootowany w `./workspace`
- **s05e02** — JSON Schema → Zod (rekursywna konwersja `toZod`), `mcp.callTool()` owinięte w `llm.tool()`, prefiksowanie `serverName__toolName`, `Promise.allSettled` dla graceful degradation
- **s05e03** — `StdioClientTransport` → `listTools()` → translacja `inputSchema` → OpenAI `parameters`, zmiana serwera nie wymaga zmiany agenta, `FS_ROOT` jako sandboxing, konfiguracja deklaratywna w `mcp.json`

## MCP Sampling & Elicitation
Odwrócenie kierunku komunikacji: serwer → klient. **Sampling** — serwer MCP korzysta z LLM klienta bez własnych kluczy API. **Elicitation** — serwer prosi użytkownika o dane/potwierdzenie przez formularz JSON Schema. Framework "delegacji AI". Narzędzia wywołują dodatkowe API/model przez odwrócenie komunikacji — enkapsulują sub-pipeline modeli i API, ukrywając złożoność przed pętlą agenta.
- **s01e03** — odwrócony kierunek, framework delegacji
- **s03e03** — praktyczne zastosowanie: narzędzia orkiestrują sub-pipelines modeli, tool-chaining (np. `listen` wywołuje ASR+analiza, `feedback` wewnętrznie wywołuje TTS)

## MCP Server Development Process
Ustrukturyzowany proces budowy serwera z AI: szablon → `API.md` z dokumentacją → agent czyta manual → propozycja narzędzi → konsolidacja → projekt schematów z perspektywy LLM → implementacja → weryfikacja małym modelem lokalnym jako smoke test.
- **s01e03** — pełny proces development z AI

## Multi-agent / Delegation
Agent jako plik markdown (frontmatter: name, model, tools; body: system prompt). Hot-reload bez restartu. Delegacja przez tool `delegate`: guard `MAX_AGENT_DEPTH = 5`, child z `parentId/sourceCallId/depth+1`, rekurencja, wynik w historii rodzica. Dwa modele komunikacji: `delegate` (sync, blocking, request-response) vs `send_message` (async, fire-and-forget, "karteczka na biurku"). Scout sub-agent: separacja wnioskowania (main agent) od eksploracji danych (scout z własną sesją i system promptem). Scout max 8 tur, sesja persistuje across turns, reset przez `new_session`.
- **s01e05** — agent jako markdown, delegacja z guard depth, delegate vs send_message
- **s02e04** — architektury wieloagentowe (Pipeline/Blackboard/Orchestrator/Tree/Mesh/Swarm), delegate (fire-and-collect) vs message (dwukierunkowy dialog z generatorami JS), agent zarządzający: minimalne narzędzia, maksymalna informacja
- **s03e02** — capability-based task assignment, Agent Templates jako deklaratywne `.agent.md` z capabilities, bounded replanning z budżetem, event sourcing JSONL
- **s03e05** — scout sub-agent: separacja wnioskowania od eksploracji, max 8 tur, persistencja sesji across turns, main agent nigdy nie widzi struktury plików
- **s04e04** — delegacja przez `delegate` z depth-aware tool availability (przy MAX_DEPTH tool fizycznie usuwany), agenci dostają dokładne ścieżki, nie eksplorują filesystemu
- **s05e01** — łączenie Orchestrator + Blackboard + DAG + Events w jednym systemie, Orchestrator dynamicznie tworzy aktorów, Blackboard jako współdzielony stan, DAG deterministyczny
- **s05e05** — Delegation Handoff Envelope: strukturalny kontekst przekazania (parent agentId/revisionId/runId, target agentId/delegationMode/inputFileIds, wersja), delegacja = pełny kontekst relacji nie tylko zadanie

## Multi-agent Architectures
Sześć wzorców koordynacji: **Pipeline** (sekwencyjne przekazanie), **Blackboard** (współdzielony stan, niezależni agenci), **Orchestrator** (centralny koordynator), **Tree** (hierarchia z managerami pośrednimi), **Mesh** (komunikacja adresowana), **Swarm** (rozproszona self-organizacja). Pierwsze cztery dominują, często łączone. Mesh i Swarm rzadko produkcyjnie z LLM.
- **s02e04** — sześć wzorców z tabelarycznym porównaniem, Pipeline/Blackboard/Orchestrator/Tree dominują

## Workflow-as-Data
Workflow zdefiniowany jako plik markdown, nie hardkodowana logika. Orchestrator odczytuje instrukcje przez `read_file` i interpretuje jako kroki. Zmiana procesu = zmiana pliku, bez rekompilacji. CRON jako wzorzec inicjacji: trigger + odniesienie do pliku workflow. Pliki `.md` w `vault/system/workflows/` z frontmatter — ładowane do instrukcji agenta jako obowiązkowe sekcje.
- **s02e04** — workflow jako markdown, zmiana bez rekompilacji, CRON + plik workflow
- **s04e01** — pliki `.md` w `vault/system/workflows/` z frontmatter `{name, description}`, ładowane jako obowiązkowe sekcje instrukcji agenta
- **s04e04** — workflow jako katalog w `ops/` z `_info.md` (metadata, depends_on) + pliki fazowe, instrukcje preskryptywne z listą "Do NOT", każda faza = osobny agent

## Agent-driven Context Assembly
Workspace z danymi w czterech warstwach: goals/, history/, memory/, sources/. Agent sam decyduje co przeczytać, w jakiej kolejności i jak połączyć — nie RAG (wyszukiwanie + wstrzyknięcie), lecz agent-driven assembly. Synteza z korelacją warstw = rola orchestratora.
- **s02e04** — cztery warstwy workspace, agent-decided assembly vs RAG injection

## Nested Delegation
Subagent może sam wzywać innych agentów, nie tylko komunikować z nadrzędnym. Instrukcje muszą uwzględniać reguły przekazywania zadań w głąb hierarchii — wpływa na architekturę całego systemu.
- **s02e05** — subagent wzywa innych agentów, reguły przekazywania w głąb

## Agent Configuration as Markdown
Definicja agenta jako `.agent.md` z gray-matter frontmatter (name, model, tools, capabilities) + body (system prompt). Zachowanie konfigurowalne bez zmiany kodu. Dynamiczne ładowanie i łatwa iteracja. YAML frontmatter z deklaratywnym resolve'owaniem narzędzi: `tools: [think, recall]` we frontmatter → tylko wymienione trafiają do modelu.
- **s02e05** — `.agent.md` z frontmatter, dynamiczne ładowanie
- **s03e02** — Agent Templates z capabilities w YAML frontmatter, capability-based matching
- **s03e05** — YAML frontmatter z deklaratywnym resolve'owaniem narzędzi (`tools: [think, recall]`), scout dostaje narzędzia MCP dynamicznie
- **s04e01** — template agenta w `<name>.agent.md` z interpolacją `{{date}}`, wzbogacany o workflows i skills, wiele agentów z różnymi konfiguracjami
- **s04e04** — `system/agents/<name>.md` z dual-mode prompting (workflow vs standalone), loader parsuje frontmatter
- **s05e01** — agent jako dane (`AgentDefinition` — instrukcje + narzędzia + maxSteps), nie klasa; rejestr agentów, różnicowanie wyłącznie zestawem narzędzi

## Agent Markdown z Rewizjami
Agenci definiowani jako Markdown z YAML frontmatter (gray-matter): model, tools, memory policy, subagent links. Każda zmiana tworzy nową rewizję z checksum SHA256 — pełna historia konfiguracji agenta w czasie. Pełny DSL konfiguracji w YAML: model, sandbox policy, kernel, memory, garden, subagents, narzędzia (mcpMode, nativeTools). Walidowany przez Zod (schema: agent/v1). Agent nie jest promptem, to pełna konfiguracja runtime.
- **s05e04** — Markdown + YAML frontmatter, rewizje z SHA256 checksum, pełna historia konfiguracji
- **s05e05** — pełny DSL agenta (sandbox policy, kernel, memory, garden, subagents, mcpMode), walidacja Zod schema: agent/v1, agent jako konfiguracja runtime nie prompt

## Architecture Primitives
Projektowanie na prymitywach (zdarzenia, artefakty, items) zamiast na funkcjonalnościach (czat, pliki, obrazy). Prymitywy to najprostsze elementy z których buduje się struktury wyższego rzędu — pozwalają rozbudowę bez przebudowy gdy czatbot ewoluuje w system wieloagentowy.
- **s05e01** — prymitywy (events, artifacts, items) vs funkcjonalności, rozbudowa bez przebudowy

## DAG Task Scheduling
Deterministyczny scheduler zarządzający cyklem życia zadań na dynamicznym DAG-u. Stany: todo → in_progress → done|waiting|blocked. `findReadyTasks` filtruje po statusie + zależnościach, `unblockParents` kaskadowo promote po zakończeniu dzieci. Stale task recovery resetuje `in_progress` do `todo` po awarii. Trójpoziomowa obsługa błędów: API → Actor → Task z recovery state.
- **s05e01** — stany DAG, findReadyTasks, unblockParents, stale task recovery, trójpoziomowa obsługa błędów

## Heartbeat Orchestration
Pull-based task queue z round-based reconciliacją. Trzy komponenty: kontrakty (struktura planu/zadań/zależności), heartbeat (manager przydzielający po cyklu), pamięć (filesystem-based). Agenci **claimują** zadania (pull), nie są przypychani (push). Matching po capabilities nie nazwach. Cykl: reconcile → resolve → claim → run → persist → flush. Nowe zadania mogą powstać w trakcie.
- **s03e02** — pull-based queue, capability matching, round-based reconciliation, elastyczne procesy
- **s05e01** — delta vs s03e02: plan zadań kształtowany dynamicznie przez agenta zarządzającego nie określony z góry, scheduler pull-based z max 20 rund

## Goal Contracts
Strukturyzowana definicja celu w `goal.md` z YAML frontmatter: objective, must_have, forbidden, budżety (kroków, replanowania), max zadań, warunki wymagające aprobaty człowieka. LLM planner → walidacja strukturalna → repair loop → materializacja. Gdy cel nieosiągalny → `no-go.md` z powodami. Zapobiega cichym fiaskom.
- **s03e02** — goal.md z frontmatter, LLM planner, walidacja + repair, no-go.md

## Non-blocking Agent Execution
Maszyna stanów `pending → running → waiting → running → completed/failed/cancelled`. Agent w `waiting` ma listę `waitingFor[]`, HTTP zwraca **202 Accepted**. Zewnętrzny system dostarcza przez `POST /deliver`. Agent może czekać na wiele rzeczy jednocześnie jak `Promise.all`. Auto-propagacja wyniku child → parent rekurencyjnie do korzenia.
- **s01e05** — maszyna stanów, HTTP 202, `POST /deliver`, auto-propagacja

## Typy narzędzi (sync/async/agent/human)
Cztery typy po stronie runnera, model widzi tylko definicje z `description`. `sync` — natychmiastowy wynik; `async` — background + deliver; `agent` — spawn child; `human` — zamrożenie + `waitingFor`. Handler typu `human` nic nie robi — runner rozpoznaje typ i omija handler. Celowy design: model wie co, nie jak.
- **s01e05** — cztery typy, model wie co nie jak, MCP po konwencji `server__tool`

## Event-driven Architecture
Fundament systemu agentowego. Każdy event **self-contained** — subscriber nigdy nie sięga do runnera po dane. Eventy niosą `EventContext` (`traceId`, `sessionId`, `agentId`, `rootAgentId`, `depth`) do korelacji w multi-agent. Zdarzenia: `agent.started/completed/failed/waiting/resumed/cancelled`, `turn.started/completed`, `tool.called/completed/failed`, `generation.completed`. Warunek możliwości monitorowania, kompresji kontekstu, moderacji w locie, heartbeat.
- **s01e05** — self-contained events, EventContext, pełna lista zdarzeń, warunek możliwości innych mechanizmów
- **s02e04** — zdarzenia między agentami rozbijają sprzężenie, agent może nasłuchiwać/emitować/zawieszać się, przykład łańcucha obsługi zgłoszenia
- **s03e02** — kaskadowanie zdarzeń z outputu agenta: etykieta = trigger dla downstream (deterministycznych lub agentowych), człowiek też może przypisywać etykiety
- **s05e01** — każda zmiana stanu emituje event przez SSE z buforem max 500, replay na nowe połączenie, fundament dla observability/ewaluacji/guardrails/UI

## Agent Triggers
Pięć typów wyzwalaczy akcji agenta: wiadomości (człowiek/agent), hooki wewnętrzne, webhooki zewnętrzne, cron (harmonogram), heartbeat (regularna kontrola stanu). Wszystkie mogą trafiać do jednego punktu wejścia — agent dynamicznie interpretuje zadanie w NL i dobiera akcję. Kluczowa różnica względem klasycznego event-driven: system agentowy rozumie intencję, nie wymaga mappingu event→handler.
- **s03e03** — pięć typów triggerów, jeden punkt wejścia, NL interpretation vs event→handler mapping

## Agent Phasing
Architektura agenta z fazami: każda faza z własnym promptem i zestawem narzędzi. Model dostaje tylko to co potrzebuje — redukcja complexity i halucynacji. Brak overlapu narzędzi między fazami. State machine z `tryCompletePhase()` resetuje się po ukończeniu. Komplementarne z Capability Stripping: phasing organizuje dostępne narzędzia, stripping je usuwa.
- **s03e03** — fazy z własnymi promptami i narzędziami, state machine, komplementarność z Capability Stripping

## Agent Harness
Pełna obudowa dla agenta: system plików, sandbox do kodu, zarządzanie pamięcią, komunikacja między agentami, observability. ~80% klasycznej inżynierii + ~20% nowej klasy problemów. Cztery kategorie infrastruktury poza oknem kontekstu: sesja (hooki, podsumowania w tle, kolejki zewnętrznych aktualizacji), pamięć (asynchroniczne budowanie wspomnień, Batch API), pliki (komunikacja między agentami, załączniki, notatki), otoczenie (dane spoza urządzenia, wstrzykiwane warunkowo).
- **s01e02** — pełna obudowa agenta
- **s02e01** — cztery kategorie infrastruktury poza oknem kontekstu

## Workspace / Agent File Organization
Przestrzeń plików per data → sesja → agent. Role katalogów: `notes/` i `outbox/` z prawem zapisu agenta, `inbox/` zapisywany wyłącznie przez root. Sub-agenci nie komunikują się bezpośrednio — root routuje dokumenty. Izolacja sesji = izolacja danych użytkowników, egzekwowana programistycznie.
- **s02e01** — hierarchia data→sesja→agent, izolacja przez root routing

## Session Decomposition
Złożone procesy dekomponowane na osobne sesje agentów z tą samą instrukcją, różnymi źródłami, wynikami do współdzielonego systemu plików. Agent skupiony na jednym zadaniu = wyższa jakość. Optymalne kosztowo — płacimy za wielokrotne wczytanie instrukcji, nie za ogromny kontekst. Agent generujący treść do wysyłki = tylko szkic, nigdy auto-wysyłka.
- **s02e03** — osobne sesje per zadanie, współdzielone pliki, szkic nie auto-wysyłka

## Workflow vs Agent
Kryterium: proces o stałej, zdefiniowanej sekwencji → workflow (kontrola, niskie ryzyko, brak elastyczności). Proces gdzie kolejność zależy od kontekstu → agent (elastyczność, autokorekcja, wyższe ryzyko, lepsze rezultaty). Heurystyka: najpierw próbuj zamknąć w workflow; 100% skuteczności wymaga człowieka w pętli. Instrukcja agenta nie może zależeć od zestawu danych — tylko od klasy problemów. Workflow i agent nie są wyborem albo-albo: workflow może być narzędziem agenta.
- **s01e02** — heurystyka i człowiek w pętli
- **s01e03** — kryterium wyboru
- **s01e04** — instrukcja agenta zależy od klasy problemów nie danych, workflow jako narzędzie agenta
- **s02e04** — tabela kryteriów uzasadniających agentów, role człowieka: dashboard nie okno czatu, gdzie wymagania wykluczają LLM
- **s05e03** — agentic jako domyślne podejście — deterministyczną logikę wybiera się tylko przy istotnym powodzie, Agentic RAG prostszy kodowo od klasycznego RAG

## Multi-step Pipelines
Kaskada zapytań LLM: każdy etap ma dedykowany prompt + schemę, wynik etapu N zasila etap N+1. Fragmentowanie inputu dla skupienia uwagi modelu. Separation of concerns — jedno zapytanie = jedna odpowiedzialność. Kaskadowa inwalidacja cache przez hashe.
- **s01e01** — pipeline `extract → dedupe → search → ground`, fragmentowanie, kaskada

## Sync vs Async Collaboration
Dwie kategorie problemów projektowych. Synchroniczna: interfejs centralny, personalizacja na żywo, szersze uprawnienia, feedback dwukierunkowy. Asynchroniczna: interfejs pominięty, procesy predefiniowane, uprawnienia sandboxowane, raportowanie z minimalnym zaangażowaniem. System hybrydowy: edytor + interfejs poleceń + workflow w plikach + agenci z dedykowanymi narzędziami.
- **s04e01** — hybrydowy system 4 elementów, synchroniczne (interaktywne) vs asynchroniczne (batch), brak bezpośredniej współpracy między agentami

## Active Directories (Folder-based Triggers)
Foldery jako interfejs wyzwalania automatyzacji: dokument wstawiony do folderu → transformacja przez agenta → przeniesienie dalej (`concept/ → review/ → ready/ → published/`). Podobny wzorzec: `inbox/ → processing/ → archive/`.
- **s04e03** — foldery jako triggery, pipeline folderowy transformacji dokumentów

## Durable Execution
Persist-first, execute-second: komenda zapisuje stan do DB przed wywołaniem modelu. Fail modelu = work queued, nie lost. Crash recovery z durable state. Route handler zwraca persistent data, nie ephemeral output. Fundamentalny wzorzec produkcyjnego agent runtime.
- **s05e04** — persist-first execute-second, fail = queued nie lost, crash recovery, route handler zwraca persistent data

## Lease-based Crash Recovery
Worker rezerwuje run z claim (expiresAt) + heartbeat co leaseTtlMs/3. Crash = heartbeat stopuje = claim expires = scheduler detect stale = requeue z exponential backoff (baseDelay * 2^(count-2)). Limit maxStaleRecoveries, po czym permanent fail.
- **s05e04** — claim z expiresAt, heartbeat co leaseTtlMs/3, exponential backoff, maxStaleRecoveries

## Readiness Engine
Deterministyczny scheduler odpytujący DB o pary job/run. Stała kolejność priorytetów: child results → wait resumy → crash recovery → nowe zadania. Root runs priorytetyzowane nad child. Rozdziela deterministyczną logikę (scheduler) od niedeterministycznej (LLM).
- **s05e04** — priorytety (child→wait→crash→new), root runs priorytetyzowane, deterministyczny vs niedeterministyczny

## Command Pattern (CQRS-inspired)
Komendy enkapsulują całe operacje biznesowe: walidacja (Zod) → auth → DB writes w transakcji → domain events → typed result. Separacja intent od execution.
- **s05e04** — komendy z walidacją/auth/transakcją/events/result, separacja intent od execution

## Narzędzia z wynikiem Waiting
Narzędzie nie musi zwrócić natychmiastowego wyniku — może zwrócić `{ kind: 'waiting' }`, zawieszając run. Obsługuje asynchroniczne interakcje (człowiek, MCP, upload) bez timeoutu na poziomie tool call. Mechanizm kompakcji kontekstu zachowuje integralność par tool call/response i pending waits — granica tail iteracyjnie dostosowywana, kompakcja nie może ciąć w środku interakcji narzędzia.
- **s05e04** — `{ kind: 'waiting' }` jako wynik, zawieszenie run, asynchroniczne interakcje
- **s05e05** — context compaction z boundary integrity, granica tail dostosowywana iteracyjnie, ochrona par tool call/response

## Event Sourcing z Outbox Pattern
Domain events zapisywane w tej samej transakcji co dane → `event_outbox` → dedykowane workery rozsyłają do SSE, projections, telemetrii. Gwarantuje at-least-once delivery. Rozdziela writes od side effects. Multi-lane: każdy event dispatchowany do niezależnych lanes z osobną retry/quarantine logiką (realtime/SSE, projection, background, observability). Duże payloady kompresowane jako sidecars. Failed events po max retries → quarantine.
- **s05e04** — transakcyjny outbox, at-least-once delivery, separacja writes od side effects
- **s05e05** — multi-lane outbox (realtime/projection/background/observability), retry/quarantine per lane, sidecar compression

## Polling Worker Pattern
Proste polling workers z adaptacyjnym opóźnieniem jako alternatywa dla skomplikowanych message queues. Jeśli była praca → delay=0 (natychmiast sprawdź ponownie). Jeśli nie → czekaj `pollIntervalMs`. `wake()` przerywa oczekiwanie. Wystarczające dla single-server SQLite deployment.
- **s05e05** — adaptacyjne opóźnienie (delay=0 gdy praca), wake() interruption, alternatywa dla message queues

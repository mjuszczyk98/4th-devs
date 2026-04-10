# Koncepty — plik roboczy

Zbiorcza lista konceptów wyodrębnionych z lekcji. Każdy agent pracujący nad kolejną lekcją powinien najpierw **przeczytać ten plik** i używać ISTNIEJĄCYCH nazw konceptów jeśli jego lekcja porusza ten sam temat. Nowe koncepty dodajemy swobodnie.

Format: nagłówek = nazwa kategorii, pod nim krótki opis + lista lekcji z tagiem źródłowym. Szczegóły per-lekcja żyją w `_raw/s0XeY.md`.

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

## Structured Outputs
Wymuszanie odpowiedzi w JSON przez JSON Schema. Dwa wymiary: struktura (gwarantowana przez `strict: true`) i wartości (generowane na podstawie nazw/opisów pól). Kolejność pól ma znaczenie — autoregresja. Wartości neutralne (`null`, `"unknown"`) jako mechanizm redukcji halucynacji. Gemini `response_format` wymusza schemę na całej odpowiedzi modelu, nie tylko argumentach narzędzi.
- **s01e01** — dwa wymiary schemy, wartości neutralne, nazwa/opis jako mikroprompt
- **s03e03** — Gemini `response_format` wymusza JSON na całej odpowiedzi (nie tylko tool params), natywne w Interactions API

## Function Calling / Tool Use
Mechanizm łączenia LLM z otoczeniem: model generuje JSON z nazwą funkcji + argumentami, aplikacja wykonuje i zwraca wynik do kontekstu. Minimum dwa round-tripy per wywołanie. Schematy wszystkich narzędzi liczą się do kontekstu przy każdym zapytaniu. Limit praktyczny: 10-15 narzędzi na agenta. Natywne (web search, code execution) vs własne — można mieszać w jednym zapytaniu.
- **s01e01** — wspomniane jako alternatywa dla Structured Outputs, natywne narzędzia providerów
- **s01e02** — pełny mechanizm, limit narzędzi, mieszanie natywnych i własnych

## Tool Design
Narzędzia LLM to NIE mapowanie API 1:1 — API pisane dla programistów, narzędzia dla modelu bez dokumentacji. Zasady: proste nazwy, minimalna liczba parametrów, opcjonalny `details`, auto-resolucja niepełnych danych, konsolidacja akcji przez parametr `mode`/`operation`, signal-to-noise w opisach, aliasy i defaulty, operacje batchowe, pomijanie hashy/wewnętrznych IDs, podział pól na obowiązkowe/programowe/zabronione. Tool Response Envelope `{ data, hint }` jako standaryzowana koperta z nextActions, confidence scoringiem i recovery. Narzędzia jako cognitive scaffolding — `think` (zero I/O, zmienia zachowanie samą obecnością) i `recall` (delegacja do sub-agenta). Tool visibility scoping przez `visibility: ["app"]`. Zawężanie pełnego API do dedykowanych narzędzi per przypadek użycia. Tool Registry jako `Map<string, Tool>` z per-skill scopingiem — agent fizycznie nie może użyć narzędzia spoza scope'u aktywnego skilla.
- **s01e02** — projektowanie narzędzi dla agenta (bez 1:1 mapowania API)
- **s01e03** — cztery perspektywy projektowania, API audit, tool consolidation (13 → 4 narzędzia Filesystem), dynamic responses (hints), destructive action safeguards
- **s03e04** — Tool Envelope `{ data, hint }` z nextActions/confidence, `.describe()` na polach Zod jako źródło semantyki, zawężanie API per przypadek użycia, modify zwracający stan po zmianie
- **s03e05** — narzędzia jako cognitive scaffolding (`think` zero I/O, `recall` delegacja do scouta), visibility scoping, separation of concerns: conversationalist + retrieval specialist
- **s04e01** — Tool Registry jako `Map<string, Tool>` z `findTool(name)` i `definitions(names?)`, per-skill scoping — agent nie może użyć narzędzi spoza scope'u aktywnego skilla

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

## Error Handling w narzędziach
Błąd nie przerywa pętli agenta — serializuj wyjątek do wyniku narzędzia i zwróć modelowi jak normalny output. Standard wyższy niż dla API: komunikaty opisowe z sugestią następnego kroku (`"team_id nieprawidłowy. Pobierz przez workspace_metadata"`). Obsługa literówek i wariantów. 4-warstwowa walidacja (registry → JSON parse → Zod → handler) z ustandaryzowanym błędem na każdej warstwie. Klasyfikacja błędów przez pattern matching (AUTH_REQUIRED, RATE_LIMITED, TRANSIENT_FAILURE, NOT_FOUND, INVALID_ARGUMENT) ze strategią recovery per kategorię. Zod `.refine()` dla reguł zależnościowych między polami.
- **s01e02** — błąd serializowany jako output, opisowe komunikaty
- **s01e03** — Dynamic Tool Responses (hints): recovery dla błędów, automatyczne korekty, dostępne wartości przy walidacji
- **s03e04** — 4-warstwowa walidacja, klasyfikacja błędów pattern matching, Zod `.refine()` dla reguł zależnościowych
- **s05e01** — trójpoziomowa obsługa: API (retry z exponential backoff na 429/5xx) → Actor (`RecoverableActorError`) → Task (recovery state z `explicit_block`/`llm_transient`/`runtime_error`), stale task recovery

## Prompt Caching
Natywny mechanizm providerów redukujący koszt i latencję przy powtarzających się prefiksach promptów. Stabilny system prompt + stabilny początek wątku = automatyczny cache u OpenAI/Gemini. Dynamiczne dane (data, godzina) w system prompcie niszczą cache — wprowadzaj je przez wyniki narzędzi na końcu wątku. Dodatkowo aplikacyjny caching wyników etapów pipeline'u przez hashe inputu. Definicje narzędzi siedzą pod system promptem — każda zmiana promptu invaliduje cache narzędzi.
- **s01e01** — cache natywny jako krytyczny dla skali + aplikacyjny caching etapów
- **s01e02** — implikacje dla stabilności system promptu
- **s02e01** — dynamiczne dane w wiadomościach usera oddzielone tagami XML, starsze metadane odświeżane przez narzędzia
- **s02e03** — Observational Memory jako architektoniczny killer feature: append-only → pełny cache hit, kontrast z grafowym RAG generującym nowy kontekst per zapytanie
- **s05e01** — SHA-256 z `session_id:task_id:actor_id` jako `prompt_cache_key` w Responses API, stabilny klucz per task-actor, cache hit rate raportowany w podsumowaniu

## Rate Limiting
Limity wywołań API jako wąskie gardło na produkcji. Obejścia: planowanie limitów z wyprzedzeniem, OpenRouter, retry z exponential backoff (429/500/503), równoległość w batchach. Limity providera (RPM/TPM) widoczne w nagłówkach — programistyczna reakcja na zbliżający się limit. Każdy endpoint AI musi mieć własny rate limiting per user.
- **s01e01** — wąskie gardło, obejścia, retry w pipeline
- **s01e05** — limity z nagłówków, rate limiting per user, OpenRouter zarządzanie kluczami per user
- **s05e03** — na skali unieruchamia aplikację, obejścia: OpenRouter jako proxy, rotacja kluczy API, problem persystujący mimo postępu providerów

## Model Selection Strategy
Cztery strategie doboru: (1) jeden główny, (2) główny + alternatywny, (3) główny + specjalistyczne, (4) zespół małych + głosowanie. Teza: nie ma "najlepszego modelu", jest tylko "najlepszy w tej sytuacji". Jedyna miarodajna metoda: testy na własnych zadaniach. Porównanie na tych samych ewaluacjach: pass/fail to za mało — modele różnią się liczbą kroków, stylem komunikacji, stabilnością. Optymalizacja schematów pod mniejsze modele opłacalna nawet gdy docelowo najsilniejszy.
- **s01e01** — cztery strategie, testy jako jedyna metoda
- **s03e04** — porównanie modeli na ewaluacjach (kroki, styl, stabilność), optymalizacja schematów pod mniejsze modele
- **s05e03** — migracja modeli wymaga reewaluacji promptów i instrukcji, mniejsze wersje (mini/nano) wymagają dokładniejszej ewaluacji, migracja może uprościć instrukcje lub umożliwić zwiększenie złożoności

## Provider Abstraction
Anti vendor lock-in. Aplikacja nie powinna być ściśle powiązana z jednym providerem. Abstrakcja warstwy API (OpenAI vs OpenRouter) przez warunkowe budowanie requestów. Frameworki (AI SDK) obecnie nierekomendowane — narzucają ograniczenia bez adekwatnej wartości. Format `provider:model`, adapter per provider tłumaczący wspólny interfejs na natywne API. W multi-agent każdy agent może używać innego providera. Każdy API ma unikalne capabilities — argument za multi-provider architekturą.
- **s01e01** — abstrakcja providerów, argument przeciw frameworkom
- **s01e05** — format `provider:model`, `ProviderInputItem`/`ProviderOutputItem`, OpenRouter jako skrót, multi-agent z różnymi providerami
- **s03e03** — porównanie OpenAI Responses API vs Gemini Interactions API: kontynuacja sesji (`previous_response_id` vs `previous_interaction_id`), schema enforcement, audio output, thinking control
- **s04e01** — OpenAI Responses API: `previous_response_id` jako mechanizm kontynuacji sesji, reasoning effort parametr per model z fallbackiem
- **s05e01** — warstwa tłumaczeń między providerami (system message, reasoning, thought signatures, ograniczenia), web search realizowany różnie per provider, własna logika + SDK > OpenRouter/biblioteki
- **s05e03** — Responses API jako standard branżowy (~4 miesiące adopcji), Assistants API deprecated po 15 miesiącach (uzależniał od provider-specific abstrakcji), multi-provider gotowość wynikająca z dynamiki zmian

## Prompt Organization
Cztery techniki: inline / oddzielne pliki z kompozycją / systemy zewnętrzne (Langfuse) / markdown + YAML frontmatter. Preferowany: markdown + frontmatter — dostępny z FS w runtime, edytowalny przez samych agentów jako narzędzie. Struktura promptu z sekcjami o jasnych rolach: generyczne zasady nawigacji, efficiency (zakaz czytania całych plików przed wyszukiwaniem), rules (cytowanie źródeł), context (jedyna sekcja specyficzna dla domeny).
- **s01e01** — tabela technik, rekomendacja markdown+frontmatter
- **s02e01** — cztery sekcje promptu, sekcja `EFFICIENCY` chroniąca przed marnowaniem tokenów

## System Prompt Design
Składowe: tożsamość, strukturyzacja (tagi XML), limity, ograniczenia, styl, adaptacja, kalibracja. Zasada **"generalizowanie generalizacji"**: zamiast reguły per błąd, kształtuj proces myślowy obejmujący całą kategorię. Instrukcje systemowe nie są mechanizmem bezpieczeństwa — jailbreaking zawsze możliwy. Cztery warstwy: uniwersalne instrukcje, otoczenie (OS/interfejs/zasoby), sesja (kompresja historii), zespół agentów. Instrukcja oparta na regułach rozumowania (jak zbierać dowody, jak dopasowywać, jak radzić sobie z niejednoznacznością), nie krokach procesu. Zgeneralizowane opisy ról narzędzi/pamięci, nie szczegóły. Warstwowa architektura kognitywna: tożsamość → zdolności poznawcze → inteligencja emocjonalna → ekspresja → mechaniki wzmacniające. Kompaktowa lista zasad referująca do mechanizmów (np. hintów) zamiast dublowania logiki.
- **s01e01** — składowe, generalizowanie generalizacji, granice bezpieczeństwa
- **s01e04** — instrukcja oparta na regułach rozumowania nie krokach, wzorzec `image_recognition`
- **s02e01** — cztery warstwy promptu, zgeneralizowane opisy ról, kluczowe pytanie: o czym agent musi wiedzieć PRZED uruchomieniem narzędzi
- **s02e05** — sekcje o odmiennych cyklach życia (Identity/Protocol/Voice/Tools/Workspace/CTA), projektuj pod pozytywne zaskoczenie nie dokładne wykonanie
- **s03e04** — kompaktowa lista zasad (19 linii) referująca do mechanizmu hintów, zasady opisują kiedy użyć narzędzia nie jak działa
- **s03e05** — warstwowa architektura kognitywna, zgeneralizowane instrukcje opisują postawy nie procedury, wiedza o sobie/otoczeniu z zewnątrz nie bazowa wiedza modelu

## In-context Learning / Few-shot
Model uczy się wzorców z przykładów w kontekście. Sekcja `<examples>` działa lepiej niż opis zasad słowami dla klasyfikacji/formatowania. Trend: zgeneralizowane zasady w prompcie + dynamiczne ładowanie przykładów przez narzędzia agenta zamiast statycznego wbijania.
- **s01e01** — few-shot/many-shot, trend ku dynamicznemu ładowaniu
- **s05e03** — BootstrapFewShot przez Ax/DSPy: uruchomienie na training set → traces z udanych predykcji → zapis jako few-shot dema, progressive enhancement: baseline → ręczne examples → zoptymalizowane demosy, `demos.json` jako build artifact

## Chain-of-Thought / Reasoning Control
Tokeny rozumowania jako osobny sygnał (`reasoning: { effort: "medium" }`) mierzone w `reasoning_tokens`. "Modele myślą generując tokeny" — nie optymalizuj agresywnie zwięzłości. Wbudowany reasoning (LRM) pomaga trudnym, szkodzi prostym zadaniom ("Don't Overthink it"). Techniki sterowania uwagą: Planowanie (lista zadań jako narzędzie), Odkrywanie (prowadź przez eksplorację pamięci), Przekierowanie (focus na stanie środowiska), Uśrednianie (wiele modeli → głosowanie). **Premise Order Matters** (arxiv 2402.08939) — kolejność informacji wpływa nawet o 40%. Sterowanie uwagą bez modyfikacji system promptu: lista zadań (model przepisuje pozostałe), tryb planowania (sygnał w user message, cache bezpieczny). Reasoning model z `summary: "auto"` oszczędza kontekst. CoT jako explicit tool (`think`) zamiast prompting technique — zero I/O, wymusza metarefleksję. Narzędzie `recall` tworzy drugą warstwę reasoning.
- **s01e01** — reasoning tokens jako sygnał, myślenie przez generowanie
- **s01e02** — LRM pomaga/szkodzi, cztery techniki sterowania uwagą, Premise Order Matters
- **s02e01** — lista zadań jako narzędzie (treść generowana przez model wpływa silniej), tryb planowania cache-safe, `summary: "auto"`
- **s03e05** — CoT jako explicit tool `think` (zero I/O, obecność w definicjach zmienia zachowanie), `recall` jako druga warstwa reasoning z delegacją do scouta

## Semantic Events & Rendering
Interakcja z LLM to seria zdarzeń (tekst, tool calls, reasoning, obrazy, błędy, potwierdzenia), nie prosta para Q&A. Architektura: oddziel LLM ↔ warstwę stanu aplikacji ↔ UI. Semantyczne zdarzenia z ID/typem/metadanymi zamiast surowego tekstu. Streaming markdown→HTML wymaga obsługi niekompletnych fragmentów (code blocks, LaTeX, tabele). Biblioteki: Streamdown, Markdown Parser.
- **s01e01** — seria zdarzeń zamiast Q&A, trójwarstwowa architektura, streaming
- **s05e02** — event sourcing SSE jako source of truth, deduplikacja przez `eventIdsByMessageId` + `lastSeq`, dwie ścieżki renderingu (pełna O(n), przyrostowa O(1)), `store: false` utrzymuje pełną kontrolę kontekstu po stronie serwera

## Dynamic / Generative UI
Kierunek: od tekstu do dynamicznie generowanych interfejsów. Standardy: MCP Apps, Apps SDK, JSON Render. AI generuje interaktywne komponenty i wizualizacje. Proces wstrzymywany na potwierdzenie użytkownika lub wynik innego agenta. Spektrum trzech strategii: **Artifacts** (LLM generuje pełny HTML, niska kontrola), **Render** (JSON spec z katalogu komponentów, server-side rendering, średnia kontrola), **MCP Apps** (UI predefiniowany, model izolowany od kodu, pełna kontrola). Kluczowe: widoczność kodu dla modelu (pełna w Artifacts/Render, brak w MCP Apps). Przesunięcie roli projektanta z detali w stronę struktur.
- **s01e01** — kierunek rozwoju, standardy, wstrzymywanie procesu
- **s03e05** — spektrum trzech strategii (Artifacts/Render/MCP Apps), `registerAppTool`/`registerAppResource`, `visibility: ['app']` scope, `structuredContent` dual-mode

## Multimodality
Zdolność modeli do obsługi różnych modalności (tekst, obraz, audio). Gemini Interactions API i OpenAI Responses API prowadzą w kategorii. Argument za projektowaniem architektury na wielu providerów. Problem załączników nie jest adresowany przez żadne API, brak standardu branżowego — LLM widzi zawartość pliku, ale nie referencję, nie może przekazać jej narzędziu ani innemu agentowi. Autorska konwencja: tag `<media src="...">` jako trzeci element wiadomości, resolver zamienia na Base64/URL tuż przed wywołaniem. Vision/audio modele rozumieją ton, emocje, dźwięki otoczenia, diaryzacja działa bez treningu.
- **s01e01** — liderzy providerzy, argument za multi-provider
- **s01e04** — problem załączników, brak standardu, `<media src>` resolver, diaryzacja bez treningu

## Agent Memory Schema
Modele danych: czatbot (`conversations` + `messages`) vs system wieloagentowy (`sessions` + `agents` + `items`). Tabela `items` unifikuje wiadomości, tool calls i załączniki jako atomy interakcji. Umożliwia dwukierunkową komunikację między agentami i zatwierdzanie akcji przez użytkownika. Produkcyjny model: `users`, `sessions`, `agents`, `items` (Drizzle/SQLite). Items jako polimorficzny log z type guardami i sequence number per agent. Repository pattern z identycznym interfejsem dla in-memory i SQLite. Domain model jako czyste funkcje zwracające `TransitionResult` (Result type zamiast wyjątków).
- **s01e01** — dwa modele danych, tabela `items` jako atomy
- **s01e05** — produkcyjny model (Drizzle/SQLite), polimorficzny log, repository pattern, Result type
- **s05e01** — model domenowy: Session, Actor, Task, Item, Artifact, Relation. Generyczny `Relation` z polimorficznym joinem zastępującym specjalistyczne tabele. Graf zadań nad FileStore (JSON) — DAG nie wymaga dedykowanej bazy grafowej

## Web Search Grounding
Natywne narzędzie providerów (`tools: [{ type: "web_search_preview" }]` w OpenAI, suffix `:online` w OpenRouter) pozwala modelowi odpytać web w trakcie generowania. Ekstrakcja źródeł z `web_search_call` / `url_citation`. Wzorzec owijania fraz w `<span class="grounded">` jako grounding odpowiedzi.
- **s01e01** — pipeline z web search, ekstrakcja źródeł, grounding spans

## Open-source Models & Quantization
Formaty GGUF (cross-platform, llama.cpp) vs MLX (Apple Silicon). Kwantyzacja = kompresja wag (Q2-Q8); Q4/Q5 = rozsądny balans. VRAM/Unified Memory jako główne ograniczenie. Testowanie: LM Studio (lokalnie) lub OpenRouter (zdalnie). Open-source bije komercyjne w wybranych zadaniach specjalistycznych i przy wymogach prywatności.
- **s01e01** — formaty, kwantyzacja, wymagania VRAM

## Tokenization
Token = fragment tekstu (część słowa, słowo, znak). Język polski zużywa ~50-70% więcej tokenów niż angielski — realny wpływ na koszt, latencję, efektywne wykorzystanie okna kontekstowego.
- **s01e01** — tokenizacja, koszt języka polskiego

## Multi-step Pipelines
Kaskada zapytań LLM: każdy etap ma dedykowany prompt + schemę, wynik etapu N zasila etap N+1. Fragmentowanie inputu dla skupienia uwagi modelu. Separation of concerns — jedno zapytanie = jedna odpowiedzialność. Kaskadowa inwalidacja cache przez hashe.
- **s01e01** — pipeline `extract → dedupe → search → ground`, fragmentowanie, kaskada

## Parallelism & Batching
Równoległe wywołania API w grupach (`Promise.all`) dla skrócenia czasu i unikania rate-limit. Batchowanie w obrębie etapu pipeline'u lub parallel function calling w agencie.
- **s01e01** — `Promise.all` w batchach po 5
- **s01e02** — parallel function calling

## Agent Harness
Pełna obudowa dla agenta: system plików, sandbox do kodu, zarządzanie pamięcią, komunikacja między agentami, observability. ~80% klasycznej inżynierii + ~20% nowej klasy problemów. Cztery kategorie infrastruktury poza oknem kontekstu: sesja (hooki, podsumowania w tle, kolejki zewnętrznych aktualizacji), pamięć (asynchroniczne budowanie wspomnień, Batch API), pliki (komunikacja między agentami, załączniki, notatki), otoczenie (dane spoza urządzenia, wstrzykiwane warunkowo).
- **s01e02** — pełna obudowa agenta
- **s02e01** — cztery kategorie infrastruktury poza oknem kontekstu

## MCP (Model Context Protocol)
Otwarty protokół komunikacji host ↔ serwer narzędzi. Trzy role: Host, Client, Server. Pięć capabilities: Tools, Resources, Prompts, Sampling, Elicitation. Dwa transporty: STDIO (subprocess, lokalny, jeden user per proces) i Streamable HTTP (multi-user, OAuth 2.1 z PKCE, produkcyjny default). MCP jest komplementarny wobec natywnego function-callingu — schematy scalają się w jedną listę, model nie widzi różnicy. MCPB pakietuje serwer STDIO w jeden plik. Multi-server routing przez prefixowanie nazw narzędzi (`files__fs_read`). MCP jako abstrakcja narzędzi w agencie — narzędzia pobierane z serwera i konwertowane na format OpenAI. Zmiana źródła danych = zmiana `mcp.json`, zero zmian w kodzie agenta. MCP Apps: serwer MCP wystawia interaktywny HTML jako resource z MIME `text/html;profile=mcp-app`, `structuredContent` zwraca dane dla UI obok `content.text` dla agenta.
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

## Security & Sandboxing
Każda granica dostępu wymuszona przez kod, nie prompt. Path traversal blokowany w handlerze. Model nie ustala `user_id`, uprawnień, ścieżek poza sandbox. Akcje nieodwracalne → potwierdzenie przez UI (przycisk), nie tekst. Wzorzec dry-run: agent testuje przed wykonaniem. Destructive action safeguards: checksum (współbieżność), dryRun (podgląd), historia zmian (rollback), ograniczenia zakresu usuwania, koncepcja "kosza". Bearer auth z kluczami SHA-256. `AbortSignal` propagation przez cały stack. Niewłaściwych zachowań modelu nie da się wyeliminować — aplikacja musi informować i być zabezpieczona prawnie.
- **s01e02** — bezpieczeństwo przez kod, dry-run, potwierdzenia UI
- **s01e03** — destructive action safeguards, `FS_ROOT` egzekwowany programistycznie
- **s01e05** — Bearer auth SHA-256, AbortSignal propagation, graceful shutdown, wymogi prawne
- **s02e02** — walidacja plików wejściowych RAG (rozmiar, format, mime-type, źródło), moderacja treści, wygasające linki
- **s02e04** — path traversal w multi-agent (`isPathSafe()` weryfikuje resolved path), operacje plikowe scoped do workspace
- **s02e05** — połączenia między narzędziami jako wektor obejścia restrykcji, sandbox code execution jako mitygacja
- **s03e02** — zero-trust z sześcioma warstwami obrony, capability stripping, izolacja danych, audit trail, privacy by design (`store: false`), adwersarz testowy
- **s03e04** — send whitelist jako guardrail w kodzie handlera, adresat poza whitelistą → automatyczny draft (`policy.enforcedDraft=true`), zasada "AI proposes, code decides"
- **s04e05** — pięć kategorii ryzyka enterprise (wyciek, destrukcja, nieautoryzowane akcje, wprowadzenie w błąd, omijanie zabezpieczeń), zaufanie infrastruktury ≠ zaufanie outputu, sandbox + CSP + path traversal
- **s05e01** — scope uprawnień systemu plików dla agentów, ryzyko nieprzewidzianych akcji destrukcyjnych wymaga sandboxingu innego niż klasyczna aplikacja
- **s05e03** — `FS_ROOT` w konfiguracji MCP serwera — sandboxing na poziomie systemu plików, serwer nie może operować poza wskazanym katalogiem

## Prompt Injection
Problem otwarty, brak skutecznej obrony. Agent czytający email/web może wykonać instrukcje z treści. Przykład: agent z kalendarzem + pocztą wysyła plan spotkań obcej osobie na prośbę z emaila. Jedyne mitygacje: ograniczenia środowiskowe (sandbox, whitelisty, izolacja), nieudostępnianie zasobów wrażliwych.
- **s01e02** — problem + mitygacje środowiskowe
- **s01e03** — kontynuacja: w publicznych MCP brak widoczności otoczenia wymaga programistycznych ograniczeń
- **s02e02** — zewnętrzne dokumenty wczytane do kontekstu jako wektor ataku, analogia XSS, filtrowanie przez LLM niewiarygodne
- **s03e02** — osobny prompt w izolowanym zapytaniu jako bariera, fraza weryfikacyjna sprawdzana programistycznie nie przez LLM, atakujący nie zna frazy

## Workflow vs Agent
Kryterium: proces o stałej, zdefiniowanej sekwencji → workflow (kontrola, niskie ryzyko, brak elastyczności). Proces gdzie kolejność zależy od kontekstu → agent (elastyczność, autokorekcja, wyższe ryzyko, lepsze rezultaty). Heurystyka: najpierw próbuj zamknąć w workflow; 100% skuteczności wymaga człowieka w pętli. Instrukcja agenta nie może zależeć od zestawu danych — tylko od klasy problemów. Workflow i agent nie są wyborem albo-albo: workflow może być narzędziem agenta.
- **s01e02** — heurystyka i człowiek w pętli
- **s01e03** — kryterium wyboru
- **s01e04** — instrukcja agenta zależy od klasy problemów nie danych, workflow jako narzędzie agenta
- **s02e04** — tabela kryteriów uzasadniających agentów, role człowieka: dashboard nie okno czatu, gdzie wymagania wykluczają LLM
- **s05e03** — agentic jako domyślne podejście — deterministyczną logikę wybiera się tylko przy istotnym powodzie, Agentic RAG prostszy kodowo od klasycznego RAG

## Query Transformation
Zapytanie użytkownika rzadko pasuje 1:1 do zasobów. Ekspansja przez synonimy i powiązane zagadnienia zwiększa hit rate. Agent musi mieć ogólną mapę bazy wiedzy (np. `_index.md`). Pytania doprecyzowujące jako pierwszy krok. Agent generuje warianty słów kluczowych, synonimy i terminy z wcześniejszych wyników w pętli pogłębiania. Problem języka rozwiązany jedną linią w prompcie o języku treści, nie logiką translacji.
- **s01e02** — ekspansja, mapa wiedzy, pytania doprecyzowujące
- **s02e01** — warianty słów kluczowych z wyników, problem języka rozwiązany w prompcie
- **s02e02** — cross-language retrieval, `_index.md`, synonimy i pod-zapytania w RAG, embedding wielojęzyczny gdy FTS zawodzi

## Augmented Function Calling
Instrukcje kontekstowe doklejane do wywołania narzędzia (np. stały styl obrazów). Tryby: statyczny (user-driven), dynamiczny (model-driven przez nazwę/opis), hybrydowy. Może zarządzać skillami (aktywacja/tworzenie) i sekwencjami akcji. Konfiguracja runtime przez pliki (`style-guide.md`, `template.html`) czytane przez agenta przed pierwszą akcją — oddziela reguły stylu/szablony od instrukcji systemnej. Szablon jako master reference, nigdy edytowany bezpośrednio, zawsze klonowany.
- **s01e02** — tryby, zarządzanie skillami
- **s01e04** — konfiguracja runtime przez pliki, separacja reguł stylu od instrukcji systemowej, wzorzec klonowania szablonu

## File Reference Resolver Pattern
Wzorzec `{{file:path}}` — zamiast kodować binaria base64 w argumentach narzędzia, model deklaruje intencję placeholderem. Resolver rekurencyjnie podmienia placeholdery tuż przed wywołaniem MCP tool. Redukuje użycie kontekstu i koszty.
- **s01e03** — wzorzec placeholderów zamiast base64
- **s05e01** — agenci referencjonują artefakty przez `{{file:path}}` zamiast kopiować treść — oszczędność tokenów + unikanie niespójności

## Observability / Token Tracking
Kumulacja `input_tokens`, `cached_tokens`, `output_tokens` z API jako podstawowa obserwowalność kosztów i cache hit rate w pętli agenta. Breakdown kosztów per sesja z wyświetlaniem po każdym wywołaniu API. Rozszerzona obserwowalność: Langfuse subscriber mapuje eventy agenta na traces/spany/generacje z timeline odtwarzalnym przy opóźnionym przetwarzaniu.
- **s01e03** — token usage tracking w pętli
- **s01e05** — Langfuse traces/spany/generacje, dwupoziomowe (logi + śledzenie agenta), `EventContext` do korelacji
- **s02e01** — breakdown kosztów per sesja (input/output/reasoning/cached), komenda `clear` resetuje historię i statystyki
- **s02e02** — token accounting w pipeline RAG, osobna statystyka per request przy wielokrotnych search/embedding
- **s03e01** — pełna hierarchia (Session→Trace→Span→Generation→Tool→Event), AsyncLocalStorage propagation, graceful degradation, dekorator `withGenerationTracing`, kontekst vs metadata
- **s03e02** — eval suite (Langfuse) z 4 suitami testowymi, audit trail dostępu do wiedzy (`knowledgeAccessLog`), token estimation z autokalibracją
- **s03e05** — JSONL trace per data jako audit trail (request, response, tool result z timestampem, modelem, statusem, preview), label odróżnia sesje agent od scout
- **s05e01** — `TokenUsage` akumulowany na sesji z dwóch źrórzeł (actor loop + observer/reflector), cache hit rate: `cachedTokens / inputTokens * 100%`, podsumowanie sesji z pełnym breakdown
- **s05e03** — strukturalne logowanie JSONL per sesja — każda linia niezależny JSON ze schematem zdarzeń (`user.message`, `turn.start`, `tool.call`, `tool.result`, `memory.compacted`), rekonstrukcja dokładnego przebiegu sesji

## MCP Server Development Process
Ustrukturyzowany proces budowy serwera z AI: szablon → `API.md` z dokumentacją → agent czyta manual → propozycja narzędzi → konsolidacja → projekt schematów z perspektywy LLM → implementacja → weryfikacja małym modelem lokalnym jako smoke test.
- **s01e03** — pełny proces development z AI

## Generative Media Loop
Wzorzec pętli tworzenia mediów: **generuj → analizuj → accept/retry**. Agent nie widzi natywnie outputu narzędzi wizualnych (obraz, wykres, PDF, wynik `execute_code`). Wymaga dedykowanego narzędzia `analyze_image` z ustrukturyzowanym werdyktem. RETRY tylko przy blocking issues; drobne niedoskonałości = ACCEPT — inaczej nieskończona pętla poprawek.
- **s01e04** — wzorzec pętli generuj→analizuj→accept/retry, `analyze_image`, zasady ACCEPT/RETRY

## JSON Prompt Templates
Strukturyzowanie promptu do generowania mediów jako plik JSON. Precyzyjna edycja jednej sekcji bez tykania reszty (styl/paleta/oświetlenie/negative prompt), powtarzalność stylu, oszczędność tokenów (ścieżka zamiast treści), wersjonowanie. Workflow: COPY template → EDIT subject → READ full JSON → PASS path.
- **s01e04** — template JSON, workflow COPY→EDIT→READ→PASS, wersjonowanie

## Visual References
Obrazy referencyjne jako tablica `reference_images` sterują kompozycją, pozą, kadrem. Spójność postaci między scenami, in/out-painting. Agent wnioskuje odpowiednią referencję z opisu użytkownika. W wideo: ostatnia klatka segmentu → pierwsza klatka następnego pozwala łączyć krótkie generacje w dłuższe sekwencje.
- **s01e04** — reference_images, spójność postaci, łączenie segmentów wideo

## Visual Hallucinations
Modele generujące obrazy halucynują analogicznie do tekstowych: ~95% poprawnych detali, ~5% subtelnych glitchy. Subtelne błędy trudniejsze do wyłapania niż oczywiste. Weryfikacja ludzka konieczna, zawsze łatwiejsza niż praca od zera.
- **s01e04** — ~95/5 rozkład błędów, weryfikacja ludzka konieczna

## Media Cost Control
Wideo jako najdroższa modalność: ~300 tokenów/sekundę, 1h ≈ 1M tokenów. Mechanizmy: clipping (`start_time`/`end_time`), redukcja FPS, przyspieszenie nagrania. Audio: trade-off ceny/jakości/latencji między rozdzielonym TTS/STT, multimodal i real-time.
- **s01e04** — wideo ~300 tok/s, mechanizmy kontroli, audio trade-offy

## Document Generation Asymmetry
Generowanie PDF przez HTML → Puppeteer jest proste; przetwarzanie istniejących PDF-ów to osobny poważny problem (dedykowane API providerów, LlamaIndex). Wzorzec: template HTML + style-guide → klon → modyfikacja body → osadzanie obrazów → konwersja. Iteracyjne poprawki fragmentów bez przerabiania całości.
- **s01e04** — asymetria generowanie vs przetwarzanie PDF, wzorzec template→klon→modyfikacja

## Audio UX
Gdy output jest audio, styl agenta musi być dostosowany do medium: bez URL-i, tabel, formatowania markdown. Kontrola stylu TTS przez naturalny język wstawiany w tekst ("Say cheerfully:"). Multi-speaker przez przypisywanie głosów do rozmówców.
- **s01e04** — styl audio bez markdown, kontrola TTS naturalnym językiem, multi-speaker

## Human-in-the-Loop
Kontrola nad akcjami agenta przez deterministyczne potwierdzenia (kod, nie LLM) zawierające pełne detale akcji. Trzy warstwy obrony: statyczna whitelist, dynamiczne confirmation UI, trust escalation. Jeśli przypadkowe wycieki są niedopuszczalne, a potwierdzenie niewystarczające — LLM nie powinien być wdrożony.
- **s01e05** — trzy warstwy obrony, deterministyczne potwierdzenia, kryterium niewdrożenia
- **s03e02** — człowiek jako final gate: agent nigdy nie wykonuje nieodwracalnych akcji, kategoryzuje/etykietuje/szkicuje, człowiek decyduje

## Trust Escalation
Mechanizm redukujący friction przy powtarzalnych akcjach. Trzy poziomy: jednorazowe tak, zaufanie na sesję, odrzucenie. Identyfikacja narzędzia jako `server__action` (bezkolizyjnie). **Auto-revoke** trust przy każdej zmianie nazwy/opisu/schematu — krytyczne dla MCP. Zaufanie sesyjne, nie permanentne.
- **s01e05** — trzy poziomy, auto-revoke przy zmianie schematu, zaufanie sesyjne

## Moderacja treści
Niestosowanie OpenAI Moderation API może prowadzić do zablokowania konta organizacji (nie klucza). Zakres moderacji wykracza poza prawo — obejmuje sam zakres działania systemu. Weryfikacja przez prompt zwracający ustrukturyzowaną odpowiedź, decyzję o dalszym przebiegu podejmuje kod. Może fałszywie blokować legalne akcje.
- **s01e05** — ryzyko blokady konta, moderacja przez prompt + kod, false positives
- **s05e03** — brak moderacji = ryzyko zablokowania konta organizacji za treści generowane przez userów, Moderation API + własne filtry na wejściu i wyjściu jako obowiązkowa warstwa

## Halucynacje / Niejawne limity
Gwarancja struktury ≠ gwarancja wartości — poprawny JSON z fałszywymi danymi nie zostanie wykryty. Modele Flash potrafią halucynować treść strony z samego URL. Mitygacje: informowanie modelu o ograniczeniach, instrukcje przy braku danych, zmniejszenie złożoności, **zmniejszenie objętości kontekstu**. Często wynikają z błędów aplikacji (źle wczytane instrukcje, model informowany o niedostępnych narzędziach).
- **s01e05** — struktura ≠ wartość, mitygacje, błędy aplikacji jako źródło halucynacji

## Event-driven Architecture
Fundament systemu agentowego. Każdy event **self-contained** — subscriber nigdy nie sięga do runnera po dane. Eventy niosą `EventContext` (`traceId`, `sessionId`, `agentId`, `rootAgentId`, `depth`) do korelacji w multi-agent. Zdarzenia: `agent.started/completed/failed/waiting/resumed/cancelled`, `turn.started/completed`, `tool.called/completed/failed`, `generation.completed`. Warunek możliwości monitorowania, kompresji kontekstu, moderacji w locie, heartbeat.
- **s01e05** — self-contained events, EventContext, pełna lista zdarzeń, warunek możliwości innych mechanizmów
- **s02e04** — zdarzenia między agentami rozbijają sprzężenie, agent może nasłuchiwać/emitować/zawieszać się, przykład łańcucha obsługi zgłoszenia
- **s03e02** — kaskadowanie zdarzeń z outputu agenta: etykieta = trigger dla downstream (deterministycznych lub agentowych), człowiek też może przypisywać etykiety
- **s05e01** — każda zmiana stanu emituje event przez SSE z buforem max 500, replay na nowe połączenie, fundament dla observability/ewaluacji/guardrails/UI

## Non-blocking Agent Execution
Maszyna stanów `pending → running → waiting → running → completed/failed/cancelled`. Agent w `waiting` ma listę `waitingFor[]`, HTTP zwraca **202 Accepted**. Zewnętrzny system dostarcza przez `POST /deliver`. Agent może czekać na wiele rzeczy jednocześnie jak `Promise.all`. Auto-propagacja wyniku child → parent rekurencyjnie do korzenia.
- **s01e05** — maszyna stanów, HTTP 202, `POST /deliver`, auto-propagacja

## Typy narzędzi (sync/async/agent/human)
Cztery typy po stronie runnera, model widzi tylko definicje z `description`. `sync` — natychmiastowy wynik; `async` — background + deliver; `agent` — spawn child; `human` — zamrożenie + `waitingFor`. Handler typu `human` nic nie robi — runner rozpoznaje typ i omija handler. Celowy design: model wie co, nie jak.
- **s01e05** — cztery typy, model wie co nie jak, MCP po konwencji `server__tool`

## Multi-agent / Delegation
Agent jako plik markdown (frontmatter: name, model, tools; body: system prompt). Hot-reload bez restartu. Delegacja przez tool `delegate`: guard `MAX_AGENT_DEPTH = 5`, child z `parentId/sourceCallId/depth+1`, rekurencja, wynik w historii rodzica. Dwa modele komunikacji: `delegate` (sync, blocking, request-response) vs `send_message` (async, fire-and-forget, "karteczka na biurku"). Scout sub-agent: separacja wnioskowania (main agent) od eksploracji danych (scout z własną sesją i system promptem). Scout max 8 tur, sesja persistuje across turns, reset przez `new_session`.
- **s01e05** — agent jako markdown, delegacja z guard depth, delegate vs send_message
- **s02e04** — architektury wieloagentowe (Pipeline/Blackboard/Orchestrator/Tree/Mesh/Swarm), delegate (fire-and-collect) vs message (dwukierunkowy dialog z generatorami JS), agent zarządzający: minimalne narzędzia, maksymalna informacja
- **s03e02** — capability-based task assignment, Agent Templates jako deklaratywne `.agent.md` z capabilities, bounded replanning z budżetem, event sourcing JSONL
- **s03e05** — scout sub-agent: separacja wnioskowania od eksploracji, max 8 tur, persistencja sesji across turns, main agent nigdy nie widzi struktury plików
- **s04e04** — delegacja przez `delegate` z depth-aware tool availability (przy MAX_DEPTH tool fizycznie usuwany), agenci dostają dokładne ścieżki, nie eksplorują filesystemu
- **s05e01** — łączenie Orchestrator + Blackboard + DAG + Events w jednym systemie, Orchestrator dynamicznie tworzy aktorów, Blackboard jako współdzielony stan, DAG deterministyczny
- **s05e05** — Delegation Handoff Envelope: strukturalny kontekst przekazania (parent agentId/revisionId/runId, target agentId/delegationMode/inputFileIds, wersja), delegacja = pełny kontekst relacji nie tylko zadanie

## Wydajność / UX agenta
Wydajność modeli adresowana przez architekturę, nie model. **Heartbeat** — wgląd w kroki (zmienia postrzeganą wydajność). **Wielowątkowość** — kolejka wiadomości, stan UI oddzielony od backendu. **Przetwarzanie w tle** — zadanie musi przeżyć zamknięcie przeglądarki. **Zasada "czy AI tu jest niezbędne"** — jeśli da się kodem, zrób kodem. Ostateczność: fine-tuning / destylacja.
- **s01e05** — heartbeat, wielowątkowość, zasada "czy AI niezbędne", fine-tuning jako ostateczność
- **s05e03** — przyciski zamiast czatu gdy akcja prosta, czat sensowny na skali lub przy złożonych akcjach, cache + równoległość + streaming jako standardowe techniki latencji

## Koszty LLM
LRM: niższa cena/token ale znacznie więcej thinking tokens. Proporcja 1:50 (user:model). Tańszy model ≠ tańsze rozwiązanie (więcej kroków = wyższy koszt). AI ambientowe: małe zadania w krótkich interwałach sumują się drastycznie.
- **s01e05** — proporcja 1:50, tańszy model ≠ tańsze rozwiązanie, AI ambientowe
- **s05e03** — 1-3% użytkowników generuje większość kosztów, twarde limity per user i dedykowane klucze jako konieczność, monitorowanie kosztów w szerszym kontekście biznesowym

## Streaming
`executeTurnStream()` jako `AsyncGenerator` — yielduje eventy w trakcie, zwraca finalny `TurnResult`. SSE na poziomie HTTP. `runAgent` i `runAgentStream` dzielą tę samą logikę pętli, różnią się sposobem zwracania. Stream kończy się gdy agent wchodzi w `waiting`.
- **s01e05** — AsyncGenerator, SSE, stream vs non-stream ta sama logika
- **s05e02** — batchowanie SSE przez `requestAnimationFrame`, bufor pending flushowany raz na klatkę, stabilny 60fps

## Deployment produkcyjny
VPS → Ubuntu z SSH key auth → git, node, nginx, ufw → DNS + TLS (certbot) → GitHub Actions self-hosted runner → reverse proxy nginx → secrets w repo settings → workflow `.yml` na push do main.
- **s01e05** — pełny stack deployment VPS, self-hosted runner, nginx reverse proxy

## Realia biznesowe aplikacji AI
Aplikacja AI to ~80% klasycznego software. Ograniczenia nie tylko modeli: rozproszone bazy wiedzy, nieustrukturyzowane procesy, narzędzia bez API, brak dostępu do aktualnych danych. Rzadko pełna automatyzacja — częściej optymalizacja o kilka-kilkanaście procent. Użytkownicy nieświadomi limitów LLM. Wymóg projektowy, nie zarzut.
- **s01e05** — ~80% klasyczny software, rzadka pełna automatyzacja, nieświadomi użytkownicy

## Agentic RAG / Agentic Search
Agent domyślnie nie wie, o czym wie — buduje kontekst przez iteracyjne wyszukiwanie. Czterofazowa strategia: **Skanowanie** (struktura, nagłówki), **Pogłębianie** (pętla szukaj→czytaj→zbierz terminy→szukaj), **Eksplorowanie** (tropy przyczyna/skutek, część/całość), **Weryfikacja pokrycia**. Zasady działają niezależnie od źródła danych — jedyny specyficzny fragment to charakter danych. Operujemy w obszarze prawdopodobieństwa, nie pewności.
- **s02e01** — czterofazowa strategia, niezależna od źródła danych, prawdopodobieństwo nie pewność
- **s02e02** — infrastruktura RAG (indeksowanie, chunking, embedding, hybrid search, RRF), progresja architektury od filesystem do dedykowanych silników

## Workspace / Agent File Organization
Przestrzeń plików per data → sesja → agent. Role katalogów: `notes/` i `outbox/` z prawem zapisu agenta, `inbox/` zapisywany wyłącznie przez root. Sub-agenci nie komunikują się bezpośrednio — root routuje dokumenty. Izolacja sesji = izolacja danych użytkowników, egzekwowana programistycznie.
- **s02e01** — hierarchia data→sesja→agent, izolacja przez root routing

## Context Masking (Manus technique)
Uzupełnianie początku wypowiedzi modelu tokenami wymuszającymi konkretne narzędzie (prefill tool call) — ogranicza dostępne akcje bez usuwania definicji z kontekstu. Deterministyczne zdjęcie po zakończeniu sesji. Deprecated w API Anthropic, ale ilustruje zasadę: niekonwencjonalne podejścia adresują całe klasy problemów.
- **s02e01** — prefill tool call, ograniczenie akcji bez usuwania definicji, deprecated ale ilustratywne

## Prompt Iteration with LLM
Model potrafi uzasadnić zachowanie i zasugerować zmiany, ale pierwsza propozycja łata konkretny przypadek, nie kategorię. Proces: analiza → generalizacja → korekta (~60% bezwartościowych, ~30% wymaga zmian) → iteracja. Efekt: zwięzłe sformułowania, do których trudno dojść samodzielnie. Generalizacja = najważniejsza umiejętność projektanta agenta. Iteracyjne projektowanie schematów: model daje ~60-70%, typowe patologie (brak stronicowania, base64, brak metadanych). Gdy brakuje pomysłów → generowanie przykładowych interakcji ujawnia problemy niewidoczne w abstrakcji. Workflow odkrywania: API docs + SDK → lista akcji → pytania filtrujące.
- **s02e01** — proces z LLM, generalizacja jako kluczowa umiejętność, ~60% bezwartościowych sugestii
- **s02e05** — kilkanaście iteracji normą, kontekst: możliwości systemu, role innych agentów, preferencje użytkownika, typowe błędy
- **s03e04** — iteracyjne projektowanie schematów, typowe patologie, generowanie przykładowych interakcji jako technika odkrywania problemów, workflow: API docs→SDK→filtry

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

## Instruction Dropout
Zjawisko: rozbudowany kontekst z zewnętrznych źródeł powoduje pomijanie instrukcji systemowych. Uwaga modelu przesuwa się na nowe treści kosztem zasad. Potwierdzone w "How Many Instructions LLMs Follow at Once" i "Reasoning on Multiple Needles In A Haystack". Kontrmiary: krótkie chunki, subagenci z własnymi oknami, powtarzanie kluczowych instrukcji w wynikach narzędzi.
- **s02e02** — definicja zjawiska, paper evidence, kontrmiary środowiskowe

## Knowledge Base Design
Dwa podejścia: **podłączana** (istniejące dokumenty → chunki, embeddingi, RAG, problem odnajdywania) vs **budowana** (dokumenty tworzone dla agentów ze strukturą i linkowaniem wewnętrznym). Meta-rozróżnienie: "łączenie ze źródłem" (fragmenty pozbawione powiązań) vs "nauka ze źródła" (odnośniki prowadzą agenta krok po kroku). Cztery wymiary nawigacji: perspektywa, nawigacja, powiązania, szczegóły — kod posiada wszystkie, dokumenty biznesowe prawie nigdy. Baza wiedzy = kod źródłowy agenta — pytanie "co agent musi wiedzieć?" nie "jak zbudować bazę?". Pięć stref odpowiedzialności (Me/World/Craft/Ops/System), jawny podział właściciela, konstytucja vaultu w `mind.md`. Self-sufficient notes — notatki pisane jakby czytelnik nie miał kontekstu. Trzecia strefa obok "nasza" i "agentowa": wiedza obecna jako kontekst, nie do automatyzacji.
- **s02e03** — podłączana vs budowana baza, łączenie vs nauka ze źródła, cztery wymiary nawigacji
- **s04e04** — baza wiedzy = kod źródłowy agenta, pięć stref (Me/World/Craft/Ops/System), self-sufficient notes, konstytucja vaultu w `mind.md`, szablony w `system/templates/`

## Observational Memory
Architektura pamięci długoterminowej oparta na kompresji tekstu, nie wyszukiwaniu. Dwa agenty: Observer (kompresuje po 30k tokenów raw) i Reflector (garbage collection po 40k–60k tokenów obserwacji). Obserwacje z temporal model (trzy daty) i priorytetyzacją. ~95% LongMemEval bez wektorów/grafów. Filozofia: "Text is the universal interface". Natywne wykorzystanie prompt caching (append-only, full cache hit).
- **s02e03** — Observer/Reflector, temporal model, ~95% LongMemEval, append-only cache
- **s02e05** — trójpoziomowa kompresja (user nigdy usuwane, assistant kondensowane pierwsze), head/tail split z ochroną koherencji, generation count śledzi stratę
- **s03e02** — per-agent-session nie globalnie, komunikacja między agentami przez filesystem, progresywna kompresja z priorytetyzacją 🔴/🟡/🟢
- **s03e05** — workspace jako pamięć kognitywna z trzema kategoriami: epizodyczna (snapshoty interakcji), faktyczna (trwałe fakty), proceduralna (wyuczone reguły), plus warstwa tożsamości (`profile/`) i `system/index.md` jako mapa nawigacyjna
- **s05e01** — per-task-thread kompresja dwufazowa: Observer (raw items → split head/tail ~30% chronione → LLM → obserwacje XML z priorytetami 🔴🟡🟢), Reflector (gentle→aggressive→heavy gdy przekroczony threshold), generation counter śledzi stratę

## Graph RAG
Baza grafowa (Neo4j) jako pamięć agenta — sieć encji z relacjami umożliwiająca nawigację po powiązaniach. Łączy FTS (BM25), semantyczne (vector) i nawigację po relacjach. Uzasadnione przy wielopoziomowych powiązaniach między rozproszonymi dokumentami. Koszt infrastruktury i złożoności sprawia, że nie jest domyślnym wyborem. Komplementarny z Observational Memory.
- **s02e03** — Neo4j, trzy strumienie wyszukiwania, komplementarność z OM, nie jest domyślny

## Entity Deduplication
Wielowarstwowa deduplikacja encji ekstrahowanych przez LLM: normalizacja per chunk → globalna deduplikacja przez klucz → merge w bazie (ON MATCH) → runtime kuracja (audit + merge_entities). Bez deduplikacji graf staje się szumem — LLM generuje wiele wariantów tego samego konceptu.
- **s02e03** — cztery warstwy deduplikacji, normalizacja, merge, runtime kuracja

## Session Decomposition
Złożone procesy dekomponowane na osobne sesje agentów z tą samą instrukcją, różnymi źródłami, wynikami do współdzielonego systemu plików. Agent skupiony na jednym zadaniu = wyższa jakość. Optymalne kosztowo — płacimy za wielokrotne wczytanie instrukcji, nie za ogromny kontekst. Agent generujący treść do wysyłki = tylko szkic, nigdy auto-wysyłka.
- **s02e03** — osobne sesje per zadanie, współdzielone pliki, szkic nie auto-wysyłka

## Deep Research / Deep Action
Wzorzec iteracyjnego pogłębiania zapytań: doprecyzowanie → parafraza → dekompozycja → pętla szukaj/analizuj/identyfikuj braki → synteza. "Deep action" rozszerza poza research — audyty, generowanie kodu, analiza logów. Każdy proces wymagający eksploracji i niebędący natychmiastowy.
- **s02e03** — iteracyjne pogłębianie, deep action poza research, wstępne przeszukiwanie

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

## Progressive Tool Discovery
Meta-narzędzia (`list_servers`, `list_tools`, `get_tool_schema`, `execute_code`) pozwalają agentowi odkrywać narzędzia MCP w runtime. Rejestr z pełnymi sygnaturami TypeScript — agent ładuje tylko potrzebne do `loadedTools` Map. Narzędzia nieładowane nie zajmują okna kontekstu.
- **s02e05** — meta-narzędzia do odkrywania MCP w runtime, leniwe ładowanie do `loadedTools` Map

## Sandbox Code Execution
Agent generuje kod zamiast bezpośrednich tool calls, uruchamia w izolowanym środowisku. QuickJS (128MB RAM, 5s timeout) lub Deno (4 poziomy uprawnień: safe/standard/network/full). Architektura 3-procesowa: proces główny ↔ MCP (STDIO) ↔ Sandbox. HTTP Tool Bridge pozwala kodowi w sandboxie wywoływać narzędzia hosta. Kluczowe: redukcja halucynacji, kosztów tokenów i czasu — dane jako zmienne w sandboxie, nigdy w kontekście LLM. Asyncified host functions: asynchroniczne MCP wywoływane synchronicznie z perspektywy QuickJS.
- **s02e05** — QuickJS sandbox, asyncified host functions, executePendingJobs()
- **s03e02** — Deno sandbox, HTTP Tool Bridge, 4 poziomy uprawnień, 150K+ linii danych → 6-10 kroków zamiast setek, dual runtime Bun+Deno
- **s04e01** — Code Mode: inline script LUB script_path, helper API (`codemode.vault.*`, `runtime.exec`), marker-based IPC (`__CODE_MODE_RESULT__=`), output parsowany od końca, wzorzec podobny do Anthropic Code Mode
- **s05e05** — MCP Code Mode: agent wywołuje MCP przez pisanie kodu nie function calling, definicje narzędzi nie w kontekście, odkrywanie przez file-based IPC bridge (write request JSON → poll response JSON), konfigurowalne per agent, sandbox writeback wymaga `commit_sandbox_writeback`

## Knowledge Categorization
Sześć kategorii wiedzy w systemie wieloagentowym: dokumenty sesji, wiedza publiczna/prywatna/agentów, pamięć podręczna, runtime. Ta sama informacja może należeć do wielu kategorii zależnie od kontekstu. Proste zasady organizacji ważniejsze niż złożone systemy kategoryzacji.
- **s02e05** — sześć kategorii, proste zasady > złożone systemy

## Steering via Associations
Identity kieruje uwagę modelu przez celowe słowa o zabarwieniu emocjonalnym ("instynkt", "wyczucie"). Skojarzenia fokusują wzorce zachowania silniej niż dosłowne instrukcje. Halucynacje jako atut: prompting przez skojarzenia na swoją korzyść.
- **s02e05** — skojarzenia emocjonalne w Identity, halucynacje jako atut

## Agent Configuration as Markdown
Definicja agenta jako `.agent.md` z gray-matter frontmatter (name, model, tools, capabilities) + body (system prompt). Zachowanie konfigurowalne bez zmiany kodu. Dynamiczne ładowanie i łatwa iteracja. YAML frontmatter z deklaratywnym resolve'owaniem narzędzi: `tools: [think, recall]` we frontmatter → tylko wymienione trafiają do modelu.
- **s02e05** — `.agent.md` z frontmatter, dynamiczne ładowanie
- **s03e02** — Agent Templates z capabilities w YAML frontmatter, capability-based matching
- **s03e05** — YAML frontmatter z deklaratywnym resolve'owaniem narzędzi (`tools: [think, recall]`), scout dostaje narzędzia MCP dynamicznie
- **s04e01** — template agenta w `<name>.agent.md` z interpolacją `{{date}}`, wzbogacany o workflows i skills, wiele agentów z różnymi konfiguracjami
- **s04e04** — `system/agents/<name>.md` z dual-mode prompting (workflow vs standalone), loader parsuje frontmatter
- **s05e01** — agent jako dane (`AgentDefinition` — instrukcje + narzędzia + maxSteps), nie klasa; rejestr agentów, różnicowanie wyłącznie zestawem narzędzi

## Nested Delegation
Subagent może sam wzywać innych agentów, nie tylko komunikować z nadrzędnym. Instrukcje muszą uwzględniać reguły przekazywania zadań w głąb hierarchii — wpływa na architekturę całego systemu.
- **s02e05** — subagent wzywa innych agentów, reguły przekazywania w głąb

## Ewaluacja (Evals)
Ustrukturyzowany test oceniający zachowanie modelu/agenta pod kątem metryk. Nie gwarantuje poprawności — weryfikuje stopień dopasowania. Trzy poziomy oceny: programistyczna (regex, schema), LLM-as-judge, człowiek. Składniki: zadanie (input + expected output), dataset (syntetyczny + produkcyjny, iteracyjny), evaluator (funkcja → score 0–1). Offline eval (przed publikacją, CI/CD) vs online eval (w trakcie działania). Projektowanie datasetów: pokrycie, różnorodność, balans. Strategia kosztowa: dane strukturalne → kod, oceny subiektywne → LLM. Architektura z Promptfoo: stateless provider (subprocess per query) i stateful provider (serializacja historii sesji z SHA256 key). 7 warstw asercji od is-json po llm-rubric. Trzy kategorie scenario evalów (readonly, safety, actions). `expected_outcome` jako semantyczna asercja rezultatu. Scenariusze bez system promptu jako walidacja samo-opisowości narzędzi.
- **s03e01** — trzy poziomy oceny, offline vs online, składniki evala, strategia kosztowa, decyzja biznesowa
- **s03e04** — Promptfoo stateless/stateful provider, 7 warstw asercji, 3 kategorie scenario evalów, `expected_outcome`, eval scenariusze bez system promptu walidujące samo-opisowość
- **s05e03** — LLM-as-judge z konfigurowalną polityką (sekcje z wagami, matchBy, exact vs semantic matching), train/verify split zapobiegający overfittingowi, noise floor — statystyczna istotność poprawy (`delta > max(spread)/2`)

## Guardrails
Trzeci filar obok observability i evals: moderacja, filtrowanie, blokowanie niepożądanych zapytań na wejściu i wyjściu. Niezależna warstwa od ewaluacji, ale korzystająca z tych samych sygnałów. Reaguje w czasie rzeczywistym. Online eval może pełnić rolę dodatkowego safety-netu.
- **s03e01** — definicja, trzy filary (observability + evals + guardrails), online eval jako safety-net

## Agent Debugging
Debugowanie agentów różni się fundamentalnie od debugowania kodu — zmiana instrukcji naprawiająca jeden przypadek może psuć inne, brak determinizmu. Playground: re-execucja z pełnym kontekstem i manipulacja parametrami. Technika uzasadnienia: poproszenie modelu o wyjaśnienie wyboru narzędzi ujawnia przyczyny problemu.
- **s03e01** — nondeterministyczne debugowanie, playground, technika uzasadnienia

## Prompt Versioning
Wersjonowanie promptów systemowych: prompty w kodzie (Git trackuje) + korelacja ze statystykami na platformie observability. Jednostronna synchronizacja (kod → platforma) przez hash SHA256. Lokalny JSON z mappingiem name→{hash, version}. Wynik: każda generacja ma referencję PromptRef (name + version).
- **s03e01** — hash-gated sync SHA256, jednostronna synchronizacja kod→platforma, PromptRef per generacja

## Capability Stripping
Wzorzec fazowego usuwania narzędzi z agenta na podstawie etapu wykonania. Faza triage: pełny dostęp; faza draft: 0 narzędzi, KB zablokowany. AI nie może sięgnąć po więcej danych — fizycznie brak narzędzi do zapytań. Ograniczenia wymuszane kodem, nie instrukcją. Narzędzia TYLKO na czas potrzeby.
- **s03e02** — fazowe usuwanie narzędzi, triage vs draft, kod nie instrukcja

## Heartbeat Orchestration
Pull-based task queue z round-based reconciliacją. Trzy komponenty: kontrakty (struktura planu/zadań/zależności), heartbeat (manager przydzielający po cyklu), pamięć (filesystem-based). Agenci **claimują** zadania (pull), nie są przypychani (push). Matching po capabilities nie nazwach. Cykl: reconcile → resolve → claim → run → persist → flush. Nowe zadania mogą powstać w trakcie.
- **s03e02** — pull-based queue, capability matching, round-based reconciliation, elastyczne procesy
- **s05e01** — delta vs s03e02: plan zadań kształtowany dynamicznie przez agenta zarządzającego nie określony z góry, scheduler pull-based z max 20 rund

## Goal Contracts
Strukturyzowana definicja celu w `goal.md` z YAML frontmatter: objective, must_have, forbidden, budżety (kroków, replanowania), max zadań, warunki wymagające aprobaty człowieka. LLM planner → walidacja strukturalna → repair loop → materializacja. Gdy cel nieosiągalny → `no-go.md` z powodami. Zapobiega cichym fiaskom.
- **s03e02** — goal.md z frontmatter, LLM planner, walidacja + repair, no-go.md

## Knowledge Anti-patterns
Pliki knowledge zawierają anty-wzorce i edge cases (co idzie źle), nie instrukcje "jak zrobić". Wynik trial-and-error. Prompt wymusza czytanie jako pierwszy krok. RAG, ale retrieval domain to failure modes, nie surowa wiedza.
- **s03e02** — anty-wzorce w plikach knowledge, failure modes jako RAG domain

## Autonomy Gap
Przejście od systemów z człowiekiem w pętli do autonomicznych to nowa klasa problemów programistycznych, nie inkrementalny wzrost trudności. Błąd co piąty raz = system bezużyteczny. Odchylenia tolerowane w trybie wsparcia przekreślają sens systemu autonomicznego. Regularna aktualizacja przekonań o możliwościach modeli.
- **s03e02** — nowa klasa problemów nie inkrementalna trudność, błąd co 5 = bezużyteczny, aktualizacja przekonań

## Agent Triggers
Pięć typów wyzwalaczy akcji agenta: wiadomości (człowiek/agent), hooki wewnętrzne, webhooki zewnętrzne, cron (harmonogram), heartbeat (regularna kontrola stanu). Wszystkie mogą trafiać do jednego punktu wejścia — agent dynamicznie interpretuje zadanie w NL i dobiera akcję. Kluczowa różnica względem klasycznego event-driven: system agentowy rozumie intencję, nie wymaga mappingu event→handler.
- **s03e03** — pięć typów triggerów, jeden punkt wejścia, NL interpretation vs event→handler mapping

## Proactive Agents
Agent działa niezależnie od bezpośrednich działań człowieka. Heartbeat cyklicznie sprawdza listę zadań (`tasks.md`) — gdy nic nie wymaga akcji, agent jest invisible. Gdy tak — proaktywnie działa na bazie metadanych (czas, lokalizacja, pogoda, status urządzenia). Przejście od reaktywnego (otoczenie tylko podczas interakcji) do pełnej integracji z otoczeniem.
- **s03e03** — heartbeat z `tasks.md`, proaktywne działanie na bazie metadanych, invisible gdy niepotrzebny

## Runtime Feedback
Trzy warstwy informacji zwrotnej w tool loop: (1) statyczne sugestie wstrzykiwane do wyniku narzędzia po błędzie, (2) dynamiczne interwencje — dodatkowa wiadomość `role: 'user'` po 2+ porażkach (screenshot, zmiana strategii), (3) hook lifecycle z `beforeFinish` jako deterministyczny guard. `FeedbackTracker` rejestruje sukcesy/porażki per narzędzie. Runtime intervention ≠ prompt engineering — modyfikuje input, nie instrukcję.
- **s03e03** — trzy warstwy feedbacku, FeedbackTracker, dynamic interjection po 2+ porażkach, runtime intervention vs prompt engineering

## Hook Lifecycle
Funkcje wywoływane na etapach pętli agenta: `beforeToolCall`, `afterToolResult`, `beforeFinish`. Trzy role: przechwycenie (modyfikacja I/O), śledzenie stanu (flagi fazowe z auto-resetem), strażnik procesu (`beforeFinish` blokuje zakończenie gdy wymagane kroki nie ukończone). Pełna sekwencja AI SDK: `onStart → onStepStart → onToolCallStart → onToolCallFinish → onStepFinish → onFinish`.
- **s03e03** — pełna sekwencja hooków AI SDK, trzy role, beforeFinish jako deterministyczny guard

## Persistent Learning
Dwa wzorce nauki między sesjami. **Instruction files**: agent zapisuje discoveries do `{site}-discoveries.md`, korzysta z recipes w `{site}.md`. System prompt: "najpierw sprawdź instruction file". Agent uczy się struktury świata, nie historii konwersacji. **Profile accumulation**: profil akumuluje odkryte `trait_id` między sesjami — ustandaryzowana trait taxonomy. Profil małe (role, goals, weakAreas), pełne sesje w osobnych plikach.
- **s03e03** — instruction files (discoveries + recipes), profile accumulation z trait taxonomy

## Agent Phasing
Architektura agenta z fazami: każda faza z własnym promptem i zestawem narzędzi. Model dostaje tylko to co potrzebuje — redukcja complexity i halucynacji. Brak overlapu narzędzi między fazami. State machine z `tryCompletePhase()` resetuje się po ukończeniu. Komplementarne z Capability Stripping: phasing organizuje dostępne narzędzia, stripping je usuwa.
- **s03e03** — fazy z własnymi promptami i narzędziami, state machine, komplementarność z Capability Stripping

## Tool-chaining
Narzędzia mogą samoistnie wywoływać dodatkowe zapytania do modeli/API — nie są tylko proxy do danych. Jedno narzędzie enkapsułuje cały sub-pipeline modeli i API, ukrywając złożoność przed pętlą agenta. W MCP odpowiada za to mechanizm Sampling.
- **s03e03** — narzędzia enkapsulują sub-pipelines (`listen`→ASR+analiza, `feedback`→TTS), MCP Sampling jako mechanizm

## Tool Response Envelope
Standaryzowana koperta odpowiedzi narzędzia `{ data: T, hint: ToolHint }` z polami status, reasonCode, summary, nextActions, recovery, diagnostics. LLM dostaje kontekst decyzyjny zamiast gołych danych — nie zgaduje co zrobić po błędzie/braku wyników, dostaje propozycję kolejnej akcji. Zmniejsza halucynacje i bezcelowe tury agenta.
- **s03e04** — pełna definicja envelope, nextActions z confidence, recovery, diagnostics

## Schema-driven Development
Zod jako single source of truth: definicja raz → automatyczna konwersja do JSON Schema (function calling), `.describe()` dla semantyki widocznej dla modelu, `.refine()` dla walidacji biznesowej. Eliminuje podwójne definicje parametrów.
- **s03e04** — Zod jako SSOT, `.describe()` na polach, `.refine()` dla reguł biznesowych

## LLM-generated Test Data
Syntetyczne dane testowe generowane przez LLM z kodu narzędzi. Kategoryzacja dwuwymiarowa: happy path / edge case × pojedyncze interakcje / scenariusze wieloetapowe. LLM domyślnie generuje płytkie testy — wymaga kierowania i weryfikacji kompletności. Scenariusze testowe służą też do oceny jakości zestawu testowego.
- **s03e04** — dwuwymiarowa kategoryzacja, LLM wymaga kierowania, scenariusze oceniają jakość zestawu

## Mock → Real Strategy
Jedna zmienna env przełącza między realnym API a in-memory mockiem z pełną funkcjonalnością (parser zapytań, paginacja, mutowalny stan). Mock nie jest statycznym fixturem — deterministyczny, pozwala testować edge case'y bez dostępu do backendu.
- **s03e04** — env toggle, in-memory mock z pełną funkcjonalnością, deterministyczny, edge case testing

## Reasoning Models Compatibility
Modele reasoning emitują reasoning items z server-side IDs — przy `store=false` IDs nie replikowalne w kolejnych turach (404). Rozróżnienie parametrów reasoning/non-reasoning konieczne w Responses API.
- **s03e04** — reasoning items z server-side IDs, `store=false` powoduje 404, rozróżnienie parametrów

## Resilient JSON Parsing
Wielokrotne podejście do parsowania outputu LLM: `JSON.parse` → fallback `jsonrepair` (trailing commas, brakujące cudzysłowy) → `extractJsonCandidates()` z 3 strategiami (raw text → fenced code block → first `{` to last `}`). Pierwsza która parsuje wygrywa. Must-have w każdym agentic system — LLM regularnie generuje niepoprawny JSON.
- **s03e03** — dwuetapowe parsowanie z `jsonrepair`, hint po naprawie
- **s03e05** — `extractJsonCandidates()` z 3 strategiami, reusable pattern

## Enrichment
Agent jako węzeł łączący szczątkowe informacje z wielu źródeł (kontakty, miejsca, kalendarz, mapa, pogoda) w ustandaryzowany output. Oryginalna wiadomość wzbogacana o dane z narzędzi. Wartość biznesowa w standaryzacji procesów, nie pojedynczych interakcjach. Bezpieczeństwo: deterministyczne interfejsy dla wrażliwych operacji.
- **s03e03** — agent jako enrichment node, standaryzacja procesów, deterministyczne interfejsy

## Web Scraping Evolution
Przesunięcie w traktowaniu agentów: od blokowania (AI Labyrinth) do współpracy — Cloudflare Markdown for Agents (strukturyzowana treść), Chrome WebMCP (natywny protokół). Nie eliminuje scrapowania — platformy bez API nadal wymagają agenta z przeglądarką. Gradacja: klasyczny bot → agent AI z Playwright → Browserbase/kernel.sh na większą skalę.
- **s03e03** — od blokowania do współpracy, Markdown for Agents, WebMCP, gradacja automatyzacji

## Offensive Design
Projektowanie z perspektywy "co dodać" nie tylko "co naprawić". Interfejs głosowy w proaktywnym systemie okazuje się bardzo użyteczny. Wysoka specjalizacja agenta akceptowalna. Onboarding i komunikacja produktu = element architektury na równi z kodem.
- **s03e03** — additive design, głos w proaktywnym systemie, specjalizacja OK, onboarding = architektura

## Non-determinism as Feature
Niedeterminizm LLM jako źródło wartości, nie błąd. LLM to "śniąca maszyna" — wszystko jest halucynacją która czasem sprzyja. `temperature`/`top_p` marginalne; zachowanie zdeterminowane przez treść kontekstu. Projektowanie przestrzeni, w której zmienność jest zaletą — agent "świadomy" ma bardzo niskie prawdopodobieństwo powtórzenia odpowiedzi.
- **s03e05** — LLM jako "śniąca maszyna", zmienność jako cecha nie bug, projektowanie przestrzeni zmienności

## Cognitive Architecture
Przejście od projektowania zachowań do stwarzania warunków powstawania zachowań (ref: "Cognitive Architectures for Language Agents", arxiv 2309.02427). Warstwy: tożsamość → zdolności poznawcze → inteligencja emocjonalna → ekspresja → mechaniki wzmacniające. Kontrast z kierunkiem branży (eliminacja halucynacji) — nie wyklucza, wprowadza zmienność. Przesunięcie roli projektanta: detale → struktury.
- **s03e05** — warstwowa architektura kognitywna, referencja arxiv, przesunięcie roli projektanta

## Temporal Grounding
Wstrzykiwanie metadanych czasowych i sytuacyjnych w każdą wiadomość jako fundamentalny building block agentów "świadomych". Agent wie kiedy jest, co może odkryć, dostaje nudge zachęcający do aktywności. Sterowanie uwagą bez modyfikacji system promptu — cache-safe, zmienia się co turę.
- **s03e05** — metadane (`now_iso`, `weekday`, `local_time`, `timezone`, `recallable`, nudge), cache-safe, co turę

## Capability Packs
Biblioteki ładowane do LLM-generated artifacts jako prelude — model wybiera z manifestu, system resolwuje i wstrzykuje. Wybór wersji pod kątem capabilities modelu (np. Tailwind v3 nie v4), nie "najlepszych standardów".
- **s03e05** — prelude biblioteki z manifestu, 11 pakietów, wersje pod kątem modelu

## Theory of Mind in LLMs
Modele od GPT-4 demonstrują rozwinięte zdolności wnioskowania o stanach mentalnych innych (ref: arxiv 2505.00026). Podstawa mechanik inteligencji emocjonalnej agenta — "czytanie między słowami", odczytywanie intencji. Wzrasta z generacjami modeli.
- **s03e05** — arxiv ref, podstawa inteligencji emocjonalnej, wzrost z generacjami

## Deterministic Artifact Editing
Edycja LLM-generated content przez search/replace zamiast regeneracji. Model decyduje CO (operacje), system deterministycznie aplikuje (regex). Szybsze, tańsze, przewidywalne. Analogiczne do agentic code editing. `edit_artifact` jako wzorzec dla każdego systemu z iteracyjnym generowaniem.
- **s03e05** — search/replace zamiast regeneracji, model decyduje co, system aplikuje, `edit_artifact`

## External Signal Enrichment
Sub-agent automatycznie wzbogaca kontekst o sygnały z zewnętrznych API (pogoda, itd.) na podstawie celu/keywordów. Lazy — fetchuje tylko gdy cel wymaga. Ogólny wzorzec: agent nie tylko czyta pliki, ale integruje dane z otoczenia.
- **s03e05** — lazy fetching na podstawie celu, wzorzec integracji danych otoczenia

## Skill Plugin System
Katalogi `vault/system/skills/<name>/` z `SKILL.md` (YAML frontmatter + instrukcje). Frontmatter definiuje: `allowed-tools` (scope'owanie narzędzi), `runtime-scripts` (deterministyczne transformacje danych zamiast LLM step-by-step), `user-invocable`, `disable-model-invocation`, `argument-hint`. Komunikat parsowany jako `/skill-name args` → `<metadata>` doklejany do wiadomości + narzędzia ograniczane. Auto-discovery: system skanuje `scripts/` w folderze skilla.
- **s04e01** — pełny system skilli z SKILL.md, per-skill tool scoping, runtime-scripts, auto-discovery

## Sync vs Async Collaboration
Dwie kategorie problemów projektowych. Synchroniczna: interfejs centralny, personalizacja na żywo, szersze uprawnienia, feedback dwukierunkowy. Asynchroniczna: interfejs pominięty, procesy predefiniowane, uprawnienia sandboxowane, raportowanie z minimalnym zaangażowaniem. System hybrydowy: edytor + interfejs poleceń + workflow w plikach + agenci z dedykowanymi narzędziami.
- **s04e01** — hybrydowy system 4 elementów, synchroniczne (interaktywne) vs asynchroniczne (batch), brak bezpośredniej współpracy między agentami

## Parallel Prototyping
AI obniża koszt prototypowania do poziomu równoległego testowania wielu wariantów — z sekwencyjnego na równoległe. Każdy test = odpowiedź na konkretne pytanie decyzyjne. Założenia początkowe błędne — liczy się szybkość korekty, nie doskonały plan.
- **s04e01** — równoległe testowanie wariantów, szybkość korekty > doskonały plan

## AI Deployment Strategy
Brak ustalonych best practices — tempo zmian miesiące, nie lata. Każde wdrożenie = eksperyment. Strategia: buduj system, z którego sam korzystasz — bezpośrednie doświadczenie ograniczeń. MVP celowo minimalny jako punkt odniesienia. Decyzja o niestosowaniu AI równie ważna jak o zastosowaniu.
- **s04e01** — build-what-you-use, MVP jako punkt odniesienia, decyzja o braku AI równie ważna

## Incremental Sync
Snapshot-based delta synchronization: sygnatura pliku = `size:mtimeMs`. Przesyłane tylko zmienione pliki. Prostsze niż hashowanie zawartości, wystarczające do detekcji zmian. Background loop z `syncInFlight` flag zapobiegającym race conditions.
- **s04e01** — snapshot-based sync (`size:mtimeMs`), background loop, race condition prevention

## Agent Interface Design
Cztery komplementarne ścieżki integracji agentów (CLI, MCP hostowany, komunikatory, dedykowany UI) — system produkcyjny to kompozycja, nie wybór jednej. Kryteria decyzyjne: grupa docelowa (techniczna vs nietechniczna), ekonomia (subskrypcje vs API), złożoność (autonomia, uprawnienia, dwukierunkowa komunikacja). Interfejs determinuje resztę architektury — model, personalizację, zakres integracji.
- **s04e02** — cztery ścieżki, kompozycja nie wybór, kryteria: grupa docelowa/ekonomia/złożoność, interfejs determinuje architekturę

## Meta-prompting
Instrukcja dla modelu generująca inną instrukcję przez rozmowę z użytkownikiem. Trójczłonowa struktura: (1) Dane — kategorie informacji do zebrania, (2) Generator — wiedza o prompt engineeringu przeniesiona na model, (3) Rezultat — szablon końcowej instrukcji. Model nie zgaduje, pogłębia niejasne instrukcje. Automatyzuje optymalizację promptów, ale nie eliminuje potrzeby wiedzy o ich konstrukcji.
- **s04e02** — trójczłonowa struktura (Dane/Generator/Rezultat), model nie zgaduje tylko pogłębia

## Micro-actions
Pojedyncze akcje AI (TTS, tłumaczenie, parafraza, wizualizacja, odnalezienie powiązań) przypisane do skrótów klawiszowych, gestów lub wyzwalaczy. Realizacja: skrypt + skrót lub lekka natywna aplikacja. Niski koszt implementacji, najwyższy dzienny ROI ze wdrożenia AI. Rozszerzalne na automatyzacje mobilne (Siri Shortcuts), watchery katalogów, natywne API urządzeń.
- **s04e02** — pojedyncze akcje AI na skróty/gesty, najwyższy ROI, rozszerzalne na mobilne

## Agent Personalization
Cztery filary personalizacji interfejsu agenta: (1) Profile/subagenci — dedykowane konteksty z własnymi ustawieniami i modelem, (2) Umiejętności/skills — predefiniowane instrukcje wstrzykiwane intencjonalnie lub przez model, (3) Narzędzia — pełny cykl UI (prezentacja → potwierdzenie → postęp → błąd → wynik + anulowanie), (4) Workflow — powtarzalne sekwencje, hooki, zaplanowane zadania. Jakość implementacji mechanik ważniejsza niż sam ich zestaw.
- **s04e02** — cztery filary (profiles/skills/tools/workflow), jakość mechanik > ich liczba

## Agent Isolation
Zasada projektowania systemów wieloagentowych: izolować agentów działających w tle tak, by konflikty nie powstawały, a nie by były rozwiązywane. Komplikacja rośnie nieliniowo z liczbą połączeń między agentami. Pełna izolacja nie zawsze możliwa, ale dążenie do niej jest domyślnym trybem.
- **s04e03** — izolacja zamiast rozwiązywania konfliktów, komplikacja nieliniowa z liczbą połączeń

## Self-observing Systems
Agenci cyklicznie weryfikują skuteczność przepływu informacji — nieużywane automatyzacje wyłączane, niedostępne źródła wyrejestrowywane, powiadomienia bez reakcji podnoszą próg. Mechanizm samooczyszczania zapobiegający degradacji automatyzacji w szum.
- **s04e03** — cykliczna weryfikacja skuteczności, samooczyszczanie, degradacja automatyzacji w szum

## API Integration Audit
Przed projektowaniem scenariusza agentowego: weryfikacja dostępności API, webhooków, deep-linków, CLI lub scrapowania. Struktura zwracanych danych może być niekompletna z perspektywy agenta — sprawdzenie wymagane upfront.
- **s04e03** — weryfikacja API/webhooków/CLI/scrapowania upfront, dane mogą być niekompletne

## Context-aware Communication
Agent z dostępem do stanu urządzenia (aktywna aplikacja, lokalizacja, tryb DND) dynamicznie dobiera kanał i formę komunikacji — od ciszy, przez powiadomienie, po eskalację SMS. Wymaga natywnego dostępu do urządzenia.
- **s04e03** — dobór kanału/formy na bazie stanu urządzenia, natywny dostęp wymagany

## Active Directories (Folder-based Triggers)
Foldery jako interfejs wyzwalania automatyzacji: dokument wstawiony do folderu → transformacja przez agenta → przeniesienie dalej (`concept/ → review/ → ready/ → published/`). Podobny wzorzec: `inbox/ → processing/ → archive/`.
- **s04e03** — foldery jako triggery, pipeline folderowy transformacji dokumentów

## Design Tensions in Agent Systems
Cztery fundamentalne napięcia: (1) autonomia vs uprawnienia, (2) elastyczność vs ryzyko zapętlenia, (3) ROI automatyzacji vs zniszczenie relacji (szczególnie sprzedaż), (4) autonomia agenta vs manualne decyzje obniżające efektywność.
- **s04e03** — cztery napięcia, tradeoffy fundamentalne dla projektowania systemów agentowych

## AI Use Case Discovery
Modele są słabymi doradcami w identyfikacji scenariuszy — sugestie generyczne. Właściwa metoda: własna obserwacja procesów + dwa pytania filtrujące: "jak AI może pomóc?" i "czy powinniśmy tu angażować AI?".
- **s04e03** — model słabym doradcą, obserwacja + pytania filtrujące, decyzja o braku AI ważna

## Signal Frequency Ranking
Technika priorytetyzacji: agenci monitorujący źródła rankingują wydarzenia po częstotliwości pojawiania się w okresie. Narzędzie wspomniane wielokrotnie = sygnał do zwrócenia uwagi.
- **s04e03** — ranking częstotliwościowy jako sygnał priorytetyzacji

## Edge Case Design
Założenia projektowe w zderzeniu z rzeczywistością: uproszczone flow procesowe rozbijają się o nietypowe przypadki. Analogia do programowania — adresowane w projekcie, nie po wdrożeniu.
- **s04e03** — uproszczone flow vs rzeczywistość, adresować w projekcie nie po wdrożeniu

## Agent Communication Boundaries
Wzorce bezpieczeństwa komunikacji agenta: oddzielny kalendarz (propozycje nie zaśmiecają głównego), osobny email (read-only, wysyłka tylko do właściciela), schowek tylko z lokalnymi modelami. Minimum uprawnień jako zasada.
- **s04e03** — oddzielny kalendarz/email/schowek, minimum uprawnień

## Frontmatter Metadata Model
Wieloosiowa kontrola metadanych w YAML frontmatter: publish (cykl publikacji), status (dojrzałość treści), access (dziedziczone z sekcji), attention (sygnał handoffu), tags (płaskie, opisują co nie gdzie). Każda oś niezależna. Uprawnienia dziedziczone per sekcja w `mind.md`, nadpisywane per notatka.
- **s04e04** — pięć osi metadanych w frontmatter, dziedziczenie uprawnień per sekcja

## Scatter/Gather
Wzorzec researchu: wyniki narzędzi zapisywane jako pliki (`outputMode: "file"`), nie inline. Agent czyta tylko potrzebne fragmenty. Kontrola wielkości kontekstu — pełne dokumenty nigdy nie trafiają do conversation history.
- **s04e04** — wyniki do plików nie inline, agent czyta tylko potrzebne fragmenty, pełne dokumenty nigdy w conversation history

## Enterprise AI Deployment
Wdrożenie AI w organizacji wymaga trzech osi jednocześnie: biznesowej (koszty, compliance, ROI), kulturowej (adopcja, oddolne inicjatywy > narzucone z góry) i technologicznej (ewaluacja, architektura, założenie <100% skuteczności). Paradoks doświadczenia: skuteczność użytkownika drastycznie zależy od świadomości mechanik agenta. Prototypowanie generuje organicznie nowe wymagania — budować małe, pokazywać wcześnie.
- **s04e05** — trzy osie wdrożenia, paradoks doświadczenia, budować małe pokazywać wcześnie, oddolne inicjatywy > narzucone

## Document-as-Tool
Najmniej inwazyjne wdrożenia AI to dokumenty/prompty podłączane do istniejących interfejsów. Trzy wzorce: checklista (powtarzalny proces, AI weryfikuje kompletność), onboarding (przekierowanie semantyczne, AI radzi sobie z niedokładnymi zapytaniami), styl (jeden prompt = spójność w zespole). AGENTS.md i Skills to ten sam wzorzec przeniesiony do programowania.
- **s04e05** — trzy wzorce (checklista/onboarding/styl), najmniej inwazyjne wdrożenie, AGENTS.md jako ten sam wzorzec

## Dual-audience Output
Każde narzędzie MCP App zwraca `content` (tekst dla LLM) i `structuredContent` (dane dla embedded UI). Jeden wynik narzędzia, dwóch odbiorców — model dostaje tekst, iframe dostaje dane strukturalne. `_meta.ui.resourceUri` wskazuje zasób HTML montowany w sandboxie.
- **s04e05** — content (LLM) + structuredContent (UI), jeden wynik dwóch odbiorców, resourceUri dla sandbox

## Model Context Update from UI
Embedded app wywołuje `app.updateModelContext()` z debouncem — wstrzykuje snapshot stanu UI do kontekstu kolejnego zapytania modelu. Frontend utrzymuje Map z deduplikacją per appka, serializowaną w każdej wiadomości. Model "widzi" stan UI bez pytania.
- **s04e05** — `app.updateModelContext()` z debouncem 120ms, Map z deduplikacją, model widzi stan UI

## Multi-anchor Text Editing
Wzorzec edycji z wieloma zakotwiczeniami: accept sugestii patchuje markdown i przesuwa pozycje sąsiednich komentarzy (delta = len delta). Batch accept sortuje od końca tekstu — klasyczny wzorzec zachowania poprawności niezmnodyfikowanych pozycji. Re-anchoring waliduje pozycje, fallbackuje do wyszukiwania tekstu.
- **s04e05** — patch markdown + przesunięcie sąsiadów, batch accept od końca, re-anchoring z fallback

## Worker Pool Pattern
N workerów z jedną współdzieloną kolejką zamiast `Promise.all` na wszystkich elementach. Każdy worker bierze kolejny element gdy skończy poprzedni — równomierny rozkład niezależnie od różnic w czasie przetwarzania.
- **s04e05** — współdzielona kolejka, równomierny rozkład, lepsze niż Promise.all przy zróżnicowanym czasie

## NDJSON Streaming
POST zwraca `application/x-ndjson` — każda linia to osobny JSON. Frontend czyta przez `ReadableStream` z buforem na niekompletną linię. Prostsze niż WebSocket, działa z HTTP, istotne dla długotrwałych zadań agentowych z natychmiastową informacją zwrotną.
- **s04e05** — NDJSON via ReadableStream, prostsze niż WebSocket, natychmiastowa informacja zwrotna

## Graceful Degradation (Agent Fallback)
Gdy API niedostępne, agent degraduje do regex-based routingu — matchuje wzorce z wiadomości do konkretnych narzędzi MCP. Real-world pattern: system działa zawsze, LLM jest enhancementem.
- **s04e05** — regex-based routing gdy API down, LLM jako enhancement nie wymóg

## Prompts as Markdown with Frontmatter
Prompty review jako pliki `.md` z frontmatter: `title`, `model`, `modes`, `contextFiles`. Samoopisujący się dokument = konfiguracja agenta. Nowy typ review = nowy plik `.md`, bez zmiany kodu. `contextFiles` jako mechanizm przełączania ról agenta.
- **s04e05** — prompty jako .md z frontmatter, nowy typ = nowy plik, contextFiles przełączają role

## Architecture Primitives
Projektowanie na prymitywach (zdarzenia, artefakty, items) zamiast na funkcjonalnościach (czat, pliki, obrazy). Prymitywy to najprostsze elementy z których buduje się struktury wyższego rzędu — pozwalają rozbudowę bez przebudowy gdy czatbot ewoluuje w system wieloagentowy.
- **s05e01** — prymitywy (events, artifacts, items) vs funkcjonalności, rozbudowa bez przebudowy

## DAG Task Scheduling
Deterministyczny scheduler zarządzający cyklem życia zadań na dynamicznym DAG-u. Stany: todo → in_progress → done|waiting|blocked. `findReadyTasks` filtruje po statusie + zależnościach, `unblockParents` kaskadowo promote po zakończeniu dzieci. Stale task recovery resetuje `in_progress` do `todo` po awarii. Trójpoziomowa obsługa błędów: API → Actor → Task z recovery state.
- **s05e01** — stany DAG, findReadyTasks, unblockParents, stale task recovery, trójpoziomowa obsługa błędów

## Streaming Markdown Rendering
Pipeline renderingu streamowanego Markdown: podział na `committedSegments` (zamrożone, cachowane w DOM) i `liveTail` (re-renderowany na deltę). Tylko ogon re-renderowany — fundament wydajnego streaming renderowania. Edge case'y parsowania: zagnieżdżony HTML, niezamknięte bloki `$$`, footnotes. DOMPurify jako niewyłączna ochrona przed XSS z outputu LLM. Pipeline pięciu warstw (remend → marked → markdown-it → highlight.js → DOMPurify).
- **s05e02** — pełny pipeline 5 warstw, committedSegments + liveTail, DOMPurify, edge case'y parsowania
- **s05e05** — block settling: flat rendering podczas streamingu → grupowanie w ToolChain (sekwencyjne) i ToolGroup (równoległe) z animacją collapse po zakończeniu

## UI Virtualization
Chunkowa wirtualizacja list wiadomości (np. 12 na chunk) z `ResizeObserver`, scroll anchoring i asymetryczny pin-to-bottom z histerezą (80px release / 4px reacquire). CSS uzupełniający: `content-visibility: auto`, `overscroll-behavior: contain`, `scrollbar-gutter: stable`. Overscan ±3 chunks. Sprawdzone przy 1500+ wiadomościach. Tylko widoczne chunki w DOM.
- **s05e02** — chunkowa wirtualizacja 12 wiadomości, ResizeObserver, pin-to-bottom z histerezą, 1500+ wiadomości
- **s05e04** — chunki po 12, overscan ±3, ResizeObserver do pomiaru wysokości, canvas/pretext text measurement do estymacji przed montażem

## Voice Agents
Dwie architektury voice: STT→LLM→TTS (3 modele, pipeline, niższy koszt) vs Realtime (1 multimodalny, najniższa latencja, wyższy koszt). LiveKit Agents: `prewarm` ładuje VAD+MCP raz, `entry` per sesja. WebRTC + JWT krótkożyciowy. Kluczowe zjawiska: VAD (Voice Activity Detection), barge-in (przerwanie), detekcja końca wypowiedzi.
- **s05e02** — dwie architektury voice, LiveKit Agents, WebRTC+JWT, VAD, barge-in

## Typewriter UX
Animacja pisania z trybami (off/fast/normal/slow) i gating — blok UI czeka na zakończenie animacji poprzedniego. Ochrona selekcji tekstu: render odkładany gdy użytkownik zaznaczył tekst w live tail.
- **s05e02** — animacja z trybami, gating, ochrona selekcji tekstu w live tail

## Search Decision Ladder
Czteropoziomowe spektrum wyszukiwania: kontekst → grep/ripgrep → hybrydowe (FTS + semantyczne) → grafy. Samodzielne bazy wektorowe nierekomendowane. Rozszerzenia SQLite/PostgreSQL wystarczają na większość projektów; dedykowane (Qdrant, Chroma) dopiero przy skali.
- **s05e02** — cztery poziomy, rozszerzenia DB wystarczają, dedykowane dopiero przy skali

## Mock-first Development
Testowanie UI agenta bez dostępu do LLM: `ScenarioBuilder` generuje deterministyczne sekwencje `StreamEvent`ów z konfigurowalnymi opóźnieniami. `detectScenario()` dopasowuje prompt regexem. Zerowy koszt tokenów przy pełnym pokryciu UI.
- **s05e02** — ScenarioBuilder, detectScenario regex, zerowy koszt tokenów

## Agent Tooling Ecosystem
Kategoryzacja narzędzi agentowych: przeglądarki (agent-browser, browser-use/browserbase), sandbox'y (daytona, e2b), scrapowanie (firecrawl, jina, brave), dokumenty (markitdown), CLI (commander, zx), monitoring (chokidar). Łączenie >1 usługi celowe — różne silniki radzą sobie z różnymi typami stron.
- **s05e02** — kategoryzacja narzędzi, łączenie wielu usług celowe

## Automated Prompt Optimization
Hill-climbing z Best-of-N kierunkowymi kandydatami (balanced, coverage, simplify, boundary, salience) — każdy adresuje inny typ błędu. Stuck detection: 3 odrzucone iteracje z tą samą operacją → wymuszona zmiana strategii. Anti-verbosity creep: tie-breaker na długość promptu (krótszy wygrywa). Metaprompt 137 linii z 5 atomowymi operacjami (REWORD/ADD/REMOVE/MERGE/REORDER). Structured prompt format z sekcjami XML. System autonomicznej optymalizacji bez zależności zewnętrznych.
- **s05e03** — hill-climbing, Best-of-N kandydatów, stuck detection, anti-verbosity, metaprompt z 5 operacjami, sekcje XML

## Prompt Programming
Sygnatury Ax/DSPy eliminują prompt z kodu — deklaratywne `input:type -> output:type "opis"`, framework generuje prompt. `:class` dla klasyfikacji, opisy w cudzysłowach jako instrukcje. Consistency bonus w metryce — nagroda za wewnętrzną spójność predykcji. Jaccard similarity dla częściowej poprawności multi-label.
- **s05e03** — sygnatury Ax/DSPy, `:class`, consistency bonus, Jaccard similarity

## Multi-model Role Separation
Trzy role w jednej pętli z różnymi modelami i profilami kosztowymi: execution (tani, bez reasoningu, najczęściej wywoływany), judge (mocny, high reasoning, ocena semantyczna), improver (mocny, high reasoning, diagnoza i planowanie). Rozdzielenie pozwala niezależną optymalizację kosztu vs jakości.
- **s05e03** — trzy role (execution/judge/improver), różne modele i profile kosztowe, niezależna optymalizacja

## Durable Execution
Persist-first, execute-second: komenda zapisuje stan do DB przed wywołaniem modelu. Fail modelu = work queued, nie lost. Crash recovery z durable state. Route handler zwraca persistent data, nie ephemeral output. Fundamentalny wzorzec produkcyjnego agent runtime.
- **s05e04** — persist-first execute-second, fail = queued nie lost, crash recovery, route handler zwraca persistent data

## Lease-based Crash Recovery
Worker rezerwuje run z claim (expiresAt) + heartbeat co leaseTtlMs/3. Crash = heartbeat stopuje = claim expires = scheduler detect stale = requeue z exponential backoff (baseDelay * 2^(count-2)). Limit maxStaleRecoveries, po czym permanent fail.
- **s05e04** — claim z expiresAt, heartbeat co leaseTtlMs/3, exponential backoff, maxStaleRecoveries

## Readiness Engine
Deterministyczny scheduler odpytujący DB o pary job/run. Stała kolejność priorytetów: child results → wait resumy → crash recovery → nowe zadania. Root runs priorytetyzowane nad child. Rozdziela deterministyczną logikę (scheduler) od niedeterministycznej (LLM).
- **s05e04** — priorytety (child→wait→crash→new), root runs priorytetyzowane, deterministyczny vs niedeterministyczny

## Optimistic UI
Trzy warstwy wiadomości: durable (backend confirmed) + optimistic (pending user) + live (streaming SSE). Scalane w projected view — gdy serwer odpowie, optimistic usuwana, live zastępowane przez durable. Stable UI keys (`stableUiKeyByMessageId`) zapobiegają remountingowi.
- **s05e04** — trzy warstwy (durable/optimistic/live), projected view, stable UI keys

## Branded Types & Result Monad
`Result<T, E>` jako discriminated union zamiast wyjątków — wymusza jawne error handling na każdym call site. `Brand<TValue, TName>` daje compile-time type safety — kompilator nie pozwala pomylić RunId z JobId. Prefiksowane ID (`run_`, `job_`, `acc_`) czynią logi natychmiast czytelnymi.
- **s05e04** — Result monada, Brand types, prefiksowane ID, compile-time safety

## rAF Batching
SSE events buforowane i flushowane na `requestAnimationFrame` — max jedno DOM update na klatkę (~16ms). Eliminuje render thrashing przy gęstym streamingu. Fallback setTimeout(100) gdy rAF niedostępny.
- **s05e04** — bufor pending + flush na rAF, max 1 DOM update/klatkę, fallback setTimeout

## Event Sourcing z Outbox Pattern
Domain events zapisywane w tej samej transakcji co dane → `event_outbox` → dedykowane workery rozsyłają do SSE, projections, telemetrii. Gwarantuje at-least-once delivery. Rozdziela writes od side effects. Multi-lane: każdy event dispatchowany do niezależnych lanes z osobną retry/quarantine logiką (realtime/SSE, projection, background, observability). Duże payloady kompresowane jako sidecars. Failed events po max retries → quarantine.
- **s05e04** — transakcyjny outbox, at-least-once delivery, separacja writes od side effects
- **s05e05** — multi-lane outbox (realtime/projection/background/observability), retry/quarantine per lane, sidecar compression

## Context Budget Calibration
`usage_ledger` śledzi tokeny per thread. Estymacje budżetu kalibrowane na podstawie rzeczywanych zużyć z poprzednich tur. Mechanizm zapobiegający cichemu przepełnieniu okna kontekstowego.
- **s05e04** — usage_ledger, estymacje kalibrowane z rzeczywistych zużyć, zapobieganie przepełnieniu

## Tenant Isolation
Foreign keys obejmują `(id, tenant_id)` — gwarancja na poziomie bazy, że wiersz z jednego tenanta nigdy nie odwoła się do wierszu z drugiego. Scope'owanie MCP, agentów, plików per workspace i tenant.
- **s05e04** — FK z tenant_id, scope'owanie per workspace/tenant, izolacja na poziomie bazy

## Agent Markdown z Rewizjami
Agenci definiowani jako Markdown z YAML frontmatter (gray-matter): model, tools, memory policy, subagent links. Każda zmiana tworzy nową rewizję z checksum SHA256 — pełna historia konfiguracji agenta w czasie. Pełny DSL konfiguracji w YAML: model, sandbox policy, kernel, memory, garden, subagents, narzędzia (mcpMode, nativeTools). Walidowany przez Zod (schema: agent/v1). Agent nie jest promptem, to pełna konfiguracja runtime.
- **s05e04** — Markdown + YAML frontmatter, rewizje z SHA256 checksum, pełna historia konfiguracji
- **s05e05** — pełny DSL agenta (sandbox policy, kernel, memory, garden, subagents, mcpMode), walidacja Zod schema: agent/v1, agent jako konfiguracja runtime nie prompt

## Narzędzia z wynikiem Waiting
Narzędzie nie musi zwrócić natychmiastowego wyniku — może zwrócić `{ kind: 'waiting' }`, zawieszając run. Obsługuje asynchroniczne interakcje (człowiek, MCP, upload) bez timeoutu na poziomie tool call. Mechanizm kompakcji kontekstu zachowuje integralność par tool call/response i pending waits — granica tail iteracyjnie dostosowywana, kompakcja nie może ciąć w środku interakcji narzędzia.
- **s05e04** — `{ kind: 'waiting' }` jako wynik, zawieszenie run, asynchroniczne interakcje
- **s05e05** — context compaction z boundary integrity, granica tail dostosowywana iteracyjnie, ochrona par tool call/response

## Command Pattern (CQRS-inspired)
Komendy enkapsulują całe operacje biznesowe: walidacja (Zod) → auth → DB writes w transakcji → domain events → typed result. Separacja intent od execution.
- **s05e04** — komendy z walidacją/auth/transakcją/events/result, separacja intent od execution

## Halucynacje Audio (Whisper)
Whisper halucynuje na ciszę (artefakty treningu na napisach filmowych) i przy mieszaniu języków. Nie naprawialne promptem — wymaga świadomego projektowania pipeline'u audio z guardrails na poziomie aplikacji.
- **s05e04** — halucynacje na ciszę, artefakty napisów filmowych, mieszanie języków, guardrails aplikacyjne

## Digital Garden
Cyfrowy ogród — strona www generowana z systemu plików markdown (frontmatter + wikilinks) pełniąca jednocześnie rolę bazy wiedzy agenta, obszaru roboczego (agent czyta/modyfikuje pliki), publikacji (wybrane treści jako www) i organizacji (tagi, wikilinks). Build pipeline: collect → parse → rewrite links → render → search (Pagefind). Auto-build na podstawie fingerprintu SHA-256. Pliki `visibility: private` chronione hasłem. Folder workspace kompatybilny z Obsidian.
- **s05e05** — pełny build pipeline, SHA-256 fingerprint, Pagefind search, visibility: private, Obsidian-compatible

## Daily Ops
Wzorzec cyklicznej orkiestracji asynchronicznej: niezależni agenci uruchamiani równolegle, każdy w własnej sesji, każdy zbiera dane z własnych integracji. Wyniki do jednego folderu → agent agregujący → transkrypt + audio → urządzenie mobilne. Harmonogram z zewnątrz (cron, GitHub Actions). Brak zależności między agentami = pełen paralelizm.
- **s05e05** — niezależni agenci równolegle, agregacja wyników, harmonogram cron/GitHub Actions

## Polling Worker Pattern
Proste polling workers z adaptacyjnym opóźnieniem jako alternatywa dla skomplikowanych message queues. Jeśli była praca → delay=0 (natychmiast sprawdź ponownie). Jeśli nie → czekaj `pollIntervalMs`. `wake()` przerywa oczekiwanie. Wystarczające dla single-server SQLite deployment.
- **s05e05** — adaptacyjne opóźnienie (delay=0 gdy praca), wake() interruption, alternatywa dla message queues

## Nawyk > Technologia
Techniczne możliwości agentów bez nawyku korzystania = zero wartości. Klucz: dopasowanie kanału komunikacji do istniejących zachowań użytkownika. Łączenie nowej aktywności z tym, co już robimy. Samo skonfigurowanie integracji nie wystarczy — musi zostać używane cyklicznie.
- **s05e05** — dopasowanie kanału do zachowań, cykliczne używanie, konfiguracja niewystarczająca

## Technologia bez Procesu
System agentowy z pełnym stackiem narzędzi bezużyteczny bez zdefiniowanych procesów. Wartość pojawia się dopiero przy spersonalizowanych procedurach, skryptach i cyklicznych wyzwalaczach. Heurystyka: zacząć od jednego powtarzalnego procesu, nie od architektury wszechświata.
- **s05e05** — pełny stack bezużyteczny bez procesów, heurystyka: zacząć od jednego powtarzalnego procesu

# Tydzień 3: Obserwacja, ewaluacja i narzędzia

## Spis treści

- [Observability](#observability)
- [Ewaluacja (Eval)](#ewaluacja-eval)
- [Bezpieczeństwo przez ograniczenia](#bezpieczeństwo-przez-ograniczenia)
- [Izolacja kontekstu](#izolacja-kontekstu)
- [Przenoszenie obliczeń do kodu (Sandbox)](#przenoszenie-obliczeń-do-kodu-sandbox)
- [Zarządzanie trudnością (Heartbeat + Kontrakty)](#zarządzanie-trudnością-heartbeat--kontrakty)
- [Kontekstowy feedback i hooki](#kontekstowy-feedback-i-hooki)
- [Narzędzia jako ograniczony podzbiór API](#narzędzia-jako-ograniczony-podzbiór-api)
- [Envelope { data, hint }](#envelope-data--hint)
- [Dane testowe i ewaluacja z Promptfoo](#dane-testowe-i-ewaluacja-z-promptfoo)
- [Niedeterminizm jako przewaga](#niedeterminizm-jako-przewaga)
- [Architektura agenta "świadomego"](#architektura-agenta-świadomego)
- [Generowanie UI przez LLM](#generowanie-ui-przez-llm)
- [Progresja przykładów kodu](#progresja-przykładów-kodu)

---

## Observability

Monitoring nie jest opcjonalny przy systemach agentowych — złożoność dynamicznego kontekstu przekracza możliwości analizy samego kodu. Wymaga **grupowania i zagnieżdżania** zdarzeń z pełnym kontekstem [e01].

### Hierarchia obserwacji (Langfuse)

| Typ | Zakres |
|----|--------|
| Session | Wątek / czat |
| Trace | Pojedyncza interakcja usera |
| Span | Czas trwania akcji |
| Generation | Wywołanie LLM (model, prompt, tools, usage) |
| Agent | Działanie agenta |
| Tool | Wywołanie narzędzia |
| Event | Zdarzenia aplikacji |

Każde zdarzenie niesie **kontekst** (kto, sesja, agent), nie tylko fakt [e01].

### Tracing — implementacja

- `AsyncLocalStorage` propaguje kontekst przez call stack bez jawnych parametrów [e01].
- Wrapper functions (`withTrace`, `withAgent`, `withTool`) opakowują logikę — gdy tracing wyłączony, zero overheadu [e01].
- Adapter LLM dekorowany przez `withGenerationTracing` — jeden punkt przechwytu, zero zmian w logice [e01].

### Wersjonowanie promptów

Hash SHA256 treści promptu determines czy pushować nową wersję. Lokalny stan w `.langfuse-prompt-state.json`. Jednostronna synchronizacja: kod → platforma [e01].

### Debugowanie agentów

Zmiana instrukcji naprawiająca jeden przypadek może psuć inne. Playground (Langfuse, Confident AI) odtwarza interakcję z pełnym kontekstem. Przydatne: poproszenie modelu o **uzasadnienie** wyboru narzędzi [e01].

## Ewaluacja (Eval)

Eval = ustrukturyzowany test oceniający zachowanie pod kątem metryk [e01].

**Składniki:** dane wejściowe + oczekiwane wyjście + dataset (syntetyczny + produkcyjny, iteracyjnie rozwijany) + evaluator `(input, output, expected) → score[]` [e01].

### Kryteria oceny

**Deterministyczne:** `contains`, `is-json`, `equals`, regex, programistyczne asercje [e01].
**Model-based:** `llm-rubric`, `conversation-relevance`, `context-recall` [e01].

**Obszary ewaluacji agentów:** skuteczność wyboru narzędzi, obsługa narzędzi (argumenty, retry), poprawność odpowiedzi, wykrywanie naruszeń [e01].

### Implementacja

`dataset.runExperiment({ task, evaluators, runEvaluators })`. Ewaluator deterministyczny dekomponuje ocenę na niezależne wymiary (decision accuracy, required tools, forbidden tools, call count) i uśrednia [e01].

## Bezpieczeństwo przez ograniczenia

- **Nie automatyzuj, wspieraj.** Błędy w trybie wsparcia mają ograniczone konsekwencje — człowiek pozostaje w pętli [e02].
- Specjalistyczne, wąskie narzędzia > all-in-one agenty [e02].
- Prompt systemowy = publiczny. Nigdy nie umieszczaj w nim sekretów [e02].
- Dostęp agenta **musi** być kontrolowany kodem, nie promptem [e02].
- Filtr prompt injection: osobny prompt w izolowanym zapytaniu zwraca "bezpieczne"/"niebezpieczne", weryfikowane programistycznie. Atakujący nie zna frazy kluczowej [e02].

## Izolacja kontekstu

Agent pracujący na danych wielu kont/projectów musi mieć programistycznie wymuszone ograniczenia widoczności wiedzy. Lock jest binarny i egzekwowany kodowo — agent nie może go ominąć przez prompt [e02].

Przykład: **Triage** — pełny dostęp, etykietowanie. **Draft** — `lockKnowledgeToAccount()`, KB zablokowany do jednego konta + kategorii [e02].

## Przenoszenie obliczeń do kodu (Sandbox)

LLM nie powinien "przeliczać w pamięci". Agent generuje kod, kod wykonuje się w izolowanym środowisku. Redukuje: halucynacje, koszty tokenów, czas. 150k+ linii danych → 6-10 kroków agenta [e02].

Architektura: **Proces Główny** (agent) → **MCP** (narzędzia plikowe) → **Sandbox** (wykonanie kodu). Poziomy uprawnień: `safe` → `standard` → `network` → `full`. Bridge HTTP pozwala kodowi w sandboxie wywoływać narzędzia hosta [e02].

## Zarządzanie trudnością (Heartbeat + Kontrakty)

**Kontrakt celu (GoalContract):** objective, must_have, forbidden, budżet kroków, budżet replanowania, max zadań, warunki wymagające aprobaty człowieka [e02].

**Heartbeat** = pętla managera: sprawdza stan → przydziela gotowe → agenci wykonują → aktualizacja → kolejny cykl. Zadania mają zależności, statusy, mogą być równoległe lub sekwencyjne [e02].

**Planowanie:** LLM generuje plan → walidacja strukturalna → repair loop (max 2 próby) → materializacja jako pliki markdown. Replanowanie: `ReplanPatch` (add/split/reassign/dependency/descope/cancel) z ograniczonym budżetem [e02].

## Kontekstowy feedback i hooki

### Wyzwalacze autonomii

Agent aktywowany przez: wiadomości, hooki wewnętrzne, webhooki, cron, heartbeat. Jeden punkt wejścia może dynamicznie interpretować zadanie w języku naturalnym [e03].

### Proaktywność i nieskończona sesja

Heartbeat cyklicznie sprawdza listę zadań — jeśli nic nie wymaga akcji, agent się nie odzywa. Metadane sterują: godzina, lokalizacja, pogoda, status komputera. Niewymagane zdarzenia nie powinny zanieczyszczać kontekstu [e03].

### Feedback między sesjami

Agent korzysta z plików instrukcji w `instructions/`. Błąd → sugestie. Po wyjściu z awarii → zapis odkryć (`{site}-discoveries.md`). `FeedbackTracker` rejestruje wyniki wywołań, liczy porażki, generuje hinty, wstrzykuje interwencje po osiągnięciu progu [e03].

### Hooki cyklu życia

Funkcje na etapach pętli: `onStart`, `onStepStart/Finish`, `onToolCallStart/Finish`, `onFinish` [e03].

Trzy role:
- **Przechwycenie** — modyfikacja danych przed przekazaniem
- **Śledzenie stanu** — flagi fazowe aktualizowane po wywołaniach
- **Strażnik procesu** — `beforeFinish` sprawdza wymagane kroki, wstrzykuje komunikat jeśli nieukończone

## Narzędzia jako ograniczony podzbiór API

Pełne podłączenie do API = antywzorzec. Zamiast `gmail_search` twórz `gmail_search_support` — domyślne zawężenie, brak przestrzeni na dane poza zakresem [e04].

### Iteracyjne projektowanie schematów

Pierwsza propozycja od modelu = punkt startowy (~60-70%). Typowe patologie: brak stronicowania, niejednoznaczne pola, base64 w odpowiedzi, brak metadanych. Proces: podaj wskazówki → model rozszerza → iteruj [e04].

## Envelope { data, hint }

Każda odpowiedź narzędzia zawiera:

- **data** — merytoryczny wynik
- **hint** — `status`, `reasonCode`, `summary`, `nextActions` (konkretne propozycje z argumentami), `recovery` (retryable, backoff, maxAttempts), `diagnostics` [e04]

Klasyfikacja błędów na podstawie wzorców: `AUTH_REQUIRED`, `RATE_LIMITED`, `NOT_FOUND`, `INVALID_ARGUMENT`, `TRANSIENT_FAILURE`. Każda kategoria = inna strategia recovery [e04].

Kontrola szczegółowości: `details: boolean`. Domyślnie compact view, z `details=true` pełne dane [e04].

Send policy: whitelist weryfikacja, odbiorca poza nią → draft z `policy.enforcedDraft: true` [e04].

## Dane testowe i ewaluacja z Promptfoo

Syntetyczne dane generowane przez LLM na podstawie kodu narzędzi (typy, schematy Zod). Kategorie: pojedyncze akcje, scenariusze wieloetapowe, przypadki błędowe [e04].

Struktura eval per narzędzie: asercje na `required_tools`, `forbidden_tools`, `expected_primary_tool`, `turn_budget`, `search_query_hint`, `llm-rubric` [e04].

Dwa poziomy: **tools** (pojedyncze akcje) i **scenarios** (wieloetapowe z zastrzeżonymi narzędziami). Provider eval = wrapper wywołujący CLI agenta jako child process [e04].

Porównanie modeli: tańszy może zdać testy, ale ujawniać problemy przewidujące awarie. Optymalizacja schematów pod mniejsze modele podnosi skuteczność również przy mocniejszych [e04].

## Niedeterminizm jako przewaga

LLM nie jest ani deterministyczny, ani wystarczająco losowy. Zachowanie silnie zdeterminowane przez **poprzedzającą treść**. Wniosek: zaprojektować przestrzeń, w której niedeterminizm staje się zaletą [e05].

### Od poleceń do warunków

Klasyczny: użytkownik → polecenie → narzędzie (1:1). Agent "świadomy": użytkownik → kontekst → model sam decyduje. Oddelegowanie decyzji *kiedy* i *jak* działać, przy zachowaniu wyznaczonej przestrzeni [e05].

### Cztery obszary oddelegowane

| Obszar | Istota |
|--------|--------|
| **Proaktywność** | Model sam określa kiedy działać |
| **Synteza** | Łączenie bez sztywnych reguł "jeśli X to Y" |
| **Wnioskowanie** | Narzędzia `think`/`recall` tworzą przestrzeń na refleksję |
| **Dopasowanie** | Model decyduje o fokusie, stylu, formie |

### Narzędzie `think`

Nie pobiera danych — zmusza do sformułowania pytań do samego siebie. Wynik wraca jako `function_call_output`. Obecność narzędzia zmienia zachowanie nawet niewywołane [e05].

### Narzędzie `recall` i scout-subagent

Deleguje wyszukiwanie do **oddzielnego agenta** (scout) z dostępem do MCP. Main agent nie wie, jakie pliki istnieją — scout odkrywa. Scout ma trwałą sesję, `new_session` resetuje. Max 8 tur [e05].

### Metadane temporalne

Każda wiadomość opakowana w `<metadata>` z `now_iso`, `weekday`, `local_time`, `timezone`, `recallable`, nudge. Sterują uwagą bez modyfikacji promptu — bezpieczne dla cache [e05].

## Architektura agenta "świadomego"

Warstwy: **tożsamość i samowiedza** → **zdolności poznawcze** (instrukcje przez pytania) → **inteligencja emocjonalna** → **sposoby ekspresji** (sterowane metadanymi) → **mechaniki wzmacniające** (postawy, nie akcje) [e05].

Instrukcje kierują "snem" modelu bez bezpośrednich poleceń. Zgeneralizowane — opisują postawy, nie procedury. Rola człowieka: projektowanie warunków powstawania zachowań [e05].

## Generowanie UI przez LLM

| Podejście | Kontrola | Ryzyko |
|-----------|----------|--------|
| **Artifacts** — LLM generuje pełny HTML/CSS/JS | Niska | Wyższe, ale rośnie z modelami |
| **Render** — LLM generuje JSON z katalogu komponentów | Średnia | Server-side rendering deterministyczny |
| **MCP Apps** — LLM wywołuje narzędzie, serwer uruchamia gotowy UI | Wysoka | Minimalne |

### Artifacts

Model generuje `{title, html}`. Capability packs (Preact, Chart.js, Tailwind v3) ładowane do iframe. Edycja przez **search/replace**. CSP izoluje: `default-src 'none'`. Wybór bibliotek pod kątem tego, co modele **najlepiej znają** (Tailwind v3, nie v4) [e05].

### Render

Model generuje `{title, spec, state}` — drzewo komponentów. Walidacja: typy, limit 120 elementów, detekcja cykli. **Wiązanie danych przez JSON Pointer:** `{"$state": "/kpis/0/value"}`. Edycja przez regenerację z kontekstem stanu [e05].

### MCP Apps

Model nie widzi kodu UI — wywołuje narzędzia, serwer MCP ma wbudowany interfejs (`registerAppResource`). Host zarządza UI, agent logiką. Komunikacja przez `structuredContent` [e05].

---

## Progresja przykładów kodu

### 1. Observability — AsyncLocalStorage (e01)

Delta: kontekst tracingowy propagowany bez parametrów.

```ts
export const withAgentContext = (name, id, fn) =>
  storage.run({ agentName: name, agentId: id, turnNumber: 0, toolIndex: 0 }, fn);
```

### 2. Decorator adaptera — przechwyt generacji (e01)

Delta: `withGenerationTracing` opakowuje `Adapter.complete()` — loguje input/output/usage. Jeden dekorator, pełna widoczność.

### 3. Sync promptów — hash-gated push (e01)

Delta: SHA256 determines czy pushować. Lokalny stan JSON. PromptRef dołączany do generacji.

### 4. Tool-use evaluator — wielowymiarowy (e01)

Delta: dekompozycja na 4 wymiary (decision, required, forbidden, call count), każdy 0/1.

### 5. Response-correctness — typowane kryteria (e01)

Delta: dispatch po `expected.type` — `exact_number`, `contains_iso_timestamp`, `relevance`. Zero LLM w ewaluatorze.

### 6. Sandbox z wykonywaniem kodu (e02)

Delta: agent ma `fs_read`/`fs_write` (MCP) + `execute_code` (sandbox Deno). Poziomy uprawnień: safe → standard → network → full.

### 7. Dwufazowy agent z izolacją kontekstu (e02)

Delta: dwie fazy — Triage (pełny dostęp) i Draft (`lockKnowledgeToAccount`). Lock w kodzie, nie w prompcie.

### 8. Multi-agent z heartbeat i kontraktami (e02)

Delta: GoalContract → plan LLM → walidacja → materializacja. CapabilityMap skanuje szablony agentów. Observational Memory per-agent. `request_human` = human-in-the-loop.

### 9. Calendar — metadata injection (e03)

Delta: statyczny prompt + dynamiczny `<metadata>` doklejany do wiadomości. Dwie fazy z osobnymi narzędziami.

### 10. Browser — feedback tracker (e03)

Delta: stateful tracking wywołań + dynamiczne sugestie na podstawie wzorców porażek. Pliki instrukcji eliminują ponowne odkrywanie struktury.

### 11. Language — hooki jako strażnik (e03)

Delta: pełny cykl hooków zarządzających fazami z wymuszaniem ukończenia przed zakończeniem. Flagi faz + automatyczny reset.

### 12. Gmail — zunifikowany ToolDefinition z Zod (e04)

Delta: `ToolDefinition` (name + description + Zod schema + handler). `.refine()` na zależności między polami. Pipeline: parse → validate → handler → wrap in `{data, hint}`.

### 13. Gmail — eval z Promptfoo (e04)

Delta: asercje na tool calls, turn budget, search query hint. Provider eval = CLI jako child process. Porównanie modeli.

### 14. Awareness — think + recall + scout (e05)

Delta: dwa narzędzia metapoznawcze, scout sub-agent, template YAML+MD. Brak narzędzi operacyjnych.

### 15. Artifacts → Render → MCP Apps (e05)

Delta progresywna: pełny HTML → JSON spec z komponentami → predefiniowany UI przez protokół. Każdy krok ogranicza niedeterminizm inaczej.

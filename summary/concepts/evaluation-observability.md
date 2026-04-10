# Ewaluacja i Obserwowalność
> Koncepty związane z oceną jakości agentów, monitorowaniem, debugowaniem i degradacją.

---

## Ewaluacja (Evals)
Ustrukturyzowany test oceniający zachowanie modelu/agenta pod kątem metryk. Nie gwarantuje poprawności — weryfikuje stopień dopasowania. Trzy poziomy oceny: programistyczna (regex, schema), LLM-as-judge, człowiek. Składniki: zadanie (input + expected output), dataset (syntetyczny + produkcyjny, iteracyjny), evaluator (funkcja → score 0–1). Offline eval (przed publikacją, CI/CD) vs online eval (w trakcie działania). Projektowanie datasetów: pokrycie, różnorodność, balans. Strategia kosztowa: dane strukturalne → kod, oceny subiektywne → LLM. Architektura z Promptfoo: stateless provider (subprocess per query) i stateful provider (serializacja historii sesji z SHA256 key). 7 warstw asercji od is-json po llm-rubric. Trzy kategorie scenario evalów (readonly, safety, actions). `expected_outcome` jako semantyczna asercja rezultatu. Scenariusze bez system promptu jako walidacja samo-opisowości narzędzi.
- **s03e01** — trzy poziomy oceny, offline vs online, składniki evala, strategia kosztowa, decyzja biznesowa
- **s03e04** — Promptfoo stateless/stateful provider, 7 warstw asercji, 3 kategorie scenario evalów, `expected_outcome`, eval scenariusze bez system promptu walidujące samo-opisowość
- **s05e03** — LLM-as-judge z konfigurowalną polityką (sekcje z wagami, matchBy, exact vs semantic matching), train/verify split zapobiegający overfittingowi, noise floor — statystyczna istotność poprawy (`delta > max(spread)/2`)

## Guardrails
Trzeci filar obok observability i evals: moderacja, filtrowanie, blokowanie niepożądanych zapytań na wejściu i wyjściu. Niezależna warstwa od ewaluacji, ale korzystająca z tych samych sygnałów. Reaguje w czasie rzeczywistym. Online eval może pełnić rolę dodatkowego safety-netu.
- **s03e01** — definicja, trzy filary (observability + evals + guardrails), online eval jako safety-net

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

## Agent Debugging
Debugowanie agentów różni się fundamentalnie od debugowania kodu — zmiana instrukcji naprawiająca jeden przypadek może psuć inne, brak determinizmu. Playground: re-execucja z pełnym kontekstem i manipulacja parametrami. Technika uzasadnienia: poproszenie modelu o wyjaśnienie wyboru narzędzi ujawnia przyczyny problemu.
- **s03e01** — nondeterministyczne debugowanie, playground, technika uzasadnienia

## Autonomy Gap
Przejście od systemów z człowiekiem w pętli do autonomicznych to nowa klasa problemów programistycznych, nie inkrementalny wzrost trudności. Błąd co piąty raz = system bezużyteczny. Odchylenia tolerowane w trybie wsparcia przekreślają sens systemu autonomicznego. Regularna aktualizacja przekonań o możliwościach modeli.
- **s03e02** — nowa klasa problemów nie inkrementalna trudność, błąd co 5 = bezużyteczny, aktualizacja przekonań

## LLM-generated Test Data
Syntetyczne dane testowe generowane przez LLM z kodu narzędzi. Kategoryzacja dwuwymiarowa: happy path / edge case × pojedyncze interakcje / scenariusze wieloetapowe. LLM domyślnie generuje płytkie testy — wymaga kierowania i weryfikacji kompletności. Scenariusze testowe służą też do oceny jakości zestawu testowego.
- **s03e04** — dwuwymiarowa kategoryzacja, LLM wymaga kierowania, scenariusze oceniają jakość zestawu

## Multi-model Role Separation
Trzy role w jednej pętli z różnymi modelami i profilami kosztowymi: execution (tani, bez reasoningu, najczęściej wywoływany), judge (mocny, high reasoning, ocena semantyczna), improver (mocny, high reasoning, diagnoza i planowanie). Rozdzielenie pozwala niezależną optymalizację kosztu vs jakości.
- **s05e03** — trzy role (execution/judge/improver), różne modele i profile kosztowe, niezależna optymalizacja

## Worker Pool Pattern
N workerów z jedną współdzieloną kolejką zamiast `Promise.all` na wszystkich elementach. Każdy worker bierze kolejny element gdy skończy poprzedni — równomierny rozkład niezależnie od różnic w czasie przetwarzania.
- **s04e05** — współdzielona kolejka, równomierny rozkład, lepsze niż Promise.all przy zróżnicowanym czasie

## Graceful Degradation (Agent Fallback)
Gdy API niedostępne, agent degraduje do regex-based routingu — matchuje wzorce z wiadomości do konkretnych narzędzi MCP. Real-world pattern: system działa zawsze, LLM jest enhancementem.
- **s04e05** — regex-based routing gdy API down, LLM jako enhancement nie wymóg

## API Integration Audit
Przed projektowaniem scenariusza agentowego: weryfikacja dostępności API, webhooków, deep-linków, CLI lub scrapowania. Struktura zwracanych danych może być niekompletna z perspektywy agenta — sprawdzenie wymagane upfront.
- **s04e03** — weryfikacja API/webhooków/CLI/scrapowania upfront, dane mogą być niekompletne

## Self-observing Systems
Agenci cyklicznie weryfikują skuteczność przepływu informacji — nieużywane automatyzacje wyłączane, niedostępne źródła wyrejestrowywane, powiadomienia bez reakcji podnoszą próg. Mechanizm samooczyszczania zapobiegający degradacji automatyzacji w szum.
- **s04e03** — cykliczna weryfikacja skuteczności, samooczyszczanie, degradacja automatyzacji w szum

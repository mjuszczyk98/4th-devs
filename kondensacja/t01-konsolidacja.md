# Tydzień 1: Fundamenty interakcji z LLM

## Spis treści

- [LLM jako funkcja w kodzie](#llm-jako-funkcja-w-kodzie)
- [Sterowanie zachowaniem przez kontekst](#sterowanie-zachowaniem-przez-kontekst)
- [Structured Outputs](#structured-outputs)
- [Function Calling](#function-calling)
- [Projektowanie narzędzi](#projektowanie-narzędzi)
- [Model Context Protocol (MCP)](#model-context-protocol-mcp)
- [Workflow vs Agent](#workflow-vs-agent)
- [Multimodalność i załączniki](#multimodalność-i-załączniki)
- [Bezpieczeństwo](#bezpieczeństwo)
- [Zarządzanie kontekstem i tokenami](#zarządzanie-kontekstem-i-tokenami)
- [Strategie doboru modeli](#strategie-doboru-modeli)
- [Organizacja promptów](#organizacja-promptów)
- [Halucynacje i ograniczenia modeli](#halucynacje-i-ograniczenia-modeli)
- [Wydajność i UX](#wydajność-i-ux)
- [Architektura zdarzeniowa](#architektura-zdarzeniowa)
- [Progresja przykładów kodu](#progresja-przykładów-kodu)

---

## LLM jako funkcja w kodzie

- LLM dostępny przez API (OpenAI, Anthropic, Gemini, OpenRouter) — programistyczna kontrola nad kontekstem i zachowaniem [e01].
- Generowanie **autoregresywne**: model przewiduje kolejny token na podstawie wejścia + dotychczas wygenerowanej treści. Wygenerowanego tokenu nie można usunąć [e01].
- API **bezstanowe** — każde żądanie musi zawierać kompletny kontekst (system prompt + historia). Limit okna kontekstowego w tokenach [e01].
- Token = fragment tekstu. Polski ~50-70% więcej tokenów niż angielski → wyższy koszt i czas [e01].
- Abstrakcja nad providerami: format `provider:model` + adapter per provider tłumaczący wspólny interfejs na natywne API [e05].

## Sterowanie zachowaniem przez kontekst

- **Sterowanie zachowaniem = zarządzanie kontekstem**. Można tworzyć wiele zapytań, gdzie wynik jednego kształtuje wejście drugiego (np. klasyfikacja → routing → odpowiedź) [e01].
- Koszt większej kontroli: wydłużony czas + wzrost kosztów (więcej zapytań API) [e01].
- Semantyczne zdarzenia: interakcja z agentami = seria zdarzeń (tekst, tool calls, potwierdzenia, błędy, obrazy), nie para pytanie-odpowiedź. Trzy warstwy: LLM → aplikacja → użytkownik [e01].
- Przetwarzanie wieloetapowe: tekst w fragmentach (nawet gdy całość mieści się w oknie), zapytania równolegle w grupach, wyniki pośrednie do plików, cache istniejących wyników [e01].

## Structured Outputs

- Mechanizm wymuszający JSON zgodny z JSON Schema (tryb `strict`) [e01].
- Dwa wymiary schema: (1) **struktura** — gwarantowana w strict, (2) **wartości** — generowane na podstawie nazw i opisów pól [e01].
- Kolejność właściwości ma znaczenie: tokeny generowane wcześniej wpływają na kolejne (np. `reasoning` przed `sentiment`) [e01].
- Wartości "nieznany"/"neutralny" zmniejszają ryzyko halucynacji [e01].
- Transformacje: ekstrakcja, klasyfikacja, kompresja, wzbogacenie, synteza, tłumaczenie, weryfikacja, parafraza, generowanie [e01].
- **Gwarancja struktury ≠ gwarancja wartości.** Poprawny JSON z błędnymi danymi nie zostanie wykryty [e05].

## Function Calling

- LLM nie ma dostępu do otoczenia. Function Calling: model generuje JSON z nazwą narzędzia i argumentami, kod uruchamia funkcję i zwraca wynik do kontekstu [e02].
- Jedna interakcja = minimum **dwa zapytania**: pierwsze — model decyduje o wywołaniu, drugie — generuje odpowiedź na podstawie wyniku [e02].
- Pętla agenta: zapytanie → tool call → wynik → kolejne zapytanie, aż model zwróci finalną odpowiedź lub wyczerpie limit kroków [e02].
- Schematy narzędzi dołączane do **każdego** zapytania — zużywają kontekst nawet nieużywane [e02].
- Augmented Function Calling: dodatkowe instrukcje kontekstowe wpływające na zachowanie przy wywołaniu narzędzia. Trzy tryby: statyczny, dynamiczny, hybrydowy [e02].

## Projektowanie narzędzi

- **Nie mapuj API 1:1.** Narzędzia są dla modelu bez kontekstu. Filtruj, łącz, upraszczaj. Limit 10-15 per agent [e02].
- Nazwa unikatowa, opis = wysoki signal-to-noise. Testuj na 10-30 zapytaniach [e02].
- Dziel właściwości na: obowiązkowe dla modelu, ustawiane programistycznie, niedostępne dla modelu [e02, e03].
- Błąd "coś poszło nie tak" = ślepy zaułek. Zawsze konkretna informacja + wskazówka naprawcza [e02].
- **Audyt API przed projektowaniem:** kompletność akcji, identyfikacja zasobów, spójność kontraktu, asynchroniczność, rate limit, paginacja [e03].
- **Konsolidacja:** grupuj po domenie działania. Przykład: 13 narzędzi systemu plików → 4 (`fs_search`, `fs_read`, `fs_write`, `fs_manage`) [e03].
- Każda odpowiedź narzędzia (sukces i błąd) powinna nieść informację kontekstową — błąd → co zrobić, sukces → sugestia [e03].
- Mechanizmy bezpieczeństwa: checksum (współbieżność), dryRun (podgląd), historia wersji (rollback) [e03].

### Natywne vs własne narzędzia

| Typ | Zalety | Wady |
|-----|--------|------|
| Natywne (web search, code execution) | Wygodne, gotowe | Ograniczona konfiguracja, vendor lock-in |
| Własne | Pełna kontrola | Więcej kodu |
| MCP | Standaryzowany protokół, wieloagentowy | Złożoność infrastruktury |

Można łączyć oba typy równocześnie w jednym zapytaniu [e02, e03].

## Model Context Protocol (MCP)

### Trzy role

| Rola | Definicja | Przykład |
|------|-----------|----------|
| **Host** | Aplikacja tworząca połączenia | Claude Desktop, back-end agenta |
| **Client** | Połączenie zarządzane przez Host | Instancja MCP Client |
| **Server** | Proces udostępniający capabilities | files-mcp, uploadthing MCP |

MCP komplementarny do natywnych narzędzi. Z perspektywy modelu źródło jest nieistotne [e03].

### Komponenty

| Komponent | Kierunek | Opis |
|-----------|----------|------|
| **Tools** | Model → Server | Akcje wywoływane przez LLM |
| **Resources** | Model ← Server | Dane do odczytu |
| **Prompts** | Użytkownik → Server | Szablony wiadomości |
| **Sampling** | Server → Model | Żądanie completion (wymaga akceptacji) |
| **Elicitation** | Server → Użytkownik | Żądanie danych (formularz) |
| **Apps** | Model → UI | Interaktywne interfejsy |

### Transporty

| Typ | Zastosowanie |
|-----|-------------|
| **STDIO** | Procesy lokalne, desktop, jeden user/proces |
| **Streamable HTTP** | Serwery zdalne, multi-user, OAuth 2.1 |

### Routing wielu serwerów

Nazwy narzędzi prefiksowane nazwą serwera: `files__fs_read`, `uploadthing__upload_files`. Agent rozpakowuje prefix i kieruje do odpowiedniego clienta [e03].

### Budowa serwerów

1. Pobierz szablon → 2. `API.md` z dokumentacją → 3. AI sugeruje narzędzia → 4. Konsolidacja → 5. Projekt input/output z perspektywy LLM → 6. Implementacja i weryfikacja. Publikacja: VPS + nginx lub Cloudflare Workers [e03].

## Workflow vs Agent

| | Workflow | Agent |
|---|---------|-------|
| Struktura | Sztywna, ustalone etapy | Dynamiczna, model decyduje |
| Pętla LLM | Sekwencyjna, ograniczona | Wieloturmowa z narzędziami |
| Przewidywalność | Wysoka | Niższa, ale elastyczniejsza |
| Kiedy | Proces ustrukturyzowany, rzadkie zmiany | Reakcja na zmiany, otwarte problemy |

100% skuteczności wymaga nadzoru człowieka [e02, e03, e04].

## Multimodalność i załączniki

- LLM odbiera obrazy/audio jako Base64/URL, ale **nie widzi adresu URL** — nie może się do niego odwołać w narzędziach. Rozwiązanie: dodatkowy element z tagiem `<media>` w wiadomości + instrukcja w system prompcie [e04].
- **Vision jako narzędzie analityczne:** pętla generuj → analizuj → popraw. Agent generuje obraz, wywołuje `analyze_image`, otrzymuje werdykt ACCEPT/RETRY [e04].
- Szablony JSON jako prompty do obrazów: precyzyjna edycja jednej sekcji, klonowanie szablonu, referencje [e04].
- Obrazy referencyjne: tablica `reference_images` do kontroli pozy, in-painting, spójności postaci [e04].
- Audio (Gemini): transkrypcja, analiza, TTS (single/multi-speaker). Pliki >20MB → resumable upload. YouTube URL obsługiwane bezpośrednio [e04].
- Wideo: analiza (Gemini bez podziału na klatki) + generowanie (Kling). Klatka startowa + końcowa = maksymalna kontrola. Ostatnia klatka segmentu = pierwsza następnego [e04].
- Dokumenty: agent + template HTML + Puppeteer → PDF. Szablon = master reference, nigdy nie edytowany bezpośrednio [e04].

## Bezpieczeństwo

- **Prompt injection** = problem otwarty, bez skutecznej obrony. Ograniczaj na poziomie środowiskowym: sandbox, whitelist, izolacja kontekstu [e02].
- Akcje nieodwracalne → potwierdzenie przez UI (formularz/przycisk), nie przez wiadomość do modelu [e02].
- Dane wrażliwe → kontrola w kodzie, model nie ma prawa ich ustalać [e02].
- Tryb **dry-run** — agent testuje akcję przed wykonaniem [e02].
- Mechanizm zaufanych narzędzi ("trust") z resetem przy jakiejkolwiek zmianie schematu/nazwy/opisu [e05].
- Jeśli przypadkowe przecieki danych są niedopuszczalne → **LLM nie powinien tam być wdrożony** [e05].
- Natywne narzędzia wygodne, ale ograniczone w konfiguracji i silnie uzależniające od platformy [e01].

## Zarządzanie kontekstem i tokenami

- Limit okna = input + output. GPT-5.2 (400k okno, 128k max output) → realnie 272k na input [e05].
- Estymacja: chars / 4 + bufor ~20%. Po zapytaniu — korekta na podstawie `usage` [e05].
- Kompresję uruchamiać **wcześnie**, już przy ~30% zużycia limitu [e05].
- **Prompt cache = priorytet.** Stabilna instrukcja systemowa + stabilny początek wątku = automatyczny cache. Zmiana jednej linijki system promptu niszczy cache [e02].
- Dynamiczne dane (data, godzina) → wiadomość użytkownika, nie prompt systemowy [e02].
- Pływające okno kontekstu gorsze niż pełny wątek z cache'em. Przy zbliżaniu się do limitu: kompresja + zapis do plików [e02, e05].

## Strategie doboru modeli

| Strategia | Kiedy |
|-----------|-------|
| Główny | Proste aplikacje |
| Główny + Alternatywny | Optymalizacja kosztu/szybkości |
| Główny + Specjalistyczne | Maksymalna skuteczność per zadanie |
| Zespół małych | Niski koszt, eksperymenty |

Pytanie "jaki model jest najlepszy?" jest błędne — właściwe: "jaki model jest najlepszy **w tej sytuacji?**" [e01]. Unikać vendor lock-in. Frameworki (AI SDK itp.) obecnie nerekomendowane [e01].

### Reasoning

Wbudowany reasoning (LRM) poprawia skuteczność, ale prostym zadaniom może szkodzić. Dodatkowe techniki: planowanie (lista zadań), odkrywanie (model "nie wie, że wie"), przekierowanie (zarządzanie uwagą), uśrednianie (wiele modeli → perspektywy) [e02].

## Organizacja promptów

| Technika | Zalety | Wady |
|----------|--------|------|
| Inline | Prostota | Brak kompozycji |
| Oddzielne pliki | Kompozycja, zmienne | Trzeba monitorować finalny prompt |
| Systemy zewnętrzne (Langfuse) | Wersjonowanie, monitoring | Dodatkowa zależność |
| **Markdown + YAML frontmatter** | Dostępne w runtime, edytowalne przez agentów | Brak wbudowanego wersjonowania |

Markdown + frontmatter = preferowany format [e01].

### Instrukcja systemowa — elementy

- **Tożsamość** — kieruje uwagę ku skojarzeniom (nie daje magicznych zdolności)
- **Strukturyzacja** — tagi XML-like wyznaczają granice sekcji
- **Limity** — zmniejszają ryzyko, ale nie dają gwarancji
- **Ograniczenia** — warunkowe reguły działania
- **Styl** — zwięzły przyspiesza, ale "modele myślą poprzez generowanie tokenów"
- **Adaptacja** — instrukcje dla trudnych sytuacji
- **Kalibracja** — konkretne wskazówki formatowania

**Generalizowanie generalizacji:** zamiast specyficznej reguły per problem → kształtuj proces myślowy modelu. Przykład: "zastanów się głośno nad wyborem narzędzia, określ pewność, poproś o doprecyzowanie" adresuje kategorię problemu [e01].

Instrukcje systemowe **nie są zabezpieczeniem** — jailbreaking możliwy. Bezpieczeństwo na poziomie kodu [e01].

### In-context learning

Model wykorzystuje wzorce z kontekstu. Few-shot / many-shot pozwala rozpoznać schematy. Preferowany pattern: system prompt = zgeneralizowane zasady, przykłady i dokumenty wczytywane dynamicznie przez narzędzia [e01].

## Halucynacje i ograniczenia modeli

- Modele Flash potrafią **w pełni halucynować** treść strony na podstawie samego URL [e05].
- Model może "domyślić się" brakujących parametrów zamiast poprosić o doprecyzowanie [e05].
- Redukcja ryzyka: informowanie o ograniczeniach, instrukcje przy braku danych, zmniejszenie złożoności i objętości kontekstu [e05].
- Halucynacje wizualne: 95% poprawnych detali, 5% subtelnych błędów [e04].

## Wydajność i UX

- **Heartbeat** — informowanie o postępie zmienia postrzeganą wydajność [e05].
- **Wielowątkowość** — długie zadania: kolejka, nowe wątki, oddzielenie stanu UI od back-endu [e05].
- **Wznawianie** — agent może czekać na wiele rzeczy jednocześnie [e05].
- Prompt cache, równoległe wywołania narzędzi, batchowe operacje, zmiana modelu na mniejszy tam gdzie możliwe [e02].
- Zmieniaj model na mniejszy tam gdzie to możliwe. Przekazuj dane między narzędziami przez pliki, nie przez output modelu [e02].
- LRM — niższa cena/token, ale **znacznie więcej tokenów**. Tańszy model może być droższy w użyciu [e05].
- Nagłówki HTTP odpowiedzi zawierają RPM/TPM limity — reaguj programistycznie [e05].

## Architektura zdarzeniowa

- Pętla agenta emituje zdarzenia: `agent.started`, `turn.started/completed`, `tool.called/completed/failed`, `agent.waiting/resumed/completed/failed/cancelled` [e05].
- Każde zdarzenie niesie **EventContext** z `traceId`, `sessionId`, `agentId`, `rootAgentId`, `depth` — korelacja w systemach wieloagentowych [e05].
- Subskrypcja zdarzeń: monitorowanie (Langfuse), moderacja, kompresja kontekstu, blokady [e05].
- Zdarzenia pozwalają na **wznowienie** agenta po dostarczeniu wyniku (`deliverResult`) [e05].

### Decyzje architektoniczne

- **Brak frameworków AI** — dynamiczny rozwój sprawia, że stają się obciążeniem [e05].
- Agenty jako **pliki markdown** (frontmatter: model, narzędzia; body: system prompt) — czytane z dysku bez restartu [e05].
- Autentykacja: klucze API hashowane (SHA-256), przypisane do użytkowników w bazie (SQLite + Drizzle ORM) [e05].
- Moderacja: OpenAI Moderation API — brak moderacji może prowadzić do zablokowania konta [e05].

---

## Progresja przykładów kodu

### 1. Interaction (e01) — podstawowa wieloturnowa rozmowa

```js
const response = await fetch(RESPONSES_API_ENDPOINT, {
  method: "POST",
  body: JSON.stringify({
    model: MODEL,
    input: [...history, toMessage("user", input)],
    reasoning: { effort: "medium" },
  }),
});
```

Uczy: każde zapytanie = pełna historia. Model nie pamięta — my dołączamy kontekst.

### 2. Structured (e01) — wymuszony JSON Schema

Delta: `text.format` ze schema gwarantuje parsowalny JSON. Typy `["string", "null"]` + opisy z "use null if..." obsługują nieznane wartości.

### 3. Grounding (e01) — kaskadowy pipeline 4-etapowy

Delta: wieloetapowe przetwarzanie, każda stage ma własny schema + prompt. Etapy: Extract → Dedupe → Search (z web search) → Ground (HTML z `<span class="grounded">`).

### 4. Minimalna pętla tool-callingu (e02) — definicje JSON Schema + handlery + pętla z limitem

Delta: separacja definicji (co model widzi) od implementacji (co kod wykonuje).

### 5. Sandboxing + conversation state (e02) — resolveSandboxPath blokuje path traversal

Delta: narzędzia izolowane programistycznie — model może próbować wyjść poza zakres.

### 6. MCP core (e03) — pełny obieg protokołu z sampling + elicitation

Delta: serwer pyta klienta o completion i potwierdzenie użytkownika w jednym handlerze.

### 7. MCP native (e03) — unifikacja narzędzi MCP i natywnych

Delta: jedna mapa handlerów, jedna lista schematów — izomorficzne z perspektywy agenta.

### 8. MCP translator (e03) — agent operujący na filesystem, file watcher, config z `mcp.json`

Delta: STDIO transport ze zmiennymi środowiskowymi, automatyzacja wyzwalana zdarzeniowo.

### 9. Upload MCP (e03) — wiele serwerów (STDIO + HTTP), routing po prefiksie, `{{file:path}}` resolver

Delta: jednoczesne połączenie różnych transportów, placeholder zamieniany na base64.

### 10. Multimodalność (e04) — 8 przykładów ze wspólną architekturą

Delta: agent łączy MCP (filesystem) + narzędzia natywne (vision, obrazy, audio, wideo, HTML→PDF) w jednej pętli. Szablony JSON + referencje + pętla generuj-analizuj-popraw.

### 11. Confirmation (e05) — whitelist + deterministyczne potwierdzenia

Delta: separacja walidacji od LLM. Agent nie decyduje — robi to kod.

### 12. Trusted tools (e05) — pamięć zaufania w sesji z resetem

Delta: redukcja frakcji potwierdzeń przez sesyjne zaufanie.

### 13. Pętla agenta z delegacją (e05) — pełny stan, przerwanie, wznowienie, depth-guarding

Delta: kontekst persystowany w bazie, agenty mają stany (`pending` → `running` → `waiting` → `completed`), delegacja z depth-limit.

### 14. Pruning kontekstu (e05) — kaskadowe podsumowanie

Delta: dropped items → generowanie podsumowania przez LLM → jako system message na początku. Sesja accumuluje summary kaskadowo.

---

## Uzupełnienia

### Typy narzędzi i ich wykonanie [e05]

Kluczowa taksonomia narzędzi w pętli agenta:
- **Sync tools** — wykonywane natychmiast w pętli (np. kalkulator)
- **MCP tools** — identyfikowane po prefiksie `serwer__narzędzie`, wykonywane przez klienta MCP (stdio lub HTTP)
- **Agent tools (delegation)** — spawnują agenta-dziecko z depth-guardingiem (`MAX_AGENT_DEPTH`). Wynik propaguje do rodzica
- **Deferred tools** — brak zarejestrowanego handlera → agent przechodzi w `waiting`, czeka na `POST /deliver`

### Struktury baz danych: czatbot vs system wieloagentowy [e01]

**Czatbot** — dwie tabele: `conversations` (id, tytuł, status) + `messages` (id, conversation_id, role, treść).

**System wieloagentowy** — trzy tabele:
- `sessions` — sesja powiązana z użytkownikiem i agentem koordynującym (nazwa, status)
- `agents` — instancje utworzone na podstawie szablonów; zadanie, status, postęp, powiązanie z sesją i agentem zlecającym
- `items` — etapy interakcji: wiadomości, wywołania narzędzi, załączniki (obrazy, dokumenty)

Struktura sessions/agents/items umożliwia dwukierunkową komunikację między agentami i zatwierdzanie akcji przez użytkownika.

### Agent Harness — pełny system [e02]

Poza samym agentem, pełny system to **Agent Harness**: system plików, sandbox do wykonywania kodu, mechaniki zarządzania kontekstem i pamięcią, komunikacja między agentami, obserwacja całego systemu. Budowa aplikacji z LLM to ~80% klasycznych aktywności, ale pozostałe ~20% to zupełnie nowa klasa problemów.

### Dwa znaczenia Context Engineering [e02]

1. **Poziom użytkownika** — zarządzanie kontekstem w narzędziach typu Claude Code / Cursor (restart wątków, przenoszenie informacji)
2. **Poziom aplikacji** — kontrolowanie przebiegu interakcji, narzędzi, ich rezultatów i komunikacji między agentami. Na tym skupia się kurs

### Renderowanie odpowiedzi LLM [e01]

Odpowiedź LLM to seria zdarzeń (tokeny rozumowania, wywołania funkcji, obrazy, błędy). Renderowanie w czasie rzeczywistym wymaga obsługi:
- **Streamingu markdown→HTML** — fragmenty kodu, LaTeX, tablice niekompletne w trakcie strumieniowania
- **Biblioteki:** Streamdown, Markdown Parser ułatwiają budowanie front-endu
- **Dynamiczne UI:** AI generuje interaktywne komponenty — standaryzowane przez MCP Apps, Apps SDK, JSON Render

Kierunek: od interakcji tekstowych do dynamicznie generowanych interfejsów.

### Modele open-source — podstawy [e01]

- **Formaty:** GGUF (llama.cpp, cross-platform) vs MLX (Apple Silicon)
- **Kwantyzacja:** kompresja wag (Q2→Q8). Q4/Q5 = zazwyczaj właściwy balans. Niższa precyzja = mniejszy rozmiar + szybsza inferencja, ale niższa skuteczność
- **VRAM / Unified Memory:** model wczytywany do pamięci. Minimum ~32 GB RAM; największe modele wymagają ~512 GB
- Testowanie: LM Studio (lokalnie) lub OpenRouter (bez instalacji)
- Modele open-source mogą przewyższać komercyjne LLM w wyspecjalizowanych zadaniach + pełna prywatność

### Dynamiczne listy narzędzi [e02]

Dynamiczne dodawanie narzędzi bez psucia prompt cache — obecnie tylko Anthropic. Alternatywy:
- Sub-agenci z osobnymi oknami kontekstu
- Code execution sandbox (narzędzia jako pliki, tylko podstawowe w kontekście) — **Progressive Disclosure**
- Agent musi mieć wskazówki o dostępnych zasobach — inaczej "nie wie, że wie"

### OAuth w MCP [e03]

Serwery MCP publiczne wymagają programistycznych ograniczeń. OAuth flow: odkrywanie metadanych → PKCE → wymiana kodu na tokeny RS → szyfrowanie → auto-refresh.

### Sampling = delegacja dostępu do AI [e03]

Sampling pozwala serwerowi MCP korzystać z LLM **bez własnych kluczy API** — klient (Host) posiada relację z providerem. Serwer wysyła `sampling/createMessage` z komunikatami i ograniczeniami, klient realizuje completion. Ten sam mechanizm działa dla elicitation.

### Workflow jako narzędzie agenta [e04]

Workflow i agent nie są "albo-albo". Workflow może stać się jednym z narzędzi w zestawie agenta — agent decyduje, czy kontekst wymaga elastyczności (agent) czy przewidywalności (workflow jako delegacja).

### Streaming jako tryb wykonania agenta [e05]

Dwa tryby: `runAgent` — standardowy, zwraca wynik po zakończeniu. `runAgentStream` — generator (`AsyncIterable<ProviderStreamEvent>`), yielding zdarzenia strumieniowe w trakcie. Oba dzielą logikę pętli, różnią się sposobem zwracania. Stream kończy się gdy agent wejdzie w `waiting` — wznowienie obsługuje osobne wywołanie.

### Architektura wspólna przykładów multimodalnych [e04]

Wszystkie 8 przykładów współdzieli architekturę:
- `agent.js` → pętla chat/tool calls (MAX_STEPS)
- `api.js` → Responses API client
- `config.js` → model, instrukcje systemowe, backendy
- `mcp/` → klient MCP (filesystem)
- `native/` → narzędzia natywne (vision, obrazy, audio, wideo, HTML→PDF)
- `helpers/` → logger, stats, shutdown
- `repl.js` → interaktywna pętla REPL

Rozróżnienie: `isNativeTool(name)` → natywne, reszta → MCP.

### Asymetria PDF: generowanie vs przetwarzanie [e04]

Generowanie PDF przez HTML→PDF (Puppeteer) jest relatywnie proste. **Przetwarzanie istniejących PDF-ów** (czytanie, nawigacja, ekstrakcja) to poważny problem biznesowy. Generowanie dokumentów jest znacznie łatwiejsze niż ich późniejsze rozumienie.

### Style-guide jako konfiguracja runtime'owa [e04]

Agent nie ma zasad stylu w instrukcji systemowej — czyta `style-guide.md` z systemu plików przed pierwszą akcją. Oddziela reguły stylu od kodu, pozwala modyfikować zachowanie bez zmian w instrukcjach. Ten sam wzorzec dotyczy szablonów HTML i JSON. Użytkownik dostosowuje output edytując pliki, bez dotykania kodu.

### Architektura agenta autonomicznego z MCP [e03]

Wzorzec: **źródło zdarzeń** (polling katalogów) → **klient MCP** (narzędzia do fs) → **pętla agenta** (LLM decyduje o kolejności). Agent otrzymuje cel, ale sam decyduje jak: wczytuje, dzieli, tłumaczy, weryfikuje, poprawia. Kluczowe: limit kroków (safety guard), historia tool calls, niezależne zarządzanie stanem per plik.

### Błędy samej aplikacji vs modelu [e05]

Zachowanie modelu może wynikać z **błędów aplikacji**, nie modelu: część instrukcji wczytana niewłaściwie, model otrzymuje informację o dostępie do narzędzi, z których nie może skorzystać. Każda pomyłka trudna do zauważenia w systemach wieloagentowych. Należy zapisywać i monitorować wszystkie zdarzenia, uwzględniając instrukcje systemowe i ich zmiany w trakcie interakcji.

### Transformacja zapytań i nawigacja po bazie wiedzy [e02]

Zapytanie użytkownika nie zawsze bezpośrednio pasuje do zasobów. Transformacja przez synonimy/powiązane zagadnienia zwiększa szansę trafienia. Model potrzebuje ogólnej wiedzy o zawartości bazy (np. `_index.md`) — bez tego nie nawiguje skutecznie. Należy rozpoznawać, czy pytanie w ogóle dotyczy bazy wiedzy — zachęcać agenta do pytań doprecyzowujących.

### API vs MCP vs CLI [e02]

| Aspekt | API | CLI | Function Calling / MCP |
|--------|-----|-----|----------------------|
| Kontrola | praktycznie brak | ograniczona | pełna |
| Dokumentacja | eksploracja | `--help` lokalnie | wbudowana w schematy |
| Skalowalność | dobra | trudna poza lokalnym | dobra |

Proxy (warstwa między API a LLM) = adaptacja istniejącego API bez jego modyfikacji. MCP = jeden z wzorców takiego proxy.

### Premise Order Matters [e02]

Badanie (arxiv: 2402.08939): sama zmiana kolejności informacji w prompcie potrafi obniżyć skuteczność modelu o ~40%. "Don't Overthink it": reasoning negatywnie wpływa na proste zadania.

### Mapy treści w plikach, nie w system prompt [e02]

Zamiast szczegółowych instrukcji nawigacji po bazie wiedzy w instrukcji systemowej (komplikuje prompt, psuje cache), lepiej przechowywać "mapę treści" w plikach zewnętrznych (np. `_index.md`). Agent wczytuje je dopiero gdy potrzebuje.

### Konfigurowalne połączenia API [e02]

Narzędzie `workspace_metadata` nie jest prostym połączeniem zasobów — model decyduje, jakiego podzbioru danych potrzebuje w danym momencie, bez pobierania całości. Redukuje kroki i zużycie kontekstu.

### Modele lokalne jako quality test [e03]

Jeśli mały model (Qwen, GLM) obsługuje narzędzia poprawnie, interfejs jest dobrze zaprojektowany. Praktyczny test jakości projektowania narzędzi.

### Deklaratywna konfiguracja serwerów MCP (`mcp.json`) [e03]

Produkcyjny wzorzec: konfiguracja połączeń MCP w jednym pliku JSON, mieszane transporty (stdio + HTTP) z definicją komend, argumentów, zmiennych środowiskowych i URL-i. Klient wczytuje config, tworzy odpowiedni transport per serwer i prefixuje nazwy narzędzi.

### Filozofia instrukcji agenta klasyfikującego [e04]

Instrukcja oparta na **regułach rozumowania**, nie na krokach procesu: jak zbierać dowody (tylko obserwowalne cechy), jak dopasowywać (profile = wymagania minimalne), jak radzić sobie z niejednoznacznością (brak dopasowania → unclassified), jak obsługiwać kompozyty (oceniać każdy obiekt osobno). Realizacja zasady: instrukcja zależna od klasy problemów, nie od zestawu danych.

### Generowanie obrazów przez kod [e04]

Agenci mogą tworzyć grafiki nie tylko przez modele image-generation, ale też **pisząc kod** — wykresy, diagramy, infografiki. Obraz = wynik narzędzia (execute code), nie modelu wizyjnego. Agent nie widzi wyniku, chyba że wyposażymy go w vision.

### UX odpowiedzi audio [e04]

Gdy agent odpowiada w formie audio: unikać dyktowania URL-i, tabel, zaawansowanego formatowania. Treść musi być dostosowana do medium — dźwięk nie przenosi formatowania wizualnego.

### Obserwowalność kosztów na produkcji [e05]

Podstawa optymalizacji: obserwowanie aplikacji i zachowań użytkowników. Platformy: Langfuse, Confident AI. Proporcja na produkcji: 1 zdarzenie użytkownika : 50+ zapytań do AI. Przed pełnym wdrożeniem — testy z małą grupą testerów.

### Limity środowiskowe i biznesowe [e05]

Ograniczenia aplikacji generatywnych wykraczają poza modele:
- Rozproszone bazy wiedzy, zróżnicowane formaty dokumentów
- Niepisane, nieustrukturyzowane procesy manualne
- Zestawy narzędzi bez API
- Fizyczny brak dostępu do aktualnych danych
- Rzadko pełna automatyzacja — częściej optymalizacja procesu o kilka-kilkanaście procent

### Deployment produkcyjny [e05]

Konkretne kroki: VPS (Ubuntu) → git/node/nginx/ufw → DNS (Cloudflare) → TLS (letsencrypt) → GitHub Actions self-hosted runner → reverse proxy nginx → sekrety w repozytorium → workflow `.yml` po push na main.

### Fine-tuning i destylacja — ostateczność [e05]

Gdy architektoniczne techniki nie wystarczą: fine-tuning mniejszych modeli pod konkretne zadanie, destylacja większych modeli. Obecnie rzadko stosowane — ceny i szybkość modeli Flash są wystarczające.

### Obowiązki prawne na produkcji [e05]

Jeśli agent może zrobić coś, czego nie powinien — aplikacja musi jasno informować, produkt zabezpieczony prawnie: regulaminy, polityka prywatności, umowy z dostawcami i użytkownikami końcowymi. Zakres detali zależy od projektu.

# Strategia Produktowa i Wdrożeniówka

## Realia biznesowe aplikacji AI
Aplikacja AI to ~80% klasycznego software. Ograniczenia nie tylko modeli: rozproszone bazy wiedzy, nieustrukturyzowane procesy, narzędzia bez API, brak dostępu do aktualnych danych. Rzadko pełna automatyzacja — częściej optymalizacja o kilka-kilkanaście procent. Użytkownicy nieświadomi limitów LLM. Wymóg projektowy, nie zarzut.
- **s01e05** — ~80% klasyczny software, rzadka pełna automatyzacja, nieświadomi użytkownicy

## Wydajność / UX agenta
Wydajność modeli adresowana przez architekturę, nie model. **Heartbeat** — wgląd w kroki (zmienia postrzeganą wydajność). **Wielowątkowość** — kolejka wiadomości, stan UI oddzielony od backendu. **Przetwarzanie w tle** — zadanie musi przeżyć zamknięcie przeglądarki. **Zasada "czy AI tu jest niezbędne"** — jeśli da się kodem, zrób kodem. Ostateczność: fine-tuning / destylacja.
- **s01e05** — heartbeat, wielowątkowość, zasada "czy AI niezbędne", fine-tuning jako ostateczność
- **s05e03** — przyciski zamiast czatu gdy akcja prosta, czat sensowny na skali lub przy złożonych akcjach, cache + równoległość + streaming jako standardowe techniki latencji

## Koszty LLM
LRM: niższa cena/token ale znacznie więcej thinking tokens. Proporcja 1:50 (user:model). Tańszy model ≠ tańsze rozwiązanie (więcej kroków = wyższy koszt). AI ambientowe: małe zadania w krótkich interwałach sumują się drastycznie.
- **s01e05** — proporcja 1:50, tańszy model ≠ tańsze rozwiązanie, AI ambientowe
- **s05e03** — 1-3% użytkowników generuje większość kosztów, twarde limity per user i dedykowane klucze jako konieczność, monitorowanie kosztów w szerszym kontekście biznesowym

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

## Open-source Models & Quantization
Formaty GGUF (cross-platform, llama.cpp) vs MLX (Apple Silicon). Kwantyzacja = kompresja wag (Q2-Q8); Q4/Q5 = rozsądny balans. VRAM/Unified Memory jako główne ograniczenie. Testowanie: LM Studio (lokalnie) lub OpenRouter (zdalnie). Open-source bije komercyjne w wybranych zadaniach specjalistycznych i przy wymogach prywatności.
- **s01e01** — formaty, kwantyzacja, wymagania VRAM

## Tokenization
Token = fragment tekstu (część słowa, słowo, znak). Język polski zużywa ~50-70% więcej tokenów niż angielski — realny wpływ na koszt, latencję, efektywne wykorzystanie okna kontekstowego.
- **s01e01** — tokenizacja, koszt języka polskiego

## Parallelism & Batching
Równoległe wywołania API w grupach (`Promise.all`) dla skrócenia czasu i unikania rate-limit. Batchowanie w obrębie etapu pipeline'u lub parallel function calling w agencie.
- **s01e01** — `Promise.all` w batchach po 5
- **s01e02** — parallel function calling

## AI Deployment Strategy
Brak ustalonych best practices — tempo zmian miesiące, nie lata. Każde wdrożenie = eksperyment. Strategia: buduj system, z którego sam korzystasz — bezpośrednie doświadczenie ograniczeń. MVP celowo minimalny jako punkt odniesienia. Decyzja o niestosowaniu AI równie ważna jak o zastosowaniu.
- **s04e01** — build-what-you-use, MVP jako punkt odniesienia, decyzja o braku AI równie ważna

## Agent Interface Design
Cztery komplementarne ścieżki integracji agentów (CLI, MCP hostowany, komunikatory, dedykowany UI) — system produkcyjny to kompozycja, nie wybór jednej. Kryteria decyzyjne: grupa docelowa (techniczna vs nietechniczna), ekonomia (subskrypcje vs API), złożoność (autonomia, uprawnienia, dwukierunkowa komunikacja). Interfejs determinuje resztę architektury — model, personalizację, zakres integracji.
- **s04e02** — cztery ścieżki, kompozycja nie wybór, kryteria: grupa docelowa/ekonomia/złożoność, interfejs determinuje architekturę

## Micro-actions
Pojedyncze akcje AI (TTS, tłumaczenie, parafraza, wizualizacja, odnalezienie powiązań) przypisane do skrótów klawiszowych, gestów lub wyzwalaczy. Realizacja: skrypt + skrót lub lekka natywna aplikacja. Niski koszt implementacji, najwyższy dzienny ROI ze wdrożenia AI. Rozszerzalne na automatyzacje mobilne (Siri Shortcuts), watchery katalogów, natywne API urządzeń.
- **s04e02** — pojedyncze akcje AI na skróty/gesty, najwyższy ROI, rozszerzalne na mobilne

## Agent Personalization
Cztery filary personalizacji interfejsu agenta: (1) Profile/subagenci — dedykowane konteksty z własnymi ustawieniami i modelem, (2) Umiejętności/skills — predefiniowane instrukcje wstrzykiwane intencjonalnie lub przez model, (3) Narzędzia — pełny cykl UI (prezentacja → potwierdzenie → postęp → błąd → wynik + anulowanie), (4) Workflow — powtarzalne sekwencje, hooki, zaplanowane zadania. Jakość implementacji mechanik ważniejsza niż sam ich zestaw.
- **s04e02** — cztery filary (profiles/skills/tools/workflow), jakość mechanik > ich liczba

## Parallel Prototyping
AI obniża koszt prototypowania do poziomu równoległego testowania wielu wariantów — z sekwencyjnego na równoległe. Każdy test = odpowiedź na konkretne pytanie decyzyjne. Założenia początkowe błędne — liczy się szybkość korekty, nie doskonały plan.
- **s04e01** — równoległe testowanie wariantów, szybkość korekty > doskonały plan

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

## Theory of Mind in LLMs
Modele od GPT-4 demonstrują rozwinięte zdolności wnioskowania o stanach mentalnych innych (ref: arxiv 2505.00026). Podstawa mechanik inteligencji emocjonalnej agenta — "czytanie między słowami", odczytywanie intencji. Wzrasta z generacjami modeli.
- **s03e05** — arxiv ref, podstawa inteligencji emocjonalnej, wzrost z generacjami

## External Signal Enrichment
Sub-agent automatycznie wzbogaca kontekst o sygnały z zewnętrznych API (pogoda, itd.) na podstawie celu/keywordów. Lazy — fetchuje tylko gdy cel wymaga. Ogólny wzorzec: agent nie tylko czyta pliki, ale integruje dane z otoczenia.
- **s03e05** — lazy fetching na podstawie celu, wzorzec integracji danych otoczenia

## Enrichment
Agent jako węzeł łączący szczątkowe informacje z wielu źródeł (kontakty, miejsca, kalendarz, mapa, pogoda) w ustandaryzowany output. Oryginalna wiadomość wzbogacana o dane z narzędzi. Wartość biznesowa w standaryzacji procesów, nie pojedynczych interakcjach. Bezpieczeństwo: deterministyczne interfejsy dla wrażliwych operacji.
- **s03e03** — agent jako enrichment node, standaryzacja procesów, deterministyczne interfejsy

## Web Scraping Evolution
Przesunięcie w traktowaniu agentów: od blokowania (AI Labyrinth) do współpracy — Cloudflare Markdown for Agents (strukturyzowana treść), Chrome WebMCP (natywny protokół). Nie eliminuje scrapowania — platformy bez API nadal wymagają agenta z przeglądarką. Gradacja: klasyczny bot → agent AI z Playwright → Browserbase/kernel.sh na większą skalę.
- **s03e03** — od blokowania do współpracy, Markdown for Agents, WebMCP, gradacja automatyzacji

## Offensive Design
Projektowanie z perspektywy "co dodać" nie tylko "co naprawić". Interfejs głosowy w proaktywnym systemie okazuje się bardzo użyteczny. Wysoka specjalizacja agenta akceptowalna. Onboarding i komunikacja produktu = element architektury na równi z kodem.
- **s03e03** — additive design, głos w proaktywnym systemie, specjalizacja OK, onboarding = architektura

## Context-aware Communication
Agent z dostępem do stanu urządzenia (aktywna aplikacja, lokalizacja, tryb DND) dynamicznie dobiera kanał i formę komunikacji — od ciszy, przez powiadomienie, po eskalację SMS. Wymaga natywnego dostępu do urządzenia.
- **s04e03** — dobór kanału/formy na bazie stanu urządzenia, natywny dostęp wymagany

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

## Incremental Sync
Snapshot-based delta synchronization: sygnatura pliku = `size:mtimeMs`. Przesyłane tylko zmienione pliki. Prostsze niż hashowanie zawartości, wystarczające do detekcji zmian. Background loop z `syncInFlight` flag zapobiegającym race conditions.
- **s04e01** — snapshot-based sync (`size:mtimeMs`), background loop, race condition prevention

## Enterprise AI Deployment
Wdrożenie AI w organizacji wymaga trzech osi jednocześnie: biznesowej (koszty, compliance, ROI), kulturowej (adopcja, oddolne inicjatywy > narzucone z góry) i technologicznej (ewaluacja, architektura, założenie <100% skuteczności). Paradoks doświadczenia: skuteczność użytkownika drastycznie zależy od świadomości mechanik agenta. Prototypowanie generuje organicznie nowe wymagania — budować małe, pokazywać wcześnie.
- **s04e05** — trzy osie wdrożenia, paradoks doświadczenia, budować małe pokazywać wcześnie, oddolne inicjatywy > narzucone

## Document-as-Tool
Najmniej inwazyjne wdrożenia AI to dokumenty/prompty podłączane do istniejących interfejsów. Trzy wzorce: checklista (powtarzalny proces, AI weryfikuje kompletność), onboarding (przekierowanie semantyczne, AI radzi sobie z niedokładnymi zapytaniami), styl (jeden prompt = spójność w zespole). AGENTS.md i Skills to ten sam wzorzec przeniesiony do programowania.
- **s04e05** — trzy wzorce (checklista/onboarding/styl), najmniej inwazyjne wdrożenie, AGENTS.md jako ten sam wzorzec

## Digital Garden
Cyfrowy ogród — strona www generowana z systemu plików markdown (frontmatter + wikilinks) pełniąca jednocześnie rolę bazy wiedzy agenta, obszaru roboczego (agent czyta/modyfikuje pliki), publikacji (wybrane treści jako www) i organizacji (tagi, wikilinks). Build pipeline: collect → parse → rewrite links → render → search (Pagefind). Auto-build na podstawie fingerprintu SHA-256. Pliki `visibility: private` chronione hasłem. Folder workspace kompatybilny z Obsidian.
- **s05e05** — pełny build pipeline, SHA-256 fingerprint, Pagefind search, visibility: private, Obsidian-compatible

## Daily Ops
Wzorzec cyklicznej orkiestracji asynchronicznej: niezależni agenci uruchamiani równolegle, każdy w własnej sesji, każdy zbiera dane z własnych integracji. Wyniki do jednego folderu → agent agregujący → transkrypt + audio → urządzenie mobilne. Harmonogram z zewnątrz (cron, GitHub Actions). Brak zależności między agentami = pełen paralelizm.
- **s05e05** — niezależni agenci równolegle, agregacja wyników, harmonogram cron/GitHub Actions

## Nawyk > Technologia
Techniczne możliwości agentów bez nawyku korzystania = zero wartości. Klucz: dopasowanie kanału komunikacji do istniejących zachowań użytkownika. Łączenie nowej aktywności z tym, co już robimy. Samo skonfigurowanie integracji nie wystarczy — musi zostać używane cyklicznie.
- **s05e05** — dopasowanie kanału do zachowań, cykliczne używanie, konfiguracja niewystarczająca

## Technologia bez Procesu
System agentowy z pełnym stackiem narzędzi bezużyteczny bez zdefiniowanych procesów. Wartość pojawia się dopiero przy spersonalizowanych procedurach, skryptach i cyklicznych wyzwalaczach. Heurystyka: zacząć od jednego powtarzalnego procesu, nie od architektury wszechświata.
- **s05e05** — pełny stack bezużyteczny bez procesów, heurystyka: zacząć od jednego powtarzalnego procesu

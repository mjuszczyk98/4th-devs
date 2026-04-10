# Frontend, Streaming i Rendering
> Koncepty związane z interfejsem użytkownika agenta, streamingiem, renderingiem i multimodalnością.

## Semantic Events & Rendering
Interakcja z LLM to seria zdarzeń (tekst, tool calls, reasoning, obrazy, błędy, potwierdzenia), nie prosta para Q&A. Architektura: oddziel LLM ↔ warstwę stanu aplikacji ↔ UI. Semantyczne zdarzenia z ID/typem/metadanymi zamiast surowego tekstu. Streaming markdown→HTML wymaga obsługi niekompletnych fragmentów (code blocks, LaTeX, tabele). Biblioteki: Streamdown, Markdown Parser.
- **s01e01** — seria zdarzeń zamiast Q&A, trójwarstwowa architektura, streaming
- **s05e02** — event sourcing SSE jako source of truth, deduplikacja przez `eventIdsByMessageId` + `lastSeq`, dwie ścieżki renderingu (pełna O(n), przyrostowa O(1)), `store: false` utrzymuje pełną kontrolę kontekstu po stronie serwera

## Dynamic / Generative UI
Kierunek: od tekstu do dynamicznie generowanych interfejsów. Standardy: MCP Apps, Apps SDK, JSON Render. AI generuje interaktywne komponenty i wizualizacje. Proces wstrzymywany na potwierdzenie użytkownika lub wynik innego agenta. Spektrum trzech strategii: **Artifacts** (LLM generuje pełny HTML, niska kontrola), **Render** (JSON spec z katalogu komponentów, server-side rendering, średnia kontrola), **MCP Apps** (UI predefiniowany, model izolowany od kodu, pełna kontrola). Kluczowe: widoczność kodu dla modelu (pełna w Artifacts/Render, brak w MCP Apps). Przesunięcie roli projektanta z detali w stronę struktur.
- **s01e01** — kierunek rozwoju, standardy, wstrzymywanie procesu
- **s03e05** — spektrum trzech strategii (Artifacts/Render/MCP Apps), `registerAppTool`/`registerAppResource`, `visibility: ['app']` scope, `structuredContent` dual-mode

## Streaming
`executeTurnStream()` jako `AsyncGenerator` — yielduje eventy w trakcie, zwraca finalny `TurnResult`. SSE na poziomie HTTP. `runAgent` i `runAgentStream` dzielą tę samą logikę pętli, różnią się sposobem zwracania. Stream kończy się gdy agent wchodzi w `waiting`.
- **s01e05** — AsyncGenerator, SSE, stream vs non-stream ta sama logika
- **s05e02** — batchowanie SSE przez `requestAnimationFrame`, bufor pending flushowany raz na klatkę, stabilny 60fps

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

## Optimistic UI
Trzy warstwy wiadomości: durable (backend confirmed) + optimistic (pending user) + live (streaming SSE). Scalane w projected view — gdy serwer odpowie, optimistic usuwana, live zastępowane przez durable. Stable UI keys (`stableUiKeyByMessageId`) zapobiegają remountingowi.
- **s05e04** — trzy warstwy (durable/optimistic/live), projected view, stable UI keys

## rAF Batching
SSE events buforowane i flushowane na `requestAnimationFrame` — max jedno DOM update na klatkę (~16ms). Eliminuje render thrashing przy gęstym streamingu. Fallback setTimeout(100) gdy rAF niedostępny.
- **s05e04** — bufor pending + flush na rAF, max 1 DOM update/klatkę, fallback setTimeout

## Branded Types & Result Monad
`Result<T, E>` jako discriminated union zamiast wyjątków — wymusza jawne error handling na każdym call site. `Brand<TValue, TName>` daje compile-time type safety — kompilator nie pozwala pomylić RunId z JobId. Prefiksowane ID (`run_`, `job_`, `acc_`) czynią logi natychmiast czytelnymi.
- **s05e04** — Result monada, Brand types, prefiksowane ID, compile-time safety

## NDJSON Streaming
POST zwraca `application/x-ndjson` — każda linia to osobny JSON. Frontend czyta przez `ReadableStream` z buforem na niekompletną linię. Prostsze niż WebSocket, działa z HTTP, istotne dla długotrwałych zadań agentowych z natychmiastową informacją zwrotną.
- **s04e05** — NDJSON via ReadableStream, prostsze niż WebSocket, natychmiastowa informacja zwrotna

## Dual-audience Output
Każde narzędzie MCP App zwraca `content` (tekst dla LLM) i `structuredContent` (dane dla embedded UI). Jeden wynik narzędzia, dwóch odbiorców — model dostaje tekst, iframe dostaje dane strukturalne. `_meta.ui.resourceUri` wskazuje zasób HTML montowany w sandboxie.
- **s04e05** — content (LLM) + structuredContent (UI), jeden wynik dwóch odbiorców, resourceUri dla sandbox

## Model Context Update from UI
Embedded app wywołuje `app.updateModelContext()` z debouncem — wstrzykuje snapshot stanu UI do kontekstu kolejnego zapytania modelu. Frontend utrzymuje Map z deduplikacją per appka, serializowaną w każdej wiadomości. Model "widzi" stan UI bez pytania.
- **s04e05** — `app.updateModelContext()` z debouncem 120ms, Map z deduplikacją, model widzi stan UI

## Multi-anchor Text Editing
Wzorzec edycji z wieloma zakotwiczeniami: accept sugestii patchuje markdown i przesuwa pozycje sąsiednich komentarzy (delta = len delta). Batch accept sortuje od końca tekstu — klasyczny wzorzec zachowania poprawności niezmnodyfikowanych pozycji. Re-anchoring waliduje pozycje, fallbackuje do wyszukiwania tekstu.
- **s04e05** — patch markdown + przesunięcie sąsiadów, batch accept od końca, re-anchoring z fallback

## Audio UX
Gdy output jest audio, styl agenta musi być dostosowany do medium: bez URL-i, tabel, formatowania markdown. Kontrola stylu TTS przez naturalny język wstawiany w tekst ("Say cheerfully:"). Multi-speaker przez przypisywanie głosów do rozmówców.
- **s01e04** — styl audio bez markdown, kontrola TTS naturalnym językiem, multi-speaker

## Multimodality
Zdolność modeli do obsługi różnych modalności (tekst, obraz, audio). Gemini Interactions API i OpenAI Responses API prowadzą w kategorii. Argument za projektowaniem architektury na wielu providerów. Problem załączników nie jest adresowany przez żadne API, brak standardu branżowego — LLM widzi zawartość pliku, ale nie referencję, nie może przekazać jej narzędziu ani innemu agentowi. Autorska konwencja: tag `<media src="...">` jako trzeci element wiadomości, resolver zamienia na Base64/URL tuż przed wywołaniem. Vision/audio modele rozumieją ton, emocje, dźwięki otoczenia, diaryzacja działa bez treningu.
- **s01e01** — liderzy providerzy, argument za multi-provider
- **s01e04** — problem załączników, brak standardu, `<media src>` resolver, diaryzacja bez treningu

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

## Web Search Grounding
Natywne narzędzie providerów (`tools: [{ type: "web_search_preview" }]` w OpenAI, suffix `:online` w OpenRouter) pozwala modelowi odpytać web w trakcie generowania. Ekstrakcja źródeł z `web_search_call` / `url_citation`. Wzorzec owijania fraz w `<span class="grounded">` jako grounding odpowiedzi.
- **s01e01** — pipeline z web search, ekstrakcja źródeł, grounding spans

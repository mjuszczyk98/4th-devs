# Tydzień 2: Kontekst, pamięć i projektowanie agentów

## Spis treści

- [Instrukcja systemowa — architektura warstwowa](#instrukcja-systemowa--architektura-warstwowa)
- [Agentic Search i RAG](#agentic-search-i-rag)
- [Indeksowanie dokumentów](#indeksowanie-dokumentów)
- [Embedding i wyszukiwanie semantyczne](#embedding-i-wyszukiwanie-semantyczne)
- [Hybrydowe wyszukiwanie (RRF)](#hybrydowe-wyszukiwanie-rrf)
- [Graph RAG](#graph-rag)
- [Observational Memory](#observational-memory)
- [Dekompozycja wieloetapowa i bazy wiedzy](#dekompozycja-wieloetapowa-i-bazy-wiedzy)
- [Architektury systemów wieloagentowych](#architektury-systemów-wieloagentowych)
- [Kontekst współdzielony — konflikty](#kontekst-współdzielony--konflikty)
- [Sandbox i progresywne odkrywanie](#sandbox-i-progresywne-odkrywanie)
- [Organizacja wiedzy w systemie wieloagentowym](#organizacja-wiedzy-w-systemie-wieloagentowym)
- [Szablony agentów](#szablony-agentów)
- [Generalizowanie instrukcji](#generalizowanie-instrukcji)
- [Sygnał vs szum](#sygnał-vs-szum)
- [Progresja przykładów kodu](#progresja-przykładów-kodu)

---

## Instrukcja systemowa — architektura warstwowa

Rola promptu systemowego spada — agenci dynamicznie odkrywają kontekst. Instrukcja daje **świadomość otoczenia**, nie kompletne informacje [e01].

**Cztery warstwy:**

| Warstwa | Typ treści |
|---------|-----------|
| Uniwersalne instrukcje | Generalizowany opis ról (pamięć, osobowość) |
| Otoczenie | OS, typ interakcji (głos/CLI/CRON), zasoby |
| Sesja | Stan bieżącej interakcji, kompresja historii |
| Zespół agentów | Współdzielone zasady, placeholder'y |

**Architektura instrukcji agenta (6 sekcji):**

| Sekcja | Cel |
|--------|-----|
| **Identity** | Persona — charakter, ton, skojarzenia słowne. Brak detali technicznych. |
| **Protocol** | Zarządzanie kontekstem, wspomnieniami, reakcje na błędy |
| **Voice** | Przykłady wyrażeń, antywzorce, few-shot |
| **Tools** | Niemal w pełni generowana dynamicznie. Nie dubluj opisów z definicji narzędzi |
| **Workspace** | Observational memory, dane runtime. Zmienna per-request |
| **CTA** | Jedno zdanie sygnalizujące koniec — zapobiega "doklejaniu" przez model |

Kluczowa zasada: obecność instrukcji nie gwarantuje przestrzegania. Projektuj tak, by model pozytywnie zaskoczył [e05].

### Sterowanie zachowaniem przez skojarzenia

Słowa o zabarwieniu emocjonalnym ("instynkt", "wyczucie") w sekcji identity realnie fokusują uwagę modelu. To forma promptingu przez **skojarzenia**, nie przez bezpośrednie instrukcje [e05].

## Agentic Search i RAG

- Agent domyślnie **nie wie, o czym wie**. Musi być pokierowany do sięgania po informacje [e01].
- Agentic RAG: agent samodzielnie iteruje wyszukiwanie — obserwuje wyniki, koryguje zapytania, pogłębia eksplorację [e01].

**Zasady sterujące eksploracją:**

| Zasada | Działanie |
|--------|-----------|
| Skanowanie | Struktura folderów, nazwy plików, nagłówki |
| Pogłębianie | Iteracyjne: synonimy, terminologia z odkrytych fragmentów |
| Eksplorowanie | Tropy: przyczyna/skutek, część/całość, problem/rozwiązanie |
| Weryfikacja | Czy mam definicje, limity, wyjątki? Jeśli nie → pogłębianie |

- Agent generuje **dwa zapytania**: słowa kluczowe (FTS) + zdanie w języku naturalnym (semantic) [e02].

## Indeksowanie dokumentów

Indeksowanie = przekształcenie surowych plików w przeszukiwalną strukturę: chunking, metadane, transformacje, grafy powiązań, synchronizacja [e02].

### Strategie chunkingu

| Strategia | Koszt | Jakość semantyczna |
|-----------|-------|-------------------|
| Znaki (stałe okno + overlap) | 0 | Najniższa |
| Separatory (rekurencyjny podział) | 0 | Kompromis |
| Kontekst (separatory + LLM generuje kontekst) | Tokeny | Dobra |
| Tematy (LLM identyfikuje granice) | Tokeny | Najlepsza |

Długość chunka: 200–500 słów / 500–4000 tokenów [e02].

## Embedding i wyszukiwanie semantyczne

- Embedding = wektor opisujący znaczenie tekstu (`text-embedding-3-small` = 1536 wymiarów). Wymiar bazy **musi** zgadzać się z modelem [e02].
- Cosine similarity mierzy podobieństwo znaczeniowe. Działa wielojęzycznie — polskie zapytanie znajdzie angielski dokument semantycznie [e02].
- Model embeddingu nie opisze poprawnie terminów spoza danych treningowych [e02].

## Hybrydowe wyszukiwanie (RRF)

- **FTS5 (BM25)** — dopasowanie leksykalne, szybkie.
- **Wektorowe (cosine)** — dopasowanie znaczeniowe.
- **RRF (Reciprocal Rank Fusion):** `score = Σ 1/(k + rank)` gdzie k=60. Scalanie na podstawie pozycji w rankingu, nie surowych wyników [e02, e03].
- Degradacja elegancka: embedding API niedostępne → FTS-only [e02].

### Architektura RAG — od prostego do złożonego

1. System plików + grep — brak indeksowania
2. SQLite + FTS5 — full-text, niska złożoność
3. **SQLite + FTS5 + sqlite-vec** — hybryda w jednej bazie (optymalna na małą/średnią skalę)
4. Elasticsearch / Qdrant / Algolia — dedykowane silniki

## Graph RAG

- Neo4j: węzły z etykietami + krawędzie z kierunkiem i typem. Kiedy: wielopoziomowe powiązania między rozproszonymi informacjami [e03].

**Architektura grafu:**

| Węzeł | Relacja |
|-------|---------|
| `Document` | `HAS_CHUNK` |
| `Chunk` (z embeddingiem) | `MENTIONS` |
| `Entity` (z embeddingiem) | `RELATED_TO` |

- Pipeline: chunk → embed → ekstrakcja encji/relacji (LLM) → embed entities → Neo4j. Hash SHA256 pominie niezmienione [e03].
- Ekstrakcja: 3-15 encji per chunk, zdefiniowane enumy typów i relacji, deduplikacja globalna [e03].
- Narzędzia retrieval: `search`, `explore`, `connect`, `cypher`. Narzędzia kuracji: `learn`, `forget`, `merge_entities`, `audit` [e03].

## Observational Memory

- Eliminuje problemy wyszukiwania przez **kompresję** zamiast wyszukiwania [e03].

**Dwa komponenty:**

| Komponent | Wyzwalacz | Akcja |
|-----------|-----------|-------|
| **Observer** | >30k tokenów w sesji | Serializuje starsze wiadomości → LLM wyciąga ustrukturyzowane obserwacje. Priorytetyzacja: 🔴 fakty użytkownika > 🟡 aktywna praca > 🟢 detale |
| **Reflector** | >60k tokenów obserwacji | Kompresuje obserwacje z rosnącą agresywnością. `[user]` nigdy nie usuwane |

- Dziennik przetrwa pojedynczą sesję — nieskompresowane wiadomości + najnowsza wersja dziennika przechodzą do nowej sesji [e03, e05].
- Ogon (30% budżetu) pozostaje surowy — zapewnia ciągłość [e05].
- Kalibracja: estymacja tokenów lokalnie z korektą na podstawie rzeczywistego użycia API [e05].

## Dekompozycja wieloetapowa i bazy wiedzy

- **Istniejąca KB** → agent *ma szansę* trafić. **Budowana KB** → agent *wie*, gdzie są dokumenty [e03].
- Agent nawiguje na 4 poziomach: perspektywa (ls) → nawigacja (grep) → powiązania (importy, linki) → szczegóły (odczyt pełnej treści) [e03].
- Ekspozycja kontekstu opiera się na **informacjach wewnątrz dokumentów**, nie na zewnętrznej strukturze [e03].
- Złożone procesy dekomponuje się na osobne sesje agentów. Instrukcje określają zasady zapisu, agenci niezależnie produkują spójny wynik [e03].
- **Deep Research / Deep Action:** doprecyzowanie → parafraza → dekompozycja → wyszukiwanie → analiza → identyfikacja braków → iteracja → synteza [e03].

### Prezentacja treści w kontekście

- Zewnętrzne treści jako **wyniki narzędzi**. Dwa narzędzia: `search` + `read`. Obraz jako format: DeepSeek-OCR = 9-10x kompresja przy 96% precyzji [e02].
- Każdy chunk: źródło (plik), sekcja, pozycja — dla modelu i UI [e02].

### Wyzwania RAG

- Konflikt wiedzy (treningowe vs dokumenty), niekompletność, świadomość zasobów, rozbudowany kontekst negatywnie wpływa na instruction following [e02].

## Architektury systemów wieloagentowych

| Architektura | Kiedy |
|-------------|-------|
| **Pipeline** | Przekształcanie danych w stałych krokach |
| **Blackboard** | Równoległe gromadzenie z wielu źródeł |
| **Orchestrator** | Złożone wieloetapowe zadania |
| **Tree** | Duża skala, hierarchiczne podziały |
| **Mesh/Swarm** | Rzadziej produkcyjnie z LLM |

### Narzędzia komunikacji

- **delegate** — zlecenie zadania, nowy wątek z własnym promptem, wynik = wynik narzędzia [e04].
- **message** — dwukierunkowa, sub-agent wstrzymuje się do dostarczenia odpowiedzi [e04].

### Architektury zdarzeniowe

Zamiast bezpośrednich wywołań — zdarzenia (`user.message`, `ticket.classified`). Wielu agentów reaguje niezależnie, naturalna integracja człowieka [e04].

## Kontekst współdzielony — konflikty

Jedna instancja agenta uruchomiona wielokrotnie = system wieloagentowy z konfliktami współbieżnymi [e04].

| Strategia | Mechanizm |
|-----------|-----------|
| Wykrywanie | Checksumy między odczytem a zapisem |
| Unikanie | Izolacja zasobów, uprawnienia read-only |
| Agent zarządzający | Dedykowany agent z pełnym wglądem |
| Historia zmian | Append-only zamiast overwrite |

### Pułapki

1. Sesja vs pamięć — kto decyduje co trafia do długoterminowej?
2. Degradacja komunikacji — każdy przekaz = potencjalna utrata
3. Interpretacja — agent z kompletnymi danymi może je zinterpretować po swojemu
4. Kontekst informacji — notatka wyrwana z konwersacji traci kontekst
5. Duplikowanie — nieuniknione, ale wykrywalne
6. Metadane — źródło, data, tags wykorzystywane w komunikacji między agentami

**Zasada:** projektować system tak prosty jak to możliwe [e04].

### Agent zarządzający

Minimalna liczba narzędzi (delegate/message + recall/search_memory), ale szeroki dostęp do informacji: rozbijanie zadań, planowanie, weryfikacja, decyzyjność, transport wiedzy [e04].

### Kiedy agenci, a kiedy kod

Agenci uzasadnieni: zadania otwarte, dynamiczne dane/zależności, iterowanie, elastyczna architektura, dopasowanie wyniku. Gdzie wymagania wykluczają LLM (koszt zero, ms response, pełna przewidywalność) — tylko kod [e04].

## Sandbox i progresywne odkrywanie

Sandbox daje agentowi swobodę przy zachowaniu kontroli [e05]:

1. Agent startuje z **4 narzędziami metody**: `list_servers`, `list_tools`, `get_tool_schema`, `execute_code`
2. Odkrywa serwery MCP, wczytuje schematy TypeScript **na żądanie**
3. Generuje kod JS i uruchamia w **QuickJS** — dane nie trafiają do kontekstu
4. Kod wywołuje narzędzia MCP synchronicznie (asyncified host functions)

Zalety: elastyczne łączenie narzędzi, operacje na dużych zbiorach bez konsumpcji tokenów [e05].

## Organizacja wiedzy w systemie wieloagentowym

| Kategoria | Zakres | Udostępnianie |
|-----------|--------|--------------|
| Dokumenty sesji | Załączniki + pliki bieżącej interakcji | Tylko agenci w sesji |
| Wiedza publiczna | Pamięć długoterminowa | Agenci + użytkownicy |
| Wiedza prywatna | Kontekst użytkownika | Per-user |
| Wiedza agentów | Instrukcje, wspomnienia, obserwacje | Per-agent |
| Pamięć podręczna | Wyniki wyszukiwań | Tymczasowa |
| Runtime | Sesje, interakcje, harmonogram | Niewidoczna dla agentów |

Klasyfikacja danych jest dynamiczna — **dlatego: proste struktury, minimalne reguły** [e05].

## Szablony agentów

Definicja agenta = plik `.agent.md` z frontmatterem (name, model, tools) + treść instrukcji. Parsowane przez `gray-matter`. Umożliwia dynamiczne ładowanie i iterację [e04, e05].

## Generalizowanie instrukcji

Generalizacja = najważniejsza umiejętność przy budowie agentów [e01]. Proces iteracji z LLM:

1. **Analiza:** opisz problem, poproś o diagnozę
2. **Generalizacja:** poproś o uniwersalne przyczyny, nie fix konkretnego przypadku
3. **Korekta:** odrzuć ~60% sugestii, doprecyzuj
4. **Iteracja:** wskazuj konkretne błędy — model sam wyciąga esencję

Modele proponują zbyt bezpośrednie (sztywne) instrukcje. Rolą człowieka jest generalizacja [e01].

## Sygnał vs szum

Nie da się w pełni kontrolować proporcji sygnału. Cel: **stworzyć warunki** maksymalizujące sygnał. Co buduje sygnał: poprawne dane wejściowe, dynamiczne instrukcje-komponenty, generyczne mechanizmy, przestrzeń na interwencję [e01].

- Dane dynamiczne → wiadomość użytkownika, nie prompt systemowy (cache!) [e01].
- Powtarzanie kluczowych instrukcji w kolejnych wiadomościach steruje **uwagą modelu** [e01].
- Lista zadań i tryb planowania = zmiana zachowania bez modyfikacji promptu [e01].
- Maskowanie kontekstu (prefilling tokenów) — deprecated w Anthropic API [e01].

---

## Progresja przykładów kodu

### 1. Agentic RAG prompt (e01) — zgeneralizowane zasady wyszukiwania

Delta: Prompt nie opisuje *co* znaleźć, lecz *jak szukać*. Sekcje SCAN/DEEPEN/EXPLORE/VERIFY uniwersalne.

### 2. REPL z historią (e01) — pętla `chat → tool_calls → results` z `MAX_STEPS`

Delta: MCP mapowane dynamicznie do formatu OpenAI, historia między zapytaniami.

### 3. Chunking — cztery strategie (e02)

Delta: Characters (stałe okno) → Separators (rekurencyjny podział) → Context (LLM enrich) → Topics (LLM generuje chunki).

```js
const chunkByCharacters = (text, size = 1000, overlap = 200) => {
  const chunks = [];
  let start = 0;
  while (start < text.length) {
    chunks.push(text.slice(start, start + size));
    start += size - overlap;
  }
  return chunks.map((content, i) => ({ content, metadata: { strategy: "characters", index: i } }));
};
```

### 4. Embedding + cosine similarity (e02)

Delta: identyczne teksty → identyczny wektor. Batch API wspiera tablicę inputów.

### 5. Hybrid RAG pipeline (e02) — SQLite + FTS5 + sqlite-vec

Delta: cztery tablice powiązane (`documents → chunks → chunks_fts → chunks_vec`). Hash SHA256 dla reindexacji. RRF fusion. Degradacja: embed() błąd → FTS-only.

### 6. Graph RAG Agent (e03) — Neo4j + ekstrakcja encji

Delta: graf z encjami i relacjami, narzędzia retrieval (`search`, `explore`, `connect`, `cypher`) + kuracji (`learn`, `forget`, `merge_entities`, `audit`).

### 7. Daily Ops multi-agent (e04) — orchestrator + 4 sub-agentów

Delta: szablony agentów w markdown frontmatter, rekurencyjne `runAgent()` z `MAX_DEPTH=3` + `MAX_TURNS=15`, workflow jako plik markdown, path safety.

```ts
if (name === 'delegate') {
  result = await runAgent(agent, delegatedTask, depth + 1)
}
```

### 8. Observational Memory agent (e05) — observer + reflector

Delta: kompresja kontekstu wieloetapowa. Observer serializuje wiadomości → LLM wyciąga obserwacje. Reflector kompresuje obserwacje.

### 9. Sandbox z progresywnym odkrywaniem (e05)

Delta: agent startuje bez znajomości narzędzi, odkrywa MCP, generuje kod JS w QuickJS. Dane operacyjne nie trafiają do kontekstu LLM.

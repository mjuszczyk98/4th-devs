# Tydzień 4: Wdrożenia i współpraca z AI

## Spis treści
- [Filozofia i zasady wdrożeń AI](#filozofia-i-zasady-wdrożeń-ai)
- [Decyzje projektowe](#decyzje-projektowe)
- [Tryby współpracy człowiek–AI](#tryby-współpracy-człowiekai)
- [Wybór interfejsu integracji](#wybór-interfejsu-integracji)
- [Personalizacja i konfiguracja agenta](#personalizacja-i-konfiguracja-agenta)
- [Architektura Cyfrowego Ogrodu](#architektura-cyfrowego-ogrodu)
- [Agent Loop i orkiestracja](#agent-loop-i-orkiestracja)
- [System narzędzi i Code Mode](#system-narzędzi-i-code-mode)
- [Infrastruktura: Sandbox i Grove](#infrastruktura-sandbox-i-grove)
- [Mikro-akcje](#mikro-akcje)
- [Meta-prompty](#meta-prompty)
- [Progresja przykładów kodu (e01 → e02)](#progresja-przykładów-kodu-e01--e02)

---

## Filozofia i zasady wdrożeń AI

- Wdrożenia AI nie różnią się fundamentami od zwykłych projektów — różnicą jest **niedeterminizm modeli**, co wymaga iteracyjnego podejścia i szybkich testów weryfikujących.
- Punkt startowy (MVP) musi być funkcjonalny, nie hipotetyczny — buduj system, z którego **sam korzystasz**, żeby doświadczyć ograniczeń na własnej skórze.
- „Nie możemy zrobić wszystkiego, ale możemy zrobić cokolwiek" — każde wdrożenie wymaga świadomego wyboru **obszarów**, w których AI wnosi wartość, i takich, gdzie lepiej go nie stosować.

**Prototypowanie z AI:**
- AI obniża koszt prototypowania do poziomu, gdzie **wiele pomysłów można testować równolegle**.
- „Proste testy" nie oznaczają prostych prototypów — AI potrafi wygenerować działającą aplikację mobilną w ramach testu koncepcji.
- Każdy test = odpowiedź na konkretne pytanie decyzyjne (np. „czy model sam wie, co dodać do notatki, czy potrzebuje wskazówki w frontmatterze?").
- Szybkie iteracje > doskonały plan. Założenia początkowe będą błędne — liczy się szybkość korekty.

**Źródła wiedzy:** konkretne treści techniczne pochodzą z blogów narzędziowców (LlamaIndex, Vercel, Langfuse, Cloudflare) i projektów open-source (Pi, Nous Research), nie z artykułów marketingowych firm wdrożeniowych.

---

## Decyzje projektowe

Decyzje kształtujące architekturę sprowadzają się do pytań o: **użytkownika** (kompetencje, potrzeby), **treść** (kto tworzy, czy AI generuje czy wzbogaca), **format** (narzędzia edycji), **integracje** (CLI, MCP, API), **publikację** (gdzie i jak), **dostępność** (lokalnie vs zdalnie).

Balans kod vs AI przesuwa się — dawniej 90/10, dziś w niektórych obszarach proporcje się odwracają. Nadal jednak większość architektury to „zwykły kod".

---

## Tryby współpracy człowiek–AI

| Wymiar | Synchroniczna | Asynchroniczna |
|---|---|---|
| Interfejs | centralny — edytor, czat, CLI | pominięty lub zminimalizowany |
| Personalizacja | bieżące budowanie kontekstu | predefiniowane procesy z góry |
| Feedback | nadzór człowieka na każdej akcji | raportowanie wyników, minimalne zaangażowanie |
| Uprawnienia agenta | szersze (człowiek nadzoruje) | wąskie, sandboxowane |
| Integracja | dopasowywana w locie | ustalona i osadzona w codzienności |

System hybrydowy = agent działa w tle + użytkownik ma dostęp edytora i kanał poleceń. Klucz: agent nie powinien przeszkadzać.

---

## Wybór interfejsu integracji

Cztery komplementarne (nie wykluczające się) ścieżki integracji agentów:

| Ścieżka | Kontekst | Personalizacja | Trudność |
|---|---|---|---|
| CLI (Claude Code, Open Code) | Osobisty / sandbox | Najwyższa | Wymaga kompetencji technicznych |
| Serwery MCP | Most do istniejących interfejsów | Ograniczona przez hosta | Niska |
| Komunikatory (Slack, Telegram) | Zespołowy | Umiarkowana | Niska |
| Dedykowane rozwiązanie | Dowolny | Pełna | Wysoka |

**Kryteria decyzyjne:**
- Grupa docelowa: techniczna → CLI/MCP; nietechniczna → Claude.ai/komunikator/dedykowany UI
- Ekonomia: subskrypcje (ChatGPT, Claude) są nieporównywalnie tańsze niż API przy dużym wolumenie — sprawdź, czy klient nie ma już umów korporacyjnych
- Złożoność systemu: im więcej autonomii w tle, uprawnień i interakcji z użytkownikiem, tym bliżej dedykowanego interfejsu

**Ograniczenia MCP w Claude.ai:**
- Brak samplingu — agent nie może inicjować komunikacji z użytkownikiem
- Personalizacja instrukcji opiera się głównie na opisach narzędzi i ich wynikach
- Brak kontroli nad UI wywołań narzędzi — ograniczone potwierdzenia, powiadomienia o statusie
- Uprawnienia i wielowątkowość sprawiają problemy (wiele kampanii, wielu klientów)

**ACP (Agent Client Protocol)** — protokół łączący IDE (JetBrains, Zed) z agentami (Codex, Cursor). Trend zacierania granic między narzędziami.

---

## Personalizacja i konfiguracja agenta

### Cztery filary personalizacji interfejsu

1. **Profile (subagenci)** — dedykowane konteksty z własnymi ustawieniami, modelem i zasobami wiedzy. Przełączanie: menu, skróty, mention (`@`), automatyczne przez AI.
2. **Umiejętności (skills)** — predefiniowane instrukcje wstrzykiwane intencjonalnie lub przez decyzję modelu. Przy dużej liczbie — konieczne wyszukiwanie i grupowanie (np. po agencie).
3. **Narzędzia** — nie samo wywołanie, lecz cykl UI: prezentacja danych wejściowych → potwierdzenie → postęp → błąd → wynik + możliwość wstrzymania/anulowania.
4. **Workflow** — serie powtarzalnych akcji, hooki, zaplanowane zadania. Obecnie rzadkie w gotowych interfejsach.

**Jakość implementacji > sam zestaw funkcji.** Złe praktyki UX w narzędziach AI są powszechne. Nacisk na jakość interfejsu wciąż ma znaczenie — nie tylko wygląd, ale mechanika.

### System Skilli (Cyfrowy Ogród)

Skille to katalogi w `vault/system/skills/<name>/` z `SKILL.md` (frontmatter + instrukcje). Frontmatter definiuje:
- `allowed-tools` — ograniczenie zestawu narzędzi dla skilla
- `runtime-scripts` — deterministyczne skrypty do wykonania przez code_mode
- `disable-model-invocation` / `user-invocable` — kontrola aktywacji
- `argument-hint` — podpowiedź argumentów dla użytkownika

**Rezolucja skilla:** komunikat użytkownika parsowany jako `/skill-name args`. Jeśli skill istnieje → do wiadomości doklejany jest `<metadata>` z konfiguracją + lista dozwolonych narzędzi jest ograniczana.

Skille z `runtime-scripts` dają agentowi możliwość uruchomienia **deterministycznego kodu** zamiast generowania logiki inline.

### Template Agenta

Plik `vault/system/<name>.agent.md` — frontmatter z `{model, tools}` + treść jako instrukcje systemowe. Template ładowany dynamicznie, wzbogacany o:
- workflows (sekcja z listą aktywnych procesów)
- skills (sekcja z listą dostępnych skilli)
- `{{date}}` interpolacja

Pozwala na wiele agentów z różnymi konfiguracjami w jednym systemie.

### Workflows

Pliki `.md` w `vault/system/workflows/` z frontmatterem `{name, description}`. Ładowane do instrukcji agenta jako sekcje „MUSISZ podążać za workflow gdy request pasuje". Workflow to deklaratywny opis kroków — agent wykonuje je jako część swojego loopa.

---

## Architektura Cyfrowego Ogrodu

**Warstwy:**
1. **Vault** — pliki Markdown jako źródło prawdy (`vault/**`)
2. **Agent** — manipuluje vaultem przez narzędzia (terminal, code_mode, git_push)
3. **Sandbox (Daytona)** — izolowane środowisko wykonawcze dla agenta
4. **Grove** — generator strony statycznej z vault → HTML
5. **CI/CD (GitHub Actions/Pages)** — automatyczna publikacja na push

**Przepływ danych:** lokalny vault ↔ sandbox vault (dwukierunkowa synchronizacja), agent operuje na sandboxie, po zakończeniu sync z powrotem + git push = deploy.

---

## Agent Loop i orkiestracja

```
userMessage → loadTemplate(agent) → resolveSkillContext → [loop max N turns]
  → completion(model, instructions, tools, previousResponseId)
  → if function_call → executeTool → feed result back
  → if text only → return to user
```

Kluczowe mechaniki:
- `previous_response_id` — kontynuacja konwersacji bez re-sendu całego kontekstu (OpenAI Responses API)
- **Reasoning effort** z fallbackiem (`xhigh` → `high` gdy model nie wspiera xhigh)
- Tool execution w bloku try/catch — błąd narzędzia nie przerywa loopa, zwraca `function_call_output` z errorem

---

## System narzędzi i Code Mode

### Tool Registry

Rejestr `Map<string, Tool>` z dwoma punktami dostępu:
- `findTool(name)` — resolwacja handlera po nazwie wywołania
- `definitions(names?)` — filtruje definicje do przekazania do modelu (w tym narzędzia wbudowane jak `web_search`)

Każde narzędzie: `{ definition: FunctionTool, handler: (args, ctx) => Promise<ToolExecutionResult> }`.

**Trzy narzędzia agentic:**

| Narzędzie | Rola | Delta wiedzy |
|---|---|---|
| `terminal` | Wykonanie komendy shell w sandboxie | Wejście-wyjście, CWD zawsze vault root |
| `code_mode` | Wykonanie TypeScript w sandboxie z helperami | `codemode.vault.{read,write,list,search,move}` + `runtime.exec` + `output.set` |
| `git_push` | Sync vault back → commit → push | Łączy operację trójstopniową w jedno wywołanie |

### Code Mode

Agent może przekazać **inline script** LUB **script_path** (do pliku w skills). Skrypt owijany w runner, który:
- wstrzykuje `codemode` helper (vault read/write/list/search/move, runtime exec)
- wstrzykuje `input` z env variable (`CODE_MODE_INPUT`)
- przechwytuje wynik przez marker `__CODE_MODE_RESULT__=` / `__CODE_MODE_ERROR__=`
- parsuje output od końca — ostatni marker wygrywa

---

## Infrastruktura: Sandbox i Grove

### Sandbox (Daytona)

`LazySandbox` tworzy instancję dopiero przy pierwszym wywołaniu `get()`. Po inicjalizacji:
- Vault wgrywany do `workspace/repo/vault/`
- Background loop (700ms) śledzi zmiany lokalne i syncuje delta (size:mtime jako sygnatura)
- `syncVaultBackNow()` pobiera zmienione pliki z sandboxa do lokalnego vaultu (z wykluczeniem `system/`)

Cykl życia: create → init → [sync loop] → sync back → delete.

### Grove — generator strony statycznej

Markdown → HTML: `collectMarkdown` pomija `system/`, `parse` z gray-matter + marked, wiki-links `[[x]]` resolwowane do relatywnych hrefów. Listing pages z paginacją (`listing: true` w frontmatter`). Szablony HTML z layout + SEO meta.

---

## Mikro-akcje

Pojedyncze akcje AI przypisane do skrótów klawiszowych, gestów lub wyzwalaczy (Keyboard Maestro, BetterTouchTool, Siri Shortcuts). Niski koszt implementacji, wysoka użyteczność dzienna.

| Typ akcji | Przykład |
|---|---|
| Odczyt zaznaczenia | TTS zaznaczonego tekstu z kontrolą tempa |
| Wyjaśnienie zaznaczenia | Definicja / kontekst z wiedzy modelu lub wyszukiwarki |
| Transformacja zaznaczenia | Korekta, tłumaczenie, parafraza, ekstrakcja |
| Transformacja kontekstowa | Auto-dopasowanie do domeny (np. github.com → styl dokumentacji) |
| Wizualizacja zaznaczenia | Tekst → precyzyjna grafika (Nano Banana 2 / HTML→PNG) |
| Odnalezienie powiązań | Zaznaczenie → zapytanie do bazy wiedzy → deep-link do notatki |
| Opisanie zawartości schowka | Auto-prompt do generowania obrazu na podstawie zdjęcia w schowku |

Realizacja: skrypt + skrót / automatyzacja, lub lekka natywna aplikacja (Swift, Tauri, Electron, React Native) dla dostępu do funkcji systemowych.

---

## Meta-prompty

**Cel:** generowanie instrukcji dla agentów przez rozmowę z użytkownikiem, nie przez ręczne pisanie promptów. Człowiek dostarcza dane, model wnosi wiedzę o dobrych praktykach prompt engineeringu.

**Trójczłonowa struktura meta-promptu:**

1. **Dane** — kategorie informacji do zgromadzenia: cel, zakres, styl, narzędzia, wzorce, modele mentalne, ograniczenia, format, wyjątki.
2. **Generator** — zasady specjalizacji/generalizacji, struktury, przydatne wyrażenia. Wiedza o prompt engineeringu przeniesiona z człowieka na model.
3. **Rezultat** — szablon końcowej instrukcji ze stałymi sekcjami: tożsamość, proces myślowy, zasady i ograniczenia, wiedza zewnętrzna, styl wypowiedzi.

**Kluczowe zasady procesu generowania:**
- Model **nie zgaduje** — oczekuje na odpowiedź użytkownika, pogłębia niejasne instrukcje
- Selekcja komponentów: brane pod uwagę tylko elementy istotne dla bieżącego kontekstu
- Warto rozbijać proces na fazy (proces → strategia → dopasowanie → format → zasady → generowanie → krytyczne zasady)
- Meta-prompt może generować nie tylko instrukcję, ale też ustawienia agenta (model, tryby, integracje)

**Zastosowania:** onboarding (personalizacja na podstawie danych produktów), generowanie obrazu (dopasowanie do tonu marki), subagenci w Claude Code / skille w Cursor, automatyczna optymalizacja promptów.

---

## Progresja przykładów kodu (e01 → e02)

**e01** — architektura od podstaw: synchroniczna vs asynchroniczna współpraca, pełny stack Cyfrowego Ogrodu (vault → agent → sandbox → grove → CI/CD), implementacja Agent Loop z `previous_response_id`, Tool Registry z trzema narzędziami agentic, Code Mode z markerami wyniku, system skilli oparty na plikach Markdown.

**e02** — przesunięcie od infrastruktury ku interakcji: kryteria wyboru interfejsu (CLI/MCP/komunikator/dedykowany), ograniczenia MCP, cztery filary personalizacji (profile/skills/narzędzia/workflow), mikro-akcje jako wzorzec codziennej integracji, meta-prompty jako metoda generowania instrukcji przez dialog.

**Delta:** e01 definiuje **jak zbudować system agentowy** (architektura, infrastruktura, orkiestracja). e02 rozszerza o **jak zintegrować agenta z użytkownikiem** (interfejsy, personalizacja, codzienne akcje, generowanie promptów).

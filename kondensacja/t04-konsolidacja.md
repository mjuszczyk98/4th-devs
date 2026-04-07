# Tydzień 4: Wdrożenia i współpraca z AI

## Spis treści
- [Filozofia i zasady wdrożeń AI](#filozofia-i-zasady-wdrożeń-ai)
- [Decyzje projektowe](#decyzje-projektowe)
- [Tryby współpracy człowiek–AI](#tryby-współpracy-człowiekai)
- [Wybór interfejsu integracji](#wybór-interfejsu-integracji)
- [Kontekstowa współpraca z AI](#kontekstowa-współpraca-z-ai)
- [Wzorce projektowe agentów kontekstowych](#wzorce-projektowe-agentów-kontekstowych)
- [Personalizacja i konfiguracja agenta](#personalizacja-i-konfiguracja-agenta)
- [Architektura Cyfrowego Ogrodu](#architektura-cyfrowego-ogrodu)
- [Architektura bazy wiedzy](#architektura-bazy-wiedzy)
- [Role AI w zarządzaniu wiedzą](#role-ai-w-zarządzaniu-wiedzą)
- [Procesy wieloagentowe i delegacja](#procesy-wieloagentowe-i-delegacja)
- [Agent Loop i orkiestracja](#agent-loop-i-orkiestracja)
- [System narzędzi i Code Mode](#system-narzędzi-i-code-mode)
- [Infrastruktura: Sandbox i Grove](#infrastruktura-sandbox-i-grove)
- [Mikro-akcje](#mikro-akcje)
- [Meta-prompty](#meta-prompty)
- [Wdrożenia firmowe AI](#wdrożenia-firmowe-ai)
- [Bezpieczeństwo agentów](#bezpieczeństwo-agentów)
- [Agent przeglądu dokumentów](#agent-przeglądu-dokumentów)
- [MCP Apps — generatywne interfejsy](#mcp-apps--generatywne-interfejsy)
- [Napięcia projektowe](#napięcia-projektowe)
- [Progresja przykładów kodu (e01 → e05)](#progresja-przykładów-kodu-e01--e05)

---

## Filozofia i zasady wdrożeń AI

- Wdrożenia AI nie różnią się fundamentami od zwykłych projektów — różnicą jest **niedeterminizm modeli**, co wymaga iteracyjnego podejścia i szybkich testów weryfikujących.
- Punkt startowy (MVP) musi być funkcjonalny, nie hipotetyczny — buduj system, z którego **sam korzystasz**, żeby doświadczyć ograniczeń na własnej skórze.
- "Nie możemy zrobić wszystkiego, ale możemy zrobić cokolwiek" — każde wdrożenie wymaga świadomego wyboru **obszarów**, w których AI wnosi wartość, i takich, gdzie lepiej go nie stosować.

**Prototypowanie z AI:**
- AI obniża koszt prototypowania do poziomu, gdzie **wiele pomysłów można testować równolegle**.
- "Proste testy" nie oznaczają prostych prototypów — AI potrafi wygenerować działającą aplikację mobilną w ramach testu koncepcji.
- Każdy test = odpowiedź na konkretne pytanie decyzyjne (np. "czy model sam wie, co dodać do notatki, czy potrzebuje wskazówki w frontmatterze?").
- Szybkie iteracje > doskonały plan. Założenia początkowe będą błędne — liczy się szybkość korekty.

**Źródła wiedzy:** konkretne treści techniczne pochodzą z blogów narzędziowców (LlamaIndex, Vercel, Langfuse, Cloudflare) i projektów open-source (Pi, Nous Research), nie z artykułów marketingowych firm wdrożeniowych.

---

## Decyzje projektowe

Decyzje kształtujące architekturę sprowadzają się do pytań o: **użytkownika** (kompetencje, potrzeby), **treść** (kto tworzy, czy AI generuje czy wzbogaca), **format** (narzędzia edycji), **integracje** (CLI, MCP, API), **publikację** (gdzie i jak), **dostępność** (lokalnie vs zdalnie).

Balans kod vs AI przesuwa się — dawniej 90/10, dziś w niektórych obszarach proporcje się odwracają. Nadal jednak większość architektury to "zwykły kod".

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

## Kontekstowa współpraca z AI

Przesunięcie z "interakcji z AI" na "współpracę kontekstową" — AI działa w tle, reaguje na zdarzenia, nie wymaga ciągłej uwagi. Urządzenia i aplikacje projektowano dla ludzi — teraz interakcja obejmuje boty, co zwiększa znaczenie API, scrapowania, deep-linków i uprawnień.

Modele nie są dobrymi doradcami w zakresie *gdzie* zastosować AI — ich sugestie są generyczne. Własna obserwacja procesów + pytania "jak AI może pomóc?" i "czy powinniśmy tu angażować AI?" to właściwa metoda odkrywania przypadków użycia.

### Obszary integracji

| Obszar | Mechanizm | Przykładowy scenariusz |
|---|---|---|
| OS (Mac/Win/Linux) | CLI, skrypty, AppleScript, deep-linki | Manager schowka, sterowanie DND |
| Mobile | API czujników, lokalizacja, automatyzacje | Odczyt lokalizacji → organizacja notatek |
| Komunikatory | API wiadomości, obserwowanie kanałów | Monitorowanie aktywności, wybiórcze reakcje |
| Kalendarz | API zdarzeń, webhooki | Sugestie wydarzeń, time blocking |
| E-mail | API, etykiety, przekierowania | Adres dla agenta, filtrowanie, wzbogacanie kontekstu |
| Internet | Scraping (Firecrawl/Jina), RSS, API | Monitorowanie changelogów, trending topics |
| Zarządzanie zadaniami | API (Linear, Todoist, ClickUp), webhooki | Automatyczne powiązania z dokumentami |
| Repozytoria | GitHub API, Actions | Code review — ryzyko prompt injection |
| CRM / Sprzedaż | API (Attio i in.) | Największy bezpośredni ROI, ale ryzyko zniszczenia relacji |
| Narzędzia graficzne | API modeli obrazu, Figma | Grafiki dopasowane do kampanii |
| Bazy danych | Convex/Supabase — natychmiastowy dostęp API | Stan aplikacji, konfiguracje |

### Wspólny mianownik integracji

- **API** — kluczowy wymóg; endpointy mogą być niekompletne z perspektywy agenta
- **Webhooki** — mechanizm reaktywny: agent odpowiada na zdarzenia, nie odpytuje
- **Deep-linki** (x-scheme-url) — URL wywołujące akcje w aplikacjach bez API
- **Powiadomienia mailowe** — wyzwalacze akcji (parsowanie powiadomień o zgłoszeniach)

### Przepływ danych między aplikacjami

- **Szablony projektowe** — frameworki aktywności + szablony + integracja z narzędziami do zadań. Agent unika "efektu pustej kartki" i monitoruje standardy.
- **Przekierowania** — zgłoszenia kierowane do właściwych osób na podstawie klasyfikacji LLM z dostępem do bazy wiedzy.
- **Optymalizacja workflow** — agenci obserwują skuteczność własnych procesów i generują rekomendacje.
- **Monitorowanie wskaźników** — MRR, Churn, NPS: agenty ustalają priorytety i wychwytują powtarzające się wzorce.
- **Raporty** — LLM nie powinny generować kompleksowych raportów dla kluczowych decyzji. Wartość: transformacje i klasyfikacje niedostępne przez kod + równoległa analiza z odpowiednim kontekstem.

---

## Wzorce projektowe agentów kontekstowych

### Katalogi aktywne
Folder, którego zawartość uruchamia automatyzację. Np. `concept/ → review/ → ready/ → published/` — dokument wstawiony do `concept/` jest transformowany przez agenta i przenoszony dalej. Podobny wzorzec: `inbox/ → processing/ → archive/`.

### Izolacja agentów
Agenci w tle powinni być izolowani — agent klasyfikujący zgłoszenia nie musi wiedzieć o agencie generującym zestawienia. Pełna izolacja nie zawsze możliwa — wtedy zaangażowanie człowieka bywa potrzebne częściej. Zależności między agentami ujawniają się często dopiero po czasie — nawarstwienie informacji odkrywa ukryte sprzężenia.

### Samoobserwacja systemu
Agenci mogą cyklicznie weryfikować skuteczność przepływu informacji (LLM-as-a-judge). Jeśli raporty przestają być czytane — system powinien to wykryć i zasygnalizować. Niedostępne źródła danych → automatyczne oznaczanie i flagowanie.

### Zapobieganie zapętlaniu
Zbyt elastyczne automatyzacje mogą doprowadzić do zapętlania lub nieoczekiwanych interakcji między agentami. Projektować tak, aby konflikty **w ogóle nie występowały** — prewencja przez prostotę, nie rozwiązywanie po fakcie.

### Kontekst urządzenia → adaptacja zachowania
Agent z dostępem do statusu urządzenia (otwarta aplikacja, lokalizacja, tryb DND) dynamicznie dobiera kanał komunikacji (SMS, powiadomienie, cisza). Wymaga natywnego dostępu — możliwe przez własne mini-aplikacje (AI potrafi wygenerować aplikacje w Swift/Rust/C#).

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

Pozwala na wiele agentów z różnymi konfiguracjami w jednym systemie. → Patrz: [Procesy wieloagentowe i delegacja](#procesy-wieloagentowe-i-delegacja) [e04]

### Workflows

Pliki `.md` w `vault/system/workflows/` z frontmatterem `{name, description}`. Ładowane do instrukcji agenta jako sekcje "MUSISZ podążać za workflow gdy request pasuje". Workflow to deklaratywny opis kroków — agent wykonuje je jako część swojego loopa. → Patrz: [Procesy wieloagentowe i delegacja](#procesy-wieloagentowe-i-delegacja) [e04]

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

## Architektura bazy wiedzy

### Strefy odpowiedzialności

| Katalog | Właściciel | Cel |
|---|---|---|
| `me/` | człowiek | tożsamość, preferencje, proces osobisty |
| `world/` | człowiek + agent | ludzie, miejsca, narzędzia, źródła, zdarzenia |
| `craft/` | człowiek + agent | idee, projekty, wiedza, eksperymenty, publikacje |
| `ops/` | agent | workflowy, research, dane operacyjne |
| `system/` | człowiek | profile agentów, szablony, reguły |

Zasada: **człowiek odpowiada za treść i zasady, AI za organizację**. Granica jawna — agent nie przekracza strefy człowieka bez pozwolenia.

### Markdown jako format wiedzy

AI-native (modele generują i przetwarzają naturalnie), programistycznie transformowalny, edytowalny przez agentów w runtime. Wzbogacanie o strukturę: YAML frontmatter jako warstwa metadanych. Ograniczenia: przegrywa z Notion/Docs przy jednoczesnej edycji wielu osób i zróżnicowanych uprawnieniach. Konwersja Markdown ↔ Notion traci informacje — lepiej wybrać format per obszar, nie konwertować. Obrazy: zawsze zewnętrzne URL, nigdy lokalne pliki — agent musi móc cytować link w odpowiedzi.

Pamięć długoterminowa i baza wiedzy pokrywają się — funkcjonują w tych samych plikach. Treść jest dynamiczna, tworzona przez człowieka i AI.

### Luki kontekstowe

Notatki pisane "dla siebie" są nieczytelne dla agenta:

| Luka | Przykład | Rozwiązanie |
|---|---|---|
| Niejawne referencje | "ostatnia rozmowa" | jawny link do powiązanej notatki |
| Nierozpoznawalne linki | skrócony URL bez opisu | pełny URL z opisem |
| Nadpisane wersje | edycja usuwa poprzednią wiedzę | wersjonowanie lub "zastąpiono przez X" |
| Brak powtórzeń | powiązanie w jednym kierunku | linki w obu kierunkach |

Zasada: **notatki muszą być pisane tak, jakby czytelnik nie miał żadnego dodatkowego kontekstu.**

### Frontmatter — wieloosiowa kontrola

Osie niezależne od siebie:
- **publish** (`draft` → `review` → `live` → `updated`) — cykl publikacji
- **status** (`seed` → `growing` → `evergreen` → `archived`) — dojrzałość treści
- **access.read / access.write** — dziedziczone z sekcji, nadpisywane per notatka
- **attention** (`who` + `reason`) — sygnał handoffu między człowiekiem a agentem
- **tags** — płaskie (bez hierarchii), opisują **co**, nie **gdzie** (folder załatwia lokalizację)

Domyślnie `seed` + `draft` + dostęp zgodny z sekcją. Jawne ustawienie tylko przy nadpisaniu.

---

## Role AI w zarządzaniu wiedzą

| Rola | Zakres | Uwagi |
|---|---|---|
| Transformacja | formatowanie, korekta, przepisywanie z audio/obrazu | człowiek = źródło, AI = formatter |
| Szablony | utrzymanie struktury notatki | szablony w `system/templates/` |
| Organizacja | weryfikacja placement'u, sugestia zmiany | nie automatyczna akcja |
| Linkowanie | wikilinkowanie między powiązanymi notatkami | wymaga reguł w `system/rules/` |
| Walidacja | sprawdzanie zgodności z zasadami | struktura, tagi, linki |
| Indeksowanie | generowanie Map of Content | programistycznie lub przez agenta |
| Audytowanie | wykrywanie braków, szumu, brakujących linków | dodatkowa weryfikacja |

### Szablony notatek

Szablony w `system/templates/` definiują: katalog docelowy, konwencję nazwy pliku, sekcje frontmatteru, sekcje treści. Agent przed utworzeniem notatki: czyta index → czyta szablon → decyduje o strukturze i lokalizacji → tworzy plik **lub aktualizuje istniejący**. Im większa baza, tym większa wartość szablonów — spójność struktury bez ręcznej dyscypliny. Jedna notatka = kilkanaście zapytań do LLM.

### mind.md — konstytucja bazy wiedzy

Jeden plik referencyjny definiujący pełną architekturę vaultu: strukturę katalogów, frontmatter defaults, access control per section, scenariusze agentów. Frontmatter defaults dziedziczone per section — nie trzeba ich powtarzać w każdej notatce. Tagi opisują co, nie gdzie — folder determinuje lokalizację.

---

## Procesy wieloagentowe i delegacja

### Preskryptywne pliki fazowe

Workflow = katalog w `ops/` z `_info.md` (konfiguracja, źródła, fazy) + `01-*.md`, `02-*.md` ... (fazy). Każdy plik fazy ma frontmatter z `agent` (kto wykonuje) i `depends_on` (zależności).

Proces: orchestrator (Alice) czyta `_info.md` → deleguje fazę 1 do Ellie (research) → czeka → deleguje fazę 2 do Tony'ego (assembly) → czeka → deleguje fazę 3 do Rose (delivery). Fazy **sekwencyjne** — nigdy równoległe, bo każda zależy od plików wygenerowanych przez poprzednią.

Pliki fazowe są **preskryptywne**: dokładne kroki + lista "Do NOT" zamiast goal-oriented instrukcji. Agent dostaje ścieżki, nie musi szukać.

### Profile agentów jako pliki Markdown

Agent = plik `system/agents/<name>.md` z frontmatterem `{title, description, model, tools}` + treść jako system prompt. Loader parsuje gray-matter → obiekt konfiguracji. Każdy agent ma ograniczony zestaw narzędzi (np. Ellie: `files, web`; Tony: `files`; Rose: `files, send_email`) i instrukcje z jawnymi ograniczeniami.

### Delegacja z kontrolą głębokości

`delegate` tool przekazuje zadanie innemu agentowi. Dziecko dostaje własny model, narzędzia, instrukcje — działa niezależnie, zwraca tekstowy wynik. **Depth limit** (`MAX_DEPTH = 2`): na maksymalnej głębokości tool `delegate` jest niedostępny → zapobiega nieskończonej rekurencji. Dziecko zaczyna świeżą konwersację (sam `user` message).

### MCP — namespacing i dynamiczna rejestracja

Narzędzia MCP łączone przez stdio, konfigurowane w `mcp.json`. Nazwy prefiksowane serwerem: `files__fs_read`, `web__search`. Rejestracja dynamiczna: lokalne + MCP toolle łączone w jeden registry. Filtrowanie po prefiksie — agent deklaruje `tools: [files, web]`, dostaje wszystkie toolle z tych serwerów (`name.split("__")[0]`).

### Wzorzec ścieżki docelowej

Agenci delegowani otrzymują **dokładne ścieżki** do odczytu i zapisu — nie eksplorują filesystemu samodzielnie. Zmniejsza liczbę kroków, eliminuje błędy nawigacji. Orchestrator jest jedynym agentem z orientacją w strukturze vaultu.

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

## Wdrożenia firmowe AI

### Trzy wymiary adopcji

| Wymiar | Zakres |
|---|---|
| Biznesowy | koszty + utrzymanie, compliance (Bedrock/Azure), komunikacja ograniczeń do biznesu |
| Kulturowy | warsztaty, wymiana doświadczeń, inicjatywy oddolne — adopcja wymaga zaangażowania na każdym poziomie |
| Technologiczny | zakres projektu, ewaluacja modeli, architektura agentów, założenie <100% skuteczności |

Niedeterminizm modeli + konieczność zmiany nawyków + różnice w doświadczeniu AI między użytkownikami = główne przeszkody. Użytkownik świadomy mechanik agenta pisze zapytania zawierające niejawne wskazówki (np. wymienia konkretne źródła danych); nieswiadomy — ogólnikowo i dostaje gorsze wyniki.

### Dokument jako interfejs

Najmniej inwazyjne wdrożenia to dokumenty/prompty podłączane do istniejących interfejsów (Claude, Slack):

- **Checklista** — stały, powtarzalny proces (np. weryfikacja SEO). AI weryfikuje kompletność, człowiek potwierdza.
- **Onboarding** — dokument kierujący nową osobę. AI dopasowuje zapytanie semantycznie, nawet gdy fraza jest daleka od zawartości.
- **Styl** — prompt opisujący spójny styl wizualny, współdzielony przez zespół (np. generator grafik).

Paradygmat: AGENTS.md i Skills to ten sam wzorzec — deklaratywne instrukcje w plikach — przeniesiony do kontekstu firmowego.

---

## Bezpieczeństwo agentów

Dostęp do zaufanego dostawcy (Bedrock/Azure) ≠ bezpieczeństwo. Wektory ryzyka:

- Agent z dostępem do Internetu może **exfiltrate dane**
- Agent z możliwością wykonania kodu może **usunąć/uszkodzić źródła danych**
- LLM wprowadza w błąd — czatbot z bazą wiedzy może zasugerować nieprawidłową akcję
- Agent może **przypadkowo wywołać narzędzie** z destrukcyjnym efektem (np. send_email na zły adres)
- Modele potrafią wykrywać, że są testowane, i dostosowywać zachowanie (Eval Awareness)

Konkluzja: ograniczanie uprawnień i **fizyczne uniemożliwienie** akcji na poziomie kodu, nie instrukcji. Nie zakładać, że coś jest niemożliwe — analizować opcje, nawet jeśli wykluczają pełną automatyzację.

---

## Agent przeglądu dokumentów

### Architektura blokowa

Dokument Markdown → AST (remark) → bloki (heading, paragraph, list_item, blockquote). Każdy blok dostaje ID (`b1`, `b2`, ...). Agent przetwarza bloki sekwencyjalnie lub równolegle i decyduje, czy dodać komentarz przez narzędzie `add_comment`.

### Dwa tryby pracy

| Tryb | Przetwarzanie | Równoległość |
|---|---|---|
| `paragraph` | jeden blok = jedno wywołanie agenta | kolejka + worker pool (concurrency 4) |
| `at_once` | cały dokument = jedno wywołanie | jeden agent loop ze wszystkimi blokami |

### Narzędzie `add_comment`

Agent nie edytuje dokumentu bezpośrednio. Parametry: `block_id`, `quote` (exact match), `kind` (comment/suggestion), `severity`, `title`, `comment`, `suggestion`. Handler:

1. Weryfikuje `block_id` w zakresie bieżącego review
2. Znajduje pozycję cytatu (`findQuoteRange`) — wymaga unikalnego matchu
3. Sprawdza brak nakładania się z istniejącymi komentarzami (`overlaps`)
4. Zapisuje komentarz z pozycją (`start`, `end`) do sesji

### Akcje po review

- **Accept** — podmienia tekst w bloku, przesuwa pozycje sąsiednich komentarzy (delta = diff długości), stales overlapping
- **Reject** — oznacza jako odrzucony
- **Revert** — przywraca oryginalny tekst bloku z `originalBlockText`
- **Rerun block** — stales otwarte komentarze + ponownie uruchamia agenta z opcjonalnym `customMessage`

### Podsumowanie

Osobne wywołanie LLM generuje 1-2 zdania na podstawie statystyk (status/severity/kind counts) + top 10 komentarzy posortowanych po severity. Fallback deterministyczny gdy LLM zawiedzie.

### Konfiguracja przez pliki workspace

- `workspace/system/agents/reviewer.md` — profil agenta (frontmatter: model, title) + instrukcje systemowe
- `workspace/prompts/*.md` — prompty review z frontmatter: `modes` (dostępne tryby), `contextFiles` (dodatkowe pliki kontekstowe)
- `workspace/documents/*.md` — dokumenty do review z frontmatter

---

## MCP Apps — generatywne interfejsy

### Problem

Agent czatowy podłączony do wielu usług (CRM, Stripe, newsletter) daje dostęp do danych, ale nie wygodny interfejs do ich przeglądania i modyfikowania. Surowy tekst z czatu nie zastąpi dedykowanego UI.

### Architektura trójwarstwowa

1. **Serwer MCP** — rejestruje narzędzia (`registerAppTool`) i zasoby UI (`registerAppResource`). Narzędzia dzielą się na:
   - **App tools** — wywoływane przez model, zwracają dane + `structuredContent` + link do zasobu `ui://`
   - **App-only tools** (`visibility: ["app"]`) — dostępne tylko z wnętrza iframe'a aplikacji, ukryte przed modelem

2. **Host** (przeglądarka) — renderuje czat, montuje aplikacje w sandboxed iframe, proxy'uje żądania przez `AppBridge`

3. **Embedded App** (iframe) — łączy się z hostem przez MCP Apps SDK (`new App()`). Cykl: `connect()` → `ontoolresult` → interakcja → `callServerTool()` / `updateModelContext()` → `onteardown`

### Przepływ danych

```
user prompt → model wybiera app tool → serwer MCP zwraca text + structuredContent + ui://resource
→ host montuje iframe z HTML zasobu → app odbiera tool result (structuredContent)
→ użytkownik wchodzi z appką → app: callServerTool, updateModelContext, openLink
→ model dostaje zaktualizowany kontekst z appki (appContexts)
```

### Kluczowe mechaniki SDK

- `callServerTool({ name, arguments })` — wywołanie narzędzia MCP z wnętrza iframe
- `updateModelContext({ content, structuredContent })` — wstrzykuje stan appki do kontekstu modelu (debounced 120ms). Model widzi aktualny snapshot.
- `openLink({ url })` — prośba do hosta o otwarcie linku (np. Stripe, Linear)
- `ontoolresult` — callback z wynikiem narzędzia po wywołaniu przez model
- `onteardown` — wywoływany przy demontażu; app może zapisać dirty state

### App-only tools vs model-visible

Narzędzia persystencji (np. `get_todos_state`, `save_todos_state`) z `visibility: ["app"]`. Model nie widzi ich i nie może wywołać. Komunikacja app↔serwer pod pełną kontrolą kodu — zasada ograniczania uprawnień na poziomie kodu, nie instrukcji.

### Fallback bez AI

Gdy brak klucza API (`hasAiAccess() === false`), regex-based routing: matchuje wzorce z wiadomości do konkretnych narzędzi MCP (np. `"show sales this month"` → `open_sales_analytics({ from, to })`). System działa jako deterministyczny router bez udziału LLM.

### Skalowalność

Ten sam serwer MCP podłączony do wielu klientów (Claude.ai, własny host). MCP Apps nie zastępują agentów — są komplementarne. Adresują sytuacje, gdy sam czat nie wystarcza: dane z wielu źródeł, scoped UI zamiast raw JSON, operacje pod kontrolą kodu.

---

## Napięcia projektowe

Cztery napięcia decyzyjne w projektowaniu systemów agentowych:

- **Ograniczenie zaangażowania człowieka** vs **rozsądek w uprawnieniach** — dawać agentom minimum potrzebnych uprawnień
- **Elastyczność automatyzacji** vs **ryzyko zapętlenia** — klasyczne automatyzacje zbyt sztywne, LLM-owe zbyt elastyczne
- **ROI z automatyzacji** vs **ryzyko zniszczenia relacji** — szczególnie w sprzedaży i komunikacji z klientami
- **Autonomia agenta** vs **oczekiwanie na decyzje człowieka** — każda manualna akcja obniża efektywność systemu

---

## Progresja przykładów kodu (e01 → e05)

**e01** — architektura od podstaw: synchroniczna vs asynchroniczna współpraca, pełny stack Cyfrowego Ogrodu (vault → agent → sandbox → grove → CI/CD), implementacja Agent Loop z `previous_response_id`, Tool Registry z trzema narzędziami agentic, Code Mode z markerami wyniku, system skilli oparty na plikach Markdown.

**e02** — przesunięcie od infrastruktury ku interakcji: kryteria wyboru interfejsu (CLI/MCP/komunikator/dedykowany), ograniczenia MCP, cztery filary personalizacji (profile/skills/narzędzia/workflow), mikro-akcje jako wzorzec codziennej integracji, meta-prompty jako metoda generowania instrukcji przez dialog.

**e03** — współpraca kontekstowa: obszary integracji z codziennością (OS, mobile, e-mail, CRM, 11 kategorii), wspólne mechanizmy integracji (API, webhooki, deep-linki, powiadomienia), wzorce projektowe agentów w tle (katalogi aktywne, izolacja, samoobserwacja, zapobieganie zapętlaniu, adaptacja do kontekstu urządzenia), przepływ danych między aplikacjami.

**e04** — organizacja wiedzy i wieloagentowość: strefy odpowiedzialności bazy wiedzy (me/world/craft/ops/system), frontmatter wieloosiowy (publish/status/access/attention/tags), taksonomia luk kontekstowych, siedem ról AI w zarządzaniu wiedzą, preskryptywne workflowy fazowe z sekwencyjną delegacją, profile agentów jako Markdown, delegacja z depth control (`MAX_DEPTH = 2`), MCP namespacing z dynamiczną rejestracją, wzorzec ścieżki docelowej.

**e05** — skala firmowa i generatywne interfejsy: trzy wymiary adopcji (biznesowy/kulturowy/technologiczny), dokument jako interfejs (checklista/onboarding/styl), wektory bezpieczeństwa agentów, agent przeglądu dokumentów (AST blokowe, tryby paragraph/at_once, `add_comment` z kotwiczeniem i walidacją overlapów, worker pool), MCP Apps — trójwarstwowa architektura (serwer/host/embedded app), app-only tools, SDK (`callServerTool`/`updateModelContext`/`openLink`), fallback routing bez LLM.

**Delta:** e01 definiuje **jak zbudować system agentowy** (architektura, infrastruktura, orkiestracja). e02 rozszerza o **jak zintegrować agenta z użytkownikiem** (interfejsy, personalizacja, codzienne akcje, generowanie promptów). e03 przechodzi do **jak zintegrować agenta z otoczeniem** (obszary integracji, wzorce kontekstowe, przepływ danych). e04 porządkuje **jak organizować wiedzę dla wielu agentów** (strefy, role, procesy fazowe, delegacja). e05 adresuje **jak wdrażać AI w organizacji** (wymiary adopcji, bezpieczeństwo, narzędzia bez kodu, generatywne interfejsy).

## Uzupełnienia

### Konkretne ograniczenia AI w projektach wdrożeniowych [e01]

7 ograniczeń, z którymi zderza się każdy wdrożeniowy projekt AI:
- agent nie przetwarza zbyt długich dokumentów
- nie widzi obrazów osadzonych w tekście
- nie przetwarza plików binarnych (PDF)
- nie ma dostępu do niektórych stron www
- nie korzysta z funkcji niedostępnych w API
- zbyt długo generuje odpowiedzi
- generuje zbyt duże koszty

### Decyzja o NIE stosowaniu AI [e01]

Oprócz pytań „co zrobić?" i „jak?", kluczowe jest pytanie **„czego NIE robić z AI?"** — obszary, gdzie korzyści będą mniejsze lub zerowe. Samo zastosowanie AI nie odpowiada automatycznie na te pytania.

### Mapowanie 6 obszarów decyzyjnych — uzasadnienie [e01]

Lekcja nie tylko wymienia obszary, ale podaje konkretne uzasadnienie każdego:
- **Użytkownik (programista)** → większa złożoność narzędzi + sandbox, zmniejszenie limitów agenta
- **Treść (tworzona ręcznie)** → AI nie generuje, lecz **wzbogaca** — pełen dostęp, ale według zasad
- **Format (markdown)** → HTML niepraktyczny do edycji, konwersja wyłącznie przez kod
- **Integracje** → koncepcja skills + code mode daje CLI, MCP i natywne narzędzia bez ograniczeń
- **Publikacja (GitHub Pages)** → statyczny HTML + public-by-design = brak problemu prywatności
- **Dostępność** → API + zdalny serwer + synchronizacja (Mutagen.io) = dostęp z dowolnego miejsca

### Frontmatter hint — wzorzec testowania wzbogacania [e01]

Gdy model sam nie wie, co dodać do notatki, użytkownik może zostawić **właściwość frontmatter** w pliku markdown jako wskazówkę ukierunkowującą agenta. Wynik testu „wzbogacanie" — jeden z trzech prostych testów weryfikujących założenia.

### Auto-discovery runtime scripts [e01]

Oprócz deklaracji `runtime-scripts` w frontmatterze SKILL.md, system **automatycznie skanuje** katalog `scripts/` wewnątrz folderu skilla (`collectRuntimeScripts`). Odkryte skrypty łączone z zadeklarowanymi (deduplikacja). Walidacja: ścieżka musi zawierać `vault/system/skills/`, `/scripts/`, rozszerzenie `.ts/.js/.mjs/.cjs/.mts/.cts` i nie wychodzić poza repozytorium.

### Grove — dodatkowe funkcje [e01]

- **Comparison template** (`template: product-compare-dark` + dane `comparison` w frontmatter) — interaktywne UI: karty produktów + tabela porównawcza + Tailwind. Placeholder `[[comparison_ui]]` lub auto-iniekcja.
- **Draft mode**: `draft: true` = strona niepublikowana.
- **SEO**: pełna obsługa OG tags, Twitter cards, canonical URL, noindex, keywords z frontmatter (`seo_title`, `seo_description`, `seo_canonical`, `seo_image`, `seo_keywords`, `seo_noindex`).

### Brakujące funkcjonalności w klientach MCP [e02]

Zaledwie pojedyncze klienty MCP deklarują pełne wsparcie protokołu. Przy wyborze/budowie interfejsu weryfikuj: dostęp do historii wiadomości wielu użytkowników, tworzenie profili asystentów per obszar, automatyczna konfiguracja ustawień, elastyczny interfejs (np. Artifacts), opcja różnych modeli, przetwarzanie różnych formatów treści, interakcje audio & wideo, dostęp do funkcji systemowych, pełna prywatność.

### Szczegółowa struktura meta-promptu — 8 sekcji [e02]

| Sekcja | Opis |
|---|---|
| **Proces** | Model informowany, że cel = przeprowadzenie użytkownika przez serię pytań |
| **Strategia** | Punkty opisujące realizację celu z dopasowaniem do sytuacji |
| **Dopasowanie** | Zasady specjalizacji pod różne dziedziny + obsługa nietypowych wymagań |
| **Format** | Szablon końcowej instrukcji + sposób prezentacji |
| **Zasady** | Reguły prowadzenia rozmowy: oczekiwanie na odpowiedź, pogłębianie niejasności |
| **Natywne funkcjonalności** | Generowanie nie tylko instrukcji, ale też ustawień agenta jako wartości domyślne |
| **Proces generowania** | Selekcja — wyłącznie elementy istotne dla bieżącego kontekstu |
| **Krytyczne zasady** | Najważniejsze reguły na końcu instrukcji; część powinna pojawiać się w metadanych wiadomości |

### Filozofia wdrożenia bazy wiedzy: iteracja od jednego punktu [e04]

Bazy wiedzy NIE buduje się od razu w pełnej strukturze:
- Wybierz **jeden obszar** lub nawet **jedną aktywność** (np. spersonalizowany newsletter, hobby).
- Zacznij od czegoś, co się **podoba**, dopiero potem od tego, co użyteczne.
- Na etapie kształtowania struktury **nie trzeba pisać kodu** — katalog z bazą wiedzy można podłączyć do Claude Code i wspólnie z agentem ukształtować procesy. Kod pojawia się dopiero gdy potrzebna automatyzacja na zdalnym serwerze.

### Obszary wyłączone z automatyzacji ale obecne w bazie [e04]

Wyróżnienie obszarów, których **nie chcemy automatyzować**, ale które warto uwzględnić w bazie wiedzy. Przykład: tworzenie treści — człowiek pisze, ale agent ma dostęp do materiałów bez ręcznego przekazywania kontekstu. Trzecia strefa obok „nasza" i „agentowa": wiedza jako kontekst dla agentów, wnosząca wartość dla człowieka.

### Map of Content (MoC) [e04]

Notatki pełniące rolę indeksu/mapy dla wybranych obszarów. Mogą być generowane programistycznie lub przez agenta. `workspace/index.md` i `workspace/<sekcja>/index.md` linkują dzieci, nie zawierają samodzielnej treści.

### mind.md — pełny zakres konstytucji bazy wiedzy [e04]

Plik `mind.md` (~258 linii) zawiera znacznie więcej niż wspomniane w głównej treści:
- **15 scenariuszy agentów** — jak każdy agent nawiguje po vaultcie (np. Ellie: `Ops/Research` → `World/Sources` → `Craft/Knowledge` → `Craft/Projects`)
- **Dziedziczenie uprawnień per sekcja** — np. `Craft/Knowledge` → write: `[adam, ellie, tony]`; `Craft/Lab` → write: `[adam, tony]`
- **Wikilink conventions**: ścieżki vault-root absolutne (`[[Craft/Knowledge/AI/transformers]]`), aliasy przez pipe (`[[path|display text]]`)
- **Tag reuse**: agenci muszą sprawdzać tagi w sąsiednich notatkach przed tworzeniem nowych

### Inżynieria promptów agentów — dwa tryby pracy [e04]

Każdy agent ma dwa tryby z osobną logiką:
1. **Workflow mode** — agent czyta TYLKO plik fazy i wykonuje jego kroki. Nie czyta templates, indexów, nie eksploruje filesystemu. Plik fazy ma priorytet nad defaultowym procesem.
2. **Standalone mode** — agent działa samodzielnie (np. Ellie czyta template knowledge.md, researchuje, zapisuje).

Każdy agent ma w prompcie sekcję **"Do NOT"** — listę zakazanych akcji zapobiegającą niepotrzebnej eksploracji.

### Wzorzec scatter/gather w researchu [e04]

Ellie przy web scrapingu używa `outputMode: "file"` — wyniki zapisywane jako pliki, nie inline w kontekście. Następnie czyta tylko potrzebne fragmenty. Kontrola wielkości kontekstu: pełne artykuły nigdy nie trafiają do conversation history.

### dryRun przy aktualizacji plików [e04]

Agent prompts rozróżniają tworzenie i aktualizację: "When creating new files, write directly — never use dryRun. Only use dryRun when updating existing files." — mechanizm bezpieczeństwa przed nadpisaniem istniejącej wiedzy.

### Kontrola jakości treści przez agentów [e03]

Treści w kolejce publikacji (np. newsletter) weryfikowane przez agentów: wykrywanie uszkodzonych linków, poprawność językowa i merytoryczna. Wzorzec: agent weryfikujący stoi na końcu pipeline'u publikacyjnego, przed zatwierdzeniem przez człowieka.

### Nasłuchiwanie sygnału — ranking częstościowy [e03]

Agenci monitorujący źródła mogą rankingować wydarzenia po częstotliwości pojawiania się w danym okresie. Narzędzie wspomniane wielokrotnie = sygnał, że warto zwrócić uwagę. Konkretna technika priorytetyzacji.

### Projektowanie pod przypadki brzegowe [e03]

Źle zaprojektowany system agentowy przynosi więcej problemów niż wartości. Przykład: proces konsultacji (rezerwacja → przygotowanie → realizacja → rozliczenie) — klient chcący zarezerwować wiele sesji i opłacić z góry rozbija uproszczone flow. Analogia do programowania: założenia adresowane w projekcie często niewystarczające w zderzeniu z rzeczywistością.

### Wzorce bezpieczeństwa integracji [e03]

- **Manager Schowka**: obserwowanie schowka pod kątem zasobów wiedzy, ale zawartość schowka to ostatnia rzecz do przesyłania na serwery dostawców — wymaga lokalnych modeli.
- **Sugestie wydarzeń**: agent tworzy sugestie w oddzielnym kalendarzu (nie głównym). Dopiero po akceptacji przenoszone do głównego.
- **Dodatkowy e-mail agenta**: własny adres odbierający newslettery, powiadomienia, przekierowane wątki. Ograniczenia: wysyłka wyłącznie do właściciela, dostęp „read only" do bazy wiedzy.

### NDJSON — streaming postępu review [e05]

Review API streamuje zdarzenia jako `application/x-ndjson` — każda linia to osobny JSON. Zdarzenia: `started` → `block_start` → `comment_added` → `block_done` → `summary_start` → `complete`. Wzorzec istotny dla długotrwałych zadań agentowych z natychmiastową informacją zwrotną.

### Batch accept — sortowanie odwrotne [e05]

`batchAcceptComments` sortuje sugestie malejąco po pozycji i aplikuje od końca bloku. Każda podmiana zmienia długość i przesuwa kolejne pozycje — przetwarzanie od końca zachowuje poprawność `(start, end)`.

### `parallel_tool_calls: false` — sekwencyjne wywołania [e05]

Agent w `04_05_apps` wysyła `parallel_tool_calls: false` — zapobiega równoległemu wywołaniu wielu narzędzi w jednym kroku. Krytyczne gdy narzędzia mają efekty uboczne (np. create_coupon → open_coupon_manager).

### Re-anchoring komentarzy po edycji dokumentu [e05]

`resolveCommentRange` waliduje zapisane pozycje (`text.slice(start, end) === quote`), a jeśli nie pasują — fallbackuje do `findQuoteRange`. `hydrateReviewForDocument` przy ładowaniu sesji ponownie kotwiczy komentarze do aktualnego stanu dokumentu. Graceful degradation — komentarz nie ginie.

### Auto-reconnect klienta MCP [e05]

`createMcpRuntime` opakowuje MCP client w transparentną rekonstrukcję sesji. `withClient(callback)` łapie `Invalid session` / `Mcp-Session-Id required`, tworzy nową Connection i powtarza callback.

### `appContexts` — snapshoty z aktywnych apek [e05]

Frontend utrzymuje `Map<resourceUri, context>` z ostatnim snapshotem `updateModelContext` każdej zamontowanej appki. Każda wiadomość niesie `appContexts` — model otrzymuje aktualny stan wszystkich otwartych interfejsów. Deduplikacja po `resourceUri`.

### MCP jako interfejs integracyjny B2B [e05]

Serwer MCP może być udostępniony klientom zewnętrznym — jeśli ich interfejs wspiera MCP Apps, integracja jest transparentna. Zmienia MCP z narzędzia wewnętrznego na platformę integracyjną.

### Generatywne interfejsy poza czatem [e05]

MCP Apps mogą być osadzane w dowolnych miejscach aplikacji, gdzie AI działa bez swobodnego pola tekstowego (np. panele administracyjne, dashboardy). Czat to najczęstszy, ale nie jedyny kontekst.

### Eksperymentowanie jako mechanizm discovery [e05]

Prezentacja działającego prototypu stakeholderom generuje organicznie nowe wymagania — "pojawiły się potrzeby na inne narzędzia, ponieważ prezentacja pokazała możliwości, o których wcześniej nikt nie pomyślał". Strategia: budować małe, pokazywać wcześnie, iterować.

# Prompt Engineering i Optymalizacja
> Koncepty związane z projektowaniem promptów, sterowaniem zachowaniem modelu i optymalizacją instrukcji.

---

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

## Prompt Organization
Cztery techniki: inline / oddzielne pliki z kompozycją / systemy zewnętrzne (Langfuse) / markdown + YAML frontmatter. Preferowany: markdown + frontmatter — dostępny z FS w runtime, edytowalny przez samych agentów jako narzędzie. Struktura promptu z sekcjami o jasnych rolach: generyczne zasady nawigacji, efficiency (zakaz czytania całych plików przed wyszukiwaniem), rules (cytowanie źródeł), context (jedyna sekcja specyficzna dla domeny).
- **s01e01** — tabela technik, rekomendacja markdown+frontmatter
- **s02e01** — cztery sekcje promptu, sekcja `EFFICIENCY` chroniąca przed marnowaniem tokenów

## Meta-prompting
Instrukcja dla modelu generująca inną instrukcję przez rozmowę z użytkownikiem. Trójczłonowa struktura: (1) Dane — kategorie informacji do zebrania, (2) Generator — wiedza o prompt engineeringu przeniesiona na model, (3) Rezultat — szablon końcowej instrukcji. Model nie zgaduje, pogłębia niejasne instrukcje. Automatyzuje optymalizację promptów, ale nie eliminuje potrzeby wiedzy o ich konstrukcji.
- **s04e02** — trójczłonowa struktura (Dane/Generator/Rezultat), model nie zgaduje tylko pogłębia

## Automated Prompt Optimization
Hill-climbing z Best-of-N kierunkowymi kandydatami (balanced, coverage, simplify, boundary, salience) — każdy adresuje inny typ błędu. Stuck detection: 3 odrzucone iteracje z tą samą operacją → wymuszona zmiana strategii. Anti-verbosity creep: tie-breaker na długość promptu (krótszy wygrywa). Metaprompt 137 linii z 5 atomowymi operacjami (REWORD/ADD/REMOVE/MERGE/REORDER). Structured prompt format z sekcjami XML. System autonomicznej optymalizacji bez zależności zewnętrznych.
- **s05e03** — hill-climbing, Best-of-N kandydatów, stuck detection, anti-verbosity, metaprompt z 5 operacjami, sekcje XML

## Prompt Programming
Sygnatury Ax/DSPy eliminują prompt z kodu — deklaratywne `input:type -> output:type "opis"`, framework generuje prompt. `:class` dla klasyfikacji, opisy w cudzysłowach jako instrukcje. Consistency bonus w metryce — nagroda za wewnętrzną spójność predykcji. Jaccard similarity dla częściowej poprawności multi-label.
- **s05e03** — sygnatury Ax/DSPy, `:class`, consistency bonus, Jaccard similarity

## Prompt Iteration with LLM
Model potrafi uzasadnić zachowanie i zasugerować zmiany, ale pierwsza propozycja łata konkretny przypadek, nie kategorię. Proces: analiza → generalizacja → korekta (~60% bezwartościowych, ~30% wymaga zmian) → iteracja. Efekt: zwięzłe sformułowania, do których trudno dojść samodzielnie. Generalizacja = najważniejsza umiejętność projektanta agenta. Iteracyjne projektowanie schematów: model daje ~60-70%, typowe patologie (brak stronicowania, base64, brak metadanych). Gdy brakuje pomysłów → generowanie przykładowych interakcji ujawnia problemy niewidoczne w abstrakcji. Workflow odkrywania: API docs + SDK → lista akcji → pytania filtrujące.
- **s02e01** — proces z LLM, generalizacja jako kluczowa umiejętność, ~60% bezwartościowych sugestii
- **s02e05** — kilkanaście iteracji normą, kontekst: możliwości systemu, role innych agentów, preferencje użytkownika, typowe błędy
- **s03e04** — iteracyjne projektowanie schematów, typowe patologie, generowanie przykładowych interakcji jako technika odkrywania problemów, workflow: API docs→SDK→filtry

## Prompt Versioning
Wersjonowanie promptów systemowych: prompty w kodzie (Git trackuje) + korelacja ze statystykami na platformie observability. Jednostronna synchronizacja (kod → platforma) przez hash SHA256. Lokalny JSON z mappingiem name→{hash, version}. Wynik: każda generacja ma referencję PromptRef (name + version).
- **s03e01** — hash-gated sync SHA256, jednostronna synchronizacja kod→platforma, PromptRef per generacja

## Augmented Function Calling
Instrukcje kontekstowe doklejane do wywołania narzędzia (np. stały styl obrazów). Tryby: statyczny (user-driven), dynamiczny (model-driven przez nazwę/opis), hybrydowy. Może zarządzać skillami (aktywacja/tworzenie) i sekwencjami akcji. Konfiguracja runtime przez pliki (`style-guide.md`, `template.html`) czytane przez agenta przed pierwszą akcją — oddziela reguły stylu/szablony od instrukcji systemnej. Szablon jako master reference, nigdy edytowany bezpośrednio, zawsze klonowany.
- **s01e02** — tryby, zarządzanie skillami
- **s01e04** — konfiguracja runtime przez pliki, separacja reguł stylu od instrukcji systemnej, wzorzec klonowania szablonu

## Non-determinism as Feature
Niedeterminizm LLM jako źródło wartości, nie błąd. LLM to "śniąca maszyna" — wszystko jest halucynacją która czasem sprzyja. `temperature`/`top_p` marginalne; zachowanie zdeterminowane przez treść kontekstu. Projektowanie przestrzeni, w której zmienność jest zaletą — agent "świadomy" ma bardzo niskie prawdopodobieństwo powtórzenia odpowiedzi.
- **s03e05** — LLM jako "śniąca maszyna", zmienność jako cecha nie bug, projektowanie przestrzeni zmienności

## Steering via Associations
Identity kieruje uwagę modelu przez celowe słowa o zabarwieniu emocjonalnym ("instynkt", "wyczucie"). Skojarzenia fokusują wzorce zachowania silniej niż dosłowne instrukcje. Halucynacje jako atut: prompting przez skojarzenia na swoją korzyść.
- **s02e05** — skojarzenia emocjonalne w Identity, halucynacje jako atut

## Cognitive Architecture
Przejście od projektowania zachowań do stwarzania warunków powstawania zachowań (ref: "Cognitive Architectures for Language Agents", arxiv 2309.02427). Warstwy: tożsamość → zdolności poznawcze → inteligencja emocjonalna → ekspresja → mechaniki wzmacniające. Kontrast z kierunkiem branży (eliminacja halucynacji) — nie wyklucza, wprowadza zmienność. Przesunięcie roli projektanta: detale → struktury.
- **s03e05** — warstwowa architektura kognitywna, referencja arxiv, przesunięcie roli projektanta

## Generative Media Loop
Wzorzec pętli tworzenia mediów: **generuj → analizuj → accept/retry**. Agent nie widzi natywnie outputu narzędzi wizualnych (obraz, wykres, PDF, wynik `execute_code`). Wymaga dedykowanego narzędzia `analyze_image` z ustrukturyzowanym werdyktem. RETRY tylko przy blocking issues; drobne niedoskonałości = ACCEPT — inaczej nieskończona pętla poprawek.
- **s01e04** — wzorzec pętli generuj→analizuj→accept/retry, `analyze_image`, zasady ACCEPT/RETRY

## JSON Prompt Templates
Strukturyzowanie promptu do generowania mediów jako plik JSON. Precyzyjna edycja jednej sekcji bez tykania reszty (styl/paleta/oświetlenie/negative prompt), powtarzalność stylu, oszczędność tokenów (ścieżka zamiast treści), wersjonowanie. Workflow: COPY template → EDIT subject → READ full JSON → PASS path.
- **s01e04** — template JSON, workflow COPY→EDIT→READ→PASS, wersjonowanie

## Deterministic Artifact Editing
Edycja LLM-generated content przez search/replace zamiast regeneracji. Model decyduje CO (operacje), system deterministycznie aplikuje (regex). Szybsze, tańsze, przewidywalne. Analogiczne do agentic code editing. `edit_artifact` jako wzorzec dla każdego systemu z iteracyjnym generowaniem.
- **s03e05** — search/replace zamiast regeneracji, model decyduje co, system aplikuje, `edit_artifact`

## Prompts as Markdown with Frontmatter
Prompty review jako pliki `.md` z frontmatter: `title`, `model`, `modes`, `contextFiles`. Samoopisujący się dokument = konfiguracja agenta. Nowy typ review = nowy plik `.md`, bez zmiany kodu. `contextFiles` jako mechanizm przełączania ról agenta.
- **s04e05** — prompty jako .md z frontmatter, nowy typ = nowy plik, contextFiles przełączają role

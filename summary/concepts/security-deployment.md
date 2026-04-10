# Bezpieczeństwo, Zaufanie i Deployment
> Koncepty związane z bezpieczeństwem agentów, zarządzaniem zaufaniem, izolacją i wdrażaniem produkcyjnym.

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

## Halucynacje Audio (Whisper)
Whisper halucynuje na ciszę (artefakty treningu na napisach filmowych) i przy mieszaniu języków. Nie naprawialne promptem — wymaga świadomego projektowania pipeline'u audio z guardrails na poziomie aplikacji.
- **s05e04** — halucynacje na ciszę, artefakty napisów filmowych, mieszanie języków, guardrails aplikacyjne

## Capability Stripping
Wzorzec fazowego usuwania narzędzi z agenta na podstawie etapu wykonania. Faza triage: pełny dostęp; faza draft: 0 narzędzi, KB zablokowany. AI nie może sięgnąć po więcej danych — fizycznie brak narzędzi do zapytań. Ograniczenia wymuszane kodem, nie instrukcją. Narzędzia TYLKO na czas potrzeby.
- **s03e02** — fazowe usuwanie narzędzi, triage vs draft, kod nie instrukcja

## Tenant Isolation
Foreign keys obejmują `(id, tenant_id)` — gwarancja na poziomie bazy, że wiersz z jednego tenanta nigdy nie odwoła się do wierszu z drugiego. Scope'owanie MCP, agentów, plików per workspace i tenant.
- **s05e04** — FK z tenant_id, scope'owanie per workspace/tenant, izolacja na poziomie bazy

## Agent Communication Boundaries
Wzorce bezpieczeństwa komunikacji agenta: oddzielny kalendarz (propozycje nie zaśmiecają głównego), osobny email (read-only, wysyłka tylko do właściciela), schowek tylko z lokalnymi modelami. Minimum uprawnień jako zasada.
- **s04e03** — oddzielny kalendarz/email/schowek, minimum uprawnień

## Agent Isolation
Zasada projektowania systemów wieloagentowych: izolować agentów działających w tle tak, by konflikty nie powstawały, a nie by były rozwiązywane. Komplikacja rośnie nieliniowo z liczbą połączeń między agentami. Pełna izolacja nie zawsze możliwa, ale dążenie do niej jest domyślnym trybem.
- **s04e03** — izolacja zamiast rozwiązywania konfliktów, komplikacja nieliniowa z liczbą połączeń

## Deployment produkcyjny
VPS → Ubuntu z SSH key auth → git, node, nginx, ufw → DNS + TLS (certbot) → GitHub Actions self-hosted runner → reverse proxy nginx → secrets w repo settings → workflow `.yml` na push do main.
- **s01e05** — pełny stack deployment VPS, self-hosted runner, nginx reverse proxy

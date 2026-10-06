# Plan: PROMPT-runda4.md — drabina kadłubów z BaseShipa i z potrzeby (cel 4 000 dób)

## Cel
Wyprowadzić kadłuby szczebli 1–5 procedurą kanonu (obrys ← ładownia docelowa 480 m³ × g^N; napęd i bak nie gorsze niż jedynki z pełną ładownią referencyjną; kajuty z obsady; konstrukcja 10%; ładownia = reszta) i zmierzyć, jakie `g` daje galaktykę (a)/(b) na T4 w oknie 3 600–4 400 dób, osobno w R i D, przy flocie 1/2/4/8, `k` 1,3, `xpNaDobeLotu` 2,7, `progFirmy` ×1, bramce G, pamięci A.

## Fazy
1. Rozpoznanie: DECYZJE 89–97, `sim/lot.ts`, użycia kadłuba w `gra.ts` i CLI.
2. Kanon i parametry: `kanon.json` blok `kadlub` (obrys 1 000, kajuta 20, konstrukcja 10%, zbiornik 50, moduł 120, jedynka: 2 osoby, 2 zbiorniki, 4 moduły); `prototyp.json` blok `runda4` (g, zaokrąglenie obrysu, gęstość referencyjna).
3. Model: `sim/kadlub.ts` (procedura, jedynka, drabina z g, drabina rundy 3 w tym samym kształcie), `Gra.drabina` jako jedyne źródło ładowni / baku / masy / ciągu / obsady; `stan.zakupyKadlubow`.
4. Testy: BaseShip 1 000 / 271 / 40 / 100 / 100 / 480; prędkość i zasięg każdego szczebla ≥ jedynki (R i D, każde g); ładownia = reszta; determinizm 4 800 dób w rundzie 4; 83 dotychczasowe zielone.
5. Bot i miary: statystyka misji (czas kontraktu w dobach statku, udział ładowni floty), CLI `npm run runda3 -- runda4 …` (g × {R, D} × 20 ziaren), tabele kadłubów, kamieni, kontraktów, pojemności, krzywej.
6. Pomiary: g ∈ {1,5; 2; 2,5; 3; 4} × {R, D} × 20 ziaren; jeśli żadne g nie daje galaktyki w oknie — g = 5 i 6.
7. DECYZJE „Runda 4: drabina kadłubów z BaseShipa i z potrzeby”, README, push, opis PR.

## Kryteria ukończenia
- Tabela kadłubów dla każdego g (szczebel, obrys, reaktory, dysze, kajuty, bak, ładownia, masa, prędkości, zasięgi, cena, krok wymuszający) i wskazane g dla okna (albo „żadne” z liczbą kontraktów wobec 27).
- Firma T4 i szczebel 5 przy wybranym g: w oknie czy uciekają; który krok procedury rośnie najszybciej.
- Testy zielone, pliki planowania aktualne, PR opisany.

---

# Archiwum: plan zadania runda 3

# Plan: PROMPT-runda3.md — progresja na mechanizmach kanonu (lot, awans, flota)

Gałąź: `claude/blissful-planck-r8yb9d` (PR #1). Pliki robocze: `task_plan.md` (ten plan), `findings.md` (ustalenia), `progress.md` (dziennik). Poprzednie zadania w archiwum na końcu każdego pliku.

## Fazy

1. **Rozpoznanie** — gdzie w `sim/` siedzą: stała prędkość i spalanie (`gra.ts`: `potrzebnePaliwo`, `zasieg`, `lec`; `zaloga.ts`: `predkosc`), port z głębokości (`swiat.ts`: `rynkiGalaktyki`), koszyk awansu (`gra.ts`: `zaliczDostawe`), pamięć zakupu (`stan.pamiecZakupu`), jeden statek (`stan.pozycja`, `paliwo`, `ladownia`, `zaloga`); ile węzłów ma L (464 zamieszkiwalne + przelotowe vs 840 w grze).
2. **Przełącznik i statek** — `runda3` w `prototyp.json` (domyślnie wyłączony; `paliwo` R/D, `bramkaTowaru` G/P, `pamiecFloty` A/B/C) i opcje gry; stan floty: `stan.statki[]` z aktywnym statkiem (dotychczasowe pola stanu to widok na aktywny statek), moduły (reaktory, ładownie, bak) per szczebel, masa sucha, obsada.
3. **Lot z hierarchii ciągu** — ciąg = dysze × 230 tf, masa na bieżąco (kadłub + moduły + paliwo + ładunek), prędkość = 4 × ciąg/masa ÷ 0,8812 × pilot, paliwo R (4 m³/dobę, postać zamknięta: t = m₀/4·(1 − e^(−4d/C))) albo D (1 m³/pc, t = (m₀d − d²/2)/C); pusty bak na starcie; testy kontrolne (4,00 i 0,99 pc/dobę; zasięgi 100 / 78,4 / 24,8 pc przy stałej masie).
4. **Rynek z ludności** — konsumpcja = `konsumpcjaNaMlnNaDobe` × potrzeby rasy × populacja × koszyk tieru, norma 30 dób, bez głębokości portu; otwartość tylko jako sufit NPC; sektory produkcji i `SectorMinTier` {1,2,1,1,2,3,1} z mapowaniem na towary; bramka G/P.
5. **Drabina rozwoju kanonu** — próg gotowości Z₀ × k^(T−1) (Z₀ = Σ populacja × zamożność × PkbToWaterUnits, zamrożone w dobie 0) vs skumulowana nadwyżka (od ostatniego awansu); kontrakt rozwojowy: receptura, naukowiec (40 m³), akademia w stolicy; awans otwiera sektory i podnosi koszyk popytu.
6. **Firma i flota** — poziomy firmy 1/2/4/8 statków (`progFirmy`), kupno statku i szczebla w stoczni cywilizacji o tierze ≥ `tierSzczebla`[N], ceny szczebli jak w rundzie 2, czas ciągły z asynchronicznymi przylotami, okna stoczni liczone, pamięć zakupu floty A/B/C z niezmiennikiem.
7. **Bot floty** — pętla zdarzeń (statek w doku decyduje i startuje; świat przewija się do najbliższego przylotu), paliwo przed pierwszym lotem, podział floty (cele innych statków wykluczone), misje kontraktowe (zakup u innej cywilizacji → naukowiec → akademia), zakupy szczebli i statków, zmiana konfiguracji modułów.
8. **Testy** — dotychczasowe zielone; nowe z promptu.
9. **Pomiary** — `npm run runda3`: siatka R/D × G/P × A/B/C po 30 ziaren, przegląd `k` w R+G+A, miary 1–8.
10. **Wynik** — sekcja „Runda 3: progresja na mechanizmach kanonu” w DECYZJE.md, README, push, opis PR.

## Kryteria ukończenia

- `npm test` zielone (stare + nowe).
- Tabele siatki wariantów i przeglądu `k`, odpowiedzi na sześć pytań z promptu.

---

# Archiwum: PROMPT-progresja (zadanie poprzednie)

## Plan: PROMPT-progresja.md — czy pełna progresja mieści się w ok. 1000 dobach

Gałąź: `claude/blissful-planck-r8yb9d` (PR #1). Pliki robocze: `task_plan.md` (ten plan), `findings.md` (ustalenia), `progress.md` (dziennik). Poprzednie zadanie (spread) w archiwum na końcu każdego pliku.

## Fazy

1. **Rozpoznanie** — DECYZJE (Galaktyka 26–46, Spread 47–58), `sim/gra.ts`, `sim/zaloga.ts`, `bot/strategia.ts`: gdzie siedzą ładownia/bak/masa (`K.*`), kandydaci, płace, horyzont; jak bot wycenia plany i załogę.
2. **Kanon i przełącznik** — nowe liczby kanonu w `kanon.json` (TierCount 4, progi XP 0/500/1500/9999, widełki płac tierów, drabina 6 szczebli — status proponowane), przełącznik `progresja` (domyślnie wyłączony, żeby dotychczasowe pomiary zostały odtwarzalne) i parametry w `prototyp.json` (`progAwansu`, koszyki tierów, `mnoznikSzczebla`, `k`, `xpNaDobeLotu`, `xpZaKontakt`, horyzont 1 200).
3. **Model w symulacji** — (a) tier cywilizacji: licznik dostaw koszyka per cywilizacja (wartość po cenie bazowej), awans przy ≥ `progAwansu` × dzienny PKB portów, awans mnoży konsumpcję towarów koszyka; (b) drabina kadłubów: `stan.szczebel`, ładownia/bak/masa × `mnoznikSzczebla`^N, cena = `k` × mediana zysku na kurs na bieżącym szczeblu (z raportów gry), kupno tylko w stolicy; (c) XP załogi: `xp`, `talent`, tier z progów kanonu, umiejętność z tieru i talentu, płaca z widełek tieru; linie raportu (stocznia, awans), suma linii = zmiana salda.
4. **Bot z inwestycjami** — ładownia/bak/masa z gry (nie z `K`), graf tankowania zależny od szczebla, kupno szczebla przy 1,5 × ceny w stolicy, premia perspektywiczna za dostawy koszyka (wartość dodatkowego popytu po awansie × pozostałe doby × udział), polityka załogi „zatrudniaj i trzymaj” (bez zwolnień i podmian, tolerowany koszt dnia XP).
5. **Testy** — dotychczasowe zielone (przełącznik wyłączony); nowe: awans tylko przez dostawę gracza, cena szczebla rośnie z przychodem, XP i tier zgodne z progami kanonu, determinizm na 1 200 dób, raport ze stocznią sumuje się.
6. **UI** — przełącznik w nagłówku i adresie, stocznia w doku stolicy, tier i postęp koszyka w panelu cywilizacji, XP/tier załogi, linie raportu; smoke w trybie progresji.
7. **Pomiary** — `npm run progresja`: L, 1 200 dób, B, pelna, 50 ziaren; kamienie milowe (mediana, 10–90%), odsetek maksimum do doby 1000, krzywa wartości co 100 dób, stabilność gospodarki (PKB d0/d600/d1200, NaN, pozycje na sufitach); przegląd `progAwansu`, `k`, `xpNaDobeLotu`.
8. **Wynik** — sekcja „Progresja: 1000 dób” w DECYZJE.md, README, commit, push, opis PR.

## Kryteria ukończenia

- `npm test` zielone (stare + nowe).
- Tabela kamieni milowych i tabela przeglądu parametrów w DECYZJE z odpowiedzią „tak/nie” per oś.
- Lista liczb kanonu, które cel 1000 dób wymusza; werdykt o stabilności gospodarki przez 1 200 dób.

---

# Archiwum: PROMPT-spread (zadanie poprzednie)

## Plan: PROMPT-spread_2.md (v2) — pamięć zakupu zamiast stałego spreadu

Gałąź: `claude/blissful-planck-r8yb9d` (PR #1). Pliki robocze: `task_plan.md` (ten plan), `findings.md` (ustalenia), `progress.md` (dziennik).

## Fazy

1. **Rozpoznanie** — DECYZJE pkt 8 (handlowiec w oknie spreadu) i 44 (paliwo blokuje korelację), miejsca w `sim/` gdzie działa `tradeSpread`: `rynek.ts` (mnożniki, całki), `gra.ts` (ceny, wyceny, kup/sprzedaj, raport), bot (`Kontekst`), testy (niezmiennik spreadu).
2. **Model w symulacji** — przełącznik `spread` (A/B/C/D/E; E = jak B bez obcięcia nacisku 0,45–2,5, v2 promptu) w `prototyp.json`, pamięć (towar, planeta, licznik) w stanie gry, licznik 5 przy zakupie, −1 za każdy skok, kara 0,3 (schodek) albo 0,3 × licznik/5 (liniowa) na sprzedaży w miejscu zakupu, spread podstawowy 0 albo 0,10, handlowiec tylko w oknie spreadu podstawowego, linia kary w raporcie.
3. **Bot zna regułę** — skoki w grafie tankowania, wyceny z karą i spreadem podstawowym, nowe miary (korelacje per towar, udział paliwa w kosztach, mediana dystansu zyskownej trasy między cywilizacjami, pc paliwa pokrywane medianą marży z pełnej ładowni), CLI z wariantem.
4. **Testy** — dotychczasowe zielone w A; nowe (B/C/D/E): odsprzedaż w miejscu zakupu nie daje zysku (każdy towar, każda załoga), po 5 skokach kara 0, pamięć bez ceny, determinizm.
5. **UI** — przełącznik wariantu, kara widoczna w doku i w raporcie; smoke z wariantem.
6. **Pomiary** — 5 wariantów × S/M (200) × L (50), `informacja = pelna`.
7. **Obliczenie** — jeśli korelacja nie zmienia znaku: o ile musiałoby zmienić się paliwo kanonu (pomiar w skrypcie, bez zmiany kanonu).
8. **Wynik** — sekcja „Spread: pamięć zakupu” w DECYZJE.md, commit, push, opis PR.

## Kryteria ukończenia

- `npm test` zielone (A + nowe niezmienniki B/C/D).
- Tabela 5 × 3 w DECYZJE z odpowiedzią o znaku korelacji, liczbą kanonu i skutkiem dla handlowca.
- Domyślny wariant gry: A.

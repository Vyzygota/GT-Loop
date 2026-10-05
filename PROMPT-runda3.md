# GalaxyTrader: Pętla — test: progresja na mechanizmach kanonu (lot, awans, flota)

Pracujesz na gałęzi PR #1 (`claude/blissful-planck-r8yb9d`). Przeczytaj `DECYZJE.md` (sekcje „Galaktyka”, „Spread: pamięć zakupu”, „Progresja: 1000 dób”) i kod `sim/`. Pracuj z pluginem **planning with files** (`task_plan.md`, `findings.md`, `progress.md`, aktualizowane po każdej fazie). Pracuj samodzielnie, bez pytań. Commituj po każdym działającym kroku, na końcu push i aktualizacja opisu PR.

## Po co ta runda

Poprzedni pomiar progresji opierał się na trzech modelach niezgodnych z kanonem gry: stałym spalaniu i prędkości niezależnych od ładunku, porcie o głębokości z otwartości handlowej i wymyślonym koszyku awansu. Ta runda zastępuje je mechanizmami kanonu i odpowiada na pytanie: **czy maksimum galaktyki (9 cywilizacji na T4), firmy (8 statków na najwyższym szczeblu) i załogi (Legenda) mieści się w ok. 1000 dób, i które gałki to ustawiają.**

## Zmiany modelu (każde założenie spoza kanonu do `prototyp.json` i DECYZJE)

### 1. Lot: hierarchia ciągu (kanon, werdykty 08.09 i 23.09)

Kolejność wyliczania: ciąg → masa → prędkość → paliwo.

- Ciąg = liczba dysz × 230 tf. Masa = kadłub + moduły + paliwo + ładunek (gęstość towaru × m³), liczona **na bieżąco w trakcie lotu**.
- Prędkość = 4 pc/dobę × (ciąg ÷ masa) ÷ 0,8812. Jedynka: 2 dysze, 421,99 t sucha + 100 t paliwa = 521,99 t, czyli 4,00 pc/dobę.
- Ubytek paliwa jest widoczny: statek przyspiesza w miarę spalania. Prędkość przelicz co najmniej na każdym skoku (lepiej w krokach ułamka doby).
- Pilot: prędkość × umiejętność pilota (nowicjusz spowalnia statek).
- Paliwo: dwa warianty (przełącznik `paliwo` w `prototyp.json`), bo kanon tego nie rozstrzygnął:
  - **R** (stawka): paliwo = 4 m³/dobę × czas lotu, więc ciężki statek pali więcej na parsek;
  - **D** (dawka): 1 m³/pc niezależnie od masy (dawka 20 m³ na skok 20 pc).
- Kontrola: pełna ładownia minerałów (1 440 t) na jedynce daje ok. 0,99 pc/dobę; w wariancie R ok. 4 m³/pc. Zasięg na 100 m³ w wariancie R: jedynka 100 pc, +4 ładownie puste 78,4 pc, +minerały 24,8 pc. Zrób z tego test.
- Start: **pusty bak**, paliwo jest pierwszym zakupem, kwota startowa 6 800 000 kr.

### 2. Rynek: pojemność z konsumpcji ludności (werdykt 04.10)

Usuń port o głębokości z otwartości. Ile planeta kupi, wyznacza dzienna konsumpcja jej ludności (`ConsumptionPerMlnPerDay` × populacja × koszyk tieru); magazyn to bufor o normie 30 dób konsumpcji. Otwartość handlowa zostaje jako sufit dobowej wymiany NPC. Jeśli przy populacjach kanonu rynek wchłania wszystko, co przewiezie flota 8 statków, **zapisz to jako wynik**, nie wprowadzaj nowego ograniczenia.

### 3. Awans tieru cywilizacji (kanon: `adres-drabiny-rozwoju` i cztery wskazane tam zapisy)

- Numeracja T1–T4; T4 (wynalazki rasowe i synergie) to najwyższy szczebel. Start: wszystkie cywilizacje na T1.
- Próg gotowości(T) = Z₀_start × k^(T−1), gdzie Z₀_start = Σ(populacja × zamożność × PkbToWaterUnits) po wszystkich światach cywilizacji, zamrożone w dobie 0. Porównujesz go ze skumulowaną nadwyżką cywilizacji w WU.
- Po przekroczeniu progu cywilizacja wystawia **kontrakt rozwojowy**. Awans o 1 tier następuje dopiero po dostawie gracza: surowce z receptury (uproszczenie: towar T2 rasy sąsiedniej + towary z sektorów otwartych na bieżącym tierze, ilość = `ilośćKontraktu` × dzienna konsumpcja stolicy), **naukowiec** (pasażer zabrany z planety tej cywilizacji lub sąsiedniej, zajmuje 40 m³ ładowni) i dowóz na **planetę z akademią** (jedna na cywilizację, wybierz stolicę). Bez gracza cywilizacja nie awansuje.
- Tier otwiera sektory produkcji według `SectorMinTier` = {1,2,1,1,2,3,1} (mapowanie sektorów jak w kodzie gry, zapisz je w DECYZJE). Popyt rośnie według koszyka tieru (kontrola z kodu gry: przy T1→T2 minerały ×6,38, paliwo ×3,46).
- Dostęp do towaru, dwa warianty (przełącznik `bramkaTowaru`): **G** (towar wyższego tieru nie istnieje na rynku cywilizacji poniżej tego tieru) i **P** (towar jest, tier steruje tylko produkcją).

### 4. Firma i flota

- Poziom firmy T1–T4 daje 1 → 2 → 4 → 8 statków. Awans firmy: wartość firmy ≥ `progFirmy`(T) (gałka w `prototyp.json`).
- Drabina kadłubów: 6 szczebli (0–5). Szczebel jest dostępny w stoczni cywilizacji o tierze ≥ `tierSzczebla`[N] (domyślnie 0–1: T1, 2: T2, 3–4: T3, 5: T4; zapisz w DECYZJE). Większy kadłub daje więcej miejsca na moduły ładunkowe, większy bak i miejsce na reaktory (reaktor 271 m³, 2 dysze na reaktor), więc też więcej ciągu. Ceny szczebli jak w poprzedniej rundzie (k × mediana zysku na kurs na szczeblu N−1).
- Obsada: liczba załogantów wynika z zamontowanych modułów (werdykt 25.08). Kanon nie ma jeszcze listy, więc przyjmij: kokpit 1 + 1 na każdy reaktor + 1 na każde 4 moduły ładunkowe i zapisz to.
- Pamięć zakupu przy flocie: trzy warianty (przełącznik `pamiecFloty`): licznik skoków statku, który kupił (**A**), statku, który sprzedaje (**B**), albo czas (**C**, 25 dób = 5 skoków jedynki). Niezmiennik: odsprzedaż na planecie zakupu przed wygaśnięciem nie daje zysku żadnemu statkowi firmy.

### 5. Czas

Czas płynie zawsze; staje tylko przy otwartym oknie stoczni. Bot liczy, ile razy na 100 dób otwiera okno stoczni (kupno kadłuba, zmiana modułów, nowy statek), osobno przy 1, 2, 4 i 8 statkach.

## Ustawienia przebiegu

- Skala **L**, 840 układów jak w grze (jeśli generator daje 464 zamieszkiwalne, opisz, jak się mają do 840), horyzont **1 200 dób**, pamięć zakupu wariant B z poprzedniej rundy (spread podstawowy 0), informacja pełna.
- Siatka: `paliwo` {R, D} × `bramkaTowaru` {G, P} × `pamiecFloty` {A, B, C}, po 30 ziaren; przegląd `k` {1,05; 1,10; 1,15; 1,20; 1,30} w wariancie R+G+A po 30 ziaren.
- Bot: kupuje paliwo przed pierwszym lotem; realizuje kontrakty rozwojowe, gdy to opłacalne w perspektywie (z naukowcem i dowozem do akademii); kupuje szczeble i statki; dzieli flotę między trasy.

## Miary

1. Doby do kamieni milowych (mediana i 10–90%): każda cywilizacja na T2/T3/T4, pierwsza i wszystkie 9 na T4, poziom firmy T2/T3/T4, każdy szczebel kadłuba, pierwszy załogant na każdym tierze, cała załoga na Legendzie.
2. Odsetek ziaren z maksimum w każdej osi do doby 1000.
3. **Oś galaktyki, dwie definicje maksimum:** (a) wszystkie 9 cywilizacji na T4; (b) wszystkie cywilizacje, z którymi gracz miał kontakt, na T4. Dla (a) podaj, ile dób zajmuje samo dotarcie do najdalszej cywilizacji na każdym szczeblu kadłuba (prędkość i zasięg z hierarchii ciągu).
4. Przegląd `k`: wartość, przy której mediana dób do (a) i do (b) wypada w 900–1100.
5. Zysk na dobę a dystans **osobno dla każdego towaru**, w wariantach R i D; udział paliwa w kosztach; zwrot paliwa z pełnej ładowni (w pc) dla każdego towaru. To ponowny pomiar wniosków „paliwo nie decyduje o znaku” i „ok. 150/290 pc”, które liczono bez masy.
6. Pojemność rynku: dla każdego towaru stosunek tego, co przewiezie flota 8 statków na najwyższym szczeblu w 100 dób, do 100 dób konsumpcji planet kupujących.
7. Okna stoczni na 100 dób przy 1/2/4/8 statkach.
8. Stabilność 1 200 dób: wzrost zamożności w d600–1200 ≤ w d0–600 dla każdej rasy, zero NaN, bez nowych sufitów.

## Testy

Wszystkie dotychczasowe zielone. Nowe: prędkość jedynki 4,00 pc/dobę i 0,99 pc/dobę z minerałami; ubytek paliwa przyspiesza statek; zasięgi z punktu 1 w wariancie R; awans tylko po kontrakcie i dostawie z naukowcem do akademii; bramka G ukrywa towar wyższego tieru; liczba statków 1/2/4/8; niezmiennik pamięci zakupu dla floty w A, B i C; determinizm na 1 200 dób.

## Czego nie robić

Nie zmieniasz liczb kanonu (ciąg dyszy, masa jedynki, cena paliwa, BasePrice, progi XP, widełki płac, SectorMinTier, otwartość, SSR). Nie dodajesz walki, zdarzeń losowych ani fabuły. Każdy nowy parametr spoza kanonu idzie do `prototyp.json` i DECYZJE.

## Wynik

Sekcja „Runda 3: progresja na mechanizmach kanonu” w `DECYZJE.md`:

- jedno zdanie na każdą oś: czy maksimum jest osiągalne w ok. 1000 dób, w definicji (a) i (b) dla galaktyki;
- które warianty (R/D, G/P, A/B/C) zmieniają wynik, a które nie;
- wartość `k` dająca ok. 1000 dób;
- czy wnioski o paliwie i dystansie z poprzednich rund zmieniają się po uwzględnieniu masy;
- okna stoczni na 100 dób przy flocie 8 statków;
- które liczby kanonu ten cel wymusza.

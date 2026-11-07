# GalaxyTrader: Pętla — funkcja: większa i różnorodna galaktyka

Pracujesz na istniejącym prototypie z tego repo (gałąź PR #1). Przeczytaj `PROMPT.md`, `DECYZJE.md` i kod `sim/`. Pracuj samodzielnie, bez pytań; decyzje zapisuj w `DECYZJE.md` w nowej sekcji „Galaktyka”. Commituj po każdym działającym kroku.

## Hipoteza

Mała galaktyka sprowadza grę do wahadła między dwiema sąsiednimi planetami (najczęstsze trasy obu dotychczasowych przebiegów to krótkie skoki wewnątrz jednej cywilizacji). Większa galaktyka z cywilizacjami o różnych profilach i różnej otwartości handlowej ma sprawić, że:
1. opłacalne trasy są różne w różnych częściach mapy i zmieniają się w czasie,
2. marża rośnie z odległością, więc dalekie kursy mają sens mimo paliwa,
3. eksploracja nieznanych cywilizacji jest decyzją z ryzykiem i nagrodą.

## Zakres

1. **Trzy skale świata** w `prototyp.json` (przełącznik `skala`), ten sam generator:
   - `S`: obecny świat (regresja, testy dotychczasowe zostają na S),
   - `M` (domyślna do grania): jeden sektor kanonu, ok. 60–80 planet zamieszkiwalnych, 3–4 cywilizacje, w tym 1–2 nieznane,
   - `L`: pełna galaktyka kanonu, 7 sektorów, 9 cywilizacji, ok. 464 układy zamieszkiwalne.
2. **Struktura z kanonu.** Galaktyka o promieniu 1 257 pc. Martwy rdzeń do 0,300 R (bez planet zamieszkiwalnych). Zdatność rośnie liniowo od 0 przy 0,300 R do 1 przy 0,467 R. Strefa zamieszkiwalna 0,467–0,600 R. Skok 20 pc zostaje, więc dodaj **układy przelotowe**: węzły bez rynku i bez paliwa, potrzebne tylko do spójności grafu. Kanon zna trzy poziomy przejezdności, a planety zamieszkiwalne to poziom, na którym się tankuje. Punkty plemion (tylko paliwo) zostają jako drugi poziom.
3. **Cywilizacje z kanonu** (tabela niżej). Każda ma własną otwartość handlową i samowystarczalność żywnościową. **Otwartość handlowa jest sufitem dobowej wymiany NPC** (ułamek dziennego „PKB” cywilizacji), czyli steruje tym, jak szybko jej rynki wracają do normy. Cywilizacja zamknięta (Orak 0,04) ma płytkie, długo zepsute rynki, a otwarta (AI 1,66) głębokie i szybko odbudowane. Samowystarczalność żywnościowa (SSR) ustala nadwyżkę lub deficyt żywności: SSR > 1 to eksporter, SSR < 1 importer. Pozostałe profile towarów zaprojektuj sam w `prototyp.json`, tak żeby producent i główny odbiorca każdego towaru leżeli w różnych sektorach.
4. **Terytorium** z populacji według kanonu: liczba układów = round(3 + 2,2 × log10(populacja w mln) + rozrzut).
5. **Informacja o cenach** (przełącznik `informacja`): `pelna` (jak dziś) albo `zasieg`. W trybie `zasieg` gracz widzi ceny na żywo tylko w zasięgu łączności 182 pc od statku, a dla pozostałych odwiedzonych planet ostatni odczyt z jego wiekiem w dobach. W trybie `zasieg` nieodwiedzonych planet poza łącznością nie widać wcale.
6. **Horyzont gry** skalowany: `limitDob` per skala w `prototyp.json` (S 120, a dla M i L wybierz sam tak, żeby gracz mógł przejść co najmniej 2 sektory w L). Cel ×2 zostaje.
7. **UI:** mapa z przybliżaniem i przesuwaniem, kolor = cywilizacja, granice sektorów, układy przelotowe jako małe punkty, a nazwy dopiero po przybliżeniu. Panel cywilizacji pokazuje otwartość i SSR.

## Miary (bot, 200 ziaren, osobno dla S, M, L; dla L wystarczy 50 ziaren, jeśli 200 trwa zbyt długo)

| Miara | Próg na M |
|---|---|
| Ziarna z zyskiem | ≥ 70% |
| Pierwsza zyskowna trasa, mediana | ≤ 3 loty |
| Udział 5 najczęstszych tras we wszystkich lotach | ≤ 25% (dziś ok. 40%) |
| Loty wewnątrz jednej cywilizacji | ≤ 50% |
| Mediana długości zyskownego lotu | ≥ 2 skoki |
| Zysk na dobę: korelacja z dystansem trasy | dodatnia |
| Kontakt z co najmniej jedną nieznaną cywilizacją | ≥ 50% ziaren |
| `informacja = zasieg` vs `pelna`: spadek mediany wartości firmy | podaj liczbę (nie ma progu, to pomiar wartości informacji) |
| Czas bota, 200 ziaren | ≤ 120 s |

Wypisz tabelę dla wszystkich trzech skal i obu trybów informacji. Jeśli progów na M nie da się osiągnąć, **nie zmieniaj liczb kanonu**. Strój tylko profile i rozmieszczenie w `prototyp.json`, a w `DECYZJE.md` zapisz, która liczba kanonu blokuje różnorodność.

## Testy

- Wszystkie dotychczasowe testy zielone na skali S.
- Nowe testy:
  - spójność grafu na M i L dla 20 ziaren,
  - brak planet zamieszkiwalnych w martwym rdzeniu,
  - każda planeta zamieszkiwalna osiągalna z każdego punktu w ramach skoku 20 pc,
  - determinizm na M,
  - tryb `zasieg`: poza 182 pc widać tylko ostatni odczyt,
  - otwartość ogranicza dobową wymianę NPC.
- Smoke test w przeglądarce na skali M, 1 ziarno, do końca horyzontu, bez błędów w konsoli i ze zgodnością UI z symulacją co do 1 kr.

## Czego nie robić

Bez nowych towarów, statków, zdarzeń losowych, walki, fabuły i zapisu gry. Bez cech ras poza otwartością i SSR. Bez zmian w zasadach załogi (to osobna funkcja). Bez dokumentów poza sekcją w `DECYZJE.md` i dopiskiem w README o przełącznikach.

## Liczby kanonu do dopisania w `sim/kanon.json`

| Nazwa | Wartość | Jednostka |
|---|---|---|
| promienGalaktyki | 1 257 | pc |
| DeadCoreFraction | 0,300 | ułamek R |
| gradientZdatnosci | 0 przy 0,300 → 1 przy 0,467, liniowo | – |
| habitableZoneInner / Outer | 0,467 / 0,600 | ułamek R |
| SectorCount | 7 | sektory |
| ukladyZamieszkiwalne | 464 | układy (status: proponowane) |
| terytoriumZPopulacji | round(3 + 2,2 × log10(pop_mln) + rozrzut) | układy |
| zasiegLacznosci | 182 | pc |

| Cywilizacja | Otwartość handlowa (ułamek dziennego PKB) | SSR żywności |
|---|---|---|
| AI | 1,66 | 0,09 |
| Corrath | 0,77 | 0,46 |
| Duhari | 0,46 | 1,7 |
| Ludzie | 0,26 | 1,25 |
| Orak | 0,04 | 0,02 |
| Planta | 0,85 | 0,54 |
| Szkarni | 0,72 | 0,43 |
| Velhari | 1,18 | 0,56 |
| Vreth | 0,5 | 1,2 |

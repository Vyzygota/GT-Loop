# GalaxyTrader: Pętla — test: drabina kadłubów wyprowadzona z BaseShipa i z potrzeby progresji

Pracujesz na gałęzi PR #1 (`claude/blissful-planck-r8yb9d`). Przeczytaj `DECYZJE.md` (zwłaszcza „Runda 3”, odpowiedzi 89–97) i kod `sim/`. Pracuj z pluginem **planning with files** (`task_plan.md`, `findings.md`, `progress.md`, aktualizowane po każdej fazie). Pracuj samodzielnie, bez pytań. Commituj po każdym działającym kroku, na końcu push i aktualizacja opisu PR.

## Po co ta runda

Runda 3 pokazała, że galaktyka nie dochodzi do T4 (0% ziaren do doby 4 000), bo flota dowozi 11–16 kontraktów wobec 27 potrzebnych. Druga przyczyna: drabina kadłubów z rundy 3 była wymyślona mnożnikiem 1,5^N i większy kadłub był wolniejszy od jedynki (szczebel 5 pusty 2,93 pc/dobę wobec 3,14). Werdykty projektanta (06.10):

- każdy tier firmy podnosi liczbę obsługiwanych statków (1 → 2 → 4 → 8); to jedyna droga do większej liczby statków, bez osobnej puli statków tylko na kontrakty;
- **ładownię potrzebną do progresji wyprowadzamy z potrzeby**;
- **BaseShip jest designerską jedynką**, z której wyprowadza się kolejne kadłuby.

Pytanie: **jaka ładownia na szczeblach 1–5 daje galaktykę na T4 w oknie 3 600–4 400 dób**, gdy każdy kadłub wyprowadza się procedurą kanonu.

## Procedura kadłuba (kanon `zasada-wyprowadzenie-kadluba`, ta sama dla każdego szczebla, nie mnożnik)

Dla BaseShipa (kontrola, zrób z tego test):

| krok | wielkość | BaseShip |
|---|---|---|
| 1 | obrys (decyzja) | 1 000 m³ |
| 2 | napęd z czasu skoku: reaktor 271 m³, 2 dysze na reaktor, 230 tf na dyszę | 1 reaktor, 271 m³ |
| 3 | kajuty 20 m³ na osobę | 40 m³ |
| 4 | konstrukcja 10% obrysu | 100 m³ |
| 5 | bak z liczby zbiorników po 50 m³ | 2 × 50 = 100 m³ |
| 6 | **ładownia = reszta**, w modułach po 120 m³ | 480 m³ = 4 × 120 (luz 9 m³) |

Dla szczebli 1–5:

- **Wejście = ładownia docelowa** (zmienna przeglądu). Obrys wyznacz odwrotnie: najmniejszy obrys, w którym po krokach 2–5 zostaje ta ładownia.
- **Napęd z czasu skoku:** najmniejsza liczba reaktorów, przy której prędkość z pełną ładownią towaru referencyjnego ρ = 1,0 jest **≥ prędkości jedynki w tym samym stanie**. Większy kadłub nie może być wolniejszy od jedynki.
- **Kajuty:** obsada z modułów jak w rundzie 3 (kokpit 1 + 1 na reaktor + 1 na 4 moduły ładowni), 20 m³ na osobę.
- **Bak:** najmniejsza liczba zbiorników 50 m³, przy której zasięg z pełną ładownią referencyjną jest ≥ zasięgu jedynki w tym samym stanie.
- **Masa** z gęstości, jak w rundzie 3. Prędkość i paliwo z hierarchii ciągu, jak w rundzie 3.
- Pierwszy krok, który wymusza zmianę obrysu, zapisz w tabeli kadłubów.

## Przegląd

- Ładownia szczebla N = 480 m³ × g^N, `g` ∈ {1,5; 2; 2,5; 3; 4} (w rundzie 3 wychodziło g ≈ 1,5 z mnożnika objętości).
- Jeśli żadne `g` nie daje galaktyki (a) lub (b) w oknie, dołóż g = 5 i 6 i podaj, ile kontraktów dowozi flota wobec 27 potrzebnych.
- Stałe: flota 1/2/4/8 statków, `k` = 1,3, `xpNaDobeLotu` = 2,7, `progFirmy` jak w rundzie 3 (×1), dostępność szczebla w stoczni o tierze jak w rundzie 3, bramka G, pamięć A.
- Paliwo: osobno R i D.
- Skala L, horyzont 4 800 dób, 20 ziaren na wartość `g` i wariant paliwa.

## Miary

1. Tabela kadłubów dla każdego `g`: szczebel, obrys, reaktory, dysze, kajuty, bak, ładownia, masa sucha, prędkość pusty / z pełną ładownią referencyjną / z pełną ładownią minerałów, zasięg pusty i z ładunkiem, cena szczebla.
2. Doby do galaktyki (a) i (b), pierwszej cywilizacji na T4, firmy T4 i szczebla 5 (mediana, 10–90%, odsetek ziaren do doby 4 000).
3. Kontrakty dowiezione do doby 4 000 i 4 800 wobec 27 potrzebnych; średni czas jednego kontraktu w dobach statku; udział ładowni floty zajętej przez kontrakty.
4. Pojemność rynku dla 8 statków szczebla 5 przy każdym `g` (jak w rundzie 3).
5. Krzywa wartości firmy co 200 dób i bankructwa.

## Testy

Wszystkie dotychczasowe zielone. Nowe: procedura dla BaseShipa daje 1 000 / 271 / 40 / 100 / 100 / 480 m³; prędkość każdego szczebla z pełną ładownią referencyjną ≥ prędkość jedynki; zasięg każdego szczebla ≥ zasięg jedynki; ładownia = reszta (zmiana dowolnego kroku ją przesuwa); determinizm na 4 800 dób.

## Czego nie robić

Nie zmieniasz liczb kanonu (BaseShip, reaktor 271 m³, 2 dysze na reaktor, 230 tf, 20 m³ na osobę, 10% konstrukcji, moduł 120 m³, zbiornik 50 m³, ceny i gęstości towarów, SectorMinTier). Nie dodajesz statków ponad 1/2/4/8. Każdy nowy parametr spoza kanonu idzie do `prototyp.json` i DECYZJE.

## Wynik

Sekcja „Runda 4: drabina kadłubów z BaseShipa i z potrzeby” w `DECYZJE.md`:

- jedno zdanie: jaka ładownia na szczeblach 1–5 (wartość `g`) daje galaktykę (a) i (b) w oknie, osobno dla R i D, albo że żadna i dlaczego;
- tabela kadłubów dla wybranego `g`, gotowa do przepisania do kanonu;
- czy przy tym `g` firma i kadłub zostają w oknie, czy uciekają;
- który krok procedury rośnie najszybciej ze szczeblem (napęd, bak czy kajuty).

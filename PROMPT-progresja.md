# GalaxyTrader: Pętla — test: czy pełna progresja mieści się w ok. 1000 dobach

Pracujesz na gałęzi PR #1 (`claude/blissful-planck-r8yb9d`). Przeczytaj `DECYZJE.md` (zwłaszcza sekcje „Galaktyka” i „Spread: pamięć zakupu”) i kod `sim/`. Pracuj z pluginem **planning with files** (`task_plan.md`, `findings.md`, `progress.md`, aktualizowane po każdej fazie). Pracuj samodzielnie, bez pytań. Commituj po każdym działającym kroku, na końcu push i aktualizacja opisu PR.

## Hipoteza projektantów

Gra fabularyzacyjna kończy się po ok. **1000 dobach**. W tym czasie gracz ma osiągnąć **maksimum rozwoju galaktyki, swojej firmy i swoich załogantów**. Sprawdzamy, czy to możliwe, a jeśli nie, jakie wartości brakujących parametrów by to dały.

## Definicje maksimum (wszystkie progi w `prototyp.json`, żeby projektant mógł je zmienić)

| Oś | Maksimum | Źródło |
|---|---|---|
| Galaktyka | wszystkie 9 cywilizacji na najwyższym tierze (T4); zapisz też doby do: pierwszej cywilizacji na T4, połowy cywilizacji na T4 | kanon: TierCount = 4; awans odblokowuje gracz (werdykt projektanta 02.10) |
| Firma | najwyższy szczebel drabiny kadłubów (szczebel 5 z 0–5) | kanon: drabina-kadlubow 6 szczebli (status proponowane) |
| Załoga | wszyscy załoganci na najwyższym tierze załogi (Legenda) | kanon: tier-zalogi 0 / 500 / 1 500 / 9 999 XP |

## Mechanizmy do dodania (uproszczone, każde założenie w DECYZJE)

1. **Awans tieru cywilizacji przez gracza.** Cywilizacja awansuje o tier, gdy gracz dostarczy jej koszyk towarów kolejnego tieru o łącznej wartości ≥ `progAwansu` × dzienny „PKB” portów tej cywilizacji (dzienna konsumpcja w WU). Koszyk tieru: T2 otwiera popyt na Elektronikę, T3 na naukę (jeśli jej nie masz jako towaru, użyj Elektroniki + Materiałów wybuchowych), T4 na oba w większej ilości. Awans podnosi konsumpcję portów według koszyka (popyt na dobra o Engel > 1 rośnie), więc zmienia rynek. Cywilizacje rosną same, ale tier podnosi tylko gracz.
2. **Drabina kadłubów.** Szczebel N ma ładownię i bak × `mnoznikSzczebla`^N (od BaseShip: 480 m³, 100 m³). Cena szczebla N wynika z zasady kanonu „cena modułu poziomu N skalibrowana do przychodu z poziomu N−1”: cena = `k` × mediana zysku na kurs bota na szczeblu N−1 (zmierzona w trakcie gry, nie wpisana na sztywno). Kupno w doku stolicy.
3. **XP załogi.** Załogant dostaje `xpNaDobeLotu` XP za każdą dobę lotu i `xpZaKontakt` za kontakt z nową cywilizacją. Tier załogi podnosi umiejętność według kanonu (skillFloor 0,8 → skillCeiling 1,25 rozłożone na 4 tiery) i płacę według widełek kanonu (120–180 / 280–450 / 580–900 / 1 100–1 800 kr/dobę).

## Ustawienia przebiegu

- Skala **L**, horyzont **1 200 dób** (żeby było widać przekroczenie 1000), spread w wariancie **B** (pamięć zakupu, spread podstawowy 0), obcięcie nacisku włączone, informacja pełna.
- Bot rozszerzony o inwestycje: kupuje szczebel, gdy ma 1,5 × ceny; świadomie dowozi koszyki awansu, gdy to opłacalne w perspektywie, a nie tylko na kurs; zatrudnia i trzyma załogantów, żeby zbierali XP.
- 50 ziaren.

## Miary

1. Doby do każdego kamienia milowego: mediana i zakres 10–90%. Kamienie: każdy szczebel kadłuba 1–5, pierwsza cywilizacja na T2/T3/T4, połowa i wszystkie cywilizacje na T4, pierwszy załogant na każdym tierze, cała załoga na Legendzie.
2. Odsetek ziaren, które osiągają maksimum w każdej osi do doby 1000.
3. **Przegląd parametrów:** dla `progAwansu`, `k` i `xpNaDobeLotu` znajdź wartości, przy których mediana dób do maksimum danej osi wypada w przedziale 900–1100. Podaj je jako tabelę (parametr → doby do maksimum dla kilku wartości).
4. **Stabilność gospodarki przez 1 200 dób:** czy zamożność cywilizacji nie ucieka (wzrost w d600–1200 ≤ wzrost w d0–600), zero NaN, bez dodawania nowych sufitów.
5. Krzywa wartości firmy w czasie (mediana co 100 dób), żeby było widać, czy gra nie „kończy się” ekonomicznie dużo wcześniej niż w 1000 dobie.

## Testy

Wszystkie dotychczasowe testy zielone. Nowe: awans tieru tylko przez dostawę gracza; cena szczebla rośnie z przychodem; XP i tier załogi zgodne z progami kanonu; determinizm na 1 200 dób.

## Czego nie robić

Nie zmieniasz liczb kanonu (paliwo, ceny bazowe, progi XP, widełki płac, TierCount). Nie dodajesz walki, zdarzeń losowych ani fabuły. Każdy nowy parametr spoza kanonu trafia do `prototyp.json` i DECYZJE.

## Wynik

Sekcja „Progresja: 1000 dób” w `DECYZJE.md`:
- odpowiedź w jednym zdaniu dla każdej osi: czy maksimum jest osiągalne w ok. 1000 dób przy obecnym kanonie;
- tabela przeglądu parametrów z wartościami dającymi ok. 1000 dób;
- które liczby kanonu wymusza ten cel (np. 9 999 XP Legendy przy zmierzonym tempie XP);
- czy gospodarka jest stabilna przez 1 200 dób bez sufitów.

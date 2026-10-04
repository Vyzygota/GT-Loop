# GalaxyTrader: Pętla — test: pamięć zakupu zamiast stałego spreadu

Pracujesz na gałęzi PR #1 (`claude/blissful-planck-r8yb9d`). Przeczytaj `DECYZJE.md` (zwłaszcza punkty 8 i 44) i kod `sim/`. Pracuj z pluginem **planning with files**: na starcie załóż `task_plan.md` (fazy), `findings.md` i `progress.md` i aktualizuj je po każdej fazie. Pracuj samodzielnie, bez pytań. Commituj po każdym działającym kroku, na końcu push na tę samą gałąź.

## Hipoteza

Dziś `tradeSpread` = 0,3 działa jako stały spread kupno/sprzedaż na **każdej** transakcji (DECYZJE pkt 8). Kanon gry przewiduje 0,3 wyłącznie jako karę za odsprzedaż w miejscu zakupu (`OnePlanetBuySellPriceSpread`). Stały spread to haracz niezależny od dystansu, który zjada marże. Sprawdzamy, czy po jego usunięciu dalekie trasy zaczynają się opłacać (korelacja zysku na dobę z dystansem ≥ 0), czy barierą jest samo paliwo (DECYZJE pkt 44).

## Model pamięci zakupu (rozstrzygnięcie projektanta, 01.09)

- Pamięć jest per statek, egzekucja per firma (w prototypie firma = jeden statek).
- Wpis pamięci: (towar, planeta, licznik skoków). Przy każdym zakupie licznik dla tej pary ustawia się na 5. Każdy wykonany skok (krawędź grafu) zmniejsza wszystkie liczniki o 1.
- Pamięć **nie przechowuje ceny kupna**.
- Dopóki licznik danej pary jest większy od zera, sprzedaż tego towaru na tej planecie podlega karze `OnePlanetBuySellPriceSpread` = 0,3 (liczba kanonu, w `kanon.json` jako `tradeSpread`).
- Poza tym kupno i sprzedaż mają **podstawowy spread** (pole w `prototyp.json`). Jego wartość w kanonie jest jeszcze nierozstrzygnięta (0 albo 0,10), dlatego mierzysz oba warianty.
- Kształt kary w czasie nie jest rozstrzygnięty, więc mierzysz dwa warianty: **schodek** (pełne 0,3, dopóki licznik > 0) i **liniowy** (0,3 × licznik / 5).
- Handlowiec przesuwa cenę tylko w oknie podstawowego spreadu. Przy spreadzie 0 nie ma na co wpływać; opisz ten skutek dla załogi w DECYZJE.

## Warianty do zmierzenia (przełącznik `spread` w `prototyp.json`)

| Wariant | Opis |
|---|---|
| A | dzisiejszy stały spread 0,3 (punkt odniesienia, bez zmian w kodzie zachowania) |
| B | pamięć zakupu, podstawowy spread 0, kara schodkowa |
| C | pamięć zakupu, podstawowy spread 0,10, kara schodkowa |
| D | pamięć zakupu, podstawowy spread 0, kara liniowa |

Domyślny wariant gry zostaw na A, dopóki projektant nie zdecyduje.

## Miary

Bot zna regułę pamięci (nie planuje odsprzedaży w miejscu zakupu z karą, chyba że mimo kary się opłaca). Uruchom wszystkie warianty dla S i M po 200 ziaren oraz L po 50, tylko tryb `informacja = pelna`.

Dla każdego wariantu i skali wypisz:

1. wszystkie miary z dotychczasowej tabeli bota,
2. korelację zysku na dobę z dystansem: na poziomie lotu i całej trasy handlowej (zakup → cel),
3. tę samą korelację osobno dla każdego towaru,
4. udział paliwa w kosztach lotów,
5. medianę dystansu zyskownej trasy handlowej między cywilizacjami,
6. ile pc paliwa pokrywa mediana marży z pełnej ładowni, dla każdego towaru (odpowiednik „ok. 150 pc” z pkt 44).

## Testy

- Wszystkie dotychczasowe testy zielone w wariancie A.
- Nowe niezmienniki dla B, C i D:
  - sprzedaż w miejscu zakupu, dopóki licznik > 0, nigdy nie daje zysku, dla każdego towaru i każdej załogi;
  - po 5 skokach kara wynosi zero;
  - pamięć nie przechowuje ceny kupna;
  - determinizm.

## Czego nie robić

Nie zmieniasz liczb kanonu, paliwa, wymiany NPC, głębokości portów, profili cywilizacji ani geometrii galaktyki. Jedyna zmiana zachowania to spread. Jeśli któryś wariant wymaga strojenia, żeby bot w ogóle działał, opisz to, zamiast stroić.

## Wynik

Sekcja „Spread: pamięć zakupu” w `DECYZJE.md`:

- tabela 4 wariantów × 3 skal,
- odpowiedź w jednym zdaniu: czy usunięcie stałego spreadu odwraca znak korelacji z dystansem, i w którym wariancie;
- jeśli nie odwraca: która liczba kanonu blokuje dalekie trasy i o ile musiałaby się zmienić, żeby korelacja wyszła ≥ 0 (tylko obliczenie, bez zmiany kanonu);
- skutek dla roli handlowca i dla kryterium „obrót na jednej planecie nie daje zysku”.

Commit i push na gałąź PR #1, aktualizacja opisu PR.

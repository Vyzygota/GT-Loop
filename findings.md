# Ustalenia (findings)

## Faza 1: rozpoznanie

- Dziś `tradeSpread` = 0,3 jest wszyty w `mnoznikKupna`/`mnoznikSprzedazy` (`sim/rynek.ts`) i stosowany na każdej transakcji: kupno = baza × 1,15, sprzedaż = baza × 0,85 (bez handlowca). Handlowiec przesuwa cenę w tym oknie (DECYZJE 8).
- Cena krańcowa: zakup q podnosi cenę (zapas spada), sprzedaż q obniża ją; kupno i natychmiastowa sprzedaż tej samej ilości na tej samej planecie przy spreadzie 0 daje dokładnie zero (ta sama całka), więc „obrót na jednej planecie nie daje zysku” wymaga kary tylko dlatego, że między zakupem a sprzedażą rynek może się ruszyć (konsumpcja, NPC) albo gracz może sprzedać część po lepszej cenie krańcowej, niż kupił całość.
- Bot wycenia transakcje bezpośrednio funkcjami `kwotaKupnaWU`/`kwotaSprzedazyWU` w `bot/strategia.ts` (klasa `Kontekst`), więc musi dostać spread podstawowy i karę z gry; graf tankowania zna dystanse odcinków, ale nie liczbę skoków — trzeba ją dodać, bo licznik pamięci maleje o skok.
- DECYZJE 44: przy stałym spreadzie pełna ładownia żywności (151 200 WU) pokrywa paliwo na ok. 150 pc; korelacja zysku/dobę z dystansem ujemna w każdym wariancie strojenia.

## Fazy 2–5: implementacja

- Kara mnoży cenę sprzedaży: sprzedaż = baza × (1 − spread podstawowy/2 × (1 − udział handlowca)) × (1 − kara). Przy spreadzie 0 kupno = sprzedaż = baza, więc natychmiastowa odsprzedaż tej samej ilości bez kary dawałaby dokładnie 0 (ta sama całka nacisku); z karą 0,3 daje stratę. Test sprawdza to dla każdego towaru, trzech ilości (1 m³, połowa, maksimum), trzech załóg (bez handlowca, handlowiec 0,8 i 1,25) w S i M.
- Pamięć zakupu jest ustawiana także w wariancie A (tanio, nie zmienia zachowania: w A kara zawsze 0), dzięki czemu kod ma jedną ścieżkę.
- Bot zna regułę: licznik pamięci jest rzutowany w przód o liczbę skoków trasy (`Dojazd.skoki` z grafu tankowania), więc plan powrotu na planetę zakupu w ciągu 5 skoków dostaje cenę z karą. W planach z klastrem dystrybucji wszystkie planety klastra dostają ten sam rzut skoków (przybliżenie).
- Przy spreadzie podstawowym 0 handlowiec nie zmienia żadnej ceny (test): rola traci sens ekonomiczny w wariantach B i D; w C działa w oknie 0,10 (najlepszy przesuwa cenę o 80% połowy okna, czyli 4%).

## Faza 7: co blokuje dodatnią korelację zysku/dobę z dystansem (eksperymenty w procesie, bez zmiany kanonu w repo)

Skala M, 40 ziaren, `informacja = pelna`, miary po trasach wykonanych przez bota (lot / cała trasa handlowa):

| Zmiana liczby kanonu (hipotetyczna) | A: lot / trasa | B: lot / trasa |
|---|---|---|
| kanon bez zmian | −0,34 / −0,38 | −0,36 / −0,40 |
| BasePrice Fuel × 0,5 | −0,34 / −0,44 | −0,37 / −0,42 |
| BasePrice Fuel × 0,1 | −0,42 / −0,52 | −0,41 / −0,46 |
| BasePrice Fuel = 0 (paliwo za darmo) | −0,37 / −0,48 | −0,35 / −0,46 |
| kosztPaliwaNaParsek = 0 | −0,38 / −0,51 | −0,39 / −0,48 |
| nacisk 0,2–5,0 zamiast 0,45–2,5 | | −0,37 / −0,38 |
| ładownia ×3 (i masa ×3) | | −0,34 / −0,39 |
| kapitał startowy ×3 | | −0,36 / −0,40 |
| prędkość nominalna ×2 | | −0,33 / −0,36 |
| bak ×3 | | −0,34 / −0,38 |
| paliwo 0 + nacisk 0,2–5 + ładownia ×3 + kapitał ×3 | | −0,36 / −0,45 |

Wniosek: **żadna pojedyncza liczba kanonu (ani ich łączna zmiana) nie odwraca znaku**. Usunięcie paliwa podnosi medianę wartości (×2,4 → ×3,0) i wydłuża trasy (48 → 55 pc), ale korelacja per dobę zostaje ujemna. DECYZJE 44 wymaga poprawki: paliwo ogranicza, *które* trasy są opłacalne (masowe towary tylko na krótko), ale nie jest przyczyną ujemnej korelacji.

Mechanizm: zysk na kurs jest ograniczony z góry (ładownia × różnica cen w paśmie nacisku 0,45–2,5, kapitał, głębokość portu docelowego), a czas kursu rośnie liniowo z dystansem, więc stopa na dobę ~ marża/dystans maleje z dystansem, chyba że różnica cen rosłaby z dystansem szybciej niż liniowo. Tak nie jest, bo w M terytoria są przyległe i skrajne ceny (Orak, deficyty Corrath) osiąga się już na granicy terytoriów. Do tego dochodzi selekcja: bot wybiera plan o najwyższej stopie, więc długie kursy są wykonywane wtedy, gdy krótkie są wyczerpane, czyli przy niskiej stopie. Dlatego pełny pomiar ma też korelację po **wszystkich dostępnych planach** w dokach (nie tylko wybranych): stopa na dobę vs dystans i zysk na kurs vs dystans.


## Faza 6 i v2 (wariant E): co mówią pomiary

- Żaden z wariantów B–E nie odwraca znaku korelacji zysku/dobę z dystansem (lot −0,29…−0,44, trasa −0,33…−0,45). Usunięcie spreadu daje +3…+17% mediany wartości i w M pierwszą zyskowną trasę po 1 locie zamiast 2.
- Wariant E (nacisk bez obcięcia, do 5,8) podnosi wartość najmocniej (M ×3,03, L ×5,80), ale **koncentruje handel lokalnie**: w M loty wewnątrz cywilizacji 67% (A: 58%), trasy między cywilizacjami 36% (A: 47%). Zdjęcie sufitu nagradza sprzedaż do pustych portów blisko granicy, nie dalekie trasy.
- Paradoks Simpsona: wewnątrz jednego towaru korelacja na poziomie lotu jest dodatnia (M/A: minerały +0,35, rozpuszczalniki +0,53, materiały wybuchowe +0,79, elektronika +0,49; żywność dopiero po usunięciu spreadu +0,18), ale mieszanka towarów (tania żywność na długich lotach pozycjonujących, drogie towary na krótkich odcinkach dystrybucji) daje ogólną korelację ujemną. Na poziomie całej trasy handlowej korelacja jest ujemna także wewnątrz towaru.
- Przegląd paliwa na L: zysk na kurs po dostępnych planach przechodzi przez zero między ×0,1 a ×0,03 ceny kanonu (A: −0,16 → +0,07; B: −0,06 → +0,11); zysk na dobę zostaje ujemny (≈ −0,43) nawet przy paliwie 0.
- Korekta DECYZJE 44: paliwo nie jest przyczyną ujemnej korelacji per dobę.

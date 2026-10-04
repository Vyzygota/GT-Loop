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

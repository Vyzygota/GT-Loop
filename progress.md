# Dziennik (progress)

- [x] Faza 1: rozpoznanie — `tradeSpread` wszyty w `rynek.ts`, bot wycenia bezpośrednio funkcjami rynku, graf tankowania bez liczby skoków.
- [x] Faza 2: model w symulacji — przełącznik `spread` (A/B/C/D), `pamiecZakupu` w stanie gry (klucz „planeta|towar” → licznik), licznik 5 przy zakupie, −1 za skok w `lec`, `karaSprzedazy` (schodek/liniowa), spread podstawowy w mnożnikach, linia „Kara za odsprzedaż w miejscu zakupu” w raporcie (suma linii nadal = zmiana salda).
- [x] Faza 3: bot i miary — skoki w grafie tankowania (`Dojazd.skoki`), wyceny z karą i spreadem podstawowym w `Kontekst`, nowe miary (korelacje per towar, udział paliwa, mediana dystansu zyskownej trasy między cywilizacjami, pc paliwa z mediany marży pełnej ładowni), CLI: `npm run bot -- all pelna - all`.
- [x] Faza 4: testy — 47 zielonych (28 dotychczasowych w A + 19 nowych: brak zysku z odsprzedaży dla każdego towaru i załogi w S i M, kara po 5 skokach = 0 i kształt kary po 2 skokach, pamięć bez ceny, determinizm, linia kary w raporcie, handlowiec tylko w oknie spreadu podstawowego).
- [x] Faza 5: UI — przełącznik `spread` w nagłówku i adresie, kara i licznik w doku, opis w pomocy; smoke na M w wariancie B: 21 lotów, UI zgodne z symulacją co do 1 kr.
- [ ] Faza 6: pomiary 4 × 3 — w toku (tło, ok. 9 min).
- [ ] Faza 7: obliczenie paliwa — w toku.
- [ ] Faza 8: DECYZJE, push, PR.

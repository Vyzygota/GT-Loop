# Dziennik (progress) — progresja

- [x] Faza 1: rozpoznanie — notatki w `findings.md`.
- [ ] Faza 2: kanon i przełącznik.
- [ ] Faza 3: model w symulacji (tier cywilizacji, drabina, XP).
- [ ] Faza 4: bot z inwestycjami.
- [ ] Faza 5: testy.
- [ ] Faza 6: UI i smoke.
- [ ] Faza 7: pomiary i przegląd parametrów.
- [ ] Faza 8: DECYZJE, push, opis PR.

---

# Archiwum: dziennik zadania spread

## Dziennik (progress)

- [x] Faza 1: rozpoznanie — `tradeSpread` wszyty w `rynek.ts`, bot wycenia bezpośrednio funkcjami rynku, graf tankowania bez liczby skoków.
- [x] Faza 2: model w symulacji — przełącznik `spread` (A/B/C/D), `pamiecZakupu` w stanie gry (klucz „planeta|towar” → licznik), licznik 5 przy zakupie, −1 za skok w `lec`, `karaSprzedazy` (schodek/liniowa), spread podstawowy w mnożnikach, linia „Kara za odsprzedaż w miejscu zakupu” w raporcie (suma linii nadal = zmiana salda).
- [x] Faza 3: bot i miary — skoki w grafie tankowania (`Dojazd.skoki`), wyceny z karą i spreadem podstawowym w `Kontekst`, nowe miary (korelacje per towar, udział paliwa, mediana dystansu zyskownej trasy między cywilizacjami, pc paliwa z mediany marży pełnej ładowni), CLI: `npm run bot -- all pelna - all`.
- [x] Faza 4: testy — 47 zielonych (28 dotychczasowych w A + 19 nowych: brak zysku z odsprzedaży dla każdego towaru i załogi w S i M, kara po 5 skokach = 0 i kształt kary po 2 skokach, pamięć bez ceny, determinizm, linia kary w raporcie, handlowiec tylko w oknie spreadu podstawowego).
- [x] Faza 5: UI — przełącznik `spread` w nagłówku i adresie, kara i licznik w doku, opis w pomocy; smoke na M w wariancie B: 21 lotów, UI zgodne z symulacją co do 1 kr.
- [x] Faza 6: pomiary 4 × 3 — 9,5 min; tabela wstawiona do DECYZJE.md (sekcja „Spread: pamięć zakupu”).
- [x] Faza 7: obliczenie paliwa — przegląd `BasePrice Fuel`/`kosztPaliwaNaParsek` × {1…0} oraz hipotetyczne zmiany pasma nacisku, ładowni, kapitału, prędkości i baku na M (`findings.md`); przegląd paliwa na L (A i B) zapisany w DECYZJE 58.
- [x] Faza 8: DECYZJE, push, PR (patrz niżej).

## v2 promptu (PROMPT-spread_2.md): wariant E

- [x] Model: parametr `obciecie` w `nacisk`/`calkaNacisku`/wycenach (domyślnie włączony, A–D bez zmian); gra niesie `obciecieNacisku`, bot i UI go przekazują.
- [x] Testy: niezmienniki B/C/D rozszerzone na E, test zakresu nacisku bez obcięcia i całki.
- [x] Pomiary 5 × 3 — 12 min, tabela w DECYZJE.md.
- [x] DECYZJE: tabela 5 × 3, skrót, odpowiedzi 55–58 z uwzględnieniem E, przegląd paliwa na L.
- [x] Faza 8: push na gałąź PR #1, opis PR zaktualizowany.

# Dziennik (progress) — runda 3

- [x] Faza 1: rozpoznanie — notatki w `findings.md`.
- [x] Faza 2: przełącznik `runda3` (+ `paliwo`, `bramkaTowaru`, `pamiecFloty`), liczby kanonu statku i `SectorMinTier` w `kanon.json`, stan floty `stan.statki[]` z aktywnym statkiem (dotychczasowe pola to widok), moduły per szczebel, obsada, pamięć floty, okna stoczni, `kupStatek`, poziomy firmy.
- [x] Faza 3: `sim/lot.ts` (postać zamknięta R i D, zasięgi), lot jako start → przewinięcie czasu → przylot (czas ciągły, statki asynchroniczne, raport sumuje się do przepływów statku), pusty bak na starcie; 6 testów kontrolnych zielonych, 66 dotychczasowych bez zmian.
- [x] Faza 4: `rynkiGalaktyki` w trybie rundy 3: konsumpcja z ludności (populacja planety × koszyk T1), sektory z `SectorMinTier` (mapowanie w `prototyp.json`), bramka G (`dostepny`) / P, bez głębokości portu; `mnoznikSpecjalizacji` w pozycji rynku do otwierania sektorów.
- [x] Faza 5: `stan.rozwoj` (Z₀ z kalibrowanego PkbToWaterUnits, nadwyżka od ostatniego awansu, kontrakt), gotowość w upływie czasu, receptura, naukowiec (40 m³, nie z akademii), `dostarczKontrakt` w stolicy, awans otwiera sektory i mnoży koszyk; 5 nowych testów.
- [x] Faza 6: w modelu: poziomy firmy (`progFirmy`), `kupStatek`, tier stoczni per szczebel, okna stoczni, pamięć floty A/B/C (`licznikPamieci`), czas ciągły (`wystartuj`/`nastepnyPrzylot`/`czekaj`).
- [ ] Faza 7: bot floty.
- [ ] Faza 8: testy.
- [ ] Faza 9: pomiary (siatka 12 × 30 ziaren, przegląd k).
- [ ] Faza 10: DECYZJE, push, opis PR.

---

# Archiwum: dziennik zadania progresja

## Dziennik (progress) — progresja

- [x] Faza 1: rozpoznanie — notatki w `findings.md`.
- [x] Faza 2: kanon i przełącznik — `kanon.json`: `TierCount` 4, `tierZalogi` (progi 0/500/1500/9999 XP, widełki płac), `drabinaKadlubow` (6 szczebli, proponowane); `prototyp.json`: blok `progresja` (wyłączona domyślnie, horyzont 1 200, `progAwansu`, koszyki T2–T4, `mnoznikKonsumpcjiAwansu`, `mnoznikSzczebla`, `k`, `minKursowDoWycenySzczebla`, `xpNaDobeLotu`, `xpZaKontakt`, nazwy tierów) i parametry bota (`mnoznikGotowkiNaSzczebel`, premia awansu, `maxKosztDobyXpKr`, ekspedycje).
- [x] Faza 3: model — `Gra`: `ladownia()/bak()/maxMasa()` ze szczebla, `wycenaSzczebla()/kupSzczebel()` (k × mediana zysku na kurs mierzonego przez grę: kurs = loty między dokami ze sprzedażą), `postepAwansu()/tierCywilizacji()` z dostawami liczonymi po cenie bazowej tylko dla towaru kupionego u innej cywilizacji (pochodzenie ładunku), awans mnoży konsumpcję i normę koszyka; XP w `lec` (doby × `xpNaDobeLotu`, kontakt `xpZaKontakt`), tier/umiejętność/płaca z `zaloga.ts`; linie raportu `stocznia` i `awans`, kamienie milowe w `stan.kamienie`.
- [x] Faza 4: bot — ładownia/bak z gry, graf tankowania per szczebel, `inwestuj()` (szczebel przy 1,5 × ceny w stolicy), premia perspektywiczna za dostawy koszyka (własne marże bota, pułap 1 × cena bazowa/m³, strażnik 10% gotówki), polityka załogi „zatrudniaj i trzymaj” (tolerancja 500 kr/dobę), ekspedycje co 100 dób do najbliższej nieznanej cywilizacji przy gotówce ≥ 2 × koszt.
- [x] Faza 5: testy — 66 zielonych (55 dotychczasowych + 11 nowych w `tests/progresja.test.ts`).
- [x] Faza 6: UI (przełącznik, stocznia, tiery i koszyki, XP) i smoke z parametrem progresji.
- [x] Faza 7: pomiary — pierwszy przegląd (6–10 bankructw na 50) → pięć poprawek bota (`findings.md`, faza 7a) → przeglądy `progAwansu`/`k`/`xpNaDobeLotu` po 50 ziaren, sonda drabiny (20 ziaren × 5 wariantów reguł), pomiar główny 50 ziaren przy `progAwansu` 0,25, `k` 5, `xpNaDobeLotu` 11 (3 bankructwa na 50).
- [x] Faza 8: sekcja „Progresja: 1000 dób” w DECYZJE.md (założenia 59–68, tabele, odpowiedzi 69–74), push, opis PR.

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

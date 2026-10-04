# Plan: PROMPT-spread_1.md — pamięć zakupu zamiast stałego spreadu

Gałąź: `claude/blissful-planck-r8yb9d` (PR #1). Pliki robocze: `task_plan.md` (ten plan), `findings.md` (ustalenia), `progress.md` (dziennik).

## Fazy

1. **Rozpoznanie** — DECYZJE pkt 8 (handlowiec w oknie spreadu) i 44 (paliwo blokuje korelację), miejsca w `sim/` gdzie działa `tradeSpread`: `rynek.ts` (mnożniki, całki), `gra.ts` (ceny, wyceny, kup/sprzedaj, raport), bot (`Kontekst`), testy (niezmiennik spreadu).
2. **Model w symulacji** — przełącznik `spread` (A/B/C/D) w `prototyp.json`, pamięć (towar, planeta, licznik) w stanie gry, licznik 5 przy zakupie, −1 za każdy skok, kara 0,3 (schodek) albo 0,3 × licznik/5 (liniowa) na sprzedaży w miejscu zakupu, spread podstawowy 0 albo 0,10, handlowiec tylko w oknie spreadu podstawowego, linia kary w raporcie.
3. **Bot zna regułę** — skoki w grafie tankowania, wyceny z karą i spreadem podstawowym, nowe miary (korelacje per towar, udział paliwa w kosztach, mediana dystansu zyskownej trasy między cywilizacjami, pc paliwa pokrywane medianą marży z pełnej ładowni), CLI z wariantem.
4. **Testy** — dotychczasowe zielone w A; nowe: odsprzedaż w miejscu zakupu nie daje zysku (każdy towar, każda załoga), po 5 skokach kara 0, pamięć bez ceny, determinizm.
5. **UI** — przełącznik wariantu, kara widoczna w doku i w raporcie; smoke z wariantem.
6. **Pomiary** — 4 warianty × S/M (200) × L (50), `informacja = pelna`.
7. **Obliczenie** — jeśli korelacja nie zmienia znaku: o ile musiałoby zmienić się paliwo kanonu (pomiar w skrypcie, bez zmiany kanonu).
8. **Wynik** — sekcja „Spread: pamięć zakupu” w DECYZJE.md, commit, push, opis PR.

## Kryteria ukończenia

- `npm test` zielone (A + nowe niezmienniki B/C/D).
- Tabela 4 × 3 w DECYZJE z odpowiedzią o znaku korelacji, liczbą kanonu i skutkiem dla handlowca.
- Domyślny wariant gry: A.

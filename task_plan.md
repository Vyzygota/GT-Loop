# Plan: PROMPT-progresja.md — czy pełna progresja mieści się w ok. 1000 dobach

Gałąź: `claude/blissful-planck-r8yb9d` (PR #1). Pliki robocze: `task_plan.md` (ten plan), `findings.md` (ustalenia), `progress.md` (dziennik). Poprzednie zadanie (spread) w archiwum na końcu każdego pliku.

## Fazy

1. **Rozpoznanie** — DECYZJE (Galaktyka 26–46, Spread 47–58), `sim/gra.ts`, `sim/zaloga.ts`, `bot/strategia.ts`: gdzie siedzą ładownia/bak/masa (`K.*`), kandydaci, płace, horyzont; jak bot wycenia plany i załogę.
2. **Kanon i przełącznik** — nowe liczby kanonu w `kanon.json` (TierCount 4, progi XP 0/500/1500/9999, widełki płac tierów, drabina 6 szczebli — status proponowane), przełącznik `progresja` (domyślnie wyłączony, żeby dotychczasowe pomiary zostały odtwarzalne) i parametry w `prototyp.json` (`progAwansu`, koszyki tierów, `mnoznikSzczebla`, `k`, `xpNaDobeLotu`, `xpZaKontakt`, horyzont 1 200).
3. **Model w symulacji** — (a) tier cywilizacji: licznik dostaw koszyka per cywilizacja (wartość po cenie bazowej), awans przy ≥ `progAwansu` × dzienny PKB portów, awans mnoży konsumpcję towarów koszyka; (b) drabina kadłubów: `stan.szczebel`, ładownia/bak/masa × `mnoznikSzczebla`^N, cena = `k` × mediana zysku na kurs na bieżącym szczeblu (z raportów gry), kupno tylko w stolicy; (c) XP załogi: `xp`, `talent`, tier z progów kanonu, umiejętność z tieru i talentu, płaca z widełek tieru; linie raportu (stocznia, awans), suma linii = zmiana salda.
4. **Bot z inwestycjami** — ładownia/bak/masa z gry (nie z `K`), graf tankowania zależny od szczebla, kupno szczebla przy 1,5 × ceny w stolicy, premia perspektywiczna za dostawy koszyka (wartość dodatkowego popytu po awansie × pozostałe doby × udział), polityka załogi „zatrudniaj i trzymaj” (bez zwolnień i podmian, tolerowany koszt dnia XP).
5. **Testy** — dotychczasowe zielone (przełącznik wyłączony); nowe: awans tylko przez dostawę gracza, cena szczebla rośnie z przychodem, XP i tier zgodne z progami kanonu, determinizm na 1 200 dób, raport ze stocznią sumuje się.
6. **UI** — przełącznik w nagłówku i adresie, stocznia w doku stolicy, tier i postęp koszyka w panelu cywilizacji, XP/tier załogi, linie raportu; smoke w trybie progresji.
7. **Pomiary** — `npm run progresja`: L, 1 200 dób, B, pelna, 50 ziaren; kamienie milowe (mediana, 10–90%), odsetek maksimum do doby 1000, krzywa wartości co 100 dób, stabilność gospodarki (PKB d0/d600/d1200, NaN, pozycje na sufitach); przegląd `progAwansu`, `k`, `xpNaDobeLotu`.
8. **Wynik** — sekcja „Progresja: 1000 dób” w DECYZJE.md, README, commit, push, opis PR.

## Kryteria ukończenia

- `npm test` zielone (stare + nowe).
- Tabela kamieni milowych i tabela przeglądu parametrów w DECYZJE z odpowiedzią „tak/nie” per oś.
- Lista liczb kanonu, które cel 1000 dób wymusza; werdykt o stabilności gospodarki przez 1 200 dób.

---

# Archiwum: PROMPT-spread (zadanie poprzednie)

## Plan: PROMPT-spread_2.md (v2) — pamięć zakupu zamiast stałego spreadu

Gałąź: `claude/blissful-planck-r8yb9d` (PR #1). Pliki robocze: `task_plan.md` (ten plan), `findings.md` (ustalenia), `progress.md` (dziennik).

## Fazy

1. **Rozpoznanie** — DECYZJE pkt 8 (handlowiec w oknie spreadu) i 44 (paliwo blokuje korelację), miejsca w `sim/` gdzie działa `tradeSpread`: `rynek.ts` (mnożniki, całki), `gra.ts` (ceny, wyceny, kup/sprzedaj, raport), bot (`Kontekst`), testy (niezmiennik spreadu).
2. **Model w symulacji** — przełącznik `spread` (A/B/C/D/E; E = jak B bez obcięcia nacisku 0,45–2,5, v2 promptu) w `prototyp.json`, pamięć (towar, planeta, licznik) w stanie gry, licznik 5 przy zakupie, −1 za każdy skok, kara 0,3 (schodek) albo 0,3 × licznik/5 (liniowa) na sprzedaży w miejscu zakupu, spread podstawowy 0 albo 0,10, handlowiec tylko w oknie spreadu podstawowego, linia kary w raporcie.
3. **Bot zna regułę** — skoki w grafie tankowania, wyceny z karą i spreadem podstawowym, nowe miary (korelacje per towar, udział paliwa w kosztach, mediana dystansu zyskownej trasy między cywilizacjami, pc paliwa pokrywane medianą marży z pełnej ładowni), CLI z wariantem.
4. **Testy** — dotychczasowe zielone w A; nowe (B/C/D/E): odsprzedaż w miejscu zakupu nie daje zysku (każdy towar, każda załoga), po 5 skokach kara 0, pamięć bez ceny, determinizm.
5. **UI** — przełącznik wariantu, kara widoczna w doku i w raporcie; smoke z wariantem.
6. **Pomiary** — 5 wariantów × S/M (200) × L (50), `informacja = pelna`.
7. **Obliczenie** — jeśli korelacja nie zmienia znaku: o ile musiałoby zmienić się paliwo kanonu (pomiar w skrypcie, bez zmiany kanonu).
8. **Wynik** — sekcja „Spread: pamięć zakupu” w DECYZJE.md, commit, push, opis PR.

## Kryteria ukończenia

- `npm test` zielone (A + nowe niezmienniki B/C/D).
- Tabela 5 × 3 w DECYZJE z odpowiedzią o znaku korelacji, liczbą kanonu i skutkiem dla handlowca.
- Domyślny wariant gry: A.

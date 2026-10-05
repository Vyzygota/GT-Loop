# Ustalenia (findings) — runda 3

## Faza 1: rozpoznanie

- Lot: `Gra.sprawdzTrase/lec` liczą doby = dystans / (4 × pilot) i paliwo = dystans × 1 m³/pc × mnożnik nawigatora; masa statku nie istnieje w modelu. Graf tankowania bota zakłada stały zasięg odcinka (bak − 1) / koszt na pc.
- Rynek: `rynkiGalaktyki` liczy konsumpcję z `portNaUkladM3NaDobe` × potrzeby × waga układu × głębokość portu z otwartości; populacja planety (`populacjaMln`, 10³–10⁶ mln) nie wchodzi do konsumpcji. Przy `konsumpcjaNaMlnNaDobe` rzędu 0,8 m³ żywności na mln i dobę (profil świata S) cywilizacja Ludzi (15 mln mln) konsumuje ok. 12 mln m³ żywności dziennie, czyli 25 000 ładowni jedynki: rynek z ludności jest dla jednego statku bezdenny.
- Awans: w rundzie 2 koszyk był wymyślony (Elektronika / Elektronika + Materiały wybuchowe, próg = `progAwansu` × PKB). Kanon tej rundy: próg gotowości z Z₀ i k, kontrakt z naukowcem i akademią, sektory `SectorMinTier`.
- Jeden statek: cały stan (`pozycja`, `paliwo`, `ladownia`, `zaloga`, `pamiecZakupu`, `szczebel`) leży płasko w `stan`; UI, bot i testy czytają te pola bezpośrednio, więc flota wejdzie jako `stan.statki[]` z aktywnym statkiem, a dotychczasowe pola staną się widokiem na statek aktywny.
- Węzły L: 464 układy zamieszkiwalne (kanon) plus układy przelotowe wzdłuż szlaków (ok. 19 pc), razem rząd 1 000–1 200 węzłów; liczba 840 „układów jak w grze” jest między tymi dwiema liczbami (opis w DECYZJE po policzeniu).

## Fazy 2–6: model (L, pojedyncze ziarna)

- **Bramka G zerowała produkcję sektorów otwieranych tierem.** `rynkiGalaktyki` normalizowało mnożnik specjalizacji z sumy konsumpcji; przy G konsumpcja towarów zamkniętych sektorów wynosiła 0, więc normalizacja = 0 i po awansie Vreth na T2 minerały (produkcjaDoPotrzeb 2,6) miały zapas 0 na każdej planecie, a kontrakt T3 (16 m³ minerałów) nie miał źródła. Naprawa: normalizacja z konsumpcji potencjalnej (koszyk T1).
- **Receptura z towarem sąsiada dla każdego składnika** blokowała T3 na zawsze (żaden sąsiad nie był T2). Teraz towar sąsiada tylko dla towarów, które otwiera tier docelowy, i tylko gdy sąsiad już je produkuje.
- **Kontrakt większy niż ładownia** (Ludzie T2: 814 m³ żywności + 147 m³ rozpuszczalników przy 480 m³ ładowni szczebla 0) nie dawał się dostarczyć w jednym kursie → dostawy częściowe (`dostarczone`, `naukowiecWAkademii`), a ilość towaru w recepturze ograniczona do 960 m³ (T3 Ludzi żądało 1 563 m³ minerałów = 4,7 tys. t).
- **Raport lotu** musiał dostać linię na każdy zakup w oknie stoczni: przy skoku poziomu firmy statek kupował dwa kadłuby/statki w jednym doku, a `okres.kadlub` pamiętał tylko ostatni (suma linii ≠ przepływy).

## Faza 7: bot floty — co psuło pojedyncze ziarna (L, R i D, ziarna 1–4) i jaka reguła to naprawiła

1. **Klaster dystrybucji** (runda 1–2: ładunek rozwożony po sąsiadach celu, objazd liczony jako koszt). Na rynkach z ludności (norma w milionach m³) każdy plan dostawał koszt objazdu ok. 600 tys. kr, więc w dobie 0 żaden plan nie był dodatni → odwrót do stolicy Vreth 330 pc, a po drodze przewożone rozpuszczalniki (kupione 18,9 tys., sprzedawane 40,7 tys. kr/m³ w każdym deficytowym porcie Ludzi) jechały 150 dób. Po zmianie (klaster = sam cel) wahadło Raven ↔ Noralun (40 pc) daje 100–130 tys. kr/dobę i firma rośnie z 6,8 do 66 mln kr w 250 dób (ziarno 1, R).
2. **Drugi krok tylko po 25 najbliższych planetach celu i tylko dla 5 najlepszych planów stopy pierwszego kroku.** Ziarno 3 (D): start w regionie Ludzi bez lokalnych tras; jedyna pętla (Nonolun 80 pc: rozpuszczalniki 18,2 tys. → 40,7 tys. kr/m³) miała pierwszy krok −15,3 tys./dobę (gorszy niż puste loty do Corrath −13,4 tys.), więc nie była oceniana, a bot ping-pongował z żywnością do Vreth do bankructwa (doba 460). Po zmianie (powrót do doku startu w drugim kroku, 60 planów) ocena pętli = +195 tys./dobę; ziarno 3 kończy z 168–534 mln kr.
3. **Odwrót po jednym słabym doku** liczył „słabość” z pierwszego kroku: pusty statek w porcie bez towaru na sprzedaż ma ujemny pierwszy krok i dodatni kurs po nim. Teraz dok jest słaby, gdy nawet dwa kroki nie zarabiają.
4. **Trzy statki na tej samej ekspedycji** (ziarno 1, R: s1–s3 do Velhari-Arcasum 553 pc, 7–9 mln kr paliwa każdy, 250 dób) i ekspedycja statku z recepturą misji na pokładzie. Teraz jedna ekspedycja naraz w całej flocie (rytm liczony od ostatniej któregokolwiek statku), nie na misji, i tylko gdy przy obecnej masie trwa ≤ 150 dób (w D 530 pc pustym szczeblem 1 to 438 dób).
5. **Twarde wykluczenie celów innych statków** wysyłało statek z 840 m³ rozpuszczalników 122 pc do Venter, mijając Noralun (ten sam pułap ceny), bo tam leciał kolega. Teraz kara 10% oceny.
6. **Misje bez limitu czasu drogi**: kontrakt Corrath z Ludzi (860 pc po grafie tankowania, 694 doby z ładunkiem) był przyjmowany i wykonywany jako jedyny plan (−6,6 mln kr na etap) aż do bankructwa (ziarno 2, R). Teraz droga misji ≤ 240 dób z masą receptury, etap o stracie > 10% wartości firmy kończy misję.
7. **Masa receptury a zasięg (R)**: 840 m³ minerałów (2 520 t) na szczeblu 1 to 0,6 pc/dobę i 22 pc zasięgu na pełnym baku — akademia poza grafem tankowania, misja porzucana po 400 dobach. Teraz zakup receptury ograniczony do masy, z którą statek przeleci najdłuższy odcinek drogi do akademii z 15% zapasu; statek na misji sprzedaje ładunek handlowy przy przydziale.
8. **Źródło receptury z zapasem 0** (rynek deficytowy z produkcją, ale pustym zapasem) wybierane jako cel → statek wracał w kółko na 25 pc. Teraz źródło musi mieć zapas.
9. **Flota „utknięta”** (nikt nie leci przez 90 dób) przerywała przebieg przed horyzontem, a `uplywCzasu` nie kończyło gry po czasie → nieskończona pętla w teście determinizmu. Teraz czas płynie do horyzontu, a koniec gry zależy od doby.
10. **Czas obliczeń**: 60 planów z drugim krokiem to 60 Dijkstr po grafie tankowania na każdy dok (35–45 s na ziarno przy 8 statkach). Pamięć dojazdów między krokami (klucz: świat, start, zasięg odcinka zaokrąglony do 2 pc) daje 15 s na ziarno przy identycznych wynikach sond.

## Faza 7b: horyzont 4 800 dób (zmiana celu projektanta na ok. 4 000 dób) — co psuło długie przebiegi

11. **Misje T4 bez źródła**: przy 4 800 dobach kontrakty T4 Ludzi i Vreth wymagają 2 m³ rozpuszczalników i 1 m³ elektroniki, a rozpuszczalników nie ma w żadnej planecie Ludzi ani Vreth: oba profile kanonu są deficytowe (0,6 i 0,3), planety „ze specjalizacją” mają 1,21 × 0,6 = 0,73 produkcji do konsumpcji, a zapas, z którego bot handlował pierwsze setki dób, był zapasem startowym (norma = 30 dób), który wymiana NPC (sufit otwartość × konsumpcja) i koszyk T3 (×2) dociągają do zera. Źródłem zostają Corrath/Planta/AI (500+ pc). Szacunek drogi misji liczył tylko odległość stąd do źródła i stąd do akademii, więc 2 m³ z Corrath wyglądały jak zakup po sąsiedzku, a statek wracał 400 dób; teraz droga = stąd → źródło → akademia, a limity dób misji i ekspedycji rosną z wielkością floty (1 / 2–3 / 4–7 / 8 statków: misja 150 / 250 / 400 / 500 dób, ekspedycja 150 / 250 / 400 / 400).
12. **Ocena etapu misji liczyła recepturę jako stratę**: plan nie sprzedaje towarów zarezerwowanych, a odejmuje wartość całej ładowni, więc etap z 546 m³ minerałów na pokładzie wyglądał na stratę 8% wartości firmy i misja kończyła się „za drogo”. Teraz wartość receptury (po koszcie zakupu) wraca do oceny, a próg straty dzieli się przez liczbę statków (8 statków × 10% = 80% kasy w jednej turze).
13. **Wspólna kasa**: 8 statków wydawało całą gotówkę na ładunek i kadłuby, a statki w locie przez układy plemienne nie miały na paliwo (ziarno 4 R: 3 340 dób czekania, kasa 0,3 mln, ładownie warte 88 mln nie do sprzedania u plemion). Rezerwa = pełny bak każdego innego statku po cenie bazowej; pierwsza wersja (rezerwa jako warunek każdego planu) zablokowała całą flotę naraz przy 10 mln w kasie (ziarno 1 R: 3 455 dób czekania) — rezerwa ogranicza tylko zakupy, nie lot ze sprzedażą.
14. **Jeden statek na misjach 800-dobowych nie dojeżdżał po drugi statek** (ziarno 2 D: 4 800 dób z jednym statkiem i 43 mln w kasie, wahadło 20 pc przy 0,79 pc/dobę z minerałami na szczeblu 1): wyprawa do stoczni ma pierwszeństwo przed misją, a statek, który przy obecnej masie nie dojedzie do stoczni, odciąża się (sprzedaje ładunek).
15. **Ekspedycje przy 3 × koszt** bankrutowały flotę 2 statków w słabym regionie (ziarno 2 R: dwie ekspedycje w 100 dób, 34 → 7,6 mln); w rundzie 3 próg to 5 × koszt.
16. **Czas obliczeń**: profil 1 200 dób — 65% w drugim kroku planisty, 31% w Dijkstrze dojazdów (każdy cel inny start, zasięg z bieżącej masy = chybienia pamięci); dojazdy drugiego kroku liczone dla pustego statku (sprzedaż w celu) trafiają w pamięć: 10 s na 1 200 dób, 25–80 s na 4 800 dób z 8 statkami.

Po tych regułach ziarna 1, 2, 4 (R) i 2 (D) kończą 4 800 dób bez zastojów: 0,8–65 mld kr, 8 statków, 11–20 dostarczonych kontraktów, kontakt ze wszystkimi 9 cywilizacjami w 1 700–2 900 dób, 1–2 cywilizacje na T4 w 2 000–3 600 dób.

Po tych regułach ziarna 1–4 w R i D kończą 1 200 dób bez bankructwa (22–534 mln kr, 2–8 statków), z 2–4 awansami cywilizacji na T2 i pojedynczymi T3; o wyniku na 30 ziarnach — DECYZJE, sekcja „Runda 3”.

---

# Archiwum: ustalenia zadania progresja

## Ustalenia (findings) — progresja

## Faza 1: rozpoznanie

- Ładownia, bak i masa są dziś stałymi kanonu (`K.ladownia`, `K.bak`, `K.maxMasaLadunku`) używanymi w `gra.ts`, `bot/strategia.ts` (graf tankowania liczony raz na świat z `K.bak`), UI i testach; drabina kadłubów wymaga, by stały się funkcją stanu gry (szczebel), a graf tankowania zależał od szczebla.
- Kandydaci (`generujKandydatow`) losują umiejętność jednostajnie z [0,8; 1,25] i dostają płacę kanonu per rola (800/400/500); nie ma XP ani tierów. Tiery załogi z progami 0/500/1 500/9 999 XP i widełkami 120–180 / 280–450 / 580–900 / 1 100–1 800 kr/dobę zmieniają obie rzeczy, więc wprowadzam je pod przełącznikiem.
- Cywilizacje nie mają tieru ani wzrostu; jedyna zmiana popytu to kontakt (budzi konsumpcję Elektroniki). Dzienny „PKB” portów cywilizacji = Σ konsumpcja × cena bazowa ≈ 30–64 tys. WU na układ i dobę (głębokość portu 0,35–1), czyli dla Ludzi (19 układów) ok. 0,6 mln WU = 6 mln kr dziennie; pełna ładownia Elektroniki to 29 mln WU, a kapitał startowy 0,68 mln WU, więc o tempie awansów decyduje kapitał i głębokość portów, nie pojemność statku.
- Bot: jeden lot na L trwa medianowo ok. 14 dób (34 loty w 480 dób, 1,9 s na ziarno), więc 1 200 dób × 50 ziaren to ok. 4–5 min na konfigurację; przegląd 3 parametrów × 4 wartości mieści się w godzinie.
- Horyzont `limitDob` pochodzi ze skali (L 480); potrzebny jest osobny horyzont progresji (1 200) jako opcja gry.

## Fazy 2–6: co wyszło w trakcie implementacji (L, B, progresja, pojedyncze ziarna)

- **Premia awansu bez hamulca bankrutuje bota.** Pierwsza wersja wyceniała awans z domyślnej marży 0,3 ceny bazowej i rozkładała ją na potrzebną wartość koszyka; przy niskim `progAwansu` premia na m³ rosła bez ograniczeń i bot kupował Elektronikę po 613 tys. kr/m³, żeby ją „dostarczyć” ze stratą — ziarno 2 zbankrutowało w 228. dobie. Działa dopiero zestaw: marża z własnych sprzedaży bota (co najmniej 3), pułap premii 1 × cena bazowa na m³ i odrzucenie premii w planie, który spaliłby > 10% gotówki.
- **Zachłanna stopa na dobę nigdy nie eksploruje daleko.** Nawet z premią kontaktu skalowaną horyzontem i zasięgiem 650 pc bot kończył 1 200 dób znając 3 cywilizacje z 9 (pusty lot na 600–1 500 pc przegrywa z każdym kursem handlowym). Potrzebna była jawna polityka ekspedycji: co 100 dób zobowiązanie do najbliższej planety nieznanej cywilizacji, dopóki `doba ≤ 0,6 horyzontu` i gotówka z ładunkiem ≥ 2 × koszt paliwa i płac. Pierwsza wersja (bez warunku gotówki) ruszała w dobie 0 i bankrutowała na paliwie.
- **Odległości na L.** Z grafu tankowania (z karą przystanku 80 pc) najbliższa planeta Corrath leży 320–730 pc od startu, Velhari 580–900 pc, Szkarni 920–1 170 pc, Duhari 1 260–1 510 pc, AI 1 490–1 690 pc, Planta ok. 2 000 pc. Objazd 9 stolic najbliższym sąsiadem po grafie skoków to mediana ok. 4 550 pc = 1 140 dób przy 4 pc/dobę i 45 mln kr paliwa po cenie bazowej (kapitał startowy 6,8 mln). Bak 100 m³ nie jest przeszkodą: na szczeblu 0 graf tankowania sięga wszystkich 9 cywilizacji w 5 sprawdzonych ziarnach.
- **Drabina kadłubów.** Mediana zysku na kurs (0,4–0,9 mln kr) niemal nie rośnie ze szczeblem, choć ładownia rośnie ×1,5 na szczebel: na płytkich rynkach portowych zysk kursu ogranicza głębokość portu docelowego, nie pojemność statku, więc większy kadłub kupuje głównie bak (dłuższe odcinki) i możliwość wiezienia kilku towarów naraz.
- **Załoga.** Przy `xpNaDobeLotu` = 2 wszyscy czterej załoganci kończą 1 200 dób z ok. 2 300–2 400 XP (tier Mistrz od ok. 760. doby); Legenda (9 999 XP) wymagałaby ok. 5 000 dób lotu. Bot nie zatrudnia pilotów: nowicjusz ma umiejętność 0,80–0,91, więc spowalnia statek o 9–20%, a tolerancja kosztu dnia XP (500 kr) tego nie pokrywa; zatrudnia nawigatorów i handlowców (w B handlowiec nic nie daje, ale nie szkodzi).
- **Pierwsze pomiary (3 ziarna, `progAwansu` 20):** udział pozycji rynku na sufitach (zapas 0 albo 6 norm) rośnie z 19% w dobie 0 do 45% w dobie 600 i 47% w dobie 1 200, bez NaN; dzienny PKB portów stały (bez awansów), wartość zapasów ×1,79 w d0–600 i ×0,99 w d600–1200.

## Faza 7a: bankructwa bota w pierwszym przeglądzie (6–10 ziaren na 50) i ich przyczyny

Pierwszy przegląd `k`/`progAwansu`/`xpNaDobeLotu` (50 ziaren każdy) miał 3–10 ziaren „utknął” na konfigurację. Ślady ostatnich lotów pokazały pięć osobnych mechanizmów, każdy naprawiony regułą bota (nie zmianą świata):

1. **Kadłub kupiony w trakcie ekspedycji** (ziarno 29: szczebel 1 za 13,1 mln w stolicy Velhari, potem 740 pc pustego lotu z 5,9 mln) → `inwestuj` nie kupuje, gdy trwa ekspedycja; po drodze bot sprawdza na każdym przystanku, czy gotówka pokrywa 1,3 × resztę drogi, inaczej przerywa ekspedycję.
2. **„Dotankuj do pełna, gdy cena ≤ bazowa” z bakiem 338 m³** (ziarno 8: 191 m³ po 10 000 kr u plemion = cała gotówka, ładunek elektroniki za 3,8 mln nie do sprzedania u plemion) → w progresji dotankowanie zostawia rezerwę na paliwo i płace całej trasy.
3. **Plany, na które nie starcza gotówki** (przychód w celu miał zapłacić za paliwo po drodze) → plan z ujemną gotówką po sprzedaży tutaj i kosztach trasy jest odrzucany. Przy okazji wycena paliwa odcinek po odcinku (znana cena w węźle startu odcinka zamiast ceny bazowej dla wszystkich dalszych), bo cena bazowa zawyżała dwukrotnie koszt tras przez planety (4 500 kr/m³ w regionie startowym) i odcinała ucieczkę z ubogich regionów.
4. **Premia awansu za częściowe dostawy przy nieosiągalnym koszyku** (ziarno 44: w Duhari przy `progAwansu` 20 bot kupował elektronikę po 220 tys. kr straty, żeby dostać 700 tys. „premii” za 1% koszyka) → premia tylko, gdy reszta koszyka po cenie bazowej ≤ 2 × majątek bota.
5. **Wyprawa do stoczni w regionie bez zyskownych tras** (ziarno 19: po dotarciu do Velhari z 7,8 mln bot pojechał do jej stolicy i kupił szczebel 2 za 3,7 mln; powrót do Vreth kosztował 5,7 mln paliwa, więc został i krążył po Velhari po −30 tys. kr/dobę) → kadłub tylko, gdy po zakupie zostaje budżet wyjścia (pusty lot do stolicy innej cywilizacji); odwrót do najbliższej stolicy innej cywilizacji już po pierwszym doku bez dodatniego planu, z pierwszeństwem przed wyprawą do stoczni.

Po poprawkach: 2 bankructwa na 50 (ziarna 17 i 34, oba po drugiej z rzędu ekspedycji do Duhari, skąd powrót kosztuje więcej niż zostaje w kasie). Mediana wartości końcowej (kr + ładunek) 15,5 mln przy `progAwansu` 20, `k` 10, `xp` 2. Lekcja o kanonie: pusty przelot 700 pc kosztuje ok. 7 mln kr paliwa (1 m³/pc × 10 000 kr u plemion), czyli więcej niż kapitał startowy, a regiony eksportowe (Velhari: elektronika i materiały wybuchowe 2,2–2,4 × potrzeb) nie mają dla samotnego kupca lokalnych tras pokrywających paliwo 7,7 tys. kr/m³ — zarabia się na nich tylko kursem do domu, na który trzeba mieć gotówkę na paliwo **i** ładunek jednocześnie.

## Faza 7b: wynik pomiarów (szczegóły i tabele w DECYZJE, sekcja „Progresja: 1000 dób”)

- **Galaktyka**: 0/50 ziaren z wszystkimi (albo połową) cywilizacji na T4; mediana znanych cywilizacji po 1 200 dobach 4 z 9; pierwsza cywilizacja na T4 w medianie 688 dób przy `progAwansu` 0,25. Objazd 9 stolic = 4 253 pc = 1 063 doby lotu i 42,5 mln kr paliwa; to kanon prędkości, promienia i paliwa, nie próg awansu.
- **Firma**: szczebel 5 w medianie 1 123 dób (34% do 1 000) przy `k` 5; `k` 1…5 daje te same doby (cena nie jest wąskim gardłem), bez ekspedycji drabina kończy się w ok. 740 dób.
- **Załoga**: cała czwórka na Legendzie w 972 dób przy `xpNaDobeLotu` 11 (10 → 1 070, 12 → 905); 9 999 XP wymusza ok. 11 XP/dobę lotu.
- **Gospodarka**: PKB ×1,013 / ×1,007, zapasy ×1,79 / ×0,99, 0 NaN; pozycje na sufitach 20% → 45% → 49% (stan ustalony, nie ucieczka).
- **Krzywa wartości**: ×1,7 (d100), ×3,0 (d300), ×4,1 (d600), ×5,5 (d1000), ×7,4 (d1200) z kadłubem; gra nie kończy się ekonomicznie wcześniej.
- Budżet ekspedycji 2 × koszt dawał 8 bankructw na 50 przy `progAwansu` 0,25; 3 × koszt daje 3 i podnosi medianę wartości (kr + ładunek) z 15,5 do 32 mln, przy tej samej liczbie ekspedycji (1,58 na ziarno).

---

# Archiwum: ustalenia zadania spread

## Ustalenia (findings)

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

# DECYZJE — założenia spoza kanonu i wynik bota

Liczby kanonu (`sim/kanon.json`) są wzięte z tabel w `PROMPT.md` i `PROMPT-galaktyka.md` bez zmian. Wszystko poniżej to moje założenia; każde ma liczbę w `sim/prototyp.json` albo jest regułą opisaną tutaj. Sekcje 1–25 opisują świat **S** (pierwszy prototyp; jego liczby leżą teraz w `prototyp.json → swiatS`), sekcja **Galaktyka** opisuje skale M i L.

## Rynek i ceny

1. **Cena krańcowa.** Kanon podaje cenę jednostkową przy danym zapasie. Przy transakcji liczę całkę nacisku po zapasie: każdy kolejny m³ jest wyceniany przy zapasie po poprzednim (postać zamknięta w `sim/rynek.ts`, `calkaNacisku`). Skutki: duża partia sama obniża sobie cenę, podział transakcji na części nic nie zmienia (test), a UI pokazuje kwotę za wpisaną ilość, średnią cenę i cenę po transakcji. Alternatywa (cena z chwili transakcji za całą partię) premiowałaby zrzucanie całej ładowni na mały rynek.
2. **Czas ciągły.** Lot trwa `dystans / prędkość` dób z ułamkiem; rynki aktualizują się liniowo o `dt` (produkcja − konsumpcja), a nie tylko w pełnych dobach. Dzięki temu pilot ma widoczny efekt w dobach i płacach.
3. **Zaokrąglenie.** Każda kwota (zakup, sprzedaż, paliwo, płace) jest zaokrąglana do pełnych kr w chwili transakcji, więc raport sumuje się dokładnie, bez tolerancji.
4. **Zapas startowy i rozruch.** Każda pozycja startuje z `zapasStartowyUlamekNormy` = 1,0 normy ± `zapasStartowyJitter` = 0,2, potem świat żyje `dobyRozruchuRynku` = 40 dób bez gracza. Dzięki temu nadwyżki i braki są widoczne od pierwszego doku (pierwsza zyskowna trasa po 1 locie).
5. **Pułap zapasu** `maxZapasWNormach` = 6 norm (od 5,9 normy cena i tak jest na minimum 0,45). Konsumpcja ustaje przy zapasie 0 (niezaspokojony popyt nie rośnie jako dług).
6. **Elektronika nieznanej cywilizacji.** Do kontaktu jej konsumpcja Elektroniki jest uśpiona (`konsumpcjaUspiona`), zapas = `kontaktZapasElektronikiUlamekNormy` = 0,05 normy. Kontakt budzi konsumpcję na wszystkich planetach tej cywilizacji i odsłania rynki. Kontakt liczy się tylko przy dokowaniu (przelot przez planetę nie wystarcza).
7. **Paliwo na planecie zawsze dostępne.** Planety z deficytem paliwa miewają zapas 0; żeby statek nie utknął, paliwo można kupić zawsze, a przy pustym zapasie cena to BasePrice × nacisk maksymalny (2,5), zgodnie z wzorem. Zakup zmniejsza zapas do 0. W punktach plemion cena bazowa i bez limitu. Paliwo w baku nie liczy się do masy ładunku.

## Załoga

8. **Handlowiec.** Udział w półoknie spreadu = `handlowiecMaxUdzialPolspreadu` (0,8) × (umiejętność − skillFloor)/(skillCeiling − skillFloor). Kupno = baza × (1 + spread/2 × (1 − udział)), sprzedaż = baza × (1 − spread/2 × (1 − udział)). Najlepszy handlowiec zabiera 80% półspreadu, więc sprzedaż < kupno zawsze (test). Handlowiec o umiejętności 0,8 nie daje nic, tak jak nawigator o 0,8. *Uzupełnienie (sekcja „Spread: pamięć zakupu”):* „spread” w tych wzorach to spread podstawowy wariantu; w wariancie A równy `tradeSpread` na każdej transakcji, w B/D zero (handlowiec nie ma na co wpływać), w C 0,10.
9. **Nawigator** `nawigatorMaxRedukcjaPaliwa` = 0,15 i **synergia** `synergiaRedukcjaPaliwa` = 0,10 to liczby z opisu w prompcie, ale spoza tabeli kanonu, więc leżą w `prototyp.json`.
10. **Ta sama rola nie sumuje się:** w każdej roli liczy się tylko najlepszy załogant. Pilot o umiejętności < 1 spowalnia statek (prędkość × umiejętność dosłownie).
11. **Kandydaci:** `liczbaKandydatow` = 3 na dok, generowani z ziarna, nazwy planety i numeru wizyty, więc deterministyczni i inni przy każdej wizycie. Rola, cywilizacja i umiejętność (2 miejsca po przecinku) losowe. W punktach tankowania nie ma kandydatów.
12. **Zatrudnianie i zwalnianie** natychmiastowe, bez odpraw. Płace naliczane tylko za doby w locie (w doku czas stoi). Start lotu wymaga gotówki na płace za ten lot.

## Świat

13. **Układ.** 14 węzłów przy skoku ≤ 20 pc nie zapełni dysku o promieniu 150 pc spójnym grafem (łańcuch 13 krawędzi to maks. 260 pc długości). Przyjąłem `promienGalaktykiPc` = 100 i układ: cywilizacja-hub (4 planety na pierścieniu ok. 11 pc) w środku, dwa ramiona po 4 planety co ok. 16 pc, każde połączone z hubem przez punkt tankowania plemion ok. 28 pc od środka. Azymuty ramion i rozrzut (`jitterPc`, `jitterKatStopnie`) losowe z ziarna; nieudane losowania (odstęp < `minOdstepPc`, graf niespójny) są powtarzane. Obrót mapy w UI (dłuższa oś pionowo) jest czysto wizualny.
14. **Cywilizacje** (profile per milion mieszkańców na dobę, patrz `prototyp.json`): Agraria (start, ramię, nadwyżka Żywności i Minerałów, brak Rozpuszczalników, Materiałów wybuchowych i odrobiny Elektroniki), Kuźnia (hub, nadwyżka Rozpuszczalników, Materiałów wybuchowych i Elektroniki, brak Żywności i Minerałów), Cisi (nieznane ramię, nadwyżka Żywności i Minerałów, brak Rozpuszczalników i Materiałów wybuchowych, po kontakcie popyt na Elektronikę). Producent i główny odbiorca leżą na przeciwnych ramionach lub w hubie, więc marża rośnie z odległością.
15. **Specjalizacja planet** przesuwa produkcję wewnątrz cywilizacji (np. Zielna żywność, Kamieniec minerały), ale jest normalizowana tak, że suma produkcji cywilizacji zostaje równa profilowi × populacja. Daje to opłacalne trasy jednoskokowe wewnątrz cywilizacji.
16. **Strojenie profili (historia).** Pierwsza wersja profili dawała bota z medianą 37 mln kr (×5,5): nierównowagi były tak duże, że po rozruchu wszystkie rynki stały na skrajnych naciskach, a pojedyncza elektronika do Cisich podwajała firmę. Zmniejszyłem deficyty (zwłaszcza Elektroniki i Materiałów wybuchowych) → 24 mln, potem przeskalowałem konsumpcję i produkcję wszystkich towarów poza paliwem ×0,4 → mediana 11,8 mln. Skala ×0,4 zmniejsza głębokość rynków (norma = 30 dób konsumpcji), więc zrzut 480 m³ wyraźnie psuje cenę, a wożenie w kółko przestaje się opłacać, co jest tezą prototypu.

## Pętla, raport, koniec gry

17. **Raport sumuje się do zmiany salda** w ten sposób: linie bazowe są kontrfaktyczne („ceny bez handlowca”, „paliwo bez nawigatora i synergii”, „płace przy prędkości nominalnej”), a linie załogi domykają je do faktycznych kwot. Oszczędność paliwa nawigatora i synergii jest wyceniona w kr po cenie paliwa w porcie startu. Dodałem linię pilota (krótszy lub dłuższy lot → różnica płac), bo to też decyzja gracza. Linia kontaktu ma 0 kr i opis, co odsłonięto.
18. **Okres raportu** = akcje w doku startu + lot. Sprzedaż w doku dotyczy ładunku kupionego wcześniej, dlatego raport pokazuje też „wynik na sprzedanych towarach” (przychód − koszt zakupu po średniej) i zmianę wartości firmy (ładunek wyceniony w porcie docelowym).
19. **Trasa** to ciąg skoków po krawędziach; bez tankowania po drodze, dokowanie tylko na końcu. Zasięg na mapie = węzły osiągalne najkrótszą ścieżką na paliwie w baku.
20. **Wartość firmy w punkcie tankowania** (brak rynku): ładunek po koszcie zakupu.
21. **Koniec gry:** pierwszy przylot w dobie ≥ 120 kończy grę, a lot, który przekroczył limit, liczy się do wyniku. Prostsze niż zabranianie lotów „niezdążających”, a luka jest mała.
22. **Literały w kodzie:** poza `kanon.json` i `prototyp.json` zostały tylko stałe metod numerycznych (EPS = 1e-9, liczba iteracji bisekcji), 0/1/2 we wzorach z kanonu (np. `spread/2`, `1 − w`) oraz proporcje rysowania mapy w UI. Parametry animacji i progi UI są w `prototyp.json → ui`.

## Bot (`npm run bot`)

23. **Strategia zachłanna:** w doku sprzedaje cały ładunek; dla każdego wariantu załogi (bez zmian, zatrudnienie kandydata, podmiana słabszego w tej samej roli, zwolnienie) i każdej znanej planety w zasięgu baku (≤ `maxSkokowTrasy` = 6 skoków) dobiera do dwóch towarów w `krokiIlosci` = 8 krokach ilości (z uwzględnieniem głębokości rynku docelowego i rzutu zapasu w przód o czas lotu), liczy zysk netto po paliwie (po cenie w porcie startu) i płacach, i wybiera **najwyższy zysk netto na dobę lotu** (nie na lot, bo w 120 dobach czas jest zasobem; tylko tak pilot ma sens). Trzyma rezerwę gotówki na płace, tankuje do pełna, gdy cena ≤ `tankujGdyCenaPonizejBazyRazy` × baza. Eksploruje nieznaną planetę, gdy jest ≤ `eksplorujMaxSkokow` = 3 skoki i doba ≤ `eksplorujDoDoby` = 80. Korzysta wyłącznie z informacji widocznych dla gracza.
24. **„Pierwsza zyskowna trasa”** = pierwszy lot, po którym wartość firmy (ładunek po cenach sprzedaży w porcie docelowym) jest wyższa niż przed zakupami w porcie startu.
25. **Ilości bota:** towar w pełnych m³, paliwo w pełnych dziesiątych m³, żeby te same liczby dało się wpisać w pola UI. Smoke test (`npm run smoke`) prowadzi bliźniaczą symulację w Node, bierze decyzje bota, odtwarza je klikając w UI i po każdym locie porównuje saldo i dobę z bliźniakiem, więc sprawdza nie tylko brak błędów w konsoli, ale i zgodność interfejsu z symulacją co do 1 kr.

### Wynik (200 ziaren × 120 dób, ziarna „1”…„200”)

```
Ziarna z zyskiem (wartość końcowa > start): 100.0%
Ziarna z podwojeniem wartości: 4.5%
Mediana lotów do pierwszej zyskownej trasy: 1 (brak zyskownej trasy w 0 ziarnach)
Mediana wartości firmy na koniec: 11 787 266 kr (start 6 800 000 kr)
Mediana liczby lotów: 18; kontakt z nieznaną cywilizacją w 200 ziarnach
Najczęstsze trasy:
    380 × Zielna → Kamieniec
    371 × Kamieniec → Zielna
    280 × Młot → Tygiel
    277 × Młot → Milczek
    222 × Zielna → Młot
Najczęstsze towary (jako ładunek lotu):
   1656 × Żywność
   1625 × Minerały
   1175 × Rozpuszczalniki
   1101 × Elektronika
    650 × Materiały wybuchowe
```

Kryterium 2 spełnione: ≥ 70% ziaren z zyskiem, pierwsza zyskowna trasa w medianie 1 lot. Bot zachłanny kończy z ×1,73 wartości, a podwojenie osiąga w 4,5% ziaren, więc cel „podwój w 120 dób” wymaga od gracza więcej niż zachłanności (planowanie elektroniki do Cisich, dobór załogi z synergią, unikanie zepsutych tras).

## Obserwacje o kanonie (nie zmieniałem liczb)

- **Paliwo dominuje koszty.** 1 m³/pc po ok. 10 000 kr/m³ to ok. 10 000 kr za parsek; płace (≤ 2 500 kr/dobę) są przy tym pomijalne, więc załoga „opłaca się” prawie zawsze poza słabym pilotem. Nawigator i synergia są zatem najcenniejszą częścią załogi.
- **Masa vs objętość.** Najgęstszy towar (Minerały, 3 t/m³) wypełnia 1 440 t dokładnie przy 480 m³, więc dla pojedynczego towaru oba limity wyczerpują się razem; limit masy wiąże tylko ładunek mieszany. Test limitu masy istnieje, ale w grze rzadko go widać.
- **Elektronika** (61 307 WU/m³) jest kapitałochłonna: za cały kapitał startowy kupisz ok. 10–15 m³, a norma zapasu na planecie to kilka m³, więc to towar na „kilka m³ do kilku planet”, a nie na pełną ładownię. To dobrze oddziela ją od towarów masowych.


# Galaktyka (PROMPT-galaktyka.md)

## Skale i przełączniki

26. **Przełączniki** `skala` (S/M/L) i `informacja` (pelna/zasieg) w `prototyp.json` są domyślnymi wartościami; UI ma je w nagłówku, a adres `#ziarno=…&skala=M&informacja=zasieg` pozwala wysłać testerowi konkretny świat. Bot: `npm run bot -- [S|M|L|all] [pelna|zasieg|both] [liczba ziaren]`; smoke: `npm run smoke -- [ziarno] [katalog zrzutów] [skala] [informacja]`.
27. **S** to dotychczasowy generator (hub + dwa ramiona) i dotychczasowe cywilizacje z otwartością 0 (brak wymiany NPC), więc świat S zachowuje się jak przed tą funkcją; wszystkie wcześniejsze testy działają na S. Przeniesienie liczb do `swiatS` nie zmienia ich wartości.
28. **Horyzont** `limitDob`: S 120, M 240, L 480. W L dwa sektory to ok. 1 200 pc łuku; przy 4 pc/dobę i objazdach szlakami (ok. 1,3× linii prostej) daje to ok. 400 dób, więc 480 pozwala przejść dwa sektory i jeszcze handlować. Cel ×2 bez zmian.

## Geometria (liczby kanonu w `kanon.json`)

29. **Układy zamieszkiwalne** losowane w pierścieniu od martwego rdzenia (0,300 R) do zewnętrznej strefy (0,600 R) z gęstością ∝ zdatność(r) × r, gdzie zdatność rośnie liniowo od 0 przy 0,300 R do 1 przy 0,467 R i równa się 1 w strefie 0,467–0,600 R. Minimalny odstęp między układami zamieszkiwalnymi `minOdstepZamieszkiwalnychPc` = 14. L ma dokładnie 464 układy (liczba kanonu, status proponowane), M jeden sektor i 75 układów (ok. 464/7 z zapasem, żeby cztery cywilizacje zmieściły się z kilkunastoma układami plemion).
30. **Sektory** to 7 równych wycinków kątowych; M używa sektora 1 (indeks 0). Granice i okręgi rdzenia oraz strefy są rysowane na mapie.
31. **Terytorium z populacji**: liczba układów = round(3 + 2,2 × log10(populacja w mln) + rozrzut), rozrzut ∈ [−1,5; 1,5] z ziarna. Populacje cywilizacji (`cywilizacjeKanonu.*.populacjaMln`) dobrałem tak, by terytoria miały 12–19 układów (Orak 2·10⁴ mln → 12–13, Ludzie 1,5·10⁷ mln → 18–19); razem ok. 150 zamieszkanych układów w L, ok. 62 w M. Terytorium rośnie od zalążka w sektorze cywilizacji, zawsze najbliższym układem do środka ciężkości (zwarty obszar). Kolejna cywilizacja w tym samym sektorze zaczyna przy granicy poprzedniej (`sasiedztwoTerytoriow`), bo przy kanonicznym paliwie handel między cywilizacjami jest możliwy tylko na krótkich dystansach (patrz 44).
32. **Trzy poziomy przejezdności**: planeta cywilizacji (rynek, paliwo, kandydaci), układ plemion (zamieszkiwalny bez cywilizacji: tylko paliwo po cenie bazowej; w S to były „punkty tankowania”), układ przelotowy (nic). Układy przelotowe leżą wzdłuż szlaków co `krokPrzelotuPc` = 19 pc z poprzecznym rozrzutem ±1,5 pc, więc każdy skok ma ≤ 19,3 pc < 20.
33. **Szlaki** = minimalne drzewo rozpinające układów zamieszkiwalnych ∪ graf względnego sąsiedztwa (krawędź a–b, gdy żaden układ c nie leży bliżej obu końców niż one siebie; do `maxDlugoscSzlakuDodatkowegoPc` = 160 pc). Daje spójny, planarny układ szlaków o długości ok. 1,3× odległości w linii prostej. Pierwsza wersja (MST + 2 najbliższych ≤ 90 pc) była zbyt drzewiasta: do sąsiedniego sektora prowadziło 4 500 pc okrężnej drogi.
34. **Stolica** cywilizacji = układ najbliższy środka ciężkości terytorium; statek zaczyna w stolicy cywilizacji startowej. Wagi układów w cywilizacji: w ∝ ranga^(−0,5) według odległości od stolicy, średnia 1; populacja układu = populacja cywilizacji × waga / liczba układów.

## Gospodarka portowa cywilizacji kanonu

35. **Port zamiast per capita.** Populacje kanonu (10⁴–10⁷ mln) są o rzędy większe niż cokolwiek, co może przewieźć jeden statek, więc rynek, na którym handluje gracz, to port międzygwiezdny: konsumpcja portu układu = `portNaUkladM3NaDobe[towar]` × potrzeby cywilizacji (mnożnik profilu) × waga układu × głębokość portu. **Głębokość portu** = clamp(otwartość, `glebokoscPortuMin` = 0,35, 1,0): zamknięta cywilizacja ma płytkie porty (Orak 0,35 maksimum), otwarta pełne. Paliwo nie jest skalowane głębokością. Produkcja portu = konsumpcja × (produkcja/potrzeby cywilizacji) × specjalizacja układu (`specjalizacjaMnoznik` 1,2 dla losowego towaru układu, 0,95 dla reszty, znormalizowane tak, by suma cywilizacji była dokładna). Dla Żywności stosunek produkcji do potrzeb to **SSR z kanonu**; pozostałe stosunki zaprojektowałem w `cywilizacjeKanonu`: Vreth/Orak/Szkarni kopią minerały, Corrath/Planta robią rozpuszczalniki, Corrath/Szkarni/Velhari materiały wybuchowe, AI (4×), Velhari i Ludzie elektronikę; każdy producent ma głównego odbiorcę w innym sektorze L (np. elektronika AI s4 → Ludzie s1, Corrath s2, Planta s5; żywność Duhari s6 → AI s4, Velhari s7). Wszystkie cywilizacje mają nadwyżkę paliwa (2×), więc paliwo na planetach jest tanie (nacisk → 0,45), a u plemion kosztuje cenę bazową.
36. **Otwartość = sufit dobowej wymiany NPC.** Co dobę handlarze NPC ciągną zapas każdej pozycji portu ku normie w tempie `tempoWymianyNPC` = 0,04 × (norma − zapas), ale nie szybciej niż otwartość × dzienna konsumpcja portu × `mnoznikSufituNPC` (1,0). Dzienna konsumpcja portu w WU to mój „PKB” portu, więc dla całej cywilizacji wymiana NPC ≤ otwartość × PKB (test). Skutki: Orak (0,04) nie jest w stanie uzupełnić deficytu żywności 98%, więc jego porty stoją na cenie maksymalnej i odbudowują się tylko dzięki graczowi; AI (1,66) wchłania 480 m³ w kilkanaście dób; cywilizacje pośrodku (Ludzie 0,26) mają deficyty, których NPC nie domyka, i nadwyżki, które się piętrzą. Krok rynku z wymianą NPC liczony jest co najwyżej dobę (zależy od zapasu); przy otwartości 0 pozostaje jedna aktualizacja liniowa jak w S.
37. **Rozruch** `galaktyka.dobyRozruchuRynku` = 180 dób (S: 40). Przy krótszym rozruchu (60) nadwyżki i braki nie zdążyły się ujawnić i w pierwszym doku nie było żadnego dodatniego planu; po 180 dobach deficyty, których NPC nie domyka, stoją na cenie maksymalnej, a nadwyżki na minimalnej, co jest stanem długookresowym tej gospodarki.
38. **Nieznane cywilizacje** (M: Vreth i Orak; L: wszystkie poza Ludźmi, Vreth i Corrath) działają jak w S: rynek ukryty do pierwszego lądowania, konsumpcja elektroniki uśpiona, zapas 0,05 normy.

## Informacja o cenach

39. **Tryb `zasieg`**: ceny na żywo tylko dla planet w promieniu 182 pc od statku (w linii prostej); poza nim dla planet **odwiedzonych** ostatni odczyt (zapisywany przy każdym dokowaniu dla odwiedzonych planet w łączności i przy odlocie z planety) z wiekiem w dobach; planet nieodwiedzonych poza łącznością nie widać wcale (na mapie: puste kółko). Odczyt pokazywany jest surowo, bez rzutowania w przód, bo świat jest deterministyczny i rzut odtworzyłby rzeczywistość dokładnie, zerując wartość informacji. Bot używa tych samych reguł (`informacjaORynku`), więc różnica wyników bota między trybami mierzy wartość informacji.

## Bot w galaktyce

40. **Graf tankowania.** Lot gracza to jeden ciąg skoków bez tankowania po drodze, a bak (100 m³ = 100 pc) nie wystarcza na trasy między cywilizacjami. Bot buduje więc graf węzłów z paliwem (planety i plemiona) połączonych najkrótszymi ścieżkami ≤ zasięg baku minus `rezerwaPaliwaOdcinkaM3` = 1 m³ i planuje dojazdy jako ciągi odcinków; każdy odcinek to jeden lot, na przystanku tankuje. Kara `karaPrzystankuPc` = 80 pc za przystanek preferuje mniej, dłuższych odcinków. Bot ma pamięć zobowiązania: wiezie ładunek do celu i na przystankach tylko tankuje oraz dokupuje.
41. **Sprzedaż częściowa i klaster dystrybucji.** Na płytkich rynkach ładunek rozwozi się po kilku planetach. W doku bot dla każdego towaru wybiera, ile sprzedać tutaj, a ile wieźć do celu (maksimum łącznego przychodu); wieziony ładunek wycenia tylko na samym celu. Zakupy pod cel są wymiarowane na klaster: cel plus do `maxPlanetDystrybucji` = 2 najbliższych planet tej samej cywilizacji w promieniu `promienDystrybucjiPc` = 70 pc (bez planety, na której stoi), z kosztem objazdu. Bez wykluczenia bieżącej planety z klastra bot wpadał w nieskończone wahadło między dwoma sąsiadami („sprzedam to później przez klaster sąsiada”).
42. **Dwa kroki.** Dla `planowDoDrugiegoKroku` = 5 najlepszych planów bot dolicza najlepszy pojedynczy kurs powrotny z celu (jeden towar, jeden z `celowDrugiegoKroku` = 25 najbliższych celów) i wybiera plan o najwyższej stopie na dobę z obu kroków. Bez tego w pierwszym doku żaden plan nie był dodatni (żywność z Ludzi do Corrath nie pokrywa paliwa), a opłacalność bierze się z pętli: żywność i elektronika w jedną stronę, rozpuszczalniki i materiały wybuchowe z powrotem.
43. **Eksploracja** to plan do najbliższej nieznanej planety w zasięgu `eksplorujMaxPc` = 260 pc, do `eksplorujDoUlamkaHoryzontu` = 0,6 horyzontu, o wartości `premiaEksploracjiKr` = 0,8 mln minus koszty; konkuruje z handlem na równych prawach (stopa na dobę). Loty eksploracyjne są wyłączone z korelacji zysku z dystansem, bo ich premia jest fikcyjna.
44. **Czego nie da się osiągnąć bez zmiany kanonu: dodatniej korelacji zysku na dobę z dystansem.** *Korekta po teście spreadu (sekcja „Spread: pamięć zakupu”): paliwo nie jest przyczyną ujemnej korelacji; przy paliwie za darmo znak się nie zmienia. Paliwo ogranicza, które trasy są opłacalne, a korelację per dobę psuje ograniczona marża na kurs przy czasie rosnącym z dystansem oraz selekcja planów przez bota.* Pierwotne rozumowanie: blokują ją `kosztPaliwaNaParsek` = 1 m³/pc i `BasePrice Fuel` = 1 000 WU (10 000 kr/pc, u plemion; ok. 4 500 kr/pc na planetach z nadwyżką) wobec wartości ładunku (pełna ładownia żywności to 151 200 WU, czyli paliwo na ok. 150 pc; minerałów na ok. 290 pc) oraz `bak` = 100 m³ wymuszający przystanki. Przy promieniu galaktyki 1 257 pc i układach co ok. 40 pc masowe towary nie mogą opłacalnie przebyć odległości między cywilizacjami; zysk powstaje przez pozycjonowanie (długi lot z tanią żywnością do producenta rozpuszczalników, który sam w sobie prawie nic nie daje) i jest realizowany na krótkich odcinkach dystrybucji. Dlatego zarówno korelacja na poziomie lotu, jak i całej trasy handlowej (zakup → cel) wychodzi ujemna we wszystkich przebadanych wariantach profili i rozmieszczenia (12 wariantów głębokości portu, tempa NPC i specjalizacji; 6 wariantów specjalizacji × tempa × głębokości). Strojenie w `prototyp.json` zmienia pozostałe miary, nie znak korelacji. Marża **na lot** rośnie z odległością (dalekie kursy wiozą droższe towary), ale nie marża **na dobę**.
45. **Strojenie M (historia).** Porty ×1 (jak S) → wszystkie plany ujemne, bot bankrutował; porty ×3 i cywilizacje przyległe → ×4,65; porty ×2, tempo NPC 0,04 → ok. ×1,8–2,6 zależnie od wariantu; głębsze porty zamkniętych cywilizacji (0,5) i tempo 0,05 podnoszą zysk i udział lotów wewnątrz cywilizacji (61%), więc zostało 0,35 i 0,04. Udział lotów wewnątrz jednej cywilizacji (ok. 58%) to w większości odcinki dystrybucji i tranzytu przez własne terytorium (promień terytorium ok. 110–130 pc przy odcinku ≤ 99 pc), nie wahadło między dwiema planetami: 5 najczęstszych tras to poniżej 1% lotów.

## Wynik bota (`npm run bot`)

Pełny przebieg (`npm run bot`, S i M po 200 ziaren, L po 50; czas na jednym rdzeniu):

<!-- TABELA-START -->
```
Bot zachłanny, horyzont dób: S 120, M 240, L 480
Miara                                                       |  S/pelna (200 z.) | S/zasieg (200 z.) |  M/pelna (200 z.) | M/zasieg (200 z.) |   L/pelna (50 z.) |  L/zasieg (50 z.)
------------------------------------------------------------+-------------------+-------------------+-------------------+-------------------+-------------------+------------------
Ziarna z zyskiem (próg M ≥ 70%)                             |            100.0% |            100.0% |             99.5% |             98.5% |            100.0% |            100.0%
Ziarna z podwojeniem wartości                               |             21.5% |             21.5% |             65.0% |             63.5% |             98.0% |             98.0%
Pierwsza zyskowna trasa, mediana lotów (≤ 3)                |               3.0 |               3.0 |               2.0 |               2.0 |               2.0 |               2.0
Udział 5 najczęstszych tras (≤ 25%)                         |             35.0% |             35.0% |              0.6% |              0.6% |              1.4% |              1.6%
Loty wewnątrz jednej cywilizacji (≤ 50%)                    |             39.0% |             39.0% |             58.0% |             57.7% |             59.3% |             59.2%
Mediana skoków zyskownego lotu (≥ 2)                        |               2.0 |               2.0 |               3.0 |               3.0 |               3.0 |               3.0
Korelacja zysk/dobę z dystansem lotu (> 0; bez eksploracji) |             -0.33 |             -0.33 |             -0.32 |             -0.31 |             -0.34 |             -0.34
  loty eksploracyjne                                        |              7.8% |              7.8% |              5.4% |              5.3% |              0.2% |              0.1%
  …z dystansem całej trasy handlowej (zakup → cel)          |             -0.34 |             -0.34 |             -0.34 |             -0.34 |             -0.41 |             -0.41
  trasy handlowe między cywilizacjami                       |             57.7% |             57.7% |             47.1% |             47.0% |             50.1% |             49.1%
  mediana dystansu trasy handlowej                          |           32.9 pc |           32.9 pc |           44.7 pc |           44.4 pc |           47.8 pc |           46.8 pc
Kontakt z nieznaną cywilizacją (≥ 50%)                      |            100.0% |            100.0% |             56.5% |             56.0% |              6.0% |              2.0%
Mediana wartości firmy na koniec                            |     12 655 385 kr |     12 655 385 kr |     15 548 746 kr |     15 534 888 kr |     25 466 664 kr |     24 768 273 kr
Mediana liczby lotów                                        |              14.0 |              14.0 |              19.0 |              19.0 |              38.0 |              38.5
Ziarna, w których bot utknął                                |                 0 |                 0 |                 0 |                 0 |                 0 |                 0
Czas bota                                                   |            11.8 s |            11.8 s |            43.4 s |            37.4 s |            79.0 s |            77.6 s
S/pelna: najczęstsze trasy: mlot → zielna (216); milczek → iskra (214); zielna → milczek (187); milczek → szept (175); zielna → kamieniec (165)
S/pelna: najczęstsze towary: Żywność (847); Minerały (686); Elektronika (673); Materiały wybuchowe (663); Rozpuszczalniki (650)
S/zasieg: najczęstsze trasy: mlot → zielna (216); milczek → iskra (214); zielna → milczek (187); milczek → szept (175); zielna → kamieniec (165)
S/zasieg: najczęstsze towary: Żywność (847); Minerały (686); Elektronika (673); Materiały wybuchowe (663); Rozpuszczalniki (650)
M/pelna: najczęstsze trasy: ludzie-venno → orak-ulmorak (6); ludzie-dorvano → ludzie-nonova (5); orak-dzdzul → ludzie-dormiven (5); corrath-umrathcor → orak-ummorul (4); orak-ummorul → orak-dzgrum (4)
M/pelna: najczęstsze towary: Minerały (877); Żywność (670); Elektronika (597); Rozpuszczalniki (590); Materiały wybuchowe (347)
M/zasieg: najczęstsze trasy: ludzie-venno → orak-ulmorak (6); ludzie-dorvano → ludzie-nonova (5); orak-dzdzul → ludzie-dormiven (5); ludzie-kador → ludzie-selterno (4); corrath-umrathcor → orak-ummorul (4)
M/zasieg: najczęstsze towary: Minerały (888); Żywność (694); Elektronika (623); Rozpuszczalniki (599); Materiały wybuchowe (355)
L/pelna: najczęstsze trasy: vreth-thuvrmal → vreth-vrmalzan (6); vreth-ethvr → vreth-gorruketh (6); vreth-vrok → vreth-akthu (5); velhari-ienha → vreth-ethrukgor (5); vreth-malmal → vreth-thuvr (5)
L/pelna: najczęstsze towary: Elektronika (483); Materiały wybuchowe (417); Minerały (395); Żywność (121); Rozpuszczalniki (82)
L/zasieg: najczęstsze trasy: vreth-ethvr → vreth-gorruketh (7); vreth-thuvrmal → vreth-vrmalzan (6); vreth-okmal → vreth-zangorok (6); vreth-zangorok → vreth-okakok (6); vreth-vrok → vreth-akthu (5)
L/zasieg: najczęstsze towary: Elektronika (481); Minerały (415); Materiały wybuchowe (413); Żywność (138); Rozpuszczalniki (83)
S: informacja=zasieg vs pelna: mediana wartości firmy 12 655 385 kr vs 12 655 385 kr (0.0%)
M: informacja=zasieg vs pelna: mediana wartości firmy 15 534 888 kr vs 15 548 746 kr (-0.1%)
L: informacja=zasieg vs pelna: mediana wartości firmy 24 768 273 kr vs 25 466 664 kr (-2.7%)
```
<!-- TABELA-KONIEC -->

### Ocena progów na M (kolumna M/pelna, 200 ziaren)

| Miara | Próg | Wynik | |
|---|---|---|---|
| Ziarna z zyskiem | ≥ 70% | 99,5% | spełnione |
| Pierwsza zyskowna trasa, mediana | ≤ 3 loty | 2,0 | spełnione |
| Udział 5 najczęstszych tras | ≤ 25% | 0,6% | spełnione (w S 35%) |
| Loty wewnątrz jednej cywilizacji | ≤ 50% | 58,0% | **nie**: to odcinki dystrybucji ładunku po planetach cywilizacji docelowej i tranzyt przez własne terytorium (promień terytorium 110–130 pc, odcinek ≤ 99 pc), nie wahadło między dwiema planetami (5 najczęstszych tras to 0,6% lotów); trasy handlowe (zakup → cel) między cywilizacjami to 47% |
| Mediana długości zyskownego lotu | ≥ 2 skoki | 3 | spełnione |
| Zysk na dobę: korelacja z dystansem | dodatnia | −0,32 (lot), −0,34 (cała trasa handlowa) | **nie**: blokują liczby kanonu paliwa i baku, patrz 44 |
| Kontakt z nieznaną cywilizacją | ≥ 50% ziaren | 56,5% | spełnione |
| `zasieg` vs `pelna`: mediana wartości firmy | pomiar | −0,1% (M), 0,0% (S), −2,7% (L, 50 ziaren) | informacja o cenach jest warta niewiele: bot i tak handluje głównie w promieniu łączności, a odczyty z odwiedzonych planet starzeją się wolno, bo rynki zamkniętych cywilizacji stoją na skrajach; w S cały świat mieści się w łączności |
| Czas bota, 200 ziaren | ≤ 120 s | 43 s | spełnione |

Uwagi: podwojenie osiąga 65% ziaren na M (mediana ×2,29 w 240 dób), więc cel ×2 jest dla gracza osiągalny, ale nie darmowy. W L bot kończy z medianą ×3,7 w 480 dób i prawie nie eksploruje (6%), bo nieznane cywilizacje leżą dalej niż `eksplorujMaxPc` od szlaków Ludzie–Vreth–Corrath; L nie ma progów w prompcie. Wynik S zmienił się względem pierwszego prototypu (mediana 12,7 mln zamiast 11,8 mln, top-5 tras 35% zamiast 40%), bo zmienił się bot (dwa kroki, sprzedaż częściowa), nie świat S.

46. **Rezerwa na paliwo u plemion.** W L bot bankrutował w 2 z 50 ziaren w połowie długiej trasy: rezerwował gotówkę na paliwo po cenie z planety startowej (ok. 4 500 kr/m³), a u plemion paliwo kosztuje cenę bazową (10 000). Teraz pierwszy odcinek liczy po cenie lokalnej, dalsze po maksimum z ceny lokalnej i bazowej; po poprawce żadne ziarno nie utyka.


# Spread: pamięć zakupu (PROMPT-spread_1.md)

## Model i warianty

47. **Przełącznik `spread`** (A/B/C/D) w `prototyp.json`, w nagłówku gry i w adresie (`&spread=B`); domyślny wariant gry to **A**, dopóki projektant nie zdecyduje. Konfiguracja wariantów w `prototyp.json → wariantySpreadu`: A = tryb `staly` (dzisiejsze zachowanie, `tradeSpread` na każdej transakcji); B = pamięć, spread podstawowy 0, kara schodkowa; C = pamięć, spread podstawowy 0,10, kara schodkowa; D = pamięć, spread podstawowy 0, kara liniowa; E (v2 promptu) = jak B, ale bez obcięcia nacisku do [`StockPressureMin`, `StockPressureMax`]: zostaje strażnik dziedziny `StockRatioFloor` = 0,02 i pułap zapasu 6 norm, więc nacisk mieści się w ok. 0,45–5,8 (parametr `obciecie` w `nacisk`/`calkaNacisku`, domyślnie włączony, więc A–D są identyczne jak wcześniej). `pamiecZakupuSkokow` = 5 (rozstrzygnięcie projektanta, nie liczba kanonu).
48. **Pamięć zakupu** to słownik `stan.pamiecZakupu`: klucz „planeta|towar” → licznik skoków, bez ceny kupna (test). Przy zakupie licznik pary ustawia się na 5; każdy wykonany lot zmniejsza wszystkie liczniki o liczbę krawędzi trasy (lot wieloskokowy = tyle skoków, ile krawędzi); licznik 0 usuwa wpis. Pamięć jest per statek = per firma (jeden statek).
49. **Ceny.** Kupno = baza × (1 + s/2 × (1 − u)), sprzedaż = baza × (1 − s/2 × (1 − u)) × (1 − kara), gdzie s to spread podstawowy wariantu, u pozycja handlowca, a kara = `tradeSpread` (0,3, schodek) albo `tradeSpread` × licznik/5 (liniowa), dopóki licznik pary (planeta, towar) > 0, inaczej 0. Kara jest mnożnikiem całej ceny sprzedaży, więc przy spreadzie 0 okno kupno/sprzedaż na planecie zakupu wynosi dokładnie 0,3 (`OnePlanetBuySellPriceSpread`); przy spreadzie 0,10 okno to 1,05 / (0,95 × 0,7) ≈ 1,58. Wybrałem mnożnik (a nie odjęcie 0,3 od spreadu), bo tak kara jest niezależna od okna podstawowego i od handlowca.
50. **Niezmiennik „obrót na jednej planecie nie daje zysku”.** Przy cenie krańcowej kupno q, a potem sprzedaż q na tej samej planecie bez spreadu daje dokładnie tę samą całkę nacisku, czyli zero (do zaokrąglenia 1 kr); kara 0,3 zamienia zero w stratę. Test sprawdza dla S i M, trzech ziaren, każdego towaru, trzech ilości (1 m³, połowa, maksimum), sprzedaży w całości i w częściach, bez handlowca i z handlowcem 0,8 oraz 1,25: saldo po odsprzedaży jest zawsze niższe. Kryterium jest więc spełnione we wszystkich wariantach, ale inaczej niż dotąd: w A przez stały spread na każdej planecie, w B/C/D przez pamięć zakupu, która po 5 skokach gaśnie (test), więc po powrocie na planetę zakupu po dłuższej trasie odsprzedaż bez kary jest możliwa — zgodnie z rozstrzygnięciem projektanta.
51. **Raport** ma nową linię „Kara za odsprzedaż w miejscu zakupu” (wartość ujemna), a linia sprzedaży pokazuje ceny bez handlowca i bez kary; suma linii nadal równa się zmianie salda (test). W doku przy cenie sprzedaży widać „kara 30% (jeszcze N sk.)”.
52. **Bot zna regułę.** Graf tankowania zapamiętuje liczbę skoków każdego odcinka (`Dojazd.skoki`), a wyceny bota rzutują licznik pamięci w przód o skoki trasy, więc plan powrotu na planetę zakupu w ciągu 5 skoków dostaje cenę z karą; sprzedaż częściowa w doku wycenia karę bez skoków w przód. W klastrze dystrybucji wszystkie planety klastra dostają ten sam rzut skoków (przybliżenie). Bot sprzedaje z karą tylko wtedy, gdy mimo kary się opłaca (ten sam wybór maksimum łącznego przychodu).
53. **Skutek dla handlowca.** Handlowiec działa wyłącznie w oknie spreadu podstawowego. W B i D spread podstawowy = 0, więc handlowiec nie zmienia żadnej ceny (test): rola traci sens ekonomiczny, bot przestaje go zatrudniać (płaca 500 kr/dobę bez zwrotu), a linie „Handlowiec: lepsze ceny” w raporcie znikają. W C okno 0,10 zostaje: najlepszy handlowiec przesuwa cenę o 80% połowy okna, czyli o 4% zamiast dzisiejszych 12%, co przy pełnej ładowni minerałów (2,9 mln kr) daje ok. 115 tys. kr na kurs, czyli nadal wielokrotność płacy. Jeśli kanon ma zostać przy spreadzie 0, handlowiec potrzebuje nowej mechaniki (np. zmniejszenia kary pamięci albo lepszego nacisku), co jest poza zakresem tego testu.
54. **Miary dodane do bota** (`npm run bot -- all pelna - all`): korelacje zysku/dobę z dystansem na poziomie lotu i trasy handlowej, osobno per towar dominujący trasy, udział paliwa w kosztach lotów (paliwo / (paliwo + płace)), mediana dystansu zyskownej trasy między cywilizacjami, pc paliwa pokrywane medianą marży z pełnej ładowni per towar (mediana marży na m³ ze sprzedaży × 480 m³ / mediana ceny paliwa zapłaconej w dokach), oraz korelacje po **wszystkich planach dostępnych w dokach** (stopa na dobę i zysk na kurs vs dystans), które mierzą strukturę gospodarki niezależnie od wyborów bota.

## Wynik (5 wariantów × 3 skale, `informacja = pelna`, S i M po 200 ziaren, L po 50)

<!-- TABELA-SPREAD-START -->
```
Bot zachłanny, horyzont dób: S 120, M 240, L 480; warianty spreadu: A, B, C, D, E

Miara                                                                       | S/pelna/A (200 z.) | S/pelna/B (200 z.) | S/pelna/C (200 z.) | S/pelna/D (200 z.) | S/pelna/E (200 z.)
----------------------------------------------------------------------------+--------------------+--------------------+--------------------+--------------------+-------------------
Ziarna z zyskiem (próg M ≥ 70%)                                             |             100.0% |             100.0% |             100.0% |             100.0% |             100.0%
Ziarna z podwojeniem wartości                                               |              21.5% |              82.0% |              62.5% |              82.0% |              90.5%
Pierwsza zyskowna trasa, mediana lotów (≤ 3)                                |                3.0 |                3.0 |                3.0 |                3.0 |                3.0
Udział 5 najczęstszych tras (≤ 25%)                                         |              35.0% |              34.1% |              33.5% |              34.1% |              32.7%
Loty wewnątrz jednej cywilizacji (≤ 50%)                                    |              39.0% |              41.4% |              39.2% |              41.2% |              40.1%
Mediana skoków zyskownego lotu (≥ 2)                                        |                2.0 |                2.0 |                2.0 |                2.0 |                2.0
Korelacja zysk/dobę z dystansem lotu (> 0; bez eksploracji)                 |              -0.33 |              -0.39 |              -0.35 |              -0.39 |              -0.41
  loty eksploracyjne                                                        |               7.8% |               6.9% |               7.6% |               6.9% |               6.7%
  …z dystansem całej trasy handlowej (zakup → cel)                          |              -0.34 |              -0.39 |              -0.35 |              -0.39 |              -0.41
  trasy handlowe między cywilizacjami                                       |              57.7% |              55.5% |              57.5% |              55.8% |              57.0%
  mediana dystansu trasy handlowej                                          |            32.9 pc |            32.5 pc |            32.8 pc |            32.5 pc |            32.6 pc
Kontakt z nieznaną cywilizacją (≥ 50%)                                      |             100.0% |              96.0% |              99.5% |              96.0% |              91.5%
Mediana wartości firmy na koniec                                            |      12 655 385 kr |      14 692 925 kr |      13 962 175 kr |      14 704 605 kr |      16 289 546 kr
Mediana liczby lotów                                                        |               14.0 |               14.0 |               14.0 |               14.0 |               14.0
Ziarna, w których bot utknął                                                |                  0 |                  0 |                  0 |                  0 |                  0
Czas bota                                                                   |             13.6 s |             15.4 s |             14.1 s |             13.8 s |             13.6 s
Korelacja po wszystkich dostępnych planach: stopa/dobę vs dystans           | -0.36 (29245 planów) | -0.39 (30265 planów) | -0.39 (29633 planów) | -0.39 (30202 planów) | -0.35 (29508 planów)
  …zysk netto na kurs vs dystans                                            |              -0.57 |              -0.52 |              -0.55 |              -0.52 |              -0.42
Udział paliwa w kosztach lotów (paliwo / (paliwo + płace))                  |              96.7% |              97.6% |              96.7% |              97.6% |              97.8%
Mediana dystansu zyskownej trasy między cywilizacjami                       |            49.3 pc |            49.0 pc |            49.3 pc |            48.9 pc |            49.4 pc
Mediana ceny paliwa zapłaconej w dokach                                     |          10 051 kr |          10 028 kr |          10 052 kr |          10 035 kr |          10 043 kr
Korelacja per towar, Żywność: lot / trasa (n tras)                          |    — / -0.13 (552) |    — / -0.29 (565) |    — / -0.22 (542) |    — / -0.32 (571) |    — / -0.33 (588)
Korelacja per towar, Minerały: lot / trasa (n tras)                         |     — / 0.00 (508) |    — / -0.04 (603) |     — / 0.03 (520) |    — / -0.06 (611) |    — / -0.21 (624)
Korelacja per towar, Rozpuszczalniki: lot / trasa (n tras)                  |    — / -0.27 (665) |    — / -0.33 (624) |    — / -0.24 (662) |    — / -0.33 (618) |    — / -0.35 (580)
Korelacja per towar, Materiały wybuchowe: lot / trasa (n tras)              |    — / -0.47 (217) |    — / -0.53 (263) |    — / -0.46 (237) |    — / -0.53 (258) |    — / -0.49 (242)
Korelacja per towar, Elektronika: lot / trasa (n tras)                      |    — / -0.27 (580) |    — / -0.45 (628) |    — / -0.39 (605) |    — / -0.46 (620) |    — / -0.42 (623)
Pc paliwa z mediany marży pełnej ładowni, Żywność (marża kr/m³)             |  113.0 pc (2366.5) |  113.9 pc (2380.2) |  116.0 pc (2429.0) |  114.0 pc (2384.1) |  123.8 pc (2589.7)
Pc paliwa z mediany marży pełnej ładowni, Minerały (marża kr/m³)            |  269.9 pc (5651.7) |  280.4 pc (5857.0) |  284.7 pc (5961.5) |  282.9 pc (5915.1) |  321.1 pc (6719.0)
Pc paliwa z mediany marży pełnej ładowni, Rozpuszczalniki (marża kr/m³)     |  411.7 pc (8621.4) |  408.0 pc (8524.0) |  425.5 pc (8909.9) |  407.2 pc (8513.0) | 488.0 pc (10211.3)
Pc paliwa z mediany marży pełnej ładowni, Materiały wybuchowe (marża kr/m³) | 1472.3 pc (30828.0) | 1595.3 pc (33328.5) | 1606.8 pc (33650.0) | 1588.1 pc (33201.4) | 1893.3 pc (39612.5)
Pc paliwa z mediany marży pełnej ładowni, Elektronika (marża kr/m³)         | 14420.6 pc (301949.0) | 14994.5 pc (313255.0) | 14880.4 pc (311620.8) | 14972.0 pc (313016.8) | 16635.2 pc (348052.3)

Miara                                                                       | M/pelna/A (200 z.) | M/pelna/B (200 z.) | M/pelna/C (200 z.) | M/pelna/D (200 z.) | M/pelna/E (200 z.)
----------------------------------------------------------------------------+--------------------+--------------------+--------------------+--------------------+-------------------
Ziarna z zyskiem (próg M ≥ 70%)                                             |              99.5% |             100.0% |             100.0% |             100.0% |             100.0%
Ziarna z podwojeniem wartości                                               |              65.0% |              77.5% |              69.0% |              77.0% |              98.0%
Pierwsza zyskowna trasa, mediana lotów (≤ 3)                                |                2.0 |                1.0 |                1.0 |                1.0 |                1.0
Udział 5 najczęstszych tras (≤ 25%)                                         |               0.6% |               0.5% |               0.5% |               0.5% |               0.5%
Loty wewnątrz jednej cywilizacji (≤ 50%)                                    |              58.0% |              58.6% |              58.5% |              58.3% |              67.2%
Mediana skoków zyskownego lotu (≥ 2)                                        |                3.0 |                3.0 |                3.0 |                3.0 |                3.0
Korelacja zysk/dobę z dystansem lotu (> 0; bez eksploracji)                 |              -0.32 |              -0.34 |              -0.29 |              -0.33 |              -0.36
  loty eksploracyjne                                                        |               5.4% |               2.0% |               2.6% |               2.0% |               1.6%
  …z dystansem całej trasy handlowej (zakup → cel)                          |              -0.34 |              -0.36 |              -0.33 |              -0.36 |              -0.37
  trasy handlowe między cywilizacjami                                       |              47.1% |              47.7% |              47.1% |              48.2% |              36.2%
  mediana dystansu trasy handlowej                                          |            44.7 pc |            47.5 pc |            46.4 pc |            47.6 pc |            43.6 pc
Kontakt z nieznaną cywilizacją (≥ 50%)                                      |              56.5% |              28.5% |              34.5% |              29.5% |              24.0%
Mediana wartości firmy na koniec                                            |      15 548 746 kr |      16 316 860 kr |      15 997 289 kr |      16 403 773 kr |      20 624 270 kr
Mediana liczby lotów                                                        |               19.0 |               19.0 |               19.5 |               19.0 |               21.0
Ziarna, w których bot utknął                                                |                  0 |                  0 |                  0 |                  0 |                  0
Czas bota                                                                   |             46.4 s |             56.5 s |             50.7 s |             51.9 s |             49.8 s
Korelacja po wszystkich dostępnych planach: stopa/dobę vs dystans           | -0.36 (140004 planów) | -0.36 (125258 planów) | -0.37 (131257 planów) | -0.36 (124677 planów) | -0.39 (135851 planów)
  …zysk netto na kurs vs dystans                                            |              -0.57 |              -0.52 |              -0.55 |              -0.52 |              -0.54
Udział paliwa w kosztach lotów (paliwo / (paliwo + płace))                  |              92.7% |              94.8% |              92.7% |              94.7% |              94.5%
Mediana dystansu zyskownej trasy między cywilizacjami                       |            85.1 pc |            92.2 pc |            89.9 pc |            93.2 pc |            93.4 pc
Mediana ceny paliwa zapłaconej w dokach                                     |            4502 kr |            4503 kr |            4503 kr |            4503 kr |            4484 kr
Korelacja per towar, Żywność: lot / trasa (n tras)                          | -0.18 / -0.39 (616) | 0.18 / -0.41 (628) | 0.06 / -0.36 (699) | 0.19 / -0.42 (608) | 0.15 / -0.40 (735)
Korelacja per towar, Minerały: lot / trasa (n tras)                         | 0.35 / -0.34 (884) | 0.20 / -0.35 (578) | 0.48 / -0.30 (686) | 0.21 / -0.34 (586) | 0.34 / -0.31 (724)
Korelacja per towar, Rozpuszczalniki: lot / trasa (n tras)                  | 0.53 / -0.29 (1100) | 0.51 / -0.27 (1147) | 0.63 / -0.27 (1209) | 0.59 / -0.27 (1133) | 0.61 / -0.32 (1208)
Korelacja per towar, Materiały wybuchowe: lot / trasa (n tras)              |  0.79 / -0.21 (67) |    — / -0.41 (225) |  0.87 / -0.26 (58) |    — / -0.39 (226) |    — / -0.35 (304)
Korelacja per towar, Elektronika: lot / trasa (n tras)                      | 0.49 / -0.37 (538) | 0.35 / -0.46 (707) | 0.55 / -0.45 (667) | 0.38 / -0.45 (713) | 0.40 / -0.46 (675)
Pc paliwa z mediany marży pełnej ładowni, Żywność (marża kr/m³)             |    94.0 pc (882.1) |    81.1 pc (761.1) |    79.2 pc (742.8) |    81.5 pc (764.2) |    81.9 pc (765.2)
Pc paliwa z mediany marży pełnej ładowni, Minerały (marża kr/m³)            |  347.8 pc (3262.7) |  428.0 pc (4014.3) |  397.3 pc (3726.8) |  426.5 pc (4000.8) | 1071.6 pc (10011.3)
Pc paliwa z mediany marży pełnej ładowni, Rozpuszczalniki (marża kr/m³)     | 1396.2 pc (13095.7) | 1533.9 pc (14388.6) | 1518.9 pc (14248.7) | 1538.8 pc (14435.1) | 2816.7 pc (26313.9)
Pc paliwa z mediany marży pełnej ładowni, Materiały wybuchowe (marża kr/m³) | 5030.1 pc (47181.0) | 1320.8 pc (12390.0) | 2581.3 pc (24215.0) | 1325.4 pc (12432.7) |  391.3 pc (3656.0)
Pc paliwa z mediany marży pełnej ładowni, Elektronika (marża kr/m³)         | 23123.9 pc (216894.7) | 12971.2 pc (121674.3) | 14170.6 pc (132931.0) | 13047.2 pc (122390.0) | 11099.6 pc (103694.9)

Miara                                                                       | L/pelna/A (50 z.) | L/pelna/B (50 z.) | L/pelna/C (50 z.) | L/pelna/D (50 z.) | L/pelna/E (50 z.)
----------------------------------------------------------------------------+-------------------+-------------------+-------------------+-------------------+------------------
Ziarna z zyskiem (próg M ≥ 70%)                                             |            100.0% |            100.0% |            100.0% |            100.0% |            100.0%
Ziarna z podwojeniem wartości                                               |             98.0% |             98.0% |             96.0% |             98.0% |            100.0%
Pierwsza zyskowna trasa, mediana lotów (≤ 3)                                |               2.0 |               2.0 |               2.0 |               2.0 |               2.0
Udział 5 najczęstszych tras (≤ 25%)                                         |              1.4% |              1.5% |              1.5% |              1.5% |              1.6%
Loty wewnątrz jednej cywilizacji (≤ 50%)                                    |             59.3% |             54.9% |             56.3% |             54.7% |             58.3%
Mediana skoków zyskownego lotu (≥ 2)                                        |               3.0 |               3.5 |               3.0 |               4.0 |               3.0
Korelacja zysk/dobę z dystansem lotu (> 0; bez eksploracji)                 |             -0.34 |             -0.37 |             -0.37 |             -0.36 |             -0.44
  loty eksploracyjne                                                        |              0.2% |              0.1% |              0.1% |              0.2% |              0.2%
  …z dystansem całej trasy handlowej (zakup → cel)                          |             -0.41 |             -0.44 |             -0.42 |             -0.43 |             -0.45
  trasy handlowe między cywilizacjami                                       |             50.1% |             55.5% |             53.4% |             55.8% |             52.3%
  mediana dystansu trasy handlowej                                          |           47.8 pc |           53.4 pc |           51.5 pc |           53.4 pc |           49.6 pc
Kontakt z nieznaną cywilizacją (≥ 50%)                                      |              6.0% |              4.0% |              4.0% |              6.0% |              6.0%
Mediana wartości firmy na koniec                                            |     25 466 664 kr |     29 755 913 kr |     28 451 065 kr |     29 792 307 kr |     39 437 236 kr
Mediana liczby lotów                                                        |              38.0 |              37.0 |              38.0 |              37.0 |              38.0
Ziarna, w których bot utknął                                                |                 0 |                 0 |                 0 |                 0 |                 0
Czas bota                                                                   |            77.4 s |            79.3 s |            81.5 s |            80.3 s |            77.4 s
Korelacja po wszystkich dostępnych planach: stopa/dobę vs dystans           | -0.53 (77653 planów) | -0.54 (75408 planów) | -0.54 (75886 planów) | -0.54 (76101 planów) | -0.51 (73928 planów)
  …zysk netto na kurs vs dystans                                            |             -0.93 |             -0.92 |             -0.92 |             -0.92 |             -0.90
Udział paliwa w kosztach lotów (paliwo / (paliwo + płace))                  |             92.3% |             94.4% |             92.2% |             94.5% |             94.3%
Mediana dystansu zyskownej trasy między cywilizacjami                       |           98.5 pc |           97.0 pc |          101.9 pc |           96.2 pc |          109.0 pc
Mediana ceny paliwa zapłaconej w dokach                                     |           4502 kr |           4503 kr |           4502 kr |           4503 kr |           4490 kr
Korelacja per towar, Żywność: lot / trasa (n tras)                          | -0.45 / -0.26 (199) |   — / -0.40 (231) | -0.88 / -0.41 (243) |   — / -0.39 (227) |   — / -0.35 (229)
Korelacja per towar, Minerały: lot / trasa (n tras)                         | 0.35 / -0.37 (548) | 0.40 / -0.34 (545) | 0.26 / -0.35 (559) | 0.42 / -0.33 (549) | 0.32 / -0.46 (487)
Korelacja per towar, Rozpuszczalniki: lot / trasa (n tras)                  | 0.78 / -0.29 (159) | 0.41 / -0.35 (128) | 0.79 / -0.35 (149) | 0.42 / -0.34 (126) |   — / -0.39 (123)
Korelacja per towar, Materiały wybuchowe: lot / trasa (n tras)              |   — / -0.28 (133) |   — / -0.31 (114) |   — / -0.18 (100) |   — / -0.28 (124) |   — / -0.29 (144)
Korelacja per towar, Elektronika: lot / trasa (n tras)                      | 0.66 / -0.46 (512) | 0.57 / -0.42 (502) | 0.54 / -0.41 (480) | 0.60 / -0.42 (499) | 0.43 / -0.44 (503)
Pc paliwa z mediany marży pełnej ładowni, Żywność (marża kr/m³)             |   87.5 pc (821.0) |   91.2 pc (855.2) |   95.7 pc (897.8) |   88.0 pc (825.7) |   79.2 pc (740.9)
Pc paliwa z mediany marży pełnej ładowni, Minerały (marża kr/m³)            | 385.4 pc (3614.5) | 414.5 pc (3888.3) | 404.1 pc (3790.9) | 413.7 pc (3880.7) | 446.4 pc (4176.3)
Pc paliwa z mediany marży pełnej ładowni, Rozpuszczalniki (marża kr/m³)     | 1282.5 pc (12028.0) | 1404.6 pc (13175.7) | 1453.0 pc (13629.2) | 1437.1 pc (13480.8) | 4912.7 pc (45957.0)
Pc paliwa z mediany marży pełnej ładowni, Materiały wybuchowe (marża kr/m³) | 5138.2 pc (48189.0) | 5968.8 pc (55988.5) | 5741.9 pc (53858.5) | 5982.3 pc (56116.0) | 17668.5 pc (165282.3)
Pc paliwa z mediany marży pełnej ładowni, Elektronika (marża kr/m³)         | 41179.6 pc (386208.0) | 39308.9 pc (368728.0) | 41770.8 pc (391805.5) | 39982.4 pc (375047.8) | 54516.6 pc (509983.5)
S/pelna/A: najczęstsze trasy: mlot → zielna (216); milczek → iskra (214); zielna → milczek (187); milczek → szept (175); zielna → kamieniec (165)
S/pelna/A: najczęstsze towary: Żywność (847); Minerały (686); Elektronika (673); Materiały wybuchowe (663); Rozpuszczalniki (650)
S/pelna/B: najczęstsze trasy: mlot → zielna (222); iskra → tygiel (195); zielna → kamieniec (193); tygiel → mlot (192); milczek → iskra (181)
S/pelna/B: najczęstsze towary: Żywność (894); Materiały wybuchowe (831); Minerały (798); Elektronika (749); Rozpuszczalniki (687)
S/pelna/C: najczęstsze trasy: mlot → zielna (199); milczek → iskra (196); zielna → milczek (186); milczek → szept (179); zielna → kamieniec (172)
S/pelna/C: najczęstsze towary: Żywność (871); Materiały wybuchowe (736); Minerały (727); Elektronika (709); Rozpuszczalniki (670)
S/pelna/D: najczęstsze trasy: mlot → zielna (218); iskra → tygiel (194); zielna → kamieniec (194); tygiel → mlot (192); milczek → iskra (183)
S/pelna/D: najczęstsze towary: Żywność (899); Materiały wybuchowe (835); Minerały (800); Elektronika (748); Rozpuszczalniki (685)
S/pelna/E: najczęstsze trasy: mlot → zielna (203); tygiel → mlot (195); zielna → kamieniec (192); iskra → tygiel (173); zielna → milczek (169)
S/pelna/E: najczęstsze towary: Żywność (947); Minerały (825); Elektronika (771); Materiały wybuchowe (769); Rozpuszczalniki (666)
M/pelna/A: najczęstsze trasy: ludzie-venno → orak-ulmorak (6); ludzie-dorvano → ludzie-nonova (5); orak-dzdzul → ludzie-dormiven (5); corrath-umrathcor → orak-ummorul (4); orak-ummorul → orak-dzgrum (4)
M/pelna/A: najczęstsze towary: Minerały (877); Żywność (670); Elektronika (597); Rozpuszczalniki (590); Materiały wybuchowe (347)
M/pelna/B: najczęstsze trasy: ludzie-terka → corrath-ancor (4); ludzie-lunrara → ludzie-noselva (4); orak-khmormor → corrath-irirvos (4); corrath-irirvos → orak-khmormor (4); corrath-ircoran → ludzie-terlun (4)
M/pelna/B: najczęstsze towary: Żywność (1018); Minerały (949); Rozpuszczalniki (848); Elektronika (802); Materiały wybuchowe (451)
M/pelna/C: najczęstsze trasy: orak-khmormor → corrath-irirvos (4); corrath-irirvos → orak-khmormor (4); corrath-rathcor → vreth-thuak (4); ludzie-vaterdor → corrath-ithithsel (4); ludzie-lunselmi → corrath-corcorvos (4)
M/pelna/C: najczęstsze towary: Żywność (963); Minerały (951); Rozpuszczalniki (775); Elektronika (750); Materiały wybuchowe (296)
M/pelna/D: najczęstsze trasy: ludzie-terka → corrath-ancor (4); orak-khmormor → corrath-irirvos (4); corrath-irirvos → orak-khmormor (4); corrath-ircoran → ludzie-terlun (4); ludzie-selterno → orak-thashul (4)
M/pelna/D: najczęstsze towary: Żywność (1022); Minerały (952); Rozpuszczalniki (837); Elektronika (809); Materiały wybuchowe (450)
M/pelna/E: najczęstsze trasy: ludzie-dorlun → ludzie-dorka (4); corrath-voskelith → ludzie-selven (4); ludzie-ternomi → ludzie-vano (4); ludzie-venraven → orak-umor (4); orak-akumash → orak-ormorkh (4)
M/pelna/E: najczęstsze towary: Minerały (1063); Żywność (996); Rozpuszczalniki (903); Elektronika (770); Materiały wybuchowe (478)
L/pelna/A: najczęstsze trasy: vreth-thuvrmal → vreth-vrmalzan (6); vreth-ethvr → vreth-gorruketh (6); vreth-vrok → vreth-akthu (5); velhari-ienha → vreth-ethrukgor (5); vreth-malmal → vreth-thuvr (5)
L/pelna/A: najczęstsze towary: Elektronika (483); Materiały wybuchowe (417); Minerały (395); Żywność (121); Rozpuszczalniki (82)
L/pelna/B: najczęstsze trasy: velhari-riien → vreth-okvr (8); vreth-ethvr → vreth-gorruketh (6); vreth-vrthuruk → ludzie-rara (5); vreth-thuvrmal → vreth-vrmalzan (5); vreth-rukgor → vreth-thuakthu (5)
L/pelna/B: najczęstsze towary: Elektronika (548); Materiały wybuchowe (470); Minerały (452); Żywność (168); Rozpuszczalniki (94)
L/pelna/C: najczęstsze trasy: velhari-ienha → vreth-ethrukgor (7); vreth-ethvr → vreth-gorruketh (6); vreth-drak → ludzie-lunmi (5); ludzie-mimimi → vreth-vrokmal (5); vreth-vrokmal → vreth-malthuruk (5)
L/pelna/C: najczęstsze towary: Elektronika (507); Materiały wybuchowe (450); Minerały (425); Żywność (146); Rozpuszczalniki (84)
L/pelna/D: najczęstsze trasy: velhari-riien → vreth-okvr (8); vreth-ethvr → vreth-gorruketh (6); vreth-vrthuruk → ludzie-rara (5); vreth-thuvrmal → vreth-vrmalzan (5); vreth-rukgor → vreth-thuakthu (5)
L/pelna/D: najczęstsze towary: Elektronika (542); Materiały wybuchowe (472); Minerały (455); Żywność (169); Rozpuszczalniki (92)
L/pelna/E: najczęstsze trasy: vreth-thuvrmal → vreth-vrmalzan (7); corrath-selum → vreth-thuvrmal (6); vreth-ethvr → vreth-gorruketh (6); ludzie-mimimi → vreth-vrokmal (6); vreth-vrokmal → vreth-malthuruk (6)
L/pelna/E: najczęstsze towary: Elektronika (507); Materiały wybuchowe (504); Minerały (398); Żywność (120); Rozpuszczalniki (102)
```
<!-- TABELA-SPREAD-KONIEC -->

### Skrót (kolumny `pelna`, korelacje: lot / cała trasa handlowa)

| Skala | A | B | C | D | E |
|---|---|---|---|---|---|
| S (200): korelacja | −0,33 / −0,34 | −0,39 / −0,39 | −0,35 / −0,35 | −0,39 / −0,39 | −0,41 / −0,41 |
| S: mediana wartości | 12,66 mln (×1,86) | 14,69 mln (×2,16) | 13,96 mln (×2,05) | 14,70 mln (×2,16) | 16,29 mln (×2,40) |
| M (200): korelacja | −0,32 / −0,34 | −0,34 / −0,36 | −0,29 / −0,33 | −0,33 / −0,36 | −0,36 / −0,37 |
| M: mediana wartości | 15,55 mln (×2,29) | 16,32 mln (×2,40) | 16,00 mln (×2,35) | 16,40 mln (×2,41) | 20,62 mln (×3,03) |
| M: pierwsza zyskowna trasa | 2 loty | 1 lot | 1 lot | 1 lot | 1 lot |
| M: loty wewnątrz jednej cywilizacji | 58,0% | 58,6% | 58,5% | 58,3% | 67,2% |
| M: trasy handlowe między cywilizacjami | 47,1% | 47,7% | 47,1% | 48,2% | 36,2% |
| M: kontakt z nieznaną cywilizacją | 56,5% | 28,5% | 34,5% | 29,5% | 24,0% |
| L (50): korelacja | −0,34 / −0,41 | −0,37 / −0,44 | −0,37 / −0,42 | −0,36 / −0,43 | −0,44 / −0,45 |
| L: mediana wartości | 25,47 mln (×3,75) | 29,76 mln (×4,38) | 28,45 mln (×4,18) | 29,79 mln (×4,38) | 39,44 mln (×5,80) |
| Korelacja po dostępnych planach, M: stopa/dobę / zysk na kurs | −0,36 / −0,57 | −0,36 / −0,52 | −0,37 / −0,55 | −0,36 / −0,52 | −0,39 / −0,54 |
| Korelacja po dostępnych planach, L: stopa/dobę / zysk na kurs | −0,53 / −0,93 | −0,54 / −0,92 | −0,54 / −0,92 | −0,54 / −0,92 | −0,51 / −0,90 |
| Udział paliwa w kosztach lotów, M | 92,7% | 94,8% | 92,7% | 94,7% | 94,5% |
| Mediana dystansu zyskownej trasy między cywilizacjami, M | 85 pc | 92 pc | 90 pc | 93 pc | 93 pc |
| Pc paliwa z mediany marży pełnej ładowni, M: Żywność / Minerały / Rozpuszczalniki / Mat. wybuchowe / Elektronika | 94 / 348 / 1 396 / 5 030 / 23 124 | 81 / 428 / 1 534 / 1 321 / 12 971 | 79 / 397 / 1 519 / 2 581 / 14 171 | 82 / 427 / 1 539 / 1 325 / 13 047 | 82 / 1 072 / 2 817 / 391 / 11 100 |

Korelacje per towar dominujący trasy (M, lot / trasa handlowa): Żywność A −0,18 / −0,39, B +0,18 / −0,41, E +0,15 / −0,40; Minerały A +0,35 / −0,34, B +0,20 / −0,35, E +0,34 / −0,31; Rozpuszczalniki A +0,53 / −0,29, B +0,51 / −0,27, E +0,61 / −0,32; Materiały wybuchowe A +0,79 / −0,21, B — / −0,41; Elektronika A +0,49 / −0,37, B +0,35 / −0,46, E +0,40 / −0,46 („—” = za mała zmienność próby). **Wewnątrz jednego towaru dłuższy lot daje więcej na dobę** (korelacje na poziomie lotu dodatnie dla minerałów, rozpuszczalników, materiałów wybuchowych i elektroniki, a po usunięciu spreadu także dla żywności), natomiast ogólna korelacja jest ujemna przez mieszankę towarów (paradoks Simpsona): długie loty pozycjonujące wiozą tanią żywność przy niskiej stopie, a krótkie odcinki dystrybucji realizują zysk z drogich towarów. Na poziomie całej trasy handlowej (razem z odcinkami pozycjonowania) korelacja jest ujemna także wewnątrz towaru. Pc paliwa dla elektroniki i materiałów wybuchowych to wielkości teoretyczne: pełnej ładowni tych towarów nie da się kupić za kapitał startowy, a porty wchłaniają po kilka m³.

## Odpowiedzi

55. **Czy usunięcie stałego spreadu odwraca znak korelacji zysku na dobę z dystansem?** Nie, w żadnym wariancie i w żadnej skali: B, C, D i E dają korelację od −0,29 do −0,44 na poziomie lotu i od −0,33 do −0,45 na poziomie całej trasy handlowej (A: −0,32…−0,34 / −0,34…−0,41), a po wszystkich dostępnych planach w dokach nawet zysk na kurs maleje z dystansem (M −0,52…−0,57, L −0,90…−0,93). Usunięcie spreadu podnosi medianę wartości firmy o 3–5% w M, 10–16% w S i 12–17% w L; wariant E (bez obcięcia nacisku) podnosi ją najmocniej (M ×3,03, L ×5,80), ale korelację pogarsza (M −0,36 / −0,37, L −0,44 / −0,45), bo nacisk do 5,8 najbardziej nagradza sprzedaż do pustych portów tuż za granicą terytorium: loty wewnątrz jednej cywilizacji rosną w M do 67%, a trasy między cywilizacjami spadają do 36%. Bez spreadu w M czas do pierwszej zyskownej trasy skraca się z 2 lotów do 1, a skłonność do eksploracji maleje (kontakt 56% → 24–35%), bo lokalny handel staje się tańszy niż ryzyko dalekiej podróży. Druga blokada z promptu (nasycenie stosunku cen sprzedaży do kupna przy ok. 2 przez obcięcie 0,45–2,5) jest prawdziwa jako obserwacja, ale jej zdjęcie nie pomaga dalekim trasom: w E mediana marży na m³ minerałów rośnie trzykrotnie (3,3 tys. → 10 tys. kr), lecz zarabia się ją na krótkich odcinkach.
56. **Która liczba kanonu blokuje dalekie trasy i o ile musiałaby się zmienić?** Żadna pojedyncza, co pokazują eksperymenty z fazy 7 (`findings.md`): przy `BasePrice Fuel` = 0 albo `kosztPaliwaNaParsek` = 0 korelacja po wykonanych trasach w M zostaje przy −0,35…−0,51; to samo przy paśmie nacisku 0,2–5,0 (i w pełnym wariancie E bez obcięcia), ładowni ×3, kapitale ×3, prędkości ×2, baku ×3 i wszystkich tych zmianach naraz (−0,36 / −0,45). Paliwo to 92–98% kosztów lotów i decyduje, które towary opłaca się wieźć daleko (mediana marży z pełnej ładowni pokrywa w M ok. 80–95 pc dla żywności, ok. 350–430 pc dla minerałów, ok. 1 400–1 540 pc dla rozpuszczalników; w E minerały ok. 1 070 pc), ale nie ono psuje korelację. Psuje ją połączenie dwóch własności kanonu: ograniczonej marży na kurs (ładownia × różnica cen; w A–D pasmo `StockPressureMin`/`Max` ogranicza ją do ×5,6, w E ogranicza ją głębokość portu i kapitał) oraz czasu kursu rosnącego liniowo z dystansem (`predkoscNominalna`), przez co stopa na dobę ~ ograniczona marża / dystans. Żeby korelacja była ≥ 0, różnica cen musiałaby rosnąć z dystansem co najmniej liniowo aż do horyzontu gry, czyli kanon potrzebowałby **reguły** (premia cenowa zależna od odległości źródła towaru albo nacisk rosnący z dystansem od producenta), a nie innej wartości istniejącej liczby. Jedyne obliczenie skalarne, jakie ma sens, dotyczy zysku **na kurs** na skali L (punkt 58): tam dalekie cele zaczynają oferować więcej na kurs dopiero przy paliwie ok. 3–5% kanonu.
57. **Skutek dla handlowca i dla kryterium „obrót na jednej planecie nie daje zysku”.** Handlowiec działa tylko w oknie spreadu podstawowego: w B, D i E (spread 0) nie zmienia żadnej ceny i bot przestaje go zatrudniać, w C okno 0,10 daje mu 4% ceny zamiast 12%, czyli rola słabnie trzykrotnie, ale pozostaje opłacalna przy pełnej ładowni. Kryterium „obrót na jednej planecie nie daje zysku” jest spełnione we wszystkich wariantach (test: każdy towar, trzy ilości, trzy załogi, S i M, także w E), ale w B/C/D/E gwarantuje je pamięć zakupu, a nie spread: po 5 skokach kara gaśnie, więc gracz może wrócić na planetę zakupu dłuższą pętlą i sprzedać bez kary; przy cenie krańcowej natychmiastowa odsprzedaż tej samej ilości bez spreadu daje dokładnie zero, więc to kara (0,3 albo malejąca) robi z tego stratę. Wariant D (kara liniowa) zachowuje się jak B we wszystkich miarach (różnice ≤ 0,02 korelacji i ≤ 1% wartości), bo bot rzadko wraca na planetę zakupu przed piątym skokiem.

58. **O ile musiałoby zmienić się paliwo (obliczenie na L, bez zmiany kanonu).** Na skali L cywilizacje leżą w osobnych sektorach, więc tam różnica cen faktycznie rośnie z dystansem. Przegląd `BasePrice Fuel` × {1; 0,5; 0,25; 0,1; 0,03; 0} na L (20 ziaren, `pelna`; korelacje po wykonanych trasach: lot / trasa; po dostępnych planach: stopa na dobę / zysk na kurs):

| Wariant | Paliwo × | wykonane: lot / trasa | dostępne plany: stopa na dobę / zysk na kurs | mediana / start | udział paliwa w kosztach |
|---|---|---|---|---|---|
| A | 1 (kanon) | −0,32 / −0,41 | −0,55 / −0,93 | ×3,65 | 92% |
| A | 0,5 | −0,43 / −0,52 | −0,49 / −0,79 | ×4,59 | 85% |
| A | 0,25 | −0,45 / −0,54 | −0,46 / −0,51 | ×4,66 | 75% |
| A | 0,1 | −0,45 / −0,54 | −0,45 / −0,16 | ×4,97 | 59% |
| A | 0,03 | −0,40 / −0,57 | −0,43 / **+0,07** | ×4,94 | 34% |
| A | 0 | −0,40 / −0,58 | −0,43 / **+0,16** | ×4,99 | 0% |
| B | 1 (kanon) | −0,37 / −0,45 | −0,55 / −0,92 | ×4,46 | 94% |
| B | 0,5 | −0,43 / −0,49 | −0,50 / −0,73 | ×4,94 | 89% |
| B | 0,25 | −0,46 / −0,52 | −0,47 / −0,41 | ×5,16 | 81% |
| B | 0,1 | −0,47 / −0,53 | −0,44 / −0,06 | ×5,31 | 69% |
| B | 0,03 | −0,42 / −0,55 | −0,43 / **+0,11** | ×5,50 | 46% |
| B | 0 | −0,41 / −0,55 | −0,42 / **+0,20** | ×5,42 | 0% |

Wniosek liczbowy: zysk **na kurs** z dostępnych planów przestaje maleć z dystansem dopiero, gdy `BasePrice Fuel` spada do ok. 3–5% kanonu (w B zero korelacji wypada między ×0,1 a ×0,03, czyli ok. 50 WU/m³ zamiast 1 000, ok. 500 kr za parsek zamiast 10 000); wtedy dalekie cele oferują więcej na kurs niż bliskie, a bez spreadu (B) efekt jest nieco silniejszy niż w A (+0,20 vs +0,16 przy paliwie 0). Zysk **na dobę** (miara z promptu) pozostaje ujemnie skorelowany z dystansem przy każdej cenie paliwa, także zerowej (−0,40…−0,45 po wykonanych lotach, −0,43 po dostępnych planach), bo czas kursu rośnie z dystansem, a marża na kurs nie rośnie szybciej niż liniowo. Żadna wartość `BasePrice Fuel` ani `kosztPaliwaNaParsek` nie daje więc korelacji zysku na dobę ≥ 0; daje ją tylko zmiana reguły, nie liczby.

---

# Progresja: 1000 dób (PROMPT-progresja.md)

Pytanie projektantów: czy w ok. 1 000 dób gracz osiąga maksimum galaktyki (9 cywilizacji na T4), firmy (szczebel 5 drabiny kadłubów) i załogi (4 załogantów na Legendzie). Test na L, 1 200 dób, spread B, informacja pełna, 50 ziaren. Liczby kanonu, których nie zmieniałem: paliwo (1 m³/pc, 1 000 WU/m³), ceny bazowe, progi XP (0 / 500 / 1 500 / 9 999), widełki płac tierów (120–180 / 280–450 / 580–900 / 1 100–1 800 kr/dobę), `TierCount` = 4, drabina 6 szczebli (0–5, status proponowane), BaseShip 480 m³ / 100 m³, prędkość 4 pc/dobę, kapitał 6,8 mln kr. Wszystkie nowe wpisy w `kanon.json` to te liczby; wszystko inne jest w `prototyp.json` (blok `progresja` i parametry `bot.*`) i poniżej.

## Założenia modelu

59. **Przełącznik `progresja`** (`prototyp.json`, nagłówek gry, `&progresja=1`; domyślnie wyłączony). Z wyłączoną progresją gra, bot i testy zachowują się dokładnie jak przed tym zadaniem (ci sami kandydaci, te same kursy, 55 dotychczasowych testów bez zmian), więc tabele z sekcji „Galaktyka” i „Spread” pozostają odtwarzalne. Z włączoną progresją horyzont to `progresja.horyzontDob` = 1 200 niezależnie od skali (na M i S też), a `OpcjeGry.limitDob` pozwala go nadpisać w skryptach.
60. **Tier cywilizacji** (`stan.tiery`, start T1 dla wszystkich dziewięciu) podnosi wyłącznie gracz: cywilizacja awansuje, gdy suma jego dostaw koszyka kolejnego tieru osiągnie próg. Dostawa = sprzedaż towaru koszyka w porcie tej cywilizacji, liczona **po cenie bazowej kanonu** (m³ × BasePrice, w WU), żeby próg nie zależał od chwilowego nacisku ani od tego, jak bardzo gracz sam sobie popsuł cenę. Liczy się tylko towar **kupiony u innej cywilizacji**: ładownia pamięta pochodzenie (cywilizacja zakupu → m³, `PozycjaLadowni.pochodzenie`), a sprzedaż schodzi z pochodzenia proporcjonalnie; bez tego kupno i odsprzedaż elektroniki w tym samym porcie (albo przewóz między dwiema planetami jednej cywilizacji) byłyby „dostawą”. Handel NPC niczego nie dostarcza (test: 300 dób bez sprzedaży gracza, wszystkie tiery = 1).
61. **Koszyki** (`progresja.koszyki`): T2 = Elektronika (100%), T3 = Elektronika 50% + Materiały wybuchowe 50% („nauka” z promptu: nie ma jej jako towaru), T4 = ten sam skład z mnożnikiem progu 2 („oba w większej ilości”). Koszyk jest pełny, gdy **każdy** jego składnik osiągnie swój udział progu (minimum z udziałów), więc T3 wymaga obu towarów, nie dowolnej mieszanki. Prompt mówi, że T2 „otwiera popyt na Elektronikę”; w prototypie popyt na elektronikę istnieje od kontaktu (DECYZJE 6), więc przyjąłem, że tier go **mnoży**, a nie tworzy (port z zerową konsumpcją nie miałby normy ani ceny).
62. **Próg awansu** = `progAwansu` × mnożnik progu tieru × dzienny „PKB” portów cywilizacji, gdzie PKB = Σ po planetach i towarach (konsumpcja + konsumpcja uśpiona) × cena bazowa, w WU/dobę (z paliwem; port je konsumuje). Na L to ok. 0,33–1,35 mln WU/dobę na cywilizację (Orak 0,33, Velhari 1,35), czyli przy `progAwansu` = 1 koszyk T2 Ludzi to ok. 0,6 mln WU = 9–10 m³ elektroniki po cenie bazowej (6 mln kr), a koszyk T4 Velhari ok. 2,7 mln WU. Po awansie licznik dostaw zeruje się (nadwyżka nie przechodzi na następny tier).
63. **Skutek awansu**: konsumpcja i norma każdego towaru koszyka na wszystkich planetach cywilizacji × `mnoznikKonsumpcjiAwansu` = 1,5 (produkcja bez zmian, więc cywilizacja staje się importerem tych towarów; na T4 elektronika ma ×3,375 konsumpcji z T1). Norma rośnie, zapas nie, więc nacisk skacze w górę: awans natychmiast zmienia rynek, co jest intencją promptu („popyt na dobra o Engel > 1 rośnie”). To jedyne źródło wzrostu PKB w świecie: cywilizacje same nie rosną (nie dodawałem wzrostu autonomicznego, bo prompt zabrania nowych sufitów, a wykładniczy wzrost bez sufitu nie ma sensu w 1 200-dobowym teście).
64. **Drabina kadłubów** (`stan.szczebel` 0–5): ładownia, bak **i limit masy** × `mnoznikSzczebla`^N (1,5; szczebel 5 = ×7,6: 3 645 m³, 759 m³, 10 935 t). Masę skaluję razem z objętością, bo inaczej od szczebla 2 większa ładownia nie pomieściłaby nic poza żywnością. Paliwo i ładunek zostają przy zakupie; kupno tylko w stoczni stolicy znanej cywilizacji (`wStoczni`).
65. **Cena szczebla N+1 = `k` × mediana zysku na kurs zmierzona przez grę na szczeblu N**, nie wpisana na sztywno. „Kurs” mierzy sama gra, niezależnie od bota: pierwsza sprzedaż w doku zamyka kurs, którego zysk = wartość firmy przy przylocie do tego doku − wartość przy przylocie do poprzedniego doku ze sprzedażą (+ wydatki na kadłub w tym czasie), więc przystanki na tankowanie i przeloty wliczają się w kurs, a nie liczą się jako osobne „kursy” ze stratą. Stocznia wycenia dopiero po `minKursowDoWycenySzczebla` = 5 kursach na obecnym szczeblu i tylko przy dodatniej medianie. Test: cena rośnie, gdy rosną zyski kursów; przed 5 kursami brak wyceny. Domyślne `k` = 10; przegląd poniżej.
66. **XP załogi**: każdy załogant na pokładzie dostaje `xpNaDobeLotu` × doby lotu i `xpZaKontakt` = 100 za kontakt z nową cywilizacją (doliczane po locie, więc efekty lotu liczą się przy starej umiejętności). Tier = najwyższy próg kanonu ≤ XP. **Umiejętność z tieru i talentu**: pasmo skillFloor…skillCeiling (0,80–1,25) podzielone na 4 równe pasma tierów, a talent ∈ [0,1] (losowany raz, 2 miejsca) ustawia pozycję w paśmie: Nowicjusz 0,80–0,91, Weteran 0,91–1,03, Mistrz 1,03–1,14, Legenda 1,14–1,25. Płaca = dolne widełki tieru + talent × (górne − dolne). Kandydaci startują od `xpStartoweKandydata` = 0 (inaczej kamienie „pierwszy załogant na tierze” byłyby losowane, a nie zdobywane). Skutek uboczny wart uwagi: nowicjusz-pilot ma 0,80–0,91, więc **spowalnia** statek o 9–20% (prędkość × umiejętność dosłownie, DECYZJE 10) i opłaca się dopiero od tieru Mistrz.
67. **Bot z inwestycjami** (tylko w trybie progresji; poza nim bot jest ten sam co w sekcji „Spread”). (a) **Kadłub**: w stoczni stolicy kupuje szczebel, gdy gotówka ≥ `mnoznikGotowkiNaSzczebel` = 1,5 × ceny (prompt) **i** po zakupie zostaje budżet wyjścia (koszt pustego lotu do stolicy innej cywilizacji); gdy go stać, a stoi gdzie indziej, ogranicza cele planów do najbliższej znanej stolicy (wyprawa do stoczni, handluje po drodze). (b) **Premia awansu**: plan sprzedaży towaru koszyka do cywilizacji poniżej T4 dostaje perspektywiczną wartość = dodatkowa konsumpcja po awansie (m³/dobę) × mediana własnych marż bota na tym towarze (co najmniej `minSprzedazyDoMarzy` = 3 sprzedaże; bez historii 0) × min(pozostałe doby, `horyzontAwansuDob` = 600) × `udzialWPopycieAwansu` = 0,25, rozłożona liniowo na potrzebną wartość koszyka; liczy się tylko, gdy reszta koszyka po cenie bazowej ≤ `maxResztaKoszykaKrotnoscMajatku` = 2 × majątek bota (inaczej awans nie jest „w perspektywie”), z pułapem `maxPremiaUlamekCeny` = 1 × cena bazowa na m³ i odrzucana w planie, który spaliłby więcej niż `maxStrataNaKoszykUlamek` = 10% gotówki; premia nie jest gotówką i nie wchodzi do szacunku gotówki po kursie (bez tych hamulców bot kupował elektronikę po 613 tys. kr/m³, żeby ją „dostarczyć” ze stratą, i bankrutował; `findings.md`). (c) **Załoga**: zatrudnia, gdy plan z nowym załogantem jest gorszy o nie więcej niż `maxKosztDobyXpKr` = 500 kr/dobę, i nie zwalnia ani nie podmienia (XP to inwestycja, kandydat zaczyna od zera). (d) **Ekspedycje**: zachłanna stopa na dobę nigdy nie wybierze pustego lotu na 600–1 500 pc (nawet z premią kontaktu skalowaną horyzontem bot kończył 1 200 dób znając 3 cywilizacje z 9), więc co `dobyMiedzyEkspedycjami` = 100 dób, do 0,6 horyzontu, bot zobowiązuje się do najbliższej planety nieznanej cywilizacji po grafie tankowania, jeśli gotówka z ładunkiem ≥ `mnoznikGotowkiNaEkspedycje` = 2 × koszt paliwa (po cenie bazowej) i płac; na każdym przystanku sprawdza, czy zostaje `mnoznikGotowkiNaKontynuacje` = 1,3 × koszt reszty drogi, inaczej przerywa; po drodze sprzedaje, co ma, i nic nie wiezie (rynek celu nieznany). (e) **Odwrót**: po `slabychDokowDoOdwrotu` = 1 doku ze znanym rynkiem bez dodatniego planu bot ogranicza cele do najbliższej znanej stolicy innej cywilizacji (regiony eksportowe, jak Velhari, nie mają lokalnych tras pokrywających paliwo 7,7 tys. kr/m³). (f) **Planowanie**: plan, na który nie starcza gotówki po sprzedaży tutaj i kosztach trasy, jest odrzucany; paliwo wyceniane odcinek po odcinku po znanej cenie w węźle startu odcinka (plemiona i nieznane planety: cena bazowa); dotankowanie „do pełna, gdy tanio” zostawia rezerwę na paliwo i płace trasy (bak do 759 m³). Wszystkie te reguły wzięły się z bankructw w pierwszym przeglądzie (6–10 ziaren na 50; opis przyczyn w `findings.md`); po nich zostają 2 bankructwa na 50, oba po drugiej z rzędu ekspedycji do Duhari.
68. **Miary** (`npm run progresja`): kamienie milowe z `stan.kamienie` (doba pierwszego osiągnięcia; szczeble 1–5, pierwsza cywilizacja na T2/T3/T4, połowa (≥ 5) i wszystkie na T4, pierwszy załogant na tierze 1–3, cała załoga (4 miejsca) na Legendzie, kontakt ze wszystkimi), mediana i zakres 10–90% po ziarnach (ziarno bez kamienia = ∞, więc mediana „> horyzont” oznacza, że nie osiągnęła go większość), odsetek ziaren z kamieniem do doby 1 000; krzywa wartości firmy co 100 dób (kr + ładunek, osobno z doliczonymi wydatkami na kadłub, bo zakup szczebla to inwestycja, a nie strata); stabilność: dzienny PKB i wartość zapasów portów po cenach bazowych w d0/d600/d1200, udział pozycji rynku na sufitach (zapas 0 albo 6 norm), NaN; objazd 9 stolic (najbliższy sąsiad po najkrótszych ścieżkach) jako dolne oszacowanie drogi do kontaktu ze wszystkimi.

## Wynik (L, 1 200 dób, spread B, informacja pełna, 50 ziaren „1”…„50”; `progAwansu` 0,25, `k` 5, `mnoznikSzczebla` 1,5, `xpNaDobeLotu` 11, `xpZaKontakt` 100)

Ziarno bez kamienia liczy się jako „> horyzont”, więc mediana „> horyzont” oznacza, że kamienia nie osiągnęła większość ziaren. Bot utknął (bankructwo) w 3 ziarnach na 50 (14, 27, 42: dwa po drugiej z rzędu ekspedycji, jedno bez ekspedycji); te ziarna liczą się jako „nie osiągnęły”.

### Kamienie milowe

<!-- TABELA-PROGRESJA-START -->
| Kamień milowy | mediana doby | 10–90% | osiągnęło do 1000 | osiągnęło do 1200 |
|---|---|---|---|---|
| Kadłub: szczebel 1 | 155 | 104–351 | 98.0% | 98.0% |
| Kadłub: szczebel 2 | 347 | 230–846 | 92.0% | 94.0% |
| Kadłub: szczebel 3 | 618 | 353–> horyzont | 84.0% | 88.0% |
| Kadłub: szczebel 4 | 891 | 511–> horyzont | 64.0% | 76.0% |
| Kadłub: szczebel 5 **(maksimum osi: firma)** | 1123 | 767–> horyzont | 34.0% | 56.0% |
| Kontakt ze wszystkimi cywilizacjami | > horyzont | > horyzont–> horyzont | 0.0% | 0.0% |
| Pierwsza cywilizacja na T2 | 42 | 28–69 | 98.0% | 98.0% |
| Pierwsza cywilizacja na T3 | 212 | 117–433 | 98.0% | 98.0% |
| Pierwsza cywilizacja na T4 | 688 | 297–> horyzont | 62.0% | 82.0% |
| Połowa cywilizacji na T4 | > horyzont | > horyzont–> horyzont | 0.0% | 0.0% |
| Wszystkie cywilizacje na T4 **(maksimum osi: galaktyka)** | > horyzont | > horyzont–> horyzont | 0.0% | 0.0% |
| Pierwszy załogant: Weteran (500 XP) | 53 | 46–65 | 100.0% | 100.0% |
| Pierwszy załogant: Mistrz (1 500 XP) | 145 | 139–156 | 100.0% | 100.0% |
| Pierwszy załogant: Legenda (9 999 XP) | 906 | 894–968 | 94.0% | 98.0% |
| Cała załoga (4 miejsca) na Legendzie **(maksimum osi: zaloga)** | 972 | 943–1042 | 76.0% | 98.0% |
<!-- TABELA-PROGRESJA-KONIEC -->

Mediana znanych cywilizacji na koniec: 4 z 9 (1,58 ekspedycji na ziarno); mediana szczebla kadłuba na koniec: 5; mediana średniego tieru cywilizacji: 1,33; mediana liczby lotów: 57,5. Objazd 9 stolic najbliższym sąsiadem po grafie skoków: mediana 4 253 pc = 1 063 dób przy 4 pc/dobę i 4 253 m³ paliwa = 42,5 mln kr po cenie bazowej (kapitał startowy 6,8 mln).

### Krzywa wartości firmy (mediana po ziarnach co 100 dób)

| Doba | mediana wartości firmy (kr + ładunek) | mediana z kadłubem | × start |
|---|---|---|---|
| 0 | 6.8 mln | 6.8 mln | ×1.00 |
| 100 | 11.4 mln | 11.6 mln | ×1.70 |
| 200 | 11.8 mln | 15.2 mln | ×2.23 |
| 300 | 13.9 mln | 20.0 mln | ×2.95 |
| 400 | 16.5 mln | 25.6 mln | ×3.77 |
| 500 | 17.5 mln | 25.1 mln | ×3.69 |
| 600 | 18.1 mln | 28.0 mln | ×4.12 |
| 700 | 19.0 mln | 30.0 mln | ×4.41 |
| 800 | 18.0 mln | 31.4 mln | ×4.62 |
| 900 | 18.9 mln | 32.2 mln | ×4.73 |
| 1000 | 20.4 mln | 37.4 mln | ×5.50 |
| 1100 | 22.3 mln | 42.6 mln | ×6.27 |
| 1200 | 31.7 mln | 50.2 mln | ×7.38 |

### Stabilność gospodarki (mediany po ziarnach)

| Miara | d0 | d600 | d1200 | wzrost d0–600 | wzrost d600–1200 |
|---|---|---|---|---|---|
| Dzienny PKB portów (mediana ziaren) | 7.11 mln WU | 7.26 mln WU | 7.32 mln WU | ×1.013 | ×1.007 |
| Wartość zapasów portów | 332.84 mln WU | 595.23 mln WU | 589.55 mln WU | ×1.787 | ×0.994 |
| Pozycje rynku na sufitach (zapas 0 albo 6 norm) | 20.3% | 44.9% | 48.6% | 24.9 pkt | 3.5 pkt |
| Ziarna z NaN w rynkach | 0 | | | | |

## Przegląd parametrów (50 ziaren na wartość; pozostałe parametry jak wyżej; kolumny: mediana doby i zakres 10–90%)

Oś galaktyki: `progAwansu` (T2–T4 pierwszej cywilizacji, połowa i wszystkie na T4):

| `progAwansu` | Pierwsza cywilizacja na T2 | Pierwsza cywilizacja na T3 | Pierwsza cywilizacja na T4 | Połowa cywilizacji na T4 | Wszystkie cywilizacje na T4 | maksimum do 1000 | mediana wartości z kadłubem d1200 | utknęło |
|---|---|---|---|---|---|---|---|---|
| 0.1 | 40 (28–60) | 73 (44–219) | 306 (132–571) | > horyzont (> horyzont–> horyzont) | > horyzont (> horyzont–> horyzont) | 0.0% | 61.2 mln | 1 |
| 0.25 | 42 (28–69) | 212 (117–433) | 688 (297–> horyzont) | > horyzont (> horyzont–> horyzont) | > horyzont (> horyzont–> horyzont) | 0.0% | 50.2 mln | 3 |
| 0.5 | 53 (36–86) | 459 (218–952) | 1170 (338–> horyzont) | > horyzont (> horyzont–> horyzont) | > horyzont (> horyzont–> horyzont) | 0.0% | 45.8 mln | 2 |
| 1 | 122 (56–317) | 827 (293–> horyzont) | > horyzont (1067–> horyzont) | > horyzont (> horyzont–> horyzont) | > horyzont (> horyzont–> horyzont) | 0.0% | 52.8 mln | 1 |
| 2 | 315 (148–456) | > horyzont (487–> horyzont) | > horyzont (> horyzont–> horyzont) | > horyzont (> horyzont–> horyzont) | > horyzont (> horyzont–> horyzont) | 0.0% | 51.4 mln | 2 |
| 5 | 537 (303–972) | > horyzont (987–> horyzont) | > horyzont (> horyzont–> horyzont) | > horyzont (> horyzont–> horyzont) | > horyzont (> horyzont–> horyzont) | 0.0% | 53.6 mln | 1 |

Oś firmy: `k` (cena szczebla = `k` × mediana zysku na kurs):

| `k` | Kadłub: szczebel 1 | Kadłub: szczebel 3 | Kadłub: szczebel 5 | maksimum do 1000 | mediana wartości z kadłubem d1200 | utknęło |
|---|---|---|---|---|---|---|
| 1 | 148 (101–248) | 789 (365–> horyzont) | > horyzont (925–> horyzont) | 16.0% | 25.9 mln | 2 |
| 2 | 148 (101–248) | 672 (365–> horyzont) | > horyzont (844–> horyzont) | 24.0% | 31.9 mln | 1 |
| 3 | 148 (101–254) | 615 (345–> horyzont) | > horyzont (852–> horyzont) | 30.0% | 36.1 mln | 2 |
| 5 | 155 (104–351) | 618 (353–> horyzont) | 1123 (767–> horyzont) | 34.0% | 50.2 mln | 3 |
| 10 | 295 (166–750) | 947 (456–> horyzont) | > horyzont (865–> horyzont) | 18.0% | 52.4 mln | 2 |
| 20 | 789 (268–> horyzont) | > horyzont (> horyzont–> horyzont) | > horyzont (> horyzont–> horyzont) | 4.0% | 33.4 mln | 3 |

Co naprawdę ogranicza drabinę (k = 5, 20 ziaren, warianty reguł bota i stoczni):

| wariant (k = 5, 20 ziaren) | szczebel 1 | 2 | 3 | 4 | 5 | mediana wartości z kadłubem | utknęło | czas |
|---|---|---|---|---|---|---|---|---|
| bazowy: 5 kursów do wyceny, ekspedycje co 100 dób | 156 (104–331) | 342 (259–550) | 595 (367–859) | 839 (548–> horyzont) | 1044 (808–> horyzont) | 51.4 mln | 1 | 83 s |
| 1 kurs do wyceny, ekspedycje co 100 dób | 109 (62–288) | 240 (140–421) | 373 (254–711) | 635 (363–865) | 814 (478–> horyzont) | 62.7 mln | 0 | 91 s |
| 1 kurs do wyceny, bez ekspedycji | 109 (62–169) | 214 (140–268) | 300 (224–377) | 386 (333–503) | 467 (415–584) | 97.0 mln | 0 | 130 s |
| 5 kursów do wyceny, bez ekspedycji | 145 (104–174) | 267 (222–312) | 386 (323–444) | 501 (441–630) | 624 (562–740) | 90.5 mln | 0 | 124 s |
| 5 kursów, ekspedycje, kupno przy 1,0 × ceny (bez budżetu 1,5×) | 156 (104–331) | 342 (259–550) | 595 (367–859) | 839 (548–> horyzont) | 1057 (728–> horyzont) | 52.9 mln | 1 | 79 s |

Oś załogi: `xpNaDobeLotu`:

| `xpNaDobeLotu` | Pierwszy załogant: Weteran (500 XP) | Pierwszy załogant: Mistrz (1 500 XP) | Pierwszy załogant: Legenda (9 999 XP) | Cała załoga (4 miejsca) na Legendzie | maksimum do 1000 | mediana wartości z kadłubem d1200 | utknęło |
|---|---|---|---|---|---|---|---|
| 2 | 251 (212–279) | 718 (670–767) | > horyzont (> horyzont–> horyzont) | > horyzont (> horyzont–> horyzont) | 0.0% | 50.5 mln | 0 |
| 5 | 108 (101–122) | 307 (288–332) | > horyzont (> horyzont–> horyzont) | > horyzont (> horyzont–> horyzont) | 0.0% | 51.2 mln | 1 |
| 8 | 68 (63–85) | 194 (190–212) | > horyzont (1243–> horyzont) | > horyzont (> horyzont–> horyzont) | 0.0% | 52.1 mln | 0 |
| 10 | 58 (51–68) | 157 (151–173) | 998 (982–1059) | 1068 (1036–1120) | 0.0% | 49.3 mln | 0 |
| 11 | 53 (46–65) | 145 (139–156) | 906 (894–968) | 972 (943–1042) | 76.0% | 50.2 mln | 3 |
| 12 | 46 (43–60) | 134 (127–153) | 838 (820–890) | 904 (882–980) | 92.0% | 50.5 mln | 2 |
| 15 | 41 (36–50) | 109 (102–122) | 679 (661–722) | 743 (715–812) | 100.0% | 52.9 mln | 1 |

## Odpowiedzi

69. **Galaktyka: nie.** Przy obecnym kanonie żadne z 50 ziaren nie doprowadziło wszystkich 9 cywilizacji do T4, ani połowy z nich, ani nawet do kontaktu ze wszystkimi dziewięcioma: mediana znanych cywilizacji po 1 200 dobach to 4, a pierwsza cywilizacja osiąga T4 w medianie 688 dób (62% ziaren do doby 1 000) przy `progAwansu` = 0,25. Barierą nie jest próg awansu, tylko odległości i paliwo: objazd 9 stolic to mediana 4 253 pc, czyli 1 063 doby czystego lotu przy 4 pc/dobę (bez handlu, bez tankowania po drodze) i 42,5 mln kr paliwa po cenie bazowej, sześć kapitałów startowych; pusty przelot do najbliższej nieznanej cywilizacji z regionu startowego kosztuje 4–9 mln kr (`findings.md`). Dlatego bot, który eksploruje, dociera do 4–5 cywilizacji, a eksploracja do 8 (ziarno 14) kończy się bankructwem.
70. **Firma: na granicy, i tylko bez eksploracji.** Szczebel 5 wypada w medianie 1 123 dób (34% ziaren do doby 1 000, 56% do 1 200) przy `k` = 5. `k` nie jest wąskim gardłem: dla `k` = 1…5 szczebel 1 przychodzi w ok. 150 dób niezależnie od ceny, szczebel 3 w 615–790, a szczebel 5 po horyzoncie (tylko `k` = 5 ma medianę 1 123); tańszy kadłub (`k` 1–3) nie przyspiesza drabiny, a obniża wartość firmy (26–36 mln zamiast 50 mln), bo wcześnie kupiony większy kadłub wiąże gotówkę i podnosi koszt tankowania bez zysku na kurs, skoro mediana zysku na kurs (0,4–0,9 mln kr) rośnie ze szczeblem słabo — na płytkich rynkach portowych zysk kursu ogranicza głębokość portu docelowego, nie pojemność ładowni — więc nawet tani kadłub czeka na 5 kursów na obecnym szczeblu, wyprawę do stolicy i budżet wyjścia. Decydują ekspedycje: ten sam bot bez ekspedycji kończy drabinę w medianie 624 dób (5 kursów do wyceny) albo 467 (1 kurs), z ekspedycjami w 1 044 albo 814 (sonda na 20 ziarnach, tabela wyżej); bez ekspedycji mediana wartości z kadłubem po 1 200 dobach to 90–97 mln zamiast 51 mln, bo każda ekspedycja to 4–9 mln kr paliwa i kilkaset dób bez zysku. Wniosek: gracz, który nie szuka nowych cywilizacji, zdąży z kadłubem przed 1 000. dobą; gracz, który szuka, nie.
71. **Załoga: tak, jeśli `xpNaDobeLotu` ≈ 11.** Cała czwórka na Legendzie wypada w medianie 972 dób (943–1 042; 76% ziaren do doby 1 000, 98% do 1 200), pierwszy Legenda w 906. dobie, Weteran w 53., Mistrz w 145. Zależność jest prawie liniowa w 1/XP: 10 XP/dobę lotu → 1 070 dób, 11 → 977, 12 → 905, 15 → 730, a przy 2 XP/dobę załoga kończy grę jako Mistrzowie (Legenda nieosiągalna). Bot zatrudnia nawigatorów i handlowców (handlowiec w B nic nie daje, ale nie szkodzi), nigdy pilotów: nowicjusz-pilot (0,80–0,91) spowalnia statek o 9–20%, czego tolerancja 500 kr/dobę nie pokrywa.
72. **Które liczby kanonu wymusza ten cel.** (a) **9 999 XP Legendy** wymusza ok. 11 XP na dobę lotu (załogant jest na pokładzie ok. 95% dób gry, więc 1 000 dób ≈ 10 500 XP); dowolny inny próg daje proporcjonalnie inne tempo (przy 2 XP/dobę Legenda musiałaby leżeć na ok. 2 000 XP). (b) **Prędkość 4 pc/dobę i promień galaktyki 1 257 pc**: sam objazd 9 stolic (4 253 pc) to 1 063 doby, więc „wszystkie cywilizacje na T4 w 1 000 dób” nie mieści się nawet bez handlu; potrzebna byłaby prędkość rzędu 8–10 pc/dobę (Legenda-pilot daje tylko ×1,25) albo galaktyka o połowę mniejsza, albo awans cywilizacji bez wizyty gracza. (c) **Paliwo 1 m³/pc po 1 000 WU**: przelot między sektorami kosztuje 4–9 mln kr, więcej niż kapitał startowy 6,8 mln, i to on, nie `progAwansu`, decyduje, że kupiec zna po 1 200 dobach 4 cywilizacje; przy paliwie ok. 1/5 kanonu ekspedycja kosztowałaby mniej niż jeden dobry kurs. (d) **Drabina 6 szczebli × 1,5**: cena nie jest problemem (`k` 1…5 daje te same doby), problemem jest czas między szczeblami (5 kursów + wyprawa do stolicy, ok. 120 dób bez ekspedycji, ok. 220 z ekspedycjami) i to, że większa ładownia nie zwiększa zysku na kurs na płytkich portach; mnożnik 1,5 od szczebla 3 kupuje głównie bak. (e) **TierCount 4 i koszyki**: przy `progAwansu` = 0,25 jedna cywilizacja przechodzi T1→T4 w ok. 690 dób (koszyk T4 jest podwójny), więc tiery cywilizacji, do których gracz lata i tak, mieszczą się w horyzoncie; dla 9 cywilizacji potrzebny byłby `progAwansu` ok. 0,1 **i** rozwiązanie problemu dojazdu z (b)–(c).
73. **Gospodarka jest stabilna przez 1 200 dób bez dodawania sufitów.** Dzienny PKB portów rośnie tylko przez awanse (mediana ×1,013 w d0–600 i ×1,007 w d600–1200), wartość zapasów po cenach bazowych ×1,79 w pierwszej połowie i ×0,99 w drugiej (rynki dochodzą do stanu ustalonego przed 600. dobą), zero NaN w 50 ziarnach. Wzrost w d600–1200 jest mniejszy niż w d0–600 na każdej mierze. Jedna rzecz warta uwagi projektanta: udział pozycji rynku na sufitach (zapas 0 albo 6 norm) rośnie z 20% w dobie 0 do 45% w 600. i 49% w 1 200. — to nie ucieczka zamożności, tylko stan ustalony rynków, których deficytu albo nadwyżki NPC nie domyka przez sufit wymiany z otwartości (DECYZJE 36); awanse (konsumpcja × 1,5 bez zmiany produkcji) dokładają takich pozycji po stronie deficytu.
74. **Czy gra „kończy się” ekonomicznie wcześniej?** Nie: mediana wartości firmy z kadłubem rośnie przez cały horyzont (×1,7 w 100. dobie, ×3,0 w 300., ×4,1 w 600., ×5,5 w 1 000., ×7,4 w 1 200.), a druga połowa gry przynosi więcej niż pierwsza, bo większe kadłuby i nowe cywilizacje odblokowują dłuższe kursy; sama gotówka z ładunkiem stoi w okolicach 11–20 mln przez środek gry, bo bot wkłada nadwyżkę w kadłuby (do 20 mln) i ekspedycje.

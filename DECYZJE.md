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

# Runda 3: progresja na mechanizmach kanonu (cel 4000 dób) (PROMPT-runda3.md)

Pytanie projektantów: czy na mechanizmach kanonu (lot z hierarchii ciągu i masy, rynek z ludności, drabina rozwoju z kontraktem i naukowcem, flota 1/2/4/8 statków, drabina kadłubów w stoczniach o tierze, czas, który zawsze płynie) gracz dociąga galaktykę, firmę, kadłub i załogę do maksimum w ok. 4 000 dób (zmiana celu projektanta z 05.10: było ok. 1 000; okno 3 600–4 400 dób zamiast 900–1 100). Test na L (1 429 węzłów: 464 układy zamieszkiwalne kanonu = 147 planet cywilizacji + 317 plemiennych, plus 965 układów przelotowych wzdłuż szlaków; liczba 840 „układów jak w grze” leży między 464 a 1 429 — przelotowe nie mają ludności ani rynku poza paliwem u plemion), horyzont 4 800 dób (żeby było widać przekroczenie 4 000), spread B, informacja pełna, siatka `paliwo`{R,D} × `bramkaTowaru`{G,P} × `pamiecFloty`{A,B,C} i przeglądy w R+G+A po 30 ziaren: `k` {1,05; 1,10; 1,20; 1,30; 1,50; 1,75; 2,00} (i dalej, jeśli 2,00 nie wystarcza), `xpNaDobeLotu`, ceny szczebli kadłuba (`k` kadłuba) i `progFirmy`. Liczby kanonu, których nie zmieniałem (nowe wpisy `kanon.json` to tylko one): ciąg dyszy 230 tf i 2 dysze na reaktor, masa jedynki 421,99 t, stała 0,8812, 4 m³/dobę (R) i 1 m³/pc (D), reaktor 271 m³, cena paliwa 1 000 WU/m³, BasePrice, progi XP i widełki płac, `SectorMinTier` {1,2,1,1,2,3,1}, otwartość, SSR, kapitał 6,8 mln kr. Wszystko inne jest w `prototyp.json` (blok `runda3` i parametry `bot.*`) i poniżej.

## Założenia modelu

75. **Przełącznik `runda3`** (`prototyp.json`, nagłówek gry, `&runda3=1`; domyślnie wyłączony; włącza też `progresja`; horyzont `runda3.horyzontDob` = 4 800 dób, osobny od horyzontu rundy 2) z trzema osiami wariantów: `paliwo` R/D, `bramkaTowaru` G/P, `pamiecFloty` A/B/C. Z wyłączoną rundą 3 gra, bot i 66 dotychczasowych testów zachowują się jak przed tym zadaniem (jeden statek jest widokiem na `stan.statki[0]`: pola `pozycja`, `paliwo`, `ladownia`, `zaloga`, `kandydaci`, `pamiecZakupu`, `szczebel` to akcesory statku aktywnego, więc UI, bot i testy czytają je jak dotąd).
76. **Lot z hierarchii ciągu** (`sim/lot.ts`): ciąg = reaktory × 2 dysze × 230 tf; masa = konstrukcja kadłuba + reaktory + moduły ładowni + paliwo + ładunek (gęstości towarów z kanonu, paliwo 1 t/m³), liczona na bieżąco; `v = 4 × ciąg/masa ÷ 0,8812 × pilot`. Jedynka (2 dysze, 421,99 t + 100 t paliwa) leci 4,00 pc/dobę; kadłub szczebla 0 to jedynka + 4 moduły ładowni (36 t, 120 m³ każdy = 480 m³), z 1 440 t minerałów 0,99 pc/dobę. Postać zamknięta lotu z ubytkiem paliwa: R — spalanie `b` = 4 m³/dobę × mnożnik nawigatora, masa maleje liniowo w czasie, `t = (m₀/b)(1 − e^(−b·d/C))`, paliwo `b·t`; D — spalanie `a` = 1 m³/pc, masa maleje liniowo z drogą, `t = (m₀·d − a·d²/2)/C`, paliwo `a·d`; `C = 4 × ciąg/0,8812 × pilot`. Kontrola: zasięg na 100 m³ w R przy stałej masie 100 / 78,4 / 24,8 pc (jedynka / +4 ładownie / +minerały) — testy; z ubytkiem paliwa statek przyspiesza, a przy minerałach pali ok. 4 m³/pc (R). Raport lotu pokazuje prędkość na starcie i na mecie; płace liczone za rzeczywiste doby lotu, oszczędność nawigatora i synergii z paliwa (doby nominalne = lot bez załogi).
77. **Pusty bak na starcie** (paliwo jest pierwszym zakupem gracza i bota; test), 6 800 000 kr jak w kanonie. Bak i ładownia zależą od szczebla, nie od stałych kanonu.
78. **Rynek z ludności** (zamiast głębokości portu z otwartości): konsumpcja planety = `konsumpcjaNaMlnNaDobe[towar]` × potrzeby rasy × populacja planety (mln) × koszyk tieru; norma 30 dób; produkcja = konsumpcja × (SSR dla żywności, `produkcjaDoPotrzeb` dla reszty) × mnożnik specjalizacji planety (normalizowany tak, by suma produkcji cywilizacji została profilem). `konsumpcjaNaMlnNaDobe` = {Food 0,8; Minerals 0,24; Solvents 0,08; Explosives 0,012; Electronics 0,0024; Fuel 0,3} m³ na milion i dobę — dobrane tak, by stolica Ludzi (2,0 mld mln) miała rząd 1,6 mln m³ żywności dziennie, a stolica Vreth (ok. 15 tys. mln) rząd 12 tys. m³: rynek jest **bezdenny wobec jednego statku** (480–3 600 m³ ładowni to ułamek promila normy), co jest wynikiem, nie założeniem (odpowiedzi niżej). Otwartość zostaje wyłącznie sufitem wymiany NPC (DECYZJE 36). Głębokość portu znika z konsumpcji.
79. **Sektory i bramka towaru.** `SectorMinTier` {1,2,1,1,2,3,1} mapuję na sektory produkcji w kolejności: rolnictwo → Food (T1), górnictwo → Minerals (T2), chemia → Solvents (T1), energetyka → Fuel (T1), przemysł → Explosives (T2), elektronika → Electronics (T3), nauka → brak towaru (T1; „nauka” to naukowiec w kontrakcie, nie towar). Tier cywilizacji otwiera produkcję sektora, gdy T ≥ `SectorMinTier`. `bramkaTowaru` G: towar sektora o `SectorMinTier` > tier **nie istnieje** na rynku cywilizacji (pozycja `dostepny = false`: brak ceny, kupna, sprzedaży; UI pokazuje „—”); P: pozycja istnieje (konsumpcja z ludności, cena z nacisku), ale nikt jej nie produkuje, dopóki tier nie otworzy sektora. Normalizacja specjalizacji liczy się z konsumpcji potencjalnej (koszyk T1), nie z zera — inaczej sektor otwarty tierem produkował 0 (błąd znaleziony sondą: po awansie Vreth na T2 minerały miały zapas 0 w każdej planecie mimo `produkcjaDoPotrzeb` 2,6).
80. **Popyt per tier** (`koszykTieru`): T1 wszystko ×1; T2 Minerals ×6,38, Solvents ×1,5, Explosives ×2, Fuel ×3,46; T3 Minerals ×8, Solvents ×2, Explosives ×3, Electronics ×3, Fuel ×5; T4 ×10 / ×2,5 / ×4 / ×6 / ×6. Awans mnoży konsumpcję, normę i produkcję (produkcja = konsumpcja × stosunek, więc importer zostaje importerem). Kontrola: T1→T2 minerały ×6,38, paliwo ×3,46 (test).
81. **Gotowość i drabina T1–T4** (`stan.rozwoj`): `Z₀ = Σ populacja × zamożność × PkbToWaterUnits` zamrożone w dobie 0; `zamoznosc` = 1,0 dla każdej rasy (prompt nie podaje; `prototyp.json`), a `PkbToWaterUnits` jest **kalibrowane w dobie 0** tak, by średnia cywilizacja (ważona ludnością) osiągała gotowość T2 po `dobyGotowosciT2` = 250 dobach skumulowanej nadwyżki: `PkbToWaterUnits = 250 × Σ nadwyżek / Σ ludności`. Nadwyżka cywilizacji = Σ po planetach i towarach max(0, produkcja − konsumpcja) × cena bazowa (WU/dobę), liczona na bieżąco (rośnie z tierem). Próg gotowości(T) = Z₀ × k^(T−1); porównanie ze skumulowaną nadwyżką od ostatniego awansu (zerowaną przy awansie). Gotowość **nie awansuje**: otwiera kontrakt rozwojowy (test: 300 dób bez gracza, wszystkie na T1 mimo 9 otwartych kontraktów).
82. **Kontrakt rozwojowy** (`Kontrakt`): receptura = towary sektorów otwartych na bieżącym tierze cywilizacji (bez paliwa; pochodzenie dowolne) plus towary, które otwiera tier docelowy, **jeśli sąsiednia cywilizacja (ten sam sektor galaktyki albo przyległy) już je produkuje** — te muszą pochodzić od sąsiada (ładownia pamięta pochodzenie); gdy żaden sąsiad nie ma tieru docelowego, receptura składa się tylko z własnych towarów (pierwsza wersja wymagała towaru sąsiada dla każdego składnika i blokowała T3 na zawsze). Ilość każdego towaru = min(`maxIloscKontraktuM3` = 960, `ilosciKontraktu` = 0,0005 × dzienna konsumpcja stolicy przy koszyku tieru docelowego) — bez limitu kontrakt T3 Ludzi wymagał 1 563 m³ minerałów (4,7 tys. t), czyli kilkunastu kursów statku szczebla 0 w R; limit 960 m³ = dwa ładunki szczebla 0. Naukowiec: pasażer 40 m³ ładowni, do zabrania z planety tej lub sąsiedniej cywilizacji innej niż akademia (`naukowiecZInnejPlanety`), jeden na statek. Akademia = stolica. **Dostawy są częściowe**: każda wizyta w akademii oddaje to, co z pokładu pasuje do receptury (z właściwym pochodzeniem), naukowiec może przyjechać osobnym kursem (`naukowiecWAkademii`); awans następuje przy dostawie, po której receptura i naukowiec są w akademii (testy: receptura w jednym kursie, naukowiec w drugim; bez naukowca brak awansu). Awans otwiera sektory, mnoży koszyk, zeruje nadwyżkę, zapisuje kamienie `tier:<cyw>:T` i `sektor:<cyw>:<towar>`.
83. **Firma i flota**: poziom firmy T1–T4 z `progFirmy` = {0; 20; 60; 200} mln kr wartości firmy (gotówka + ładunek; sprawdzane przy każdym przylocie), `statkiNaPoziom` = {1, 2, 4, 8}; nowy statek szczebla 0 kosztuje `cenaNowegoStatkuKr` = 6,8 mln (kapitał startowy) i kupuje się go tylko w stoczni stolicy; dostaje pusty bak, pustą załogę i własnych kandydatów. Każdy statek ma własną pozycję, paliwo, ładownię, załogę, pamięć, szczebel, licznik skoków i kurs; gotówka jest wspólna. Raport lotu każdego statku sumuje się do **jego** przepływów w okresie między przylotami (`deltaKr`), łącznie z kadłubami i statkami kupionymi w oknie stoczni (po linii na zakup).
84. **Drabina kadłubów** (6 szczebli 0–5, `konfiguracje` {reaktory, moduły} = {1,4}, {1,7}, {2,9}, {3,14}, {5,20}, {7,30}; objętość kadłuba 851 m³ × 1,5^N mieści moduły × 120 m³ + reaktory × 271 m³ + bak `bakM3` = {100, 150, 225, 338, 506, 759}; masa konstrukcji (421,99 − 100) × 1,5^N, reaktor 100 t, moduł 36 t). Prędkości z pełną ładownią żywności: 2,2 / 1,4 / 1,9 / 1,9 / 2,1 / 2,0 pc/dobę; szczebel 1 jest „ładowniowy” (7 modułów na 1 reaktorze), od szczebla 2 reaktory nadążają. Cena szczebla jak w rundzie 2 (`k` kadłuba × mediana zysku na kurs; w rundzie 3 kurs zamyka pierwsze **kupno** w doku, bo na bezdennych rynkach sprzedaż bywa w każdym doku), stocznia sprzedaje szczebel N tylko w stolicy cywilizacji o tierze ≥ `tierSzczebla`[N] = {1, 1, 2, 3, 3, 4} (prompt: 0–1 T1, 2 T2, 3–4 T3, 5 T4). Obsada = kokpit 1 + 1 na reaktor + 1 na każde 4 moduły ładowni: 3 / 3 / 5 / 7 / 11 / 15 miejsc (szczebel 0: pilot, nawigator, handlowiec — jak kanon).
85. **Pamięć zakupu floty** (`pamiecFloty`, przy spreadzie B): wpis (planeta, towar) należy do floty i zapisuje statek kupujący, dobę i liczniki skoków wszystkich statków; A — wygasa po 5 skokach **statku, który kupił**; B — po 5 skokach **statku, który sprzedaje** (każdy statek liczy od stanu swoich skoków w chwili zakupu); C — po `pamiecCzasDob` = 25 dobach (≙ 5 skoków po 5 dób). Niezmiennik (testy A/B/C): dopóki licznik > 0, cena odsprzedaży w miejscu zakupu ≤ cena zakupu dla **każdego** statku floty; wygasanie według reguły wariantu.
86. **Czas zawsze płynie**: lot to start → przewinięcie świata do najbliższego przylotu (rynki żyją, gotowość rośnie, inne statki dokują w kolejności przylotu) → przylot; w doku czas stoi tylko w oknie stoczni (zakup kadłuba/statku); flota bez planu czeka po `dobyCzekaniaFloty` = 5 dób, a horyzont mija także bez przylotu. Okna stoczni (`stan.oknaStoczni`: doba, liczba statków, rodzaj) liczone na 100 dób przy 1/2/4/8 statkach.
87. **Bot floty** (`bot/flota.ts`, pętla zdarzeń: każdy statek w doku decyduje planistą z rund 1–2 na statku aktywnym — paliwo pierwsze, handel, inwestycje — a świat przewija się do najbliższego przylotu). Nowe reguły rundy 3, każda z sondy na pojedynczych ziarnach (`findings.md`): (a) **klaster dystrybucji = sam cel** (na bezdennych rynkach objazd po sąsiadach był czystym kosztem, który zaniżał każdy plan i wpychał bota w odwrót z regionu, w którym wahadło żywność ↔ rozpuszczalniki dawało 100 tys. kr/dobę); (b) **drugi krok liczy też powrót do doku startu** i ocenia do `planowDoDrugiegoKrokuRunda3` = 60 planów (na L 25 najbliższych planet celu to ta sama cywilizacja z tym samym profilem nadwyżek, a pętla handlowa bywa poza pierwszą piątką stopy pierwszego kroku); dojazdy drugiego kroku liczone dla pustego statku (ładunek sprzedaje się w celu) i pamiętane między krokami floty (zasięg odcinka zaokrąglony w dół do 2 pc; 10 s zamiast 45 s na 1 200 dób); (c) **odwrót** dopiero, gdy nawet dwa kroki nie zarabiają; (d) **podział floty** przez karę `karaWspolnegoCelu` = 10% oceny celu, do którego leci już inny statek (twarde wykluczenie wysyłało statki w puste loty w drugą stronę); (e) **ekspedycje**: jedna naraz w całej flocie, nie na misji, dopiero od 4 statków (`maxDobyEkspedycji` = {0, 0, 400, 400} dób przy 1 / 2–3 / 4–7 / 8 statkach: flota 1–2 statków, która poznawała Velhari i Duhari w 100.–400. dobie, kupowała drugi statek w obcej stolicy i bankrutowała), gdy gotówka z ładunkiem ≥ `mnoznikGotowkiNaEkspedycjeRunda3` = 5 × koszt pustego lotu (rytm co `dobyMiedzyEkspedycjami` = 100 dób, do 0,6 horyzontu); przy pełnej informacji kontakt przychodzi też z planów handlowych do planet nieznanej cywilizacji; (f) **misje kontraktowe**: statek w doku bierze najbliższy nieprzydzielony kontrakt, dla którego droga stąd do najbliższego źródła każdego brakującego towaru i ze źródła do akademii (najdłuższa z nich) ≤ `maxDystansKontraktuPc` = 2 000 pc i ≤ `maxDobyDrogiMisji` = {150, 250, 400, 500} dób według wielkości floty (liczone z masą receptury), wykonalny (każdy towar ma znane źródło z zapasem, naukowiec w zasięgu) i tani: koszt (receptura po cenie bazowej + paliwo) ≤ `maxUdzialKosztuMisji` = 10% wartości firmy i ≤ gotówki / `mnoznikGotowkiNaKontrakt` = 2; sprzedaje ładunek handlowy (lekki statek), kupuje recepturę tam, gdzie wolno (towar sąsiada tylko u sąsiada), ale **tylko tyle, ile uniesie na najdłuższym odcinku drogi do akademii** z zapasem `rezerwaZasieguMisji` = 15% (w R 840 m³ minerałów zbijało zasięg do 22 pc), bierze naukowca, dowozi częściami, a etap o planie (z doliczoną wartością receptury na pokładzie) gorszym niż −`maxStrataMisjiUlamek` = 10% wartości firmy podzielone przez liczbę statków, albo cel poza grafem tankowania po odciążeniu, kończy misję; misja po `maxDobyMisji` = 800 dobach jest porzucana (dostarczone części zostają w akademii); (g) **inwestycje**: kadłub przy `mnoznikGotowkiNaSzczebel` = 1,5 × ceny w stoczni o wystarczającym tierze, nowy statek przy `mnoznikGotowkiNaStatek` = 3 × 6,8 mln, gdy poziom firmy pozwala (przy 1,5× nowy statek zostawał bez kapitału obrotowego i dwa statki tonęły w paliwie); wyprawa do stoczni ma pierwszeństwo przed misją (jeden statek na misjach nigdy nie dojeżdżał po drugi), a statek, który przy obecnej masie nie dojedzie do stoczni, sprzedaje ładunek i jedzie pusty; (i) **wspólna kasa**: każdy statek liczy zakupy (ładunek, receptura, kadłub, statek) z gotówki pomniejszonej o rezerwę = pełny bak każdego innego statku po cenie bazowej paliwa plus **rezerwacje** innych statków w locie na zakupy zaplanowane w celu (drugi krok planu, nie więcej niż udział statku w kasie: bez tego statek leciał 100 pc, żeby kupić nic, bo kolega wydał gotówkę), ale sam lot ze sprzedażą tutaj jest dozwolony, gdy starcza realnej gotówki (rezerwa jako warunek lotu blokowała całą flotę naraz); **flota w biedzie** (gotówka poniżej dwóch rezerw paliwa) nie lata ze stratą: bez dodatniego planu statek sprzedaje ładunek tutaj i czeka w doku po 5 dób, zamiast spalić resztę kasy na pustych przelotach (bankructwa z pustymi ładowniami i 0 kr); (h) paliwo: pierwszy zakup to paliwo na pierwszy odcinek, planista liczy doby i paliwo każdego odcinka z masy po doborze ładunku (`obliczLot`), a maksymalną masę dodatkową z wykonalności pierwszego odcinka z pełnym bakiem.
88. **Miary** (`npm run runda3`): kamienie milowe (`stan.kamienie`: tiery każdej cywilizacji i „pierwsza cywilizacja na T”, poziomy firmy, liczba statków, szczeble, tiery załogi, kontakty) jako mediana i zakres 10–90% po ziarnach (ziarno bez kamienia = ∞) i odsetek ziaren z kamieniem do doby 4 000; galaktyka (a) = wszystkie 9 cywilizacji na T4, (b) = wszystkie poznane na T4 (doba ostatniego awansu, gdy każda znana jest na T4); doby lotu do najdalszej stolicy (najkrótsza ścieżka grafu od startu) pustym statkiem każdego szczebla i z pełną ładownią żywności; zysk na dobę vs dystans per towar w R i D (kosze 0–50 / 50–100 / 100–200 / 200+ pc, mediana po lotach bota), udział paliwa w kosztach lotu (paliwo / (paliwo + płace)) i zwrot paliwa = marża brutto lotu / koszt paliwa na pc (pc, na które starcza marża); pojemność rynku dla 8 statków szczebla 5 = mediana konsumpcji stolic znanych cywilizacji / dostawy floty (8 × ładownia / czas kursu tam z ładunkiem i z powrotem pusto na medianie dystansu lotów); okna stoczni na 100 dób przy 1/2/4/8 statkach (okna w przedziałach wielkości floty / doby w tych przedziałach); krzywa wartości firmy co 200 dób (mediana po ziarnach; z kadłubami i statkami po cenie zakupu); stabilność per cywilizacja w d0/d2400/d4800: zamożność = dzienny PKB (Σ konsumpcja × cena bazowa, WU/dobę) i wartość zapasów po cenach bazowych, wzrost w d2400–4800 vs d0–2400, pozycje rynku, puste (zapas 0, cena na pułapie), pełne (6 norm), puste wśród dostępnych w dobie 0 („nowe sufity”), NaN.

## Wynik (L, 4 800 dób, spread B, informacja pełna; siatka 12 wariantów × 20 ziaren „r3-1”…„r3-20”, przeglądy parametrów w R:G:A × 30 ziaren)

Siatkę policzyłem po **20 ziaren na wariant** zamiast 30 (zgoda projektanta z 05.10 na skrócenie, gdy cała siatka trwa zbyt długo): przebieg 4 800 dób z flotą 8 statków trwa 25–150 s, a siatka z przeglądami to 879 przebiegów (ok. 5 h na 4 procesach). Przeglądy `k`, `xpNaDobeLotu`, `progFirmy` i `kKadluba` mają po 30 ziaren; wiersz wartości domyślnej (k 1,15; xp 11; progFirmy ×1; kKadluba 5) to wariant bazowy R:G:A (20 ziaren). Bankructwo = wartość firmy < 1 mln kr na końcu. Wszystkie tabele składa `npm run runda3 -- tabele` z `wyniki/runda3/*.json`.

### Kamienie milowe — wariant bazowy R:G:A (20 ziaren, horyzont 4800 dób, cel 4000)

| Kamień milowy | mediana doby | 10–90% | do 4000 | do 4800 | w oknie 3600–4400? |
|---|---|---|---|---|---|
| pierwsza gotowość T2 (kontrakt otwarty) | 235 | 233–243 | 100.0% | 100.0% |  |
| pierwsza cywilizacja T2 | 565 | 394–> horyzont | 90.0% | 90.0% |  |
| pierwsza cywilizacja T3 | 1572 | 947–> horyzont | 80.0% | 80.0% |  |
| pierwsza cywilizacja T4 **(maksimum osi: cywilizacja)** | 2778 | 1446–> horyzont | 70.0% | 75.0% | za wcześnie |
| galaktyka (b): wszystkie poznane na T4 **(maksimum osi: galaktyka (b))** | > horyzont | > horyzont–> horyzont | 0.0% | 5.0% | poza horyzontem |
| galaktyka (a): wszystkie 9 na T4 **(maksimum osi: galaktyka (a))** | > horyzont | > horyzont–> horyzont | 0.0% | 5.0% | poza horyzontem |
| firma T2 (2 statki) | 55 | 30–72 | 95.0% | 95.0% |  |
| firma T3 (4 statki) | 275 | 122–705 | 95.0% | 95.0% |  |
| firma T4 (8 statków) **(maksimum osi: firma)** | 1451 | 483–> horyzont | 85.0% | 90.0% | za wcześnie |
| flota: 2. statek | 131 | 37–297 | 95.0% | 95.0% |  |
| flota: 4. statek | 309 | 152–739 | 95.0% | 95.0% |  |
| flota: 8. statek **(maksimum osi: flota)** | 1474 | 518–> horyzont | 85.0% | 90.0% | za wcześnie |
| kadłub: szczebel 1 | 116 | 69–670 | 95.0% | 95.0% |  |
| kadłub: szczebel 2 | 827 | 562–> horyzont | 85.0% | 85.0% |  |
| kadłub: szczebel 3 | 2083 | 1238–> horyzont | 60.0% | 70.0% |  |
| kadłub: szczebel 4 | 2887 | 1432–> horyzont | 60.0% | 65.0% |  |
| kadłub: szczebel 5 **(maksimum osi: kadłub)** | 3622 | 1827–> horyzont | 55.0% | 65.0% | **tak** |
| załoga: pierwszy Mistrz (1 500 XP) | 145 | 140–164 | 95.0% | 95.0% |  |
| załoga: pierwszy Legenda (9 999 XP) | 932 | 914–1095 | 95.0% | 95.0% |  |
| załoga: pierwszy statek z pełną załogą (≥ 4) na Legendzie **(maksimum osi: załoga)** | 1215 | 1019–1846 | 95.0% | 95.0% | za wcześnie |
| kontakt: 4. cywilizacja | 460 | 280–906 | 100.0% | 100.0% |  |
| kontakt: 6. cywilizacja | 1262 | 734–> horyzont | 90.0% | 90.0% |  |
| kontakt: wszystkie 9 | 1997 | 1433–> horyzont | 85.0% | 85.0% |  |

### Siatka wariantów

| Wariant | n | mediana wartości (mln) | bankructwa | statki (mediana) | firma T4 do 4000 | szczebel 5 do 4000 | mediana T2 / T3 / T4 pierwszej cyw. | cyw. T2 / T3 / T4 (śr. liczba) | galaktyka (b): mediana / do 4000 | galaktyka (a) do 4000 | misje dostarczone (śr.) |
|---|---|---|---|---|---|---|---|---|---|---|---|
| D:G:A | 20 | 7756.5 | 10.0% | 8 | 80.0% | 60.0% | 1274 / 2094 / 3015 | 5.5 / 3.3 / 2.3 | > horyzont / 0.0% | 0.0% | 10.9 |
| D:G:B | 20 | 10873.8 | 10.0% | 8 | 80.0% | 55.0% | 1230 / 1863 / 2931 | 5.5 / 3.5 / 2.3 | > horyzont / 0.0% | 0.0% | 11.3 |
| D:G:C | 20 | 7783.1 | 10.0% | 8 | 80.0% | 60.0% | 1274 / 2094 / 2525 | 5.3 / 3.6 / 2.7 | > horyzont / 0.0% | 0.0% | 11.6 |
| D:P:A | 20 | 10343.7 | 10.0% | 8 | 90.0% | 40.0% | 1274 / 2436 / 2937 | 5.2 / 3.8 / 2.5 | > horyzont / 0.0% | 0.0% | 11.6 |
| D:P:B | 20 | 6696.5 | 10.0% | 8 | 90.0% | 40.0% | 1230 / 2433 / 2929 | 5.0 / 3.5 / 2.3 | > horyzont / 0.0% | 0.0% | 10.8 |
| D:P:C | 20 | 5572.3 | 10.0% | 8 | 90.0% | 50.0% | 1274 / 2597 / 3121 | 5.0 / 3.2 / 2.3 | > horyzont / 0.0% | 0.0% | 10.4 |
| R:G:A | 20 | 4702.7 | 5.0% | 8 | 85.0% | 55.0% | 565 / 1572 / 2778 | 6.3 / 3.6 / 2.5 | > horyzont / 0.0% | 0.0% | 12.3 |
| R:G:B | 20 | 34032.0 | 5.0% | 8 | 90.0% | 70.0% | 565 / 1428 / 2298 | 6.3 / 3.9 / 3.0 | > horyzont / 0.0% | 0.0% | 13.1 |
| R:G:C | 20 | 10200.1 | 5.0% | 8 | 85.0% | 55.0% | 565 / 1624 / 3145 | 6.3 / 3.5 / 2.1 | > horyzont / 0.0% | 0.0% | 11.9 |
| R:P:A | 20 | 18920.5 | 10.0% | 8 | 90.0% | 55.0% | 545 / 1560 / 2888 | 6.2 / 4.0 / 3.1 | > horyzont / 0.0% | 0.0% | 13.4 |
| R:P:B | 20 | 12775.4 | 15.0% | 8 | 85.0% | 55.0% | 545 / 1725 / 3158 | 6.2 / 3.9 / 2.9 | > horyzont / 0.0% | 0.0% | 12.9 |
| R:P:C | 20 | 26450.8 | 5.0% | 8 | 95.0% | 75.0% | 545 / 1495 / 2405 | 7.0 / 4.8 / 3.6 | > horyzont / 0.0% | 0.0% | 15.6 |

#### Osie zbiorczo

| Wariant | n | mediana wartości (mln) | bankructwa | statki (mediana) | firma T4 do 4000 | szczebel 5 do 4000 | mediana T2 / T3 / T4 pierwszej cyw. | cyw. T2 / T3 / T4 (śr. liczba) | galaktyka (b): mediana / do 4000 | galaktyka (a) do 4000 | misje dostarczone (śr.) |
|---|---|---|---|---|---|---|---|---|---|---|---|
| paliwo D | 120 | 7503.6 | 10.0% | 8 | 85.0% | 50.8% | 1250 / 2358 / 2928 | 5.2 / 3.5 / 2.4 | > horyzont / 0.0% | 0.0% | 11.1 |
| paliwo R | 120 | 15333.2 | 7.5% | 8 | 88.3% | 60.8% | 551 / 1547 / 2703 | 6.4 / 4.0 / 2.9 | > horyzont / 0.0% | 0.0% | 13.2 |
| bramka G | 120 | 9934.4 | 7.5% | 8 | 83.3% | 59.2% | 837 / 1718 / 2703 | 5.8 / 3.5 / 2.5 | > horyzont / 0.0% | 0.0% | 11.8 |
| bramka P | 120 | 10324.5 | 10.0% | 8 | 90.0% | 52.5% | 763 / 1980 / 2901 | 5.8 / 3.9 / 2.8 | > horyzont / 0.0% | 0.0% | 12.4 |
| pamięć A | 80 | 8446.3 | 8.8% | 8 | 86.3% | 52.5% | 822 / 1932 / 2873 | 5.8 / 3.7 / 2.6 | > horyzont / 0.0% | 0.0% | 12.1 |
| pamięć B | 80 | 10858.6 | 10.0% | 8 | 86.3% | 55.0% | 822 / 1914 / 2921 | 5.7 / 3.7 / 2.6 | > horyzont / 0.0% | 0.0% | 12.0 |
| pamięć C | 80 | 10320.5 | 7.5% | 8 | 87.5% | 60.0% | 822 / 1842 / 2710 | 5.9 / 3.8 / 2.7 | > horyzont / 0.0% | 0.0% | 12.4 |

### Paliwo i odległość — wariant R

**R: zysk na dobę vs dystans, udział paliwa, zwrot paliwa**

| Towar | kosz dystansu (pc) | lotów | mediana zysku/dobę (kr) | mediana udziału paliwa w kosztach | mediana zwrotu paliwa (pc) |
|---|---|---|---|---|---|
| Food | 0–50 | 7324 | -21293 | 0.76 | 6 |
| Food | 50–100 | 1463 | -38274 | 0.80 | -144 |
| Food | 100–200 | 631 | 34520 | 0.64 | 501 |
| Food | 200–∞ | 509 | 3590104 | 0.44 | 127447 |
| Minerals | 0–50 | 5546 | 348201 | 0.59 | 761 |
| Minerals | 50–100 | 1228 | 280195 | 0.65 | 1406 |
| Minerals | 100–200 | 582 | 602375 | 0.47 | 9364 |
| Minerals | 200–∞ | 391 | 1664884 | 0.38 | 61345 |
| Solvents | 0–50 | 7286 | 443119 | 0.83 | 616 |
| Solvents | 50–100 | 985 | 96464 | 0.79 | 654 |
| Solvents | 100–200 | 461 | 277370 | 0.62 | 2854 |
| Solvents | 200–∞ | 538 | 2875896 | 0.49 | 94647 |
| Explosives | 0–50 | 8975 | 2362462 | 0.67 | 3579 |
| Explosives | 50–100 | 938 | 1324369 | 0.74 | 5510 |
| Explosives | 100–200 | 581 | 919824 | 0.62 | 11318 |
| Explosives | 200–∞ | 501 | 3025859 | 0.34 | 134955 |
| Electronics | 0–50 | 3218 | 6235144 | 0.75 | 4018 |
| Electronics | 50–100 | 547 | 7998332 | 0.78 | 19841 |
| Electronics | 100–200 | 428 | 6315147 | 0.69 | 47834 |
| Electronics | 200–∞ | 636 | 8480268 | 0.53 | 223756 |

### Paliwo i odległość — wariant D

**D: zysk na dobę vs dystans, udział paliwa, zwrot paliwa**

| Towar | kosz dystansu (pc) | lotów | mediana zysku/dobę (kr) | mediana udziału paliwa w kosztach | mediana zwrotu paliwa (pc) |
|---|---|---|---|---|---|
| Food | 0–50 | 3841 | 124971 | 0.61 | 397 |
| Food | 50–100 | 816 | -19601 | 0.79 | -50 |
| Food | 100–200 | 810 | -4183 | 0.60 | 70 |
| Food | 200–∞ | 403 | 868958 | 0.32 | 52830 |
| Minerals | 0–50 | 2592 | 207911 | 0.50 | 956 |
| Minerals | 50–100 | 1240 | 622759 | 0.44 | 7326 |
| Minerals | 100–200 | 491 | 516706 | 0.36 | 22601 |
| Minerals | 200–∞ | 455 | 861175 | 0.31 | 85290 |
| Solvents | 0–50 | 3529 | 207737 | 0.69 | 393 |
| Solvents | 50–100 | 693 | 2309 | 0.78 | 165 |
| Solvents | 100–200 | 537 | 4017 | 0.62 | 318 |
| Solvents | 200–∞ | 461 | 2005517 | 0.39 | 92021 |
| Explosives | 0–50 | 4541 | 4239035 | 0.53 | 12741 |
| Explosives | 50–100 | 602 | 1499180 | 0.62 | 13741 |
| Explosives | 100–200 | 425 | 721092 | 0.55 | 11531 |
| Explosives | 200–∞ | 513 | 1343153 | 0.37 | 85953 |
| Electronics | 0–50 | 2229 | 13254654 | 0.68 | 18962 |
| Electronics | 50–100 | 676 | 11434499 | 0.63 | 84282 |
| Electronics | 100–200 | 482 | 4699969 | 0.63 | 51277 |
| Electronics | 200–∞ | 536 | 4958302 | 0.45 | 228962 |

### Krzywa wartości firmy (R:G:A)

| Doba | mediana wartości firmy (kr + ładunek) | mediana z kadłubami i statkami | × kapitał startowy | 10–90% (z kadłubem, mln) |
|---|---|---|---|---|
| 0 | 6.8 mln | 6.8 mln | ×1.0 | 6.8–6.8 |
| 200 | 50.8 mln | 58.8 mln | ×8.6 | 34.7–144.5 |
| 400 | 55.6 mln | 100.0 mln | ×14.7 | 48.4–261.3 |
| 600 | 82.9 mln | 176.5 mln | ×25.9 | 58.7–351.3 |
| 800 | 69.2 mln | 191.9 mln | ×28.2 | 60.7–595.4 |
| 1000 | 71.4 mln | 229.1 mln | ×33.7 | 53.0–688.7 |
| 1200 | 75.3 mln | 257.1 mln | ×37.8 | 84.6–885.8 |
| 1400 | 118.2 mln | 329.4 mln | ×48.4 | 84.4–1427.9 |
| 1600 | 196.6 mln | 507.1 mln | ×74.6 | 146.9–2195.8 |
| 1800 | 298.3 mln | 645.3 mln | ×94.9 | 136.3–3615.1 |
| 2000 | 530.4 mln | 961.2 mln | ×141.4 | 127.9–5032.6 |
| 2200 | 417.6 mln | 1178.7 mln | ×173.3 | 160.9–5399.6 |
| 2400 | 419.2 mln | 1248.4 mln | ×183.6 | 181.0–6838.6 |
| 2600 | 466.0 mln | 1299.4 mln | ×191.1 | 155.9–8969.9 |
| 2800 | 918.0 mln | 1787.4 mln | ×262.8 | 166.6–12814.8 |
| 3000 | 543.1 mln | 2012.5 mln | ×296.0 | 147.6–20515.1 |
| 3200 | 1101.6 mln | 2295.4 mln | ×337.6 | 182.4–22230.4 |
| 3400 | 1057.6 mln | 2428.8 mln | ×357.2 | 171.7–25106.9 |
| 3600 | 1200.4 mln | 2845.1 mln | ×418.4 | 217.5–27488.1 |
| 3800 | 1267.4 mln | 2913.5 mln | ×428.4 | 231.9–30492.9 |
| 4000 | 1321.2 mln | 3055.5 mln | ×449.3 | 255.0–35242.2 |
| 4200 | 1681.2 mln | 3415.7 mln | ×502.3 | 264.0–40078.3 |
| 4400 | 1591.4 mln | 4825.1 mln | ×709.6 | 276.3–44902.6 |
| 4600 | 2216.1 mln | 6138.9 mln | ×902.8 | 276.3–49739.9 |
| 4800 | 4702.7 mln | 9288.5 mln | ×1366.0 | 276.3–59729.1 |

### Pojemność rynku dla 8 statków szczebla 5 (R:G:A)

| Towar | dostawy 8 statków szczebla 5 (m³/dobę, mediana) | mediana konsumpcji stolic (m³/dobę) | min konsumpcji stolic | stosunek konsumpcja / dostawy (mediana) |
|---|---|---|---|---|
| Food | 1198 | 231665 | 3260 | 195.9 |
| Minerals | 720 | 788052 | 5705 | 898.7 |
| Solvents | 1074 | 35382 | 334 | 34.8 |
| Explosives | 974 | 5663 | 196 | 6.1 |
| Electronics | 1312 | 3486 | 40 | 1.9 |

### Okna stoczni na 100 dób (R:G:A)

| Statków | dób floty tej wielkości (suma po ziarnach) | okien stoczni | okien na 100 dób |
|---|---|---|---|
| 1 | 7240 | 7 | 0.10 |
| 2 | 4361 | 38 | 0.87 |
| 4 | 22329 | 103 | 0.46 |
| 8 | 61354 | 412 | 0.67 |

### Stabilność 4800 dób na cywilizację (R:G:A, mediany po ziarnach)

| Cywilizacja | PKB (WU/dobę) d0 → d2400 → d4800 | wzrost PKB d0–2400 / d2400–4800 | zapasy (WU) wzrost d0–2400 / d2400–4800 | pozycje d0 → d4800 | puste d0 / d2400 / d4800 | puste wśród dostępnych w d0: d0 → d4800 | pełne (6 norm) d0 → d4800 | NaN |
|---|---|---|---|---|---|---|---|---|
| ludzie | 10625.8 → 10625.8 → 35248.9 mln | ×1.00 / ×1.15 **(szybciej w 2. połowie)** | ×1.22 / ×1.25 | 57 → 93 | 14 / 20 / 35 | 14 → 19 | 0 → 23 | nie |
| vreth | 63.1 → 255.1 → 311.0 mln | ×4.04 / ×1.00 | ×7.97 / ×1.00 | 39 → 77 | 13 / 29 / 32 | 13 → 13 | 0 → 26 | nie |
| corrath | 1424.6 → 3800.2 → 6175.7 mln | ×2.67 / ×1.00 | ×2.44 / ×1.20 | 51 → 88 | 0 / 0 / 0 | 0 → 0 | 0 → 22 | nie |
| szkarni | 208.6 → 208.6 → 767.8 mln | ×1.00 / ×1.00 | ×1.82 / ×1.21 | 45 → 75 | 0 / 0 / 0 | 0 → 0 | 0 → 31 | nie |
| orak | 13.0 → 13.0 → 54.2 mln | ×1.00 / ×2.64 **(szybciej w 2. połowie)** | ×1.00 / ×4.22 | 39 → 70 | 26 / 26 / 43 | 26 → 26 | 13 → 26 | nie |
| ai | 6554.2 → 6554.2 → 30173.7 mln | ×1.00 / ×1.54 **(szybciej w 2. połowie)** | ×1.00 / ×2.33 | 54 → 85 | 0 / 0 / 0 | 0 → 0 | 0 → 0 | nie |
| planta | 3387.6 → 3387.6 → 13764.2 mln | ×1.00 / ×1.99 **(szybciej w 2. połowie)** | ×1.74 / ×1.79 | 54 → 93 | 0 / 0 / 0 | 0 → 0 | 4 → 35 | nie |
| duhari | 682.3 → 682.3 → 2463.0 mln | ×1.00 / ×1.39 **(szybciej w 2. połowie)** | ×1.68 / ×1.27 | 48 → 85 | 14 / 17 / 31 | 14 → 16 | 0 → 32 | nie |
| velhari | 2137.0 → 2137.0 → 8712.3 mln | ×1.00 / ×4.08 **(szybciej w 2. połowie)** | ×1.00 / ×3.74 | 51 → 85 | 0 / 0 / 0 | 0 → 0 | 0 → 8 | nie |

### Zasięg kadłubów: doby do najdalszej stolicy

| Szczebel | prędkość pusty (pc/dobę) | prędkość z pełną ładownią żywności | doby do najdalszej stolicy: pusty (mediana po ziarnach) | z ładunkiem |
|---|---|---|---|---|
| 0 | 3.14 | 2.08 | 652 | 981 |
| 1 | 2.12 | 1.33 | 965 | 1541 |
| 2 | 2.83 | 1.87 | 722 | 1092 |
| 3 | 2.81 | 1.84 | 728 | 1111 |
| 4 | 3.11 | 2.07 | 657 | 986 |
| 5 | 2.93 | 1.95 | 697 | 1050 |

Najdalsza stolica od startu (najkrótsza ścieżka grafu): mediana 2045 pc, zakres 1649–2298 pc.

### Przegląd k (R:G:A; próg gotowości Z₀ × k^(T−1))

| k (próg gotowości Z₀ × k^(T−1)) | n | gotowość T2: mediana (10–90%), do 4000 | 1. cyw. T2: mediana (10–90%), do 4000 | 1. cyw. T3: mediana (10–90%), do 4000 | 1. cyw. T4: mediana (10–90%), do 4000, w oknie? | galaktyka (b): mediana (10–90%), do 4000, w oknie? | galaktyka (a): mediana (10–90%), do 4000, w oknie? | cyw. T2 / T3 / T4 (śr.) | mediana wartości (mln) |
|---|---|---|---|---|---|---|---|---|---|
| 1.05 | 30 | 218 (214–228), 100.0% | 479 (353–1875), 93.3% | 1927 (728–> horyzont), 70.0% | 3166 (1417–> horyzont), 60.0%, za wcześnie | > horyzont (> horyzont–> horyzont), 0.0%, poza horyzontem | > horyzont (> horyzont–> horyzont), 0.0%, poza horyzontem | 5.3 / 3.3 / 2.4 | 7025.9 |
| 1.1 | 30 | 228 (223–239), 100.0% | 473 (368–> horyzont), 90.0% | 1584 (725–> horyzont), 73.3% | 3107 (1684–> horyzont), 60.0%, za wcześnie | > horyzont (> horyzont–> horyzont), 0.0%, poza horyzontem | > horyzont (> horyzont–> horyzont), 0.0%, poza horyzontem | 5.3 / 3.1 / 2.2 | 2730.2 |
| 1.15 | 20 | 235 (233–243), 100.0% | 565 (394–> horyzont), 90.0% | 1572 (947–> horyzont), 80.0% | 2778 (1446–> horyzont), 70.0%, za wcześnie | > horyzont (> horyzont–> horyzont), 0.0%, poza horyzontem | > horyzont (> horyzont–> horyzont), 0.0%, poza horyzontem | 6.3 / 3.6 / 2.5 | 4702.7 |
| 1.2 | 30 | 246 (243–255), 100.0% | 674 (405–> horyzont), 86.7% | 2075 (1083–> horyzont), 70.0% | 3010 (1534–> horyzont), 56.7%, za wcześnie | > horyzont (> horyzont–> horyzont), 0.0%, poza horyzontem | > horyzont (> horyzont–> horyzont), 0.0%, poza horyzontem | 5.4 / 3.4 / 2.6 | 7640.6 |
| 1.3 | 30 | 266 (263–278), 100.0% | 635 (420–> horyzont), 90.0% | 1798 (933–> horyzont), 73.3% | 4043 (1518–> horyzont), 46.7%, **tak** | > horyzont (> horyzont–> horyzont), 0.0%, poza horyzontem | > horyzont (> horyzont–> horyzont), 0.0%, poza horyzontem | 5.6 / 3.0 / 1.9 | 2691.7 |
| 1.5 | 30 | 306 (304–318), 100.0% | 666 (483–> horyzont), 86.7% | 2375 (1107–> horyzont), 63.3% | 4361 (1816–> horyzont), 46.7%, **tak** | > horyzont (> horyzont–> horyzont), 0.0%, poza horyzontem | > horyzont (> horyzont–> horyzont), 0.0%, poza horyzontem | 5.0 / 2.4 / 1.6 | 5588.0 |
| 1.75 | 30 | 358 (354–368), 100.0% | 733 (552–> horyzont), 80.0% | 2559 (1281–> horyzont), 66.7% | > horyzont (1946–> horyzont), 40.0%, poza horyzontem | > horyzont (> horyzont–> horyzont), 0.0%, poza horyzontem | > horyzont (> horyzont–> horyzont), 0.0%, poza horyzontem | 5.1 / 2.7 / 1.3 | 2072.9 |
| 2 | 30 | 407 (404–413), 100.0% | 781 (623–> horyzont), 86.7% | 3113 (1332–> horyzont), 56.7% | > horyzont (2696–> horyzont), 36.7%, poza horyzontem | > horyzont (> horyzont–> horyzont), 0.0%, poza horyzontem | > horyzont (> horyzont–> horyzont), 0.0%, poza horyzontem | 4.9 / 2.2 / 1.1 | 5020.4 |

### Przegląd xp (R:G:A; xpNaDobeLotu; wiersz 4 ma 19 ziaren z tego samego powodu)

| xp (xpNaDobeLotu) | n | pierwszy Mistrz (1 500 XP): mediana (10–90%), do 4000 | pierwszy Legenda (9 999 XP): mediana (10–90%), do 4000, w oknie? | pierwszy statek z pełną załogą (≥ 4) na Legendzie: mediana (10–90%), do 4000, w oknie? | cyw. T2 / T3 / T4 (śr.) | mediana wartości (mln) |
|---|---|---|---|---|---|---|
| 2 | 30 | 782 (752–> horyzont), 83.3% | > horyzont (> horyzont–> horyzont), 0.0%, poza horyzontem | > horyzont (> horyzont–> horyzont), 0.0%, poza horyzontem | 4.8 / 2.5 / 1.7 | 2306.3 |
| 2.5 | 30 | 622 (600–663), 93.3% | 4084 (4001–> horyzont), 10.0%, **tak** | > horyzont (> horyzont–> horyzont), 3.3%, poza horyzontem | 5.2 / 2.8 / 2.0 | 3444.3 |
| 3 | 30 | 527 (501–555), 93.3% | 3418 (3312–> horyzont), 76.7%, za wcześnie | > horyzont (3922–> horyzont), 13.3%, poza horyzontem | 5.3 / 2.6 / 1.7 | 2496.1 |
| 3.5 | 30 | 444 (429–478), 96.7% | 2963 (2860–> horyzont), 80.0%, za wcześnie | > horyzont (3137–> horyzont), 30.0%, poza horyzontem | 5.6 / 2.8 / 1.9 | 5978.2 |
| 4 | 19 | 390 (378–419), 94.7% | 2572 (2464–> horyzont), 84.2%, za wcześnie | 4631 (2712–> horyzont), 31.6%, za późno | 5.9 / 3.7 / 2.5 | 8646.7 |
| 5 | 30 | 316 (302–349), 96.7% | 2096 (2013–> horyzont), 76.7%, za wcześnie | 3606 (2362–> horyzont), 56.7%, **tak** | 4.9 / 2.9 / 2.2 | 3150.7 |
| 6 | 30 | 265 (253–298), 96.7% | 1706 (1667–> horyzont), 80.0%, za wcześnie | 2734 (1781–> horyzont), 66.7%, za wcześnie | 5.4 / 3.2 / 2.2 | 3997.9 |
| 11 | 20 | 145 (140–164), 95.0% | 932 (914–1095), 95.0%, za wcześnie | 1215 (1019–1846), 95.0%, za wcześnie | 6.3 / 3.6 / 2.5 | 4702.7 |

### Przegląd progFirmy (R:G:A; mnożnik progów poziomu firmy (progFirmy × m))

| progFirmy (mnożnik progów poziomu firmy (progFirmy × m)) | n | firma T2: mediana (10–90%), do 4000 | firma T3: mediana (10–90%), do 4000 | firma T4: mediana (10–90%), do 4000, w oknie? | 8. statek: mediana (10–90%), do 4000, w oknie? | cyw. T2 / T3 / T4 (śr.) | mediana wartości (mln) |
|---|---|---|---|---|---|---|---|
| 1 | 20 | 55 (30–72), 95.0% | 275 (122–705), 95.0% | 1451 (483–> horyzont), 85.0%, za wcześnie | 1474 (518–> horyzont), 85.0%, za wcześnie | 6.3 / 3.6 / 2.5 | 4702.7 |
| 5 | 30 | 654 (266–> horyzont), 90.0% | 1962 (1119–> horyzont), 66.7% | 3403 (1663–> horyzont), 56.7%, za wcześnie | 3428 (1681–> horyzont), 56.7%, za wcześnie | 4.3 / 2.0 / 1.1 | 3928.1 |
| 25 | 30 | 2833 (1318–> horyzont), 53.3% | > horyzont (2205–> horyzont), 30.0% | > horyzont (3128–> horyzont), 23.3%, poza horyzontem | > horyzont (3194–> horyzont), 23.3%, poza horyzontem | 2.2 / 1.2 / 0.8 | 563.9 |
| 100 | 30 | > horyzont (1934–> horyzont), 40.0% | > horyzont (3637–> horyzont), 20.0% | > horyzont (4427–> horyzont), 6.7%, poza horyzontem | > horyzont (4466–> horyzont), 6.7%, poza horyzontem | 1.7 / 0.7 / 0.5 | 805.1 |
| 500 | 30 | > horyzont (4114–> horyzont), 10.0% | > horyzont (> horyzont–> horyzont), 6.7% | > horyzont (> horyzont–> horyzont), 0.0%, poza horyzontem | > horyzont (> horyzont–> horyzont), 0.0%, poza horyzontem | 1.5 / 0.5 / 0.4 | 805.1 |

### Przegląd kKadluba (R:G:A; cena szczebla = k × mediana zysku na kurs; wiersz 100 ma 20 ziaren, bo proces przeglądu został ubity po 20. ziarnie)

| kKadluba (cena szczebla = k × mediana zysku na kurs) | n | szczebel 1: mediana (10–90%), do 4000 | szczebel 2: mediana (10–90%), do 4000 | szczebel 3: mediana (10–90%), do 4000 | szczebel 4: mediana (10–90%), do 4000 | szczebel 5: mediana (10–90%), do 4000, w oknie? | cyw. T2 / T3 / T4 (śr.) | mediana wartości (mln) |
|---|---|---|---|---|---|---|---|---|
| 5 | 20 | 116 (69–670), 95.0% | 827 (562–> horyzont), 85.0% | 2083 (1238–> horyzont), 60.0% | 2887 (1432–> horyzont), 60.0% | 3622 (1827–> horyzont), 55.0%, **tak** | 6.3 / 3.6 / 2.5 | 4702.7 |
| 20 | 30 | 548 (108–1429), 93.3% | 2770 (1090–> horyzont), 63.3% | 4433 (2067–> horyzont), 36.7% | > horyzont (2602–> horyzont), 33.3% | > horyzont (3058–> horyzont), 16.7%, poza horyzontem | 4.2 / 2.1 / 1.3 | 772.5 |
| 50 | 30 | 1080 (127–> horyzont), 86.7% | 3791 (1637–> horyzont), 53.3% | > horyzont (2913–> horyzont), 26.7% | > horyzont (4408–> horyzont), 10.0% | > horyzont (> horyzont–> horyzont), 0.0%, poza horyzontem | 3.6 / 1.5 / 0.8 | 353.5 |
| 100 | 20 | 1988 (546–> horyzont), 90.0% | > horyzont (4082–> horyzont), 10.0% | > horyzont (4337–> horyzont), 10.0% | > horyzont (> horyzont–> horyzont), 5.0% | > horyzont (> horyzont–> horyzont), 5.0%, poza horyzontem | 3.9 / 1.3 / 0.6 | 1880.4 |
| 200 | 30 | 2731 (1006–> horyzont), 63.3% | > horyzont (2712–> horyzont), 13.3% | > horyzont (> horyzont–> horyzont), 6.7% | > horyzont (> horyzont–> horyzont), 0.0% | > horyzont (> horyzont–> horyzont), 0.0%, poza horyzontem | 3.5 / 1.0 / 0.6 | 757.9 |

## Odpowiedzi

89. **Jedno zdanie na oś (R:G:A, mediany po ziarnach; cel ok. 4 000 dób, okno 3 600–4 400).** *Cywilizacja*: pierwsza cywilizacja osiąga T4 w 2 778 dób (70% ziaren do doby 4 000) — za wcześnie wobec okna, a `k` 1,3–1,5 przesuwa ją w okno (4 043 / 4 361). *Galaktyka (b)* (wszystkie poznane na T4) i *(a)* (wszystkie 9): **0% ziaren do doby 4 000 przy każdym `k`** i 5% (jedno ziarno) do 4 800; po 4 800 dobach średnio 2,5–3,6 cywilizacji jest na T4, 3,5–4,8 na T3, 5–7 na T2, choć kontakt ze wszystkimi dziewięcioma przychodzi w 1 997 dób. *Firma*: T4 (8 statków) w 1 451 dób (85% do 4 000) — trzy razy za wcześnie. *Kadłub*: szczebel 5 w 3 622 dób (55% do 4 000) — **w oknie**, ale dlatego, że czeka na pierwszą cywilizację T4 (stocznia szczebla 5 wymaga tieru 4), nie dlatego, że jest drogi. *Załoga*: przy `xpNaDobeLotu` 11 pierwszy Legenda w 932 dób, pierwszy statek z pełną załogą na Legendzie w 1 215 — cztery razy za wcześnie; wartości w oknie niżej (92).
90. **Które warianty zmieniają wynik.** *Paliwo R/D*: najmocniejsza oś. W D pierwsza cywilizacja T2 przychodzi w 1 250 dób zamiast 551 (T3 2 358 vs 1 547), bo tanie długie loty (1 m³/pc niezależnie od masy) rozpraszają flotę po galaktyce, zamiast trzymać ją przy wahadle między dwiema cywilizacjami; w R masa karze dalekie loty z ładunkiem, więc bot buduje kapitał lokalnie i zaczyna kontrakty wcześniej. Po 4 800 dobach różnica maleje (T4 pierwszej cywilizacji 2 928 vs 2 703; 2,4 vs 2,9 cywilizacji na T4; wartość 7,5 vs 15 mld), a bankructwa są podobne (10% vs 7,5%). *Bramka G/P*: prawie bez różnicy na końcu (T4 2 703 vs 2 901; 2,5 vs 2,8 cywilizacji na T4); P daje szybszy start (T2 763 vs 837), bo towary T2 istnieją na rynkach T1 jako deficyt i da się nimi handlować od pierwszej cywilizacji T2 u sąsiada; G blokuje popyt, dopóki tier nie otworzy sektora. *Pamięć floty A/B/C*: bez różnicy w granicach szumu (T4 2 873 / 2 921 / 2 710; wartość 8,4 / 10,9 / 10,3 mld) — rynki z ludności są bezdenne wobec floty, więc odsprzedaż w miejscu zakupu i tak nie jest kuszącym kursem i reguła wygasania nie ma na czym działać. Wniosek: dla celu 4 000 dób liczy się tylko R/D, i to głównie przez tempo startu.
91. **`k` dla ok. 4 000 dób.** Gotowość T2 (otwarcie kontraktu) przychodzi w 218–407 dób dla `k` 1,05–2,00 (mediany; z `dobyGotowosciT2` = 250 i kalibracją PkbToWaterUnits), więc próg gotowości nigdy nie jest wąskim gardłem: cywilizacja jest gotowa setki dób przed tym, jak bot dowozi kontrakt. Dla **pierwszej cywilizacji na T4** okno 3 600–4 400 trafia `k` = **1,3** (mediana 4 043, 47% ziaren do 4 000) i 1,5 (4 361, 47%); `k` 1,75 i 2,00 wypychają medianę poza horyzont (40% / 37% do 4 000), więc nie ma potrzeby rozszerzać przeglądu w górę. Dla **galaktyki (a) i (b)** żadne `k` nie daje nic: 0% ziaren do 4 000 przy każdej wartości, a liczba cywilizacji na T4 po 4 800 dobach spada z 2,4 (k 1,05) do 1,1 (k 2,00). Barierą jest przepustowość kontraktów bota — 11–16 dostarczonych na 4 800 dób przy 27 potrzebnych (9 cywilizacji × 3 tiery) — i receptury, których składników nie ma w pobliżu (93, 97).
92. **`xpNaDobeLotu` dla Legendy w 3 600–4 400 dób.** Progi XP kanonu bez zmian (0 / 500 / 1 500 / 9 999). Pierwszy załogant na Legendzie: xp 2 → poza horyzontem, 2,5 → 4 084 (10% do 4 000), 3 → 3 418 (77%), 3,5 → 2 963, 4 → 2 572, 11 → 932; **okno trafia xp ≈ 2,5–3 (ok. 2,7)** — załogant z pierwszego statku lata ok. 90% dób, więc 9 999 XP ≈ 2,7 × 0,9 × 4 000. Pierwszy statek z pełną (≥ 4) załogą na Legendzie przychodzi później, bo flota dokupuje statki i miejsca w większych kadłubach, a każdy nowy załogant startuje od 0 XP: xp 4 → 4 631 (32% do 4 000), 3,5 → poza horyzontem (30%), 5 → **3 606 (57% do 4 000, w oknie)**, 6 → 2 734 (67%). Dla kamienia „cała załoga statku na Legendzie” trzeba więc xp ≈ 5; dla samego założyciela 2,5–3.
93. **Ceny szczebli kadłuba i `progFirmy`.** *Firma*: przy `progFirmy` = {0; 20; 60; 200} mln T4 (8 statków) przychodzi w 1 451 dób, bo wartość firmy rośnie ×142 do doby 2 000 i ×1 366 do 4 800 (krzywa niżej); ×5 ({0; 100; 300; 1 000} mln) daje 3 403 dób (57% do 4 000), ×25 — poza horyzontem (23% do 4 000), ×100 i ×500 — pojedyncze ziarna. Okno 3 600–4 400 leży między ×5 a ×25: po interpolacji logarytmicznej **`progFirmy` × ok. 8**, czyli {0; 160; 480; 1 600} mln kr; ale uwaga — wyższe progi trzymają flotę mniejszą, a to psuje oś cywilizacji (×5: 1,1 cywilizacji na T4 zamiast 2,5; ×25: 0,8), bo kontrakty wozi ta sama flota. *Kadłub*: przy cenie 5 × mediana zysku na kurs szczebel 5 przychodzi w 3 622 dób — **już w oknie** (55% do 4 000); droższe kadłuby (20 / 50 / 100 / 200 ×) dają szczebel 5 w poza horyzontem (17% / 0% / 5% / 0% ziaren do 4 000) — poza horyzontem — i hamują wszystko inne (szczebel 1 w 519–2 971 dób zamiast 116). Cena nie jest tu dźwignią: szczebel 5 ogranicza `tierSzczebla` (stocznia szczebla 5 tylko w stolicy cywilizacji T4), więc jego data to data pierwszego T4 + dojazd; szczeble 3–4 (stocznia T3) przychodzą w 2 083 / 2 887 dób z tego samego powodu.
94. **Czy wnioski o paliwie i odległości zmieniają się z masą (R vs D).** Zmieniają się w szczegółach, nie w kierunku. W obu wariantach zysk na dobę **rośnie z dystansem** dla towarów T2+ (R: minerały 355 tys. → 1,9 mln kr/dobę od kosza 0–50 do 200+ pc, materiały wybuchowe 3,0 → 4,2 mln, rozpuszczalniki 0,7 → 3,0 mln; D podobnie), a udział paliwa w kosztach **maleje** z dystansem (R: 0,78 → 0,38 dla żywności, 0,70 → 0,37 dla materiałów wybuchowych) — odwrotnie niż w rundach 1–2 (korelacja ujemna), bo rynki z ludności płacą pułap 2,5 × ceny bazowej w każdym deficytowym porcie, a duże kadłuby wożą tysiące m³. Masa działa tam, gdzie towar jest ciężki: w R minerały (3 t/m³) mają udział paliwa 0,61 w koszu 0–50 pc i zysk 355 tys./dobę, w D 0,47 i 437 tys.; materiały wybuchowe 0,70 vs 0,58. Żywność (0,7 t/m³, marża ok. 800 kr/m³) nie pokrywa paliwa w koszu 50–100 pc w żadnym wariancie (−27 tys. i −19 tys. kr/dobę). Zwrot paliwa (pc, na które starcza marża brutto lotu): żywność 32–36 pc w koszu 0–50 (dlatego bot wozi ją tylko na krótko), minerały 806 (R) / 2 459 (D), materiały wybuchowe 4 756 / 12 371, elektronika 16,7 tys. / 50,8 tys. — towary T2+ płacą za każdą odległość w galaktyce.
95. **Okna stoczni na 100 dób i pojemność rynku.** Okien stoczni (zakup kadłuba albo statku, jedyne chwile, gdy czas stoi): 0,10 na 100 dób przy 1 statku, 0,87 przy 2, 0,46 przy 4, **0,67 przy 8 statkach** — przy 8 statkach gracz zatrzymuje czas raz na ok. 150 dób, bo każdy z ośmiu statków wspina się po drabinie osobno (6 szczebli × 8 statków = 48 zakupów kadłuba na grę plus 7 statków). Pojemność rynku dla 8 statków szczebla 5 (3 600 m³ ładowni każdy, kurs tam z ładunkiem i z powrotem pusto na medianie dystansu lotów): flota dostarcza 0,7–1,3 tys. m³ dziennie na towar, a mediana konsumpcji stolic to 232 tys. m³ żywności, 788 tys. minerałów, 35 tys. rozpuszczalników, 5,7 tys. materiałów wybuchowych i 3,5 tys. elektroniki — stosunek konsumpcja / dostawy **196 / 899 / 35 / 6,1 / 1,9**: rynki wchłaniają wszystko, co 8 statków wozi (zapisane jako wynik, zgodnie z promptem); jedynie elektronika zbliża się do granicy na najmniejszych stolicach (minimum 40 m³/dobę). Granicą nie jest popyt, lecz **podaż**: statek może kupić tylko z zapasu, a zapas towaru, który cywilizacja produkuje poniżej potrzeb, jest zerowy — stąd rozpuszczalników i elektroniki do receptur trzeba szukać u nadwyżkowych cywilizacji 500+ pc dalej.
96. **Stabilność 4 800 dób.** Zero NaN w 879 przebiegach; wzrost zamożności w d2400–4800 ≤ wzrost w d0–2400 **nie zachodzi dla każdej rasy**, i to z konstrukcji: jedynym źródłem wzrostu PKB (Σ konsumpcja × cena bazowa) jest awans tieru (koszyk ×6,38 minerałów itd.), a awanse dalekich cywilizacji gracz dowozi w drugiej połowie gry — Vreth i Corrath rosną w pierwszej połowie (×4,0 / ×2,7) i stoją w drugiej (×1,00), Ludzie, Orak, AI, Planta, Duhari i Velhari stoją w pierwszej (×1,00) i rosną w drugiej (×1,15–×4,08). Nie jest to ucieczka: PKB jest schodkowy i ograniczony tierem 4 (ostatni schodek), bez wzrostu autonomicznego. „Nowe sufity” (pozycje rynku dostępne w dobie 0, które opróżniły się do doby 4 800): Ludzie 14 → 19, Duhari 14 → 16, reszta bez zmian — to deficytowe towary, których konsumpcja wzrosła po awansie; rośnie natomiast liczba pozycji **pełnych** (6 norm): 0 → 8–35 na cywilizację, bo nadwyżkowe towary nie mają dokąd odpłynąć (sufit wymiany NPC z otwartości, DECYZJE 36) — stan ustalony znany z rundy 2 (73), nie nowy sufit. Krzywa wartości firmy rośnie przez cały horyzont (×14,7 w 400. dobie, ×141 w 2 000., ×449 w 4 000., ×1 366 w 4 800. z kadłubami; 10–90%: 0,28–60 mld), gra nie kończy się ekonomicznie wcześniej, ale pieniądze przestają mieć znaczenie po ok. 1 000 dobach.
97. **Które liczby kanonu wymusza cel 4 000 dób.** (a) **Profile produkcji ras i receptura T4**: rozpuszczalniki produkują ponad potrzeby tylko Corrath (1,7), Planta (2,6) i AI (1,1), elektronikę AI (4,0), Velhari (2,2) i Ludzie na T3 (1,4); kontrakt T4 Vreth albo Ludzi potrzebuje 1–2 m³ tych towarów, a najbliższe źródło z zapasem bywa 500+ pc od akademii — jeden kontrakt to 300–500 dób statku. Przy 11–16 kontraktach na 4 800 dób i 27 potrzebnych galaktyka na T4 wymaga albo dwukrotnie większej przepustowości (więcej niż 8 statków na kontrakty albo receptury z towarów dostępnych lokalnie), albo awansu bez składnika spoza regionu; sam `k` nic tu nie zmienia. (b) **`tierSzczebla`** (szczebel 5 tylko w stoczni cywilizacji T4): wiąże oś kadłuba z osią cywilizacji — szczebel 5 przychodzi 850 dób po pierwszym T4; przy celu 4 000 dla obu osi to spójne, ale przy niższym `k` kadłub też przyjdzie wcześniej. (c) **9 999 XP Legendy** ⇒ ok. 2,7 XP na dobę lotu dla załogi startowej, ok. 5 dla ostatnich zatrudnionych w rosnącej flocie (każdy nowy statek i większy kadłub zaczyna od zera). (d) **Pułap ceny 2,5 × cena bazowa i konsumpcja z ludności**: po otwarciu minerałów i materiałów wybuchowych u pierwszej cywilizacji T2 (565. doba) deficytowy port sąsiada płaci 15 tys. kr/m³ za minerały i 157 tys. za materiały wybuchowe przy bezdennym popycie, więc firma rośnie ×140 do 2 000. doby i `progFirmy` {20; 60; 200} mln mija w 1 451 dób; cel 4 000 wymaga progów ×8 ({160; 480; 1 600} mln) albo pułapu ceny poniżej 2,5. (e) **Ciąg 230 tf i masy kadłubów**: pełne kadłuby lecą 1,3–2,1 pc/dobę (szczebel 1 najwolniej), najdalsza stolica leży 2 045 pc od startu (650–980 dób lotu w jedną stronę), więc kontakt ze wszystkimi dziewięcioma zajmuje ok. 2 000 dób nawet flocie 8 statków — mieści się w 4 000, ale każdy kontrakt dla dalekiej cywilizacji to setki dób. (f) **Paliwo 4 m³/dobę (R) vs 1 m³/pc (D)**: R wymusza handel lokalny i szybszy start (T2 w 551 dób zamiast 1 250), D rozprasza flotę; dla celu 4 000 dób R jest bezpieczniejszy. (g) **`SectorMinTier` i bramka G**: silnik pieniędzy (minerały, materiały wybuchowe, elektronika) nie istnieje przed pierwszym awansem T2, więc pierwsze 500–600 dób to żywność i rozpuszczalniki z marżą, która ledwie pokrywa paliwo (zwrot 32–36 pc) — to one decydują o 7–10% bankructw, nie dalsza gra.

# Runda 4: drabina kadłubów z BaseShipa i z potrzeby (PROMPT-runda4.md)

Pytanie projektantów: jaka ładownia na szczeblach 1–5 daje galaktykę na T4 w oknie 3 600–4 400 dób, gdy każdy kadłub wyprowadza się procedurą kanonu (`zasada-wyprowadzenie-kadluba`), a nie mnożnikiem; werdykty z 06.10: tier firmy to jedyna droga do większej liczby statków (1 → 2 → 4 → 8, bez osobnej puli na kontrakty), ładownię wyprowadzamy z potrzeby, BaseShip jest designerską jedynką. Test na L, 4 800 dób, flota 1/2/4/8, `k` 1,3, `xpNaDobeLotu` 2,7, `progFirmy` ×1, bramka G, pamięć A, osobno R i D, 20 ziaren na g i wariant. Liczby kanonu bez zmian, nowe w `kanon.json` (blok `kadlub`): obrys jedynki 1 000 m³, kajuta 20 m³ na osobę, 2 osoby jedynki, konstrukcja 10% obrysu, zbiornik 50 m³ (2 w jedynce), moduł 120 m³ (4 w jedynce); reaktor 271 m³, 2 dysze × 230 tf, gęstości i ceny towarów, `SectorMinTier` jak dotąd.

## Założenia modelu

98. **Procedura kadłuba** (`sim/kadlub.ts`, ta sama dla każdego szczebla): 1. obrys (decyzja), 2. napęd (reaktory po 271 m³, 2 dysze × 230 tf), 3. kajuty 20 m³ na osobę, 4. konstrukcja 10% obrysu, 5. bak ze zbiorników 50 m³, 6. ładownia = reszta w modułach 120 m³. Dla BaseShipa daje 1 000 / 271 / 40 / 100 / 100 / 480 m³ (4 moduły, luz 9 m³; test). Dla szczebli 1–5 wejściem jest ładownia docelowa 480 m³ × g^N (moduły zaokrąglone w górę), a obrys wyznacza się odwrotnie: najmniejszy (zaokrąglony w górę do `zaokraglenieObrysuM3` = 10 m³), w którym po krokach 2–5 zostaje ta ładownia. Napęd: najmniejsza liczba reaktorów, przy której prędkość z pełną ładownią towaru referencyjnego ρ = `gestoscReferencyjnaTNaM3` = 1,0 i pełnym bakiem jest ≥ prędkości jedynki w tym samym stanie (2,08 pc/dobę). Bak: najmniejsza liczba zbiorników, przy której zasięg w tym stanie jest ≥ zasięgu jedynki (55 pc w R, 100 pc w D). Kajuty: obsada jak w rundzie 3 (kokpit 1 + 1 na reaktor + 1 na rozpoczęte 4 moduły) × 20 m³ — **dla jedynki tabela kanonu mówi 40 m³ (2 osoby), a ta formuła dałaby 3 osoby / 60 m³**; jedynka bierze tabelę kanonu, szczeble 1–5 formułę (do decyzji projektanta: albo obsada jedynki 2, albo formuła „1 na reaktor” bez kokpitu). Procedura iteruje (obsada zależy od reaktorów, masa od obrysu) i zbiega w kilku krokach.
99. **Masa i lot** jak w rundzie 3: masa sucha = konstrukcja × 3,2199 t/m³ (gęstość z jedynki: (421,99 − 100) / 100 m³ konstrukcji) + reaktory × 100 t + moduły × 36 t — jedynka 421,99 t to kadłub bez modułów ładowni, jak w DECYZJE 76 i w liczbach kontrolnych kanonu (jedynka + 4 puste ładownie: zasięg 78,4 pc; z 1 440 t minerałów 0,99 pc/dobę), więc szczebel 0 waży 565,99 t jak w rundzie 3 (test); pierwsza siatka policzona z gęstością 1,7799 (moduły wliczone w 421,99 t, szczebel 0 lżejszy o 144 t) poszła do kosza, jej skrót w `findings.md`; kajuty i zbiorniki bez masy własnej (paliwo 1 t/m³, ładunek z gęstości kanonu); prędkość i paliwo z hierarchii ciągu (DECYZJE 76). Jedynka = rung 0 drabiny, więc runda 4 ma jedno źródło ładowni, baku, masy, ciągu i obsady (`Gra.drabina`); runda 3 dostaje swoją drabinę z `prototyp.json` w tym samym kształcie i zachowuje się jak dotąd (83 testy).
100. **Krok wymuszający obrys**: dla każdego szczebla sprawdzam, który krok (2 napęd, 3 kajuty, 5 bak) jako pierwszy nie mieści się w obrysie skalowanym proporcjonalnie do ładowni (1 000 m³ × moduły / 4); „—” oznacza, że minimalny obrys jest **mniejszy** od proporcjonalnego — napęd rośnie wolniej niż ładownia, bo prędkość referencyjna wymaga ok. 1 reaktora na 4,6 modułu (jedynka ma 1 na 4), a bak prawie nie rośnie.
101. **Bot** jak w rundzie 3 z poprawkami z sond rundy 4 (`findings.md`, faza 5): ładunek receptury dobierany z osiągalności akademii w grafie tankowania liczonym z tą masą na pokładzie (cała, połowa, ćwierć, ósma receptury), statek na misji we flocie nie bierze ładunku handlowego i sprzedaje go przed zakupem receptury, naraz na misjach najwyżej połowa floty, rezerwacje gotówki na drugi krok do 1/(2 × statki) kasy i nie blokują receptur, lot przynoszący gotówkę dozwolony także w biedzie, misja startuje tylko lekkim statkiem (`maxMasaStartuMisjiUlamek` = 0,25 masy suchej). Te reguły działają też w rundzie 3, ale liczb rundy 3 nie przeliczałem (zmiana bota, nie modelu).
102. **Miary** (`npm run runda3 -- runda4 …`, `-- tabele4`): tabela kadłubów (obrys, reaktory, dysze, kajuty, konstrukcja, bak, ładownia, luz, masa sucha, prędkość pusty / ρ 1,0 / minerały, zasięg pusty / z ładunkiem ρ 1,0, cena szczebla = mediana zakupów bota, krok wymuszający); kamienie: galaktyka (a)/(b), pierwsza cywilizacja T4, firma T4, szczebel 5 (mediana, 10–90%, odsetek do 4 000, okno); kontrakty dostarczone do 4 000 i 4 800 wobec 27, czas kontraktu w dobach statku (start misji → dostawa końcowa), udział ładowni floty zajętej przez kontrakty = Σ czas misji × ładownia statku przy dostawie / Σ (horyzont − doba zakupu statku) × ładownia końcowa; pojemność rynku dla 8 statków szczebla 5 (jak DECYZJE 88); krzywa wartości co 200 dób i bankructwa.

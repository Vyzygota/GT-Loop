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

47. **Przełącznik `spread`** (A/B/C/D) w `prototyp.json`, w nagłówku gry i w adresie (`&spread=B`); domyślny wariant gry to **A**, dopóki projektant nie zdecyduje. Konfiguracja wariantów w `prototyp.json → wariantySpreadu`: A = tryb `staly` (dzisiejsze zachowanie, `tradeSpread` na każdej transakcji); B = pamięć, spread podstawowy 0, kara schodkowa; C = pamięć, spread podstawowy 0,10, kara schodkowa; D = pamięć, spread podstawowy 0, kara liniowa. `pamiecZakupuSkokow` = 5 (rozstrzygnięcie projektanta, nie liczba kanonu).
48. **Pamięć zakupu** to słownik `stan.pamiecZakupu`: klucz „planeta|towar” → licznik skoków, bez ceny kupna (test). Przy zakupie licznik pary ustawia się na 5; każdy wykonany lot zmniejsza wszystkie liczniki o liczbę krawędzi trasy (lot wieloskokowy = tyle skoków, ile krawędzi); licznik 0 usuwa wpis. Pamięć jest per statek = per firma (jeden statek).
49. **Ceny.** Kupno = baza × (1 + s/2 × (1 − u)), sprzedaż = baza × (1 − s/2 × (1 − u)) × (1 − kara), gdzie s to spread podstawowy wariantu, u pozycja handlowca, a kara = `tradeSpread` (0,3, schodek) albo `tradeSpread` × licznik/5 (liniowa), dopóki licznik pary (planeta, towar) > 0, inaczej 0. Kara jest mnożnikiem całej ceny sprzedaży, więc przy spreadzie 0 okno kupno/sprzedaż na planecie zakupu wynosi dokładnie 0,3 (`OnePlanetBuySellPriceSpread`); przy spreadzie 0,10 okno to 1,05 / (0,95 × 0,7) ≈ 1,58. Wybrałem mnożnik (a nie odjęcie 0,3 od spreadu), bo tak kara jest niezależna od okna podstawowego i od handlowca.
50. **Niezmiennik „obrót na jednej planecie nie daje zysku”.** Przy cenie krańcowej kupno q, a potem sprzedaż q na tej samej planecie bez spreadu daje dokładnie tę samą całkę nacisku, czyli zero (do zaokrąglenia 1 kr); kara 0,3 zamienia zero w stratę. Test sprawdza dla S i M, trzech ziaren, każdego towaru, trzech ilości (1 m³, połowa, maksimum), sprzedaży w całości i w częściach, bez handlowca i z handlowcem 0,8 oraz 1,25: saldo po odsprzedaży jest zawsze niższe. Kryterium jest więc spełnione we wszystkich wariantach, ale inaczej niż dotąd: w A przez stały spread na każdej planecie, w B/C/D przez pamięć zakupu, która po 5 skokach gaśnie (test), więc po powrocie na planetę zakupu po dłuższej trasie odsprzedaż bez kary jest możliwa — zgodnie z rozstrzygnięciem projektanta.
51. **Raport** ma nową linię „Kara za odsprzedaż w miejscu zakupu” (wartość ujemna), a linia sprzedaży pokazuje ceny bez handlowca i bez kary; suma linii nadal równa się zmianie salda (test). W doku przy cenie sprzedaży widać „kara 30% (jeszcze N sk.)”.
52. **Bot zna regułę.** Graf tankowania zapamiętuje liczbę skoków każdego odcinka (`Dojazd.skoki`), a wyceny bota rzutują licznik pamięci w przód o skoki trasy, więc plan powrotu na planetę zakupu w ciągu 5 skoków dostaje cenę z karą; sprzedaż częściowa w doku wycenia karę bez skoków w przód. W klastrze dystrybucji wszystkie planety klastra dostają ten sam rzut skoków (przybliżenie). Bot sprzedaje z karą tylko wtedy, gdy mimo kary się opłaca (ten sam wybór maksimum łącznego przychodu).
53. **Skutek dla handlowca.** Handlowiec działa wyłącznie w oknie spreadu podstawowego. W B i D spread podstawowy = 0, więc handlowiec nie zmienia żadnej ceny (test): rola traci sens ekonomiczny, bot przestaje go zatrudniać (płaca 500 kr/dobę bez zwrotu), a linie „Handlowiec: lepsze ceny” w raporcie znikają. W C okno 0,10 zostaje: najlepszy handlowiec przesuwa cenę o 80% połowy okna, czyli o 4% zamiast dzisiejszych 12%, co przy pełnej ładowni minerałów (2,9 mln kr) daje ok. 115 tys. kr na kurs, czyli nadal wielokrotność płacy. Jeśli kanon ma zostać przy spreadzie 0, handlowiec potrzebuje nowej mechaniki (np. zmniejszenia kary pamięci albo lepszego nacisku), co jest poza zakresem tego testu.
54. **Miary dodane do bota** (`npm run bot -- all pelna - all`): korelacje zysku/dobę z dystansem na poziomie lotu i trasy handlowej, osobno per towar dominujący trasy, udział paliwa w kosztach lotów (paliwo / (paliwo + płace)), mediana dystansu zyskownej trasy między cywilizacjami, pc paliwa pokrywane medianą marży z pełnej ładowni per towar (mediana marży na m³ ze sprzedaży × 480 m³ / mediana ceny paliwa zapłaconej w dokach), oraz korelacje po **wszystkich planach dostępnych w dokach** (stopa na dobę i zysk na kurs vs dystans), które mierzą strukturę gospodarki niezależnie od wyborów bota.

## Wynik (4 warianty × 3 skale, `informacja = pelna`, S i M po 200 ziaren, L po 50)

<!-- TABELA-SPREAD-START -->
(w przygotowaniu)
<!-- TABELA-SPREAD-KONIEC -->

## Odpowiedzi

<!-- ODPOWIEDZI-SPREAD -->

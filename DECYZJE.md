# DECYZJE — założenia spoza kanonu i wynik bota

Liczby kanonu (`sim/kanon.json`) są wzięte z tabeli w `PROMPT.md` bez zmian. Wszystko poniżej to moje założenia; każde ma liczbę w `sim/prototyp.json` albo jest regułą opisaną tutaj.

## Rynek i ceny

1. **Cena krańcowa.** Kanon podaje cenę jednostkową przy danym zapasie. Przy transakcji liczę całkę nacisku po zapasie: każdy kolejny m³ jest wyceniany przy zapasie po poprzednim (postać zamknięta w `sim/rynek.ts`, `calkaNacisku`). Skutki: duża partia sama obniża sobie cenę, podział transakcji na części nic nie zmienia (test), a UI pokazuje kwotę za wpisaną ilość, średnią cenę i cenę po transakcji. Alternatywa (cena z chwili transakcji za całą partię) premiowałaby zrzucanie całej ładowni na mały rynek.
2. **Czas ciągły.** Lot trwa `dystans / prędkość` dób z ułamkiem; rynki aktualizują się liniowo o `dt` (produkcja − konsumpcja), a nie tylko w pełnych dobach. Dzięki temu pilot ma widoczny efekt w dobach i płacach.
3. **Zaokrąglenie.** Każda kwota (zakup, sprzedaż, paliwo, płace) jest zaokrąglana do pełnych kr w chwili transakcji, więc raport sumuje się dokładnie, bez tolerancji.
4. **Zapas startowy i rozruch.** Każda pozycja startuje z `zapasStartowyUlamekNormy` = 1,0 normy ± `zapasStartowyJitter` = 0,2, potem świat żyje `dobyRozruchuRynku` = 40 dób bez gracza. Dzięki temu nadwyżki i braki są widoczne od pierwszego doku (pierwsza zyskowna trasa po 1 locie).
5. **Pułap zapasu** `maxZapasWNormach` = 6 norm (od 5,9 normy cena i tak jest na minimum 0,45). Konsumpcja ustaje przy zapasie 0 (niezaspokojony popyt nie rośnie jako dług).
6. **Elektronika nieznanej cywilizacji.** Do kontaktu jej konsumpcja Elektroniki jest uśpiona (`konsumpcjaUspiona`), zapas = `kontaktZapasElektronikiUlamekNormy` = 0,05 normy. Kontakt budzi konsumpcję na wszystkich planetach tej cywilizacji i odsłania rynki. Kontakt liczy się tylko przy dokowaniu (przelot przez planetę nie wystarcza).
7. **Paliwo na planecie zawsze dostępne.** Planety z deficytem paliwa miewają zapas 0; żeby statek nie utknął, paliwo można kupić zawsze, a przy pustym zapasie cena to BasePrice × nacisk maksymalny (2,5), zgodnie z wzorem. Zakup zmniejsza zapas do 0. W punktach plemion cena bazowa i bez limitu. Paliwo w baku nie liczy się do masy ładunku.

## Załoga

8. **Handlowiec.** Udział w półoknie spreadu = `handlowiecMaxUdzialPolspreadu` (0,8) × (umiejętność − skillFloor)/(skillCeiling − skillFloor). Kupno = baza × (1 + spread/2 × (1 − udział)), sprzedaż = baza × (1 − spread/2 × (1 − udział)). Najlepszy handlowiec zabiera 80% półspreadu, więc sprzedaż < kupno zawsze (test). Handlowiec o umiejętności 0,8 nie daje nic, tak jak nawigator o 0,8.
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

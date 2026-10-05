import kanonJson from './kanon.json';
import prototypJson from './prototyp.json';
import type { Rola, Skala, Towar, TowarLubPaliwo, TrybInformacji, WariantSpreadu } from './typy';

export interface Kanon {
  kurs: number;
  towary: Record<TowarLubPaliwo, { basePrice: number; gestosc: number }>;
  ladownia: number;
  maxMasaLadunku: number;
  bak: number;
  kosztPaliwaNaParsek: number;
  predkoscNominalna: number;
  skokPodstawowy: number;
  startingCredits: number;
  tradeSpread: number;
  StockPressureMin: number;
  StockPressureMax: number;
  StockPriceWeight: number;
  StockRatioFloor: number;
  normaZapasu: number;
  skillFloor: number;
  skillCeiling: number;
  placa: Record<Rola, number>;
  miejscaZalogi: number;
  promienGalaktyki: number;
  DeadCoreFraction: number;
  gradientZdatnosci: { od: number; do: number };
  habitableZoneInner: number;
  habitableZoneOuter: number;
  SectorCount: number;
  ukladyZamieszkiwalne: number;
  terytoriumZPopulacji: { staly: number; naDekade: number };
  zasiegLacznosci: number;
  cywilizacje: Record<string, { nazwa: string; otwartosc: number; ssr: number }>;
  /** Liczba tierów cywilizacji i załogi (awans cywilizacji odblokowuje gracz). */
  TierCount: number;
  /** Tiery załogi: progi XP (tier 0…TierCount−1) i widełki płacy kr/dobę per tier. */
  tierZalogi: { progiXP: number[]; placaKrNaDobe: [number, number][] };
  /** Drabina kadłubów: liczba szczebli (0…szczebli−1), status proponowane. */
  drabinaKadlubow: { szczebli: number; status: string };
  /** Statek kanonu: ciąg dyszy, dysze na reaktor, masa sucha jedynki, stała prędkości, spalanie R, dawka D, objętość reaktora. */
  statek: { ciagDyszyTf: number; dyszNaReaktor: number; masaJedynkiSuchaT: number; stalaPredkosci: number; spalanieRM3NaDobe: number; dawkaDM3NaPc: number; objetoscReaktoraM3: number };
  /** Minimalny tier otwierający sektor produkcji (7 sektorów; mapowanie na towary w prototyp.json). */
  SectorMinTier: number[];
}

export interface PlanetaProfil {
  nazwa: string;
  populacjaMln: number;
  specjalizacja: Partial<Record<TowarLubPaliwo, number>>;
}

export interface CywilizacjaProfil {
  id: string;
  nazwa: string;
  rola: 'hub' | 'ramie';
  znanaNaStarcie: boolean;
  start: boolean;
  kolor: string;
  otwartosc: number;
  planety: PlanetaProfil[];
  potrzebyM3NaMlnNaDobe: Record<TowarLubPaliwo, number>;
  produkcjaM3NaMlnNaDobe: Record<TowarLubPaliwo, number>;
}

export interface CywilizacjaWSkali {
  id: string;
  sektor: number;
  start: boolean;
  znanaNaStarcie: boolean;
}

export interface KonfiguracjaSkali {
  limitDob: number;
  opis?: string;
  sektory?: number[];
  ukladyZamieszkiwalne?: number;
  cywilizacje?: CywilizacjaWSkali[];
}

export interface CywilizacjaKanonuProfil {
  kolor: string;
  populacjaMln: number;
  sylaby: string[];
  potrzeby: Record<TowarLubPaliwo, number>;
  produkcjaDoPotrzeb: Partial<Record<TowarLubPaliwo, number>>;
}

export interface KonfiguracjaSpreadu {
  tryb: 'staly' | 'pamiec';
  spreadPodstawowy?: number;
  kara?: 'schodek' | 'liniowy';
  /** Wariant E: nacisk bez obcięcia StockPressureMin/Max (zostaje StockRatioFloor i pułap zapasu). */
  bezObcieciaNacisku?: boolean;
  opis?: string;
}

export interface KoszykTieru {
  tier: number;
  /** Udziały wartości towarów w koszyku (sumują się do 1). */
  udzialy: Partial<Record<Towar, number>>;
  /** Mnożnik progu awansu tego tieru (T4: „oba w większej ilości”). */
  mnoznikProgu: number;
}

export interface KonfiguracjaProgresji {
  wlaczona: boolean;
  horyzontDob: number;
  /** Próg awansu: wartość koszyka (po cenach bazowych) ≥ progAwansu × dzienny PKB portów cywilizacji. */
  progAwansu: number;
  koszyki: KoszykTieru[];
  /** Awans mnoży konsumpcję (i normę) towarów koszyka na wszystkich planetach cywilizacji. */
  mnoznikKonsumpcjiAwansu: number;
  /** Szczebel N: ładownia, bak i masa × mnoznikSzczebla^N. */
  mnoznikSzczebla: number;
  /** Cena szczebla N+1 = k × mediana zysku na kurs zmierzona na szczeblu N. */
  k: number;
  minKursowDoWycenySzczebla: number;
  xpNaDobeLotu: number;
  xpZaKontakt: number;
  xpStartoweKandydata: number;
  nazwyTierowZalogi: string[];
}

export interface KonfiguracjaRundy3 {
  wlaczona: boolean;
  paliwo: 'R' | 'D';
  bramkaTowaru: 'G' | 'P';
  pamiecFloty: 'A' | 'B' | 'C';
  /** Wariant C pamięci zakupu: kara gaśnie po tylu dobach (25 = 5 skoków jedynki). */
  pamiecCzasDob: number;
  statek: {
    masaReaktoraT: number;
    modulLadowniM3: number;
    masaModuluLadowniT: number;
    mnoznikKadluba: number;
    objetoscJedynkiM3: number;
    konfiguracje: { reaktory: number; ladownie: number }[];
    bakM3: number[];
    tierSzczebla: number[];
    obsada: { kokpit: number; naReaktor: number; naModulyLadowni: number };
    naukowiecM3: number;
  };
  rynek: {
    konsumpcjaNaMlnNaDobe: Record<TowarLubPaliwo, number>;
    sektory: { nazwa: string; towar: TowarLubPaliwo | null }[];
    /** Mnożniki popytu per tier (indeks 0 = T1) i towar. */
    koszykTieru: Record<TowarLubPaliwo, number>[];
  };
  awans: {
    k: number;
    dobyGotowosciT2: number;
    zamoznosc: Record<string, number>;
    ilosciKontraktu: number;
    /** Górny limit ilości jednego towaru w recepturze (m³): kontrakt da się dowieźć w ≤ 2 kursach kadłuba szczebla 0. */
    maxIloscKontraktuM3: number;
    naukowiecZInnejPlanety: boolean;
  };
  firma: {
    progFirmy: number[];
    statkiNaPoziom: number[];
    cenaNowegoStatkuKr: number;
  };
}

export interface Prototyp {
  skala: Skala;
  informacja: TrybInformacji;
  spread: WariantSpreadu;
  wariantySpreadu: Record<WariantSpreadu, KonfiguracjaSpreadu>;
  pamiecZakupuSkokow: number;
  progresja: KonfiguracjaProgresji;
  runda3: KonfiguracjaRundy3;
  skale: Record<Skala, KonfiguracjaSkali>;
  celMnoznikWartosci: number;
  nawigatorMaxRedukcjaPaliwa: number;
  synergiaRedukcjaPaliwa: number;
  handlowiecMaxUdzialPolspreadu: number;
  liczbaKandydatow: number;
  umiejetnoscMiejscaDziesietne: number;
  maxZapasWNormach: number;
  kontaktZapasElektronikiUlamekNormy: number;
  galaktyka: {
    minOdstepZamieszkiwalnychPc: number;
    maxProbLosowania: number;
    maxDlugoscSzlakuDodatkowegoPc: number;
    krokPrzelotuPc: number;
    jitterPrzelotuPc: number;
    rozrzutTerytorium: number;
    wykladnikWagiUkladu: number;
    specjalizacjaMnoznik: number;
    specjalizacjaReszta: number;
    portNaUkladM3NaDobe: Record<TowarLubPaliwo, number>;
    tempoWymianyNPC: number;
    mnoznikSufituNPC: number;
    glebokoscPortuMin: number;
    glebokoscPortuMax: number;
    zapasStartowyUlamekNormy: number;
    zapasStartowyJitter: number;
    dobyRozruchuRynku: number;
    maxProbUkladu: number;
    sasiedztwoTerytoriow: boolean;
  };
  cywilizacjeKanonu: Record<string, CywilizacjaKanonuProfil>;
  swiatS: {
    dobyRozruchuRynku: number;
    zapasStartowyUlamekNormy: number;
    zapasStartowyJitter: number;
    uklad: {
      promienGalaktykiPc: number;
      promienHubaPc: number;
      odlegloscTankowaniaPc: number;
      krokRamieniaPc: number;
      jitterPc: number;
      jitterKatStopnie: number;
      katMiedzyRamionamiStopnie: [number, number];
      minOdstepPc: number;
      maxProb: number;
    };
    cywilizacje: CywilizacjaProfil[];
    punktyTankowania: { nazwa: string }[];
  };
  nazwyTowarow: Record<TowarLubPaliwo, string>;
  nazwyRol: Record<Rola, string>;
  imiona: string[];
  nazwiska: string[];
  ui: {
    lotMinSek: number;
    lotMaxSek: number;
    lotSekNaDobe: number;
    skrotTestowy: number;
    progBilansu: number;
    poziomyMapy: { sredniPc: number; bliskiPc: number };
    tablicaCenWierszy: number;
  };
  bot: {
    liczbaZiaren: number;
    liczbaZiarenL: number;
    pierwszeZiarno: number;
    maxSkokowTrasy: number;
    minZyskNettoKr: number;
    tankujGdyCenaPonizejBazyRazy: number;
    topN: number;
    krokiIlosci: number;
    najlepszychCelowDoOcenyZalogi: number;
    eksplorujMaxPc: number;
    eksplorujDoUlamkaHoryzontu: number;
    premiaEksploracjiKr: number;
    karaPrzystankuPc: number;
    rezerwaPaliwaOdcinkaM3: number;
    promienDystrybucjiPc: number;
    maxPlanetDystrybucji: number;
    planowDoDrugiegoKroku: number;
    krokiDrugiegoKroku: number;
    celowDrugiegoKroku: number;
    /** Progresja: kupuje szczebel, gdy gotówka ≥ mnożnik × cena. */
    mnoznikGotowkiNaSzczebel: number;
    /** Progresja: jaki udział dodatkowego popytu po awansie bot spodziewa się obsłużyć. */
    udzialWPopycieAwansu: number;
    /** Progresja: horyzont (dób) wyceny dodatkowego popytu po awansie. */
    horyzontAwansuDob: number;
    /** Progresja: ile własnych sprzedaży towaru bot potrzebuje, żeby wyceniać przyszły popyt na niego. */
    minSprzedazyDoMarzy: number;
    /** Progresja: pułap premii awansu na m³ dostawy (ułamek ceny bazowej). */
    maxPremiaUlamekCeny: number;
    /** Progresja: premia awansu liczy się tylko, gdy reszta koszyka (po cenie bazowej) ≤ krotność majątku bota (gotówka + ładunek). */
    maxResztaKoszykaKrotnoscMajatku: number;
    /** Progresja: największa strata gotówki (ułamek kasy) na kurs, przy której premia awansu jeszcze się liczy. */
    maxStrataNaKoszykUlamek: number;
    /** Progresja: tolerowany koszt dnia (kr/dobę) zatrudnienia załoganta dla XP. */
    maxKosztDobyXpKr: number;
    /** Progresja: co ile dób (od ostatniego kontaktu) bot rusza na ekspedycję do najbliższej nieznanej cywilizacji. */
    dobyMiedzyEkspedycjami: number;
    /** Progresja: ekspedycja rusza, gdy gotówka z ładunkiem ≥ mnożnik × szacowany koszt paliwa i płac. */
    mnoznikGotowkiNaEkspedycje: number;
    /** Progresja: ekspedycja trwa, dopóki gotówka z ładunkiem ≥ mnożnik × koszt reszty drogi; inaczej bot ją przerywa. */
    mnoznikGotowkiNaKontynuacje: number;
    /** Progresja: po tylu kolejnych dokach bez dodatniego planu bot wraca do najbliższej stolicy innej cywilizacji. */
    slabychDokowDoOdwrotu: number;
    /** Runda 3: zasięg grafu tankowania (pc); zasięg odcinka statku filtruje go per statek i masa. */
    maxOdcinekGrafuPc: number;
    /** Runda 3: najdalszy kontrakt rozwojowy, jakiego bot się podejmuje (pc po grafie tankowania do akademii). */
    maxDystansKontraktuPc: number;
    /** Runda 3: misja kontraktowa rusza, gdy gotówka ≥ mnożnik × (receptura po cenach bazowych + paliwo tam). */
    mnoznikGotowkiNaKontrakt: number;
    /** Runda 3: po tylu dobach bot porzuca misję kontraktową. */
    maxDobyMisji: number;
    /** Runda 3: nowy statek, gdy gotówka ≥ mnożnik × cena statku. */
    mnoznikGotowkiNaStatek: number;
    /** Runda 3: gdy wszystkie statki stoją bez planu, flota czeka tyle dób i próbuje ponownie. */
    dobyCzekaniaFloty: number;
    /** Runda 3: po tylu dobach czekania bez planu flota utknęła. */
    maxDobyCzekaniaFloty: number;
    /** Flota: o ile (ułamek oceny) gorszy jest cel, do którego leci już inny statek firmy (podział floty między trasy przy remisie). */
    karaWspolnegoCelu: number;
    /** Runda 3: ile planów (wg stopy pierwszego kroku) dostaje ocenę dwóch kroków; na skali L pętla handlowa bywa poza pierwszą piątką. */
    planowDoDrugiegoKrokuRunda3: number;
    /** Runda 3: ekspedycja (pusty lot do nieznanej cywilizacji) tylko, gdy przy obecnej masie trwa nie dłużej niż tyle dób. */
    maxDobyEkspedycji: number;
    /** Runda 3: misja kontraktowa tylko, gdy droga po recepturę i do akademii trwa nie dłużej niż tyle dób. */
    maxDobyDrogiMisji: number;
    /** Runda 3: zapas zasięgu (ułamek najdłuższego odcinka drogi do akademii), jaki musi zostać po załadunku receptury (wariant R: masa skraca zasięg). */
    rezerwaZasieguMisji: number;
    /** Runda 3: etap misji, którego plan traci więcej niż ten ułamek wartości firmy, kończy misję (zamiast spalić kasę na jednym locie). */
    maxStrataMisjiUlamek: number;
  };
}

export const K: Kanon = kanonJson as unknown as Kanon;
export const P: Prototyp = prototypJson as unknown as Prototyp;

export function kr(wu: number): number {
  return wu * K.kurs;
}

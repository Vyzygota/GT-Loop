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

export interface Prototyp {
  skala: Skala;
  informacja: TrybInformacji;
  spread: WariantSpreadu;
  wariantySpreadu: Record<WariantSpreadu, KonfiguracjaSpreadu>;
  pamiecZakupuSkokow: number;
  progresja: KonfiguracjaProgresji;
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
    /** Progresja: największa strata gotówki (ułamek kasy) na kurs, przy której premia awansu jeszcze się liczy. */
    maxStrataNaKoszykUlamek: number;
    /** Progresja: tolerowany koszt dnia (kr/dobę) zatrudnienia załoganta dla XP. */
    maxKosztDobyXpKr: number;
    /** Progresja: co ile dób (od ostatniego kontaktu) bot rusza na ekspedycję do najbliższej nieznanej cywilizacji. */
    dobyMiedzyEkspedycjami: number;
    /** Progresja: ekspedycja rusza, gdy gotówka z ładunkiem ≥ mnożnik × szacowany koszt paliwa i płac. */
    mnoznikGotowkiNaEkspedycje: number;
  };
}

export const K: Kanon = kanonJson as unknown as Kanon;
export const P: Prototyp = prototypJson as unknown as Prototyp;

export function kr(wu: number): number {
  return wu * K.kurs;
}

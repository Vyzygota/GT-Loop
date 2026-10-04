import kanonJson from './kanon.json';
import prototypJson from './prototyp.json';
import type { Rola, Skala, TowarLubPaliwo, TrybInformacji, WariantSpreadu } from './typy';

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
  opis?: string;
}

export interface Prototyp {
  skala: Skala;
  informacja: TrybInformacji;
  spread: WariantSpreadu;
  wariantySpreadu: Record<WariantSpreadu, KonfiguracjaSpreadu>;
  pamiecZakupuSkokow: number;
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
  };
}

export const K: Kanon = kanonJson as unknown as Kanon;
export const P: Prototyp = prototypJson as unknown as Prototyp;

export function kr(wu: number): number {
  return wu * K.kurs;
}

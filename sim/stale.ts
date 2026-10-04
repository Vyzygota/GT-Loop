import kanonJson from './kanon.json';
import prototypJson from './prototyp.json';
import type { Rola, TowarLubPaliwo } from './typy';

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
  planety: PlanetaProfil[];
  potrzebyM3NaMlnNaDobe: Record<TowarLubPaliwo, number>;
  produkcjaM3NaMlnNaDobe: Record<TowarLubPaliwo, number>;
}

export interface Prototyp {
  dobyGry: number;
  celMnoznikWartosci: number;
  nawigatorMaxRedukcjaPaliwa: number;
  synergiaRedukcjaPaliwa: number;
  handlowiecMaxUdzialPolspreadu: number;
  liczbaKandydatow: number;
  umiejetnoscMiejscaDziesietne: number;
  maxZapasWNormach: number;
  dobyRozruchuRynku: number;
  zapasStartowyUlamekNormy: number;
  zapasStartowyJitter: number;
  kontaktZapasElektronikiUlamekNormy: number;
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
  nazwyTowarow: Record<TowarLubPaliwo, string>;
  nazwyRol: Record<Rola, string>;
  imiona: string[];
  nazwiska: string[];
  ui: { lotMinSek: number; lotMaxSek: number; lotSekNaDobe: number; skrotTestowy: number; progBilansu: number };
  bot: {
    liczbaZiaren: number;
    pierwszeZiarno: number;
    maxSkokowTrasy: number;
    minZyskNettoKr: number;
    tankujGdyCenaPonizejBazyRazy: number;
    eksplorujDoDoby: number;
    eksplorujMaxSkokow: number;
    topN: number;
    krokiIlosci: number;
  };
}

export const K: Kanon = kanonJson as unknown as Kanon;
export const P: Prototyp = prototypJson as unknown as Prototyp;

export function kr(wu: number): number {
  return wu * K.kurs;
}

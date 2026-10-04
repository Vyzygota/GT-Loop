export type Towar = 'Food' | 'Minerals' | 'Solvents' | 'Explosives' | 'Electronics';
export type TowarLubPaliwo = Towar | 'Fuel';
export type Rola = 'pilot' | 'nawigator' | 'handlowiec';
export type TypWezla = 'planeta' | 'tankowanie';

export const TOWARY: Towar[] = ['Food', 'Minerals', 'Solvents', 'Explosives', 'Electronics'];
export const TOWARY_I_PALIWO: TowarLubPaliwo[] = [...TOWARY, 'Fuel'];
export const ROLE: Rola[] = ['pilot', 'nawigator', 'handlowiec'];

export interface Wezel {
  id: string;
  nazwa: string;
  typ: TypWezla;
  x: number;
  y: number;
  cywilizacja?: string;
  populacjaMln?: number;
}

export interface Krawedz {
  a: string;
  b: string;
  dystans: number;
}

export interface ProfilCywilizacji {
  id: string;
  nazwa: string;
  znanaNaStarcie: boolean;
  populacjaMln: number;
  planety: string[];
  potrzebyM3NaDobe: Record<TowarLubPaliwo, number>;
  produkcjaM3NaDobe: Record<TowarLubPaliwo, number>;
}

export interface Swiat {
  ziarno: string;
  wezly: Wezel[];
  krawedzie: Krawedz[];
  cywilizacje: ProfilCywilizacji[];
  startId: string;
}

/** Rynek jednego towaru na jednej planecie. Wszystko w m³ i m³/dobę. */
export interface PozycjaRynku {
  zapas: number;
  norma: number;
  produkcja: number;
  konsumpcja: number;
  /** Konsumpcja uśpiona do kontaktu (Elektronika u nieznanej cywilizacji). */
  konsumpcjaUspiona: number;
}

export type Rynek = Record<TowarLubPaliwo, PozycjaRynku>;

export interface Zalogant {
  id: string;
  imie: string;
  rola: Rola;
  cywilizacja: string;
  umiejetnosc: number;
  placa: number;
}

export interface PozycjaLadowni {
  m3: number;
  kosztKr: number;
}

export interface Transakcja {
  rodzaj: 'kupno' | 'sprzedaz';
  planeta: string;
  towar: Towar;
  m3: number;
  kwotaKr: number;
  kwotaBezHandlowcaKr: number;
  cenaJednPrzedKr: number;
  cenaJednPoKr: number;
  naciskPrzed: number;
  naciskPo: number;
  kosztZakupuKr?: number;
}

export interface LiniaRaportu {
  klucz: string;
  etykieta: string;
  kr: number;
  opis?: string;
}

export interface WynikHandlowy {
  towar: Towar;
  m3: number;
  przychodKr: number;
  kosztZakupuKr: number;
  zyskKr: number;
}

export interface Raport {
  numerLotu: number;
  z: string;
  do: string;
  trasa: string[];
  dystansPc: number;
  doby: number;
  dobyNominalne: number;
  dobaStart: number;
  dobaKoniec: number;
  linie: LiniaRaportu[];
  zmianaSalda: number;
  saldoPrzed: number;
  saldoPo: number;
  wartoscPrzed: number;
  wartoscPo: number;
  transakcje: Transakcja[];
  wynikHandlowy: WynikHandlowy[];
  paliwo: {
    kupionoM3: number;
    kosztZakupuKr: number;
    zuzytoM3: number;
    bezZalogiM3: number;
    oszczednoscNawigatoraM3: number;
    oszczednoscSynergiiM3: number;
    cenaOdniesieniaKr: number;
    wBakuPo: number;
  };
  zaloga: {
    placeNaDobe: number;
    predkosc: number;
    mnoznikPaliwa: number;
    udzialHandlowca: number;
    synergia: boolean;
    sklad: Zalogant[];
  };
  kontakt?: { cywilizacja: string; nazwa: string; opis: string };
  koniecGry: boolean;
}

export interface EfektyZalogi {
  predkosc: number;
  mnoznikPilota: number;
  mnoznikNawigatora: number;
  mnoznikSynergii: number;
  mnoznikPaliwa: number;
  udzialHandlowca: number;
  synergia: boolean;
  placeNaDobe: number;
  najlepszy: Partial<Record<Rola, Zalogant>>;
}

export interface Ceny {
  kupnoKr: number;
  sprzedazKr: number;
  bazowaKr: number;
  nacisk: number;
  zapasM3: number;
  normaM3: number;
  zapasDoby: number;
  bilansNaDobe: number;
}

export interface Wycena {
  m3: number;
  kwotaKr: number;
  cenaSredniaKr: number;
  cenaJednPrzedKr: number;
  cenaJednPoKr: number;
  naciskPrzed: number;
  naciskPo: number;
  kwotaBezHandlowcaKr: number;
}

export interface Osiagalny {
  id: string;
  dystans: number;
  paliwo: number;
  sciezka: string[];
}

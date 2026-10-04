export type Towar = 'Food' | 'Minerals' | 'Solvents' | 'Explosives' | 'Electronics';
export type TowarLubPaliwo = Towar | 'Fuel';
export type Rola = 'pilot' | 'nawigator' | 'handlowiec';
export type TypWezla = 'planeta' | 'tankowanie' | 'przelot';
export type Skala = 'S' | 'M' | 'L';
export type TrybInformacji = 'pelna' | 'zasieg';
export type WariantSpreadu = 'A' | 'B' | 'C' | 'D' | 'E';

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
  sektor?: number;
  /** Czy to układ zamieszkiwalny (planeta z rynkiem albo plemiona z paliwem). */
  zamieszkiwalny: boolean;
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
  /** Sufit dobowej wymiany NPC jako ułamek dziennego PKB; 0 = brak wymiany NPC (świat S). */
  otwartosc: number;
  /** Samowystarczalność żywnościowa: produkcja / potrzeby. */
  ssr: number;
  kolor: string;
  sektor?: number;
  stolica: string;
}

export interface Swiat {
  ziarno: string;
  skala: Skala;
  wezly: Wezel[];
  krawedzie: Krawedz[];
  cywilizacje: ProfilCywilizacji[];
  startId: string;
  /** Geometria kanonu do rysowania granic (brak dla S). */
  geometria?: { promien: number; rdzen: number; strefaOd: number; strefaDo: number; sektory: number[]; liczbaSektorow: number };
}

/** Rynek jednego towaru na jednej planecie. Wszystko w m³ i m³/dobę. */
export interface PozycjaRynku {
  zapas: number;
  norma: number;
  produkcja: number;
  konsumpcja: number;
  /** Konsumpcja uśpiona do kontaktu (Elektronika u nieznanej cywilizacji). */
  konsumpcjaUspiona: number;
  /** Otwartość handlowa cywilizacji: sufit dobowej wymiany NPC = otwartość × konsumpcja × mnożnik. */
  otwartosc: number;
}

/** Co gracz wie o rynku planety: na żywo, ostatni odczyt (z wiekiem w dobach) albo nic. */
export interface InformacjaORynku {
  tryb: 'zywa' | 'odczyt';
  rynek: Rynek;
  wiekDob: number;
}

export type Rynek = Record<TowarLubPaliwo, PozycjaRynku>;

export interface Zalogant {
  id: string;
  imie: string;
  rola: Rola;
  cywilizacja: string;
  umiejetnosc: number;
  placa: number;
  /** Progresja: doświadczenie (XP) i talent ∈ [0,1]; tier wynika z progów kanonu, umiejętność i płaca z tieru i talentu. */
  xp?: number;
  talent?: number;
}

export interface PozycjaLadowni {
  m3: number;
  kosztKr: number;
  /** Pochodzenie: cywilizacja zakupu → m³ (dostawa koszyka awansu liczy tylko towar kupiony gdzie indziej). */
  pochodzenie: Record<string, number>;
}

export interface Transakcja {
  rodzaj: 'kupno' | 'sprzedaz';
  planeta: string;
  towar: Towar;
  m3: number;
  kwotaKr: number;
  kwotaBezHandlowcaKr: number;
  /** Kwota bez handlowca i bez kary za odsprzedaż w miejscu zakupu. */
  kwotaBezKaryKr: number;
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
  /** Progresja: awanse tierów cywilizacji w tym okresie i kupiony szczebel kadłuba. */
  awanse?: { cywilizacja: string; nazwa: string; tier: number }[];
  kadlub?: { szczebel: number; kwotaKr: number };
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
  informacja: 'zywa' | 'odczyt';
  wiekDob: number;
  /** Kara za odsprzedaż w miejscu zakupu (ułamek ceny) i licznik skoków pamięci. */
  kara: number;
  licznikPamieci: number;
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
  kwotaBezKaryKr: number;
  kara: number;
}

export interface Osiagalny {
  id: string;
  dystans: number;
  paliwo: number;
  sciezka: string[];
}

export interface OpcjeGry {
  skala?: Skala;
  informacja?: TrybInformacji;
  spread?: WariantSpreadu;
  /** Progresja (tiery cywilizacji, drabina kadłubów, XP załogi); domyślnie z prototypu. */
  progresja?: boolean;
  /** Horyzont dób (domyślnie ze skali, a w progresji z `progresja.horyzontDob`). */
  limitDob?: number;
}

/** Postęp awansu cywilizacji na kolejny tier. */
export interface PostepAwansu {
  tier: number;
  nastepny: number | null;
  /** Dzienny PKB portów cywilizacji (konsumpcja × cena bazowa, WU/dobę). */
  pkbWU: number;
  /** Próg wartości koszyka (WU) i potrzebne/dostarczone per towar. */
  progWU: number;
  towary: { towar: Towar; potrzebneWU: number; dostarczoneWU: number }[];
  /** Najmniejszy z udziałów dostarczone/potrzebne (1 = koszyk pełny). */
  udzial: number;
}

/** Wycena kolejnego szczebla kadłuba w stoczni. */
export interface WycenaSzczebla {
  nastepny: number;
  kwotaKr: number | null;
  kursow: number;
  medianaZyskuKr: number | null;
  ladowniaM3: number;
  bakM3: number;
  powod?: string;
}

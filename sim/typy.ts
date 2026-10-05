export type Towar = 'Food' | 'Minerals' | 'Solvents' | 'Explosives' | 'Electronics';
export type TowarLubPaliwo = Towar | 'Fuel';
export type Rola = 'pilot' | 'nawigator' | 'handlowiec';
export type TypWezla = 'planeta' | 'tankowanie' | 'przelot';
export type Skala = 'S' | 'M' | 'L';
export type TrybInformacji = 'pelna' | 'zasieg';
export type WariantSpreadu = 'A' | 'B' | 'C' | 'D' | 'E';
export type WariantPaliwa = 'R' | 'D';
export type BramkaTowaru = 'G' | 'P';
export type PamiecFloty = 'A' | 'B' | 'C';

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
  /** Runda 3: czy towar w ogóle jest na tym rynku (bramka G: towar wyższego tieru nie istnieje poniżej tego tieru). */
  dostepny?: boolean;
  /** Runda 3: mnożnik specjalizacji planety × normalizacja (produkcja = konsumpcja × stosunek × ten mnożnik), do otwierania sektorów. */
  mnoznikSpecjalizacji?: number;
}

/** Runda 3: kontrakt rozwojowy wystawiony przez cywilizację po osiągnięciu gotowości. */
export interface Kontrakt {
  /** Tier docelowy. */
  tier: number;
  /** Receptura: towar → m³ do dostarczenia; towary sektorów otwartych na bieżącym tierze mogą pochodzić skądkolwiek. */
  towary: Partial<Record<Towar, number>>;
  /** Część receptury, która musi pochodzić od sąsiedniej cywilizacji (towar tieru docelowego, który sąsiad już produkuje). */
  odSasiada: Partial<Record<Towar, number>>;
  /** Ile m³ każdego towaru już dostarczono do akademii (dostawy częściowe, kilka kursów lub statków). */
  dostarczone: Partial<Record<Towar, number>>;
  /** Czy naukowiec już dotarł do akademii. */
  naukowiecWAkademii: boolean;
  otwartyDoba: number;
}

/** Runda 3: stan rozwoju cywilizacji (drabina kanonu). */
export interface RozwojCywilizacji {
  /** Z₀_start = Σ populacja × zamożność × PkbToWaterUnits (WU), zamrożone w dobie 0. */
  z0WU: number;
  /** Skumulowana nadwyżka (WU) od ostatniego awansu. */
  nadwyzkaWU: number;
  kontrakt: Kontrakt | null;
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
  /** Runda 3: który statek wykonał lot i prędkości na starcie/mecie. */
  statek?: number;
  predkoscStart?: number;
  predkoscMeta?: number;
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
  /** Runda 3: lot z hierarchii ciągu, rynek z ludności, drabina rozwoju kanonu, flota; domyślnie z prototypu (wymusza progresję). */
  runda3?: boolean;
  paliwo?: WariantPaliwa;
  bramkaTowaru?: BramkaTowaru;
  pamiecFloty?: PamiecFloty;
}

/** Jeden statek firmy. Dotychczasowe pola stanu (pozycja, paliwo, ładownia, załoga…) są widokiem na statek aktywny. */
export interface Statek {
  id: number;
  nazwa: string;
  pozycja: string;
  paliwo: number;
  ladownia: Record<Towar, PozycjaLadowni>;
  zaloga: Zalogant[];
  kandydaci: Zalogant[];
  /** Pamięć zakupu statku (poza rundą 3): klucz „planeta|towar” → licznik skoków. */
  pamiecZakupu: Record<string, number>;
  szczebel: number;
  /** Runda 3: zamontowane moduły (reaktory, ładownie); poza rundą 3 nieużywane. */
  moduly: { reaktory: number; ladownie: number };
  numerLotu: number;
  /** Łączna liczba wykonanych skoków (pamięć zakupu floty A/B). */
  skoki: number;
  kursStart: { wartosc: number; szczebel: number; kadlubKr: number };
  /** Runda 3: naukowiec na pokładzie (kontrakt rozwojowy cywilizacji), zajmuje naukowiecM3. */
  naukowiec: { cywilizacja: string; zPlanety: string } | null;
  /** Lot w toku (czas ciągły): trasa i doba przylotu; null w doku. */
  wLocie: LotWToku | null;
}

export interface LotWToku {
  trasa: string[];
  dystans: number;
  dobaStart: number;
  przylot: number;
  doby: number;
  dobyNominalne: number;
  paliwoZuzyteM3: number;
  bezZalogiM3: number;
  poNawigatorzeM3: number;
  /** Paliwo bez pilota (z nawigatorem i synergią) przy załodze z chwili startu. */
  bezPilotaM3: number;
  placeKr: number;
  placeNominalneKr: number;
  cenaOdniesieniaKr: number;
  /** Prędkość na starcie i na mecie (runda 3: statek przyspiesza w miarę spalania). */
  predkoscStart: number;
  predkoscMeta: number;
}

/** Wpis pamięci zakupu floty (runda 3): doba i liczniki skoków wszystkich statków w chwili zakupu. */
export interface WpisPamieciFloty {
  doba: number;
  statek: number;
  skokiStatkow: Record<number, number>;
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

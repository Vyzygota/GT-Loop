import { Losowosc } from './losowosc';
import {
  cenaBazowaWU,
  kwotaKupnaWU,
  kwotaPaliwaWU,
  kwotaSprzedazyWU,
  krokRynku,
  mnoznikKupna,
  mnoznikSprzedazy,
  nacisk,
  zapasPo,
} from './rynek';
import { K, P, kr } from './stale';
import { bakSzczeblaM3, ciagTf, konfiguracjaSzczebla, ladowniaM3, lot, masaSuchaT, obsada, zasiegNaPaliwie } from './lot';
import { generujSwiat, konsumpcjaZLudnosci, minTierTowaru } from './swiat';
import { Graf, odleglosc } from './trasa';
import { aktualizujZaloganta, efektyZalogi, generujKandydatow, tierZalogi } from './zaloga';
import {
  TOWARY,
  TOWARY_I_PALIWO,
  type BramkaTowaru,
  type Ceny,
  type EfektyZalogi,
  type InformacjaORynku,
  type Kontrakt,
  type LiniaRaportu,
  type OpcjeGry,
  type Osiagalny,
  type PamiecFloty,
  type PostepAwansu,
  type PozycjaLadowni,
  type Raport,
  type RozwojCywilizacji,
  type Rynek,
  type Skala,
  type Statek,
  type Swiat,
  type Towar,
  type Transakcja,
  type TrybInformacji,
  type WariantPaliwa,
  type WariantSpreadu,
  type Wezel,
  type WpisPamieciFloty,
  type Wycena,
  type WycenaSzczebla,
  type WynikHandlowy,
  type Zalogant,
} from './typy';

const EPS = 1e-9;

export interface Odczyt {
  doba: number;
  rynek: Rynek;
}

export interface Stan {
  doba: number;
  kr: number;
  /** Flota firmy; `aktywny` to statek, na który patrzą pola pozycja/paliwo/ładownia/załoga/kandydaci/pamięć/szczebel/numerLotu/kursStart. */
  statki: Statek[];
  aktywny: number;
  paliwo: number;
  pozycja: string;
  ladownia: Record<Towar, PozycjaLadowni>;
  zaloga: Zalogant[];
  kandydaci: Zalogant[];
  rynki: Record<string, Rynek>;
  znaneCywilizacje: Record<string, boolean>;
  wizyty: Record<string, number>;
  /** Ostatnie odczyty rynków odwiedzonych planet (tryb informacji `zasieg`). */
  odczyty: Record<string, Odczyt>;
  /** Pamięć zakupu: klucz „planeta|towar” → licznik skoków (bez ceny kupna). */
  pamiecZakupu: Record<string, number>;
  numerLotu: number;
  koniec: boolean;
  raporty: Raport[];
  // ---- Progresja (bez progresji pola stoją: tier 1, szczebel 0, puste liczniki) ----
  /** Tier każdej cywilizacji (1…TierCount); podnosi go tylko gracz dostawą koszyka. */
  tiery: Record<string, number>;
  /** Dostawy koszyka kolejnego tieru per cywilizacja: towar → wartość po cenie bazowej (WU). */
  dostawy: Record<string, Partial<Record<Towar, number>>>;
  /** Szczebel drabiny kadłubów (0…szczebli−1). */
  szczebel: number;
  /** Zyski na kurs (kr) zmierzone na każdym szczeblu; kurs = loty między kolejnymi dokami ze sprzedażą. */
  zyskiKursow: Record<number, number[]>;
  /** Bieżący kurs: wartość firmy przy przylocie do ostatniego doku ze sprzedażą, szczebel i wydatki na kadłub od tej chwili. */
  kursStart: { wartosc: number; szczebel: number; kadlubKr: number };
  wydanoNaKadlub: number;
  /** Kamienie milowe: klucz → doba pierwszego osiągnięcia. */
  kamienie: Record<string, number>;
  // ---- Runda 3 ----
  /** Pamięć zakupu floty: klucz „planeta|towar” → doba zakupu i liczniki skoków statków w chwili zakupu. */
  pamiecFloty: Record<string, WpisPamieciFloty>;
  /** Poziom firmy (1…4) → liczba statków 1/2/4/8. */
  poziomFirmy: number;
  /** Okna stoczni (kupno kadłuba, zmiana modułów, nowy statek): doba i liczba statków w tej chwili. */
  oknaStoczni: { doba: number; statkow: number; rodzaj: string }[];
  /** Runda 3: rozwój cywilizacji (drabina kanonu): Z₀, skumulowana nadwyżka, kontrakt. */
  rozwoj: Record<string, RozwojCywilizacji>;
  /** Runda 3: PkbToWaterUnits wykalibrowane w dobie 0 (założenie: średnia cywilizacja osiąga gotowość T2 po dobyGotowosciT2 × k dobach). */
  pkbToWaterUnits: number;
}

interface Okres {
  transakcje: Transakcja[];
  paliwoKupioneM3: number;
  paliwoKosztKr: number;
  saldoNaStarcie: number;
  wartoscNaStarcie: number;
  /** Przepływy gotówki tego statku w okresie (przy flocie inne statki też ruszają kasę). */
  deltaKr: number;
  kadlub: { szczebel: number; kwotaKr: number } | null;
  /** Runda 3: statek kupiony w tym okresie przez statek aktywny (okno stoczni). */
  nowyStatek: { id: number; kwotaKr: number } | null;
  awanse: { cywilizacja: string; nazwa: string; tier: number }[];
}

const POLA_STATKU = ['pozycja', 'paliwo', 'ladownia', 'zaloga', 'kandydaci', 'pamiecZakupu', 'szczebel', 'numerLotu', 'kursStart'] as const;

function zaokr(x: number): number {
  return Math.round(x);
}

function mediana(xs: readonly number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const i = Math.floor(s.length / 2);
  return s.length % 2 ? s[i] : (s[i - 1] + s[i]) / 2;
}

function kopiaRynku(r: Rynek): Rynek {
  const k = {} as Rynek;
  for (const t of TOWARY_I_PALIWO) k[t] = { ...r[t] };
  return k;
}

/** Gra: czysta symulacja bez DOM. UI i bot wywołują wyłącznie jej metody. */
export class Gra {
  readonly swiat: Swiat;
  readonly graf: Graf;
  readonly stan: Stan;
  readonly skala: Skala;
  readonly informacja: TrybInformacji;
  readonly limitDob: number;
  readonly wariantSpreadu: WariantSpreadu;
  /** Spread podstawowy wariantu: A = tradeSpread na każdej transakcji, B/D/E = 0, C = 0,10. */
  readonly spreadPodstawowy: number;
  /** Czy nacisk jest obcinany do [StockPressureMin, StockPressureMax] (wariant E: nie). */
  readonly obciecieNacisku: boolean;
  /** Progresja: tiery cywilizacji, drabina kadłubów, XP załogi. */
  readonly progresja: boolean;
  /** Runda 3: lot z hierarchii ciągu, rynek z ludności, drabina rozwoju kanonu, flota. */
  readonly runda3: boolean;
  readonly wariantPaliwa: WariantPaliwa;
  readonly bramkaTowaru: BramkaTowaru;
  readonly wariantPamieciFloty: PamiecFloty;
  /** Okres doku każdego statku (indeks = id statku). */
  private okresy: Okres[] = [];
  /** Ostatni raport każdego statku (po przylocie). */
  private ostatnieRaporty: (Raport | null)[] = [];
  private readonly rng: Losowosc;

  private get okres(): Okres {
    return this.okresy[this.stan.aktywny];
  }

  private set okres(o: Okres) {
    this.okresy[this.stan.aktywny] = o;
  }

  constructor(ziarno: string, opcje: OpcjeGry = {}) {
    this.skala = opcje.skala ?? P.skala;
    this.informacja = opcje.informacja ?? P.informacja;
    this.runda3 = opcje.runda3 ?? P.runda3.wlaczona;
    this.wariantPaliwa = opcje.paliwo ?? P.runda3.paliwo;
    this.bramkaTowaru = opcje.bramkaTowaru ?? P.runda3.bramkaTowaru;
    this.wariantPamieciFloty = opcje.pamiecFloty ?? P.runda3.pamiecFloty;
    this.progresja = this.runda3 || (opcje.progresja ?? P.progresja.wlaczona);
    this.limitDob = opcje.limitDob ?? (this.progresja ? P.progresja.horyzontDob : P.skale[this.skala].limitDob);
    this.wariantSpreadu = opcje.spread ?? P.spread;
    const konfig = P.wariantySpreadu[this.wariantSpreadu];
    this.spreadPodstawowy = konfig.tryb === 'staly' ? K.tradeSpread : (konfig.spreadPodstawowy ?? 0);
    this.obciecieNacisku = !konfig.bezObcieciaNacisku;
    const { swiat, rynki } = generujSwiat(ziarno, this.skala, { runda3: this.runda3, bramka: this.bramkaTowaru });
    this.swiat = swiat;
    this.graf = new Graf(swiat.wezly, swiat.krawedzie);
    this.rng = new Losowosc(ziarno);
    const znane: Record<string, boolean> = {};
    const tiery: Record<string, number> = {};
    const dostawy: Record<string, Partial<Record<Towar, number>>> = {};
    for (const c of swiat.cywilizacje) {
      znane[c.id] = c.znanaNaStarcie;
      tiery[c.id] = 1;
      dostawy[c.id] = {};
    }
    const stan: Partial<Stan> = {
      doba: 0,
      kr: K.startingCredits,
      statki: [],
      aktywny: 0,
      rynki,
      znaneCywilizacje: znane,
      wizyty: {},
      odczyty: {},
      koniec: false,
      raporty: [],
      tiery,
      dostawy,
      zyskiKursow: { 0: [] },
      wydanoNaKadlub: 0,
      kamienie: {},
      pamiecFloty: {},
      poziomFirmy: 1,
      oknaStoczni: [],
      rozwoj: {},
      pkbToWaterUnits: 0,
    };
    // Pola statku aktywnego jako widok: UI, bot i testy czytają `stan.pozycja` itd. jak dotąd.
    for (const pole of POLA_STATKU) {
      Object.defineProperty(stan, pole, {
        enumerable: true,
        get: () => (this.stan.statki[this.stan.aktywny] as unknown as Record<string, unknown>)[pole],
        set: (v: unknown) => {
          (this.stan.statki[this.stan.aktywny] as unknown as Record<string, unknown>)[pole] = v;
        },
      });
    }
    this.stan = stan as Stan;
    this.dodajStatek(swiat.startId);
    if (this.runda3) this.zainicjujRozwoj();
    this.zadokuj();
  }

  // ---------- Runda 3: drabina rozwoju kanonu ----------

  /** Kalibracja PkbToWaterUnits i Z₀ każdej cywilizacji w dobie 0. */
  private zainicjujRozwoj(): void {
    const A = P.runda3.awans;
    let sumaNadwyzki = 0;
    let sumaLudnosci = 0;
    for (const c of this.swiat.cywilizacje) {
      sumaNadwyzki += this.nadwyzkaDobowaWU(c.id);
      sumaLudnosci += this.ludnoscZamoznoscCyw(c.id);
    }
    // Z₀ średniej cywilizacji = dobyGotowosciT2 × jej dobowa nadwyżka ⇒ PkbToWaterUnits = dobyGotowosciT2 × Σ nadwyżek / Σ (populacja × zamożność).
    this.stan.pkbToWaterUnits = sumaLudnosci > 0 ? (A.dobyGotowosciT2 * sumaNadwyzki) / sumaLudnosci : 0;
    for (const c of this.swiat.cywilizacje) {
      this.stan.rozwoj[c.id] = { z0WU: this.ludnoscZamoznoscCyw(c.id) * this.stan.pkbToWaterUnits, nadwyzkaWU: 0, kontrakt: null };
    }
  }

  private ludnoscZamoznoscCyw(idCyw: string): number {
    const cyw = this.cywilizacja(idCyw)!;
    const zamoznosc = P.runda3.awans.zamoznosc[idCyw] ?? 1;
    return cyw.planety.reduce((s, id) => s + (this.wezel(id).populacjaMln ?? 0), 0) * zamoznosc;
  }

  /** Dobowa nadwyżka cywilizacji (WU/dobę): Σ po planetach i towarach (produkcja − konsumpcja)⁺ × cena bazowa. */
  nadwyzkaDobowaWU(idCyw: string): number {
    const cyw = this.cywilizacja(idCyw);
    if (!cyw) return 0;
    let suma = 0;
    for (const id of cyw.planety) {
      for (const t of TOWARY_I_PALIWO) {
        const poz = this.stan.rynki[id][t];
        suma += Math.max(0, poz.produkcja - poz.konsumpcja - poz.konsumpcjaUspiona) * K.towary[t].basePrice;
      }
    }
    return suma;
  }

  /** Próg gotowości na tier T: Z₀ × k^(T−1). */
  progGotowosciWU(idCyw: string, tier: number): number {
    return this.stan.rozwoj[idCyw].z0WU * Math.pow(P.runda3.awans.k, tier - 1);
  }

  rozwoj(idCyw: string): RozwojCywilizacji {
    return this.stan.rozwoj[idCyw];
  }

  /** Sąsiedzi cywilizacji: ta sama galaktyczna strefa sektora albo sektory przyległe (mod liczba sektorów). */
  sasiednieCywilizacje(idCyw: string): string[] {
    const cyw = this.cywilizacja(idCyw)!;
    const n = this.swiat.geometria?.liczbaSektorow ?? K.SectorCount;
    return this.swiat.cywilizacje
      .filter((c) => c.id !== idCyw && c.sektor !== undefined && cyw.sektor !== undefined && (c.sektor === cyw.sektor || (c.sektor - cyw.sektor + n) % n === 1 || (cyw.sektor - c.sektor + n) % n === 1))
      .map((c) => c.id);
  }

  /**
   * Receptura kontraktu na tier T: towary sektorów otwartych na bieżącym tierze (bez paliwa) plus towary, które otwiera tier T,
   * jeśli jakaś sąsiednia cywilizacja już je produkuje; ilość = ilosciKontraktu × dzienna konsumpcja stolicy przy koszyku tieru T.
   */
  recepturaKontraktu(idCyw: string, tier: number): Partial<Record<Towar, number>> {
    const cyw = this.cywilizacja(idCyw)!;
    const obecny = this.tierCywilizacji(idCyw);
    const sasiedziZTierem = this.sasiednieCywilizacje(idCyw).some((s) => this.tierCywilizacji(s) >= tier);
    const towary: Partial<Record<Towar, number>> = {};
    const pop = this.wezel(cyw.stolica).populacjaMln ?? 0;
    for (const t of TOWARY) {
      const min = minTierTowaru(t);
      const wRecepturze = min <= obecny || (min === tier && sasiedziZTierem);
      if (!wRecepturze) continue;
      towary[t] = Math.max(1, Math.ceil(P.runda3.awans.ilosciKontraktu * konsumpcjaZLudnosci(idCyw, pop, t, tier)));
    }
    return towary;
  }

  /** Upływ czasu w rundzie 3: skumulowana nadwyżka cywilizacji, po przekroczeniu progu kontrakt rozwojowy. */
  private poUplywieCzasu(dt: number): void {
    if (!this.runda3) return;
    for (const c of this.swiat.cywilizacje) {
      const r = this.stan.rozwoj[c.id];
      const tier = this.tierCywilizacji(c.id);
      if (tier >= K.TierCount) continue;
      r.nadwyzkaWU += this.nadwyzkaDobowaWU(c.id) * dt;
      if (!r.kontrakt && r.nadwyzkaWU >= this.progGotowosciWU(c.id, tier + 1)) {
        r.kontrakt = { tier: tier + 1, towary: this.recepturaKontraktu(c.id, tier + 1), otwartyDoba: this.stan.doba };
        this.kamien(`gotowosc:${c.id}:T${tier + 1}`);
      }
    }
  }

  /** Czy w tym doku można zabrać naukowca dla cywilizacji `idCyw` (planeta tej lub sąsiedniej cywilizacji, nie akademia). */
  naukowiecDostepny(idCyw: string, idWezla: string = this.stan.pozycja): boolean {
    if (!this.runda3) return false;
    const w = this.wezel(idWezla);
    if (w.typ !== 'planeta' || !w.cywilizacja || !this.cywilizacjaZnana(idCyw)) return false;
    const cyw = this.cywilizacja(idCyw)!;
    if (P.runda3.awans.naukowiecZInnejPlanety && idWezla === cyw.stolica) return false;
    return w.cywilizacja === idCyw || this.sasiednieCywilizacje(idCyw).includes(w.cywilizacja);
  }

  /** Zabiera naukowca (pasażer, naukowiecM3 ładowni) dla kontraktu cywilizacji `idCyw`. */
  zabierzNaukowca(idCyw: string): void {
    if (!this.naukowiecDostepny(idCyw)) throw new Error('Naukowca dla tej cywilizacji zabierzesz z planety tej albo sąsiedniej cywilizacji (nie z akademii)');
    const s = this.statek();
    if (s.naukowiec) throw new Error('Naukowiec już jest na pokładzie');
    if (this.objetoscZajeta() + P.runda3.statek.naukowiecM3 > this.ladownia() + EPS) throw new Error(`Naukowiec potrzebuje ${P.runda3.statek.naukowiecM3} m³ ładowni`);
    s.naukowiec = { cywilizacja: idCyw, zPlanety: this.stan.pozycja };
  }

  wysadzNaukowca(): void {
    this.statek().naukowiec = null;
  }

  /** Ile m³ towaru w ładowni statku aktywnego pochodzi spoza cywilizacji `idCyw`. */
  ladunekSpoza(towar: Towar, idCyw: string): number {
    const l = this.stan.ladownia[towar];
    let suma = 0;
    for (const c of Object.keys(l.pochodzenie)) if (c !== idCyw) suma += l.pochodzenie[c];
    return Math.min(suma, l.m3);
  }

  /** Czy kontrakt cywilizacji w tym doku da się dostarczyć (akademia = stolica, naukowiec, receptura kupiona gdzie indziej). */
  kontraktDoDostarczenia(idWezla: string = this.stan.pozycja): { cywilizacja: string; kontrakt: Kontrakt; brakuje: string[] } | null {
    if (!this.runda3) return null;
    const w = this.wezel(idWezla);
    if (w.typ !== 'planeta' || !w.cywilizacja) return null;
    const cyw = this.cywilizacja(w.cywilizacja)!;
    if (cyw.stolica !== idWezla || !this.cywilizacjaZnana(cyw.id)) return null;
    const kontrakt = this.stan.rozwoj[cyw.id].kontrakt;
    if (!kontrakt) return null;
    const brakuje: string[] = [];
    const s = this.statek();
    if (!s.naukowiec || s.naukowiec.cywilizacja !== cyw.id) brakuje.push('naukowiec');
    for (const t of Object.keys(kontrakt.towary) as Towar[]) {
      if (this.ladunekSpoza(t, cyw.id) + EPS < kontrakt.towary[t]!) brakuje.push(t);
    }
    return { cywilizacja: cyw.id, kontrakt, brakuje };
  }

  /** Dostawa kontraktu rozwojowego w akademii: zużywa recepturę i naukowca, cywilizacja awansuje o tier. */
  dostarczKontrakt(): { cywilizacja: string; tier: number } {
    const d = this.kontraktDoDostarczenia();
    if (!d) throw new Error('Tu nie ma otwartego kontraktu rozwojowego do dostarczenia');
    if (d.brakuje.length) throw new Error(`Do kontraktu brakuje: ${d.brakuje.join(', ')}`);
    for (const t of Object.keys(d.kontrakt.towary) as Towar[]) this.zuzyjLadunekSpoza(t, d.kontrakt.towary[t]!, d.cywilizacja);
    this.statek().naukowiec = null;
    this.awansujCywilizacje(d.cywilizacja, d.kontrakt.tier);
    return { cywilizacja: d.cywilizacja, tier: d.kontrakt.tier };
  }

  private zuzyjLadunekSpoza(towar: Towar, m3: number, idCyw: string): void {
    const l = this.stan.ladownia[towar];
    const koszt = zaokr((l.kosztKr * m3) / l.m3);
    let zostalo = m3;
    for (const c of Object.keys(l.pochodzenie)) {
      if (c === idCyw || zostalo <= EPS) continue;
      const bierz = Math.min(l.pochodzenie[c], zostalo);
      l.pochodzenie[c] -= bierz;
      zostalo -= bierz;
      if (l.pochodzenie[c] < EPS) delete l.pochodzenie[c];
    }
    l.m3 -= m3;
    l.kosztKr -= koszt;
    if (l.m3 < EPS) {
      l.m3 = 0;
      l.kosztKr = 0;
      l.pochodzenie = {};
    }
  }

  /** Awans cywilizacji (runda 3): koszyk popytu, otwarte sektory, zerowanie nadwyżki i kontraktu, kamienie. */
  private awansujCywilizacje(idCyw: string, tier: number): void {
    const cyw = this.cywilizacja(idCyw)!;
    const stary = this.tierCywilizacji(idCyw);
    const R = P.runda3.rynek;
    const koszykStary = R.koszykTieru[Math.min(stary, R.koszykTieru.length) - 1];
    const koszykNowy = R.koszykTieru[Math.min(tier, R.koszykTieru.length) - 1];
    for (const id of cyw.planety) {
      const pop = this.wezel(id).populacjaMln ?? 0;
      for (const t of TOWARY_I_PALIWO) {
        const poz = this.stan.rynki[id][t];
        const otwarty = minTierTowaru(t) <= tier;
        const bylOtwarty = minTierTowaru(t) <= stary;
        const stosunek = t === 'Food' ? K.cywilizacje[idCyw].ssr : (P.cywilizacjeKanonu[idCyw].produkcjaDoPotrzeb[t] ?? 1);
        if (!poz.dostepny) {
          // Bramka G: towar pojawia się na rynku dopiero, gdy tier otwiera jego sektor.
          if (!otwarty) continue;
          poz.dostepny = true;
          const uspiona = !this.stan.znaneCywilizacje[idCyw] && t === 'Electronics';
          const konsumpcja = konsumpcjaZLudnosci(idCyw, pop, t, tier);
          poz.konsumpcja = uspiona ? 0 : konsumpcja;
          poz.konsumpcjaUspiona = uspiona ? konsumpcja : 0;
          poz.norma = K.normaZapasu * konsumpcja;
          poz.zapas = poz.norma * P.galaktyka.zapasStartowyUlamekNormy;
        } else {
          const mnoznik = koszykNowy[t] / koszykStary[t];
          poz.konsumpcja *= mnoznik;
          poz.konsumpcjaUspiona *= mnoznik;
          poz.norma *= mnoznik;
        }
        const konsumpcjaPelna = poz.konsumpcja + poz.konsumpcjaUspiona;
        poz.produkcja = otwarty ? konsumpcjaPelna * stosunek * (poz.mnoznikSpecjalizacji ?? 1) : 0;
        if (otwarty && !bylOtwarty) this.kamien(`sektor:${idCyw}:${t}`);
      }
    }
    // Profil cywilizacji (panel, premie bota): sumy z rynków.
    for (const t of TOWARY_I_PALIWO) {
      cyw.potrzebyM3NaDobe[t] = cyw.planety.reduce((s, id) => s + this.stan.rynki[id][t].konsumpcja + this.stan.rynki[id][t].konsumpcjaUspiona, 0);
      cyw.produkcjaM3NaDobe[t] = cyw.planety.reduce((s, id) => s + this.stan.rynki[id][t].produkcja, 0);
    }
    this.stan.tiery[idCyw] = tier;
    this.stan.rozwoj[idCyw].nadwyzkaWU = 0;
    this.stan.rozwoj[idCyw].kontrakt = null;
    this.okres.awanse.push({ cywilizacja: idCyw, nazwa: cyw.nazwa, tier });
    this.kamien(`tier:${idCyw}:${tier}`);
    this.kamien(`cywilizacja:pierwsza:T${tier}`);
    this.sprawdzKamienieGalaktyki();
  }

  /** Kamienie osi galaktyki: połowa i wszystkie na T4 (definicja a) oraz wszystkie znane na T4 (definicja b). */
  private sprawdzKamienieGalaktyki(): void {
    const n = this.swiat.cywilizacje.length;
    const szczyt = K.TierCount;
    const naSzczycie = this.swiat.cywilizacje.filter((c) => this.tierCywilizacji(c.id) >= szczyt).length;
    if (naSzczycie >= Math.ceil(n / 2)) this.kamien(`cywilizacja:polowa:T${szczyt}`);
    if (naSzczycie >= n) this.kamien(`cywilizacja:wszystkie:T${szczyt}`);
    const znane = this.swiat.cywilizacje.filter((c) => this.stan.znaneCywilizacje[c.id]);
    if (znane.length > 0 && znane.every((c) => this.tierCywilizacji(c.id) >= szczyt)) this.kamien(`cywilizacja:znane:T${szczyt}`);
  }

  // ---------- Flota ----------

  private nowaLadownia(): Record<Towar, PozycjaLadowni> {
    const ladownia = {} as Record<Towar, PozycjaLadowni>;
    for (const t of TOWARY) ladownia[t] = { m3: 0, kosztKr: 0, pochodzenie: {} };
    return ladownia;
  }

  /** Nowy statek szczebla 0 w podanym węźle; w rundzie 3 z pustym bakiem (paliwo jest pierwszym zakupem). */
  private dodajStatek(pozycja: string): Statek {
    const id = this.stan.statki.length;
    const statek: Statek = {
      id,
      nazwa: `Statek ${id + 1}`,
      pozycja,
      paliwo: this.runda3 ? 0 : K.bak,
      ladownia: this.nowaLadownia(),
      zaloga: [],
      kandydaci: [],
      pamiecZakupu: {},
      szczebel: 0,
      moduly: { ...konfiguracjaSzczebla(0) },
      numerLotu: 0,
      skoki: 0,
      kursStart: { wartosc: this.stan.statki.length === 0 ? K.startingCredits : this.wartoscFirmy(), szczebel: 0, kadlubKr: 0 },
      naukowiec: null,
      wLocie: null,
    };
    this.stan.statki.push(statek);
    this.okresy.push({ transakcje: [], paliwoKupioneM3: 0, paliwoKosztKr: 0, saldoNaStarcie: this.stan.kr, wartoscNaStarcie: this.stan.kr, deltaKr: 0, kadlub: null, nowyStatek: null, awanse: [] });
    this.ostatnieRaporty.push(null);
    return statek;
  }

  statek(i: number = this.stan.aktywny): Statek {
    return this.stan.statki[i];
  }

  /** Przełącza statek aktywny (pola stanu, akcje w doku, lot). */
  wybierzStatek(i: number): void {
    if (i < 0 || i >= this.stan.statki.length) throw new Error(`Nie ma statku ${i}`);
    this.stan.aktywny = i;
  }

  /** Liczba statków, jaką dopuszcza poziom firmy (runda 3: 1/2/4/8). */
  limitStatkow(): number {
    if (!this.runda3) return 1;
    const lista = P.runda3.firma.statkiNaPoziom;
    return lista[Math.min(this.stan.poziomFirmy, lista.length) - 1];
  }

  /** Czy stoimy w stoczni (dok stolicy znanej cywilizacji), a w rundzie 3 dodatkowo czy jej tier dopuszcza dany szczebel. */
  stoczniaDopuszcza(szczebel: number, idWezla: string = this.stan.pozycja): boolean {
    if (!this.wStoczni(idWezla)) return false;
    if (!this.runda3) return true;
    const cyw = this.wezel(idWezla).cywilizacja!;
    const tiery = P.runda3.statek.tierSzczebla;
    return this.tierCywilizacji(cyw) >= tiery[Math.min(szczebel, tiery.length - 1)];
  }

  /** Runda 3: zakup nowego statku szczebla 0 w stoczni; wymaga wolnego miejsca w limicie poziomu firmy. */
  kupStatek(): Statek {
    if (!this.runda3) throw new Error('Flota działa tylko w rundzie 3');
    if (!this.stoczniaDopuszcza(0)) throw new Error('Nowy statek kupisz tylko w stoczni stolicy');
    if (this.stan.statki.length >= this.limitStatkow()) throw new Error(`Poziom firmy ${this.stan.poziomFirmy} pozwala na ${this.limitStatkow()} statków`);
    const cena = P.runda3.firma.cenaNowegoStatkuKr;
    if (cena > this.stan.kr) throw new Error('Brak gotówki');
    this.stan.kr -= cena;
    this.okres.deltaKr -= cena;
    this.stan.wydanoNaKadlub += cena;
    const s = this.dodajStatek(this.stan.pozycja);
    this.okres.nowyStatek = { id: s.id, kwotaKr: cena };
    this.oknoStoczni('statek');
    this.kamien(`flota:${this.stan.statki.length}`);
    // Nowy statek dokuje tu i dostaje własnych kandydatów (czas stoi w oknie stoczni).
    const poprzedni = this.stan.aktywny;
    this.stan.aktywny = s.id;
    this.zadokuj();
    this.stan.aktywny = poprzedni;
    return s;
  }

  /** Runda 3: awans poziomu firmy, gdy wartość firmy ≥ progFirmy(T); sprawdzany przy każdym przylocie. */
  private sprawdzPoziomFirmy(): void {
    if (!this.runda3) return;
    const progi = P.runda3.firma.progFirmy;
    const wartosc = this.wartoscFirmy();
    while (this.stan.poziomFirmy < progi.length && wartosc >= progi[this.stan.poziomFirmy]) {
      this.stan.poziomFirmy += 1;
      this.kamien(`firma:T${this.stan.poziomFirmy}`);
    }
  }

  private oknoStoczni(rodzaj: string): void {
    this.stan.oknaStoczni.push({ doba: this.stan.doba, statkow: this.stan.statki.length, rodzaj });
  }

  /** Statki w doku (nie w locie), do pętli bota. */
  statkiWDoku(): number[] {
    return this.stan.statki.filter((s) => s.wLocie === null).map((s) => s.id);
  }

  // ---------- Kadłub (drabina) ----------

  private mnoznikKadluba(): number {
    return Math.pow(P.progresja.mnoznikSzczebla, this.stan.szczebel);
  }

  /** Pojemność ładowni (m³): runda 3 = moduły ładowni × 120 m³, inaczej BaseShip × mnoznikSzczebla^N. */
  ladownia(): number {
    if (this.runda3) return ladowniaM3(this.statek().moduly);
    return K.ladownia * this.mnoznikKadluba();
  }

  bak(): number {
    if (this.runda3) return bakSzczeblaM3(this.stan.szczebel);
    return K.bak * this.mnoznikKadluba();
  }

  /** Limit masy ładunku: w rundzie 3 brak (masa tylko spowalnia statek), inaczej BaseShip × mnoznikSzczebla^N. */
  maxMasa(): number {
    if (this.runda3) return Infinity;
    return K.maxMasaLadunku * this.mnoznikKadluba();
  }

  // ---------- Runda 3: masa, ciąg, prędkość ----------

  masaSuchaT(statek: Statek = this.statek()): number {
    return masaSuchaT(statek.szczebel, statek.moduly);
  }

  ciagTf(statek: Statek = this.statek()): number {
    return ciagTf(statek.moduly);
  }

  /** Masa statku teraz: kadłub + moduły + paliwo (1 t/m³) + ładunek (gęstość × m³). */
  masaStatkuT(statek: Statek = this.statek(), ladunekDodatkowyT = 0): number {
    let ladunek = 0;
    for (const t of TOWARY) ladunek += statek.ladownia[t].m3 * K.towary[t].gestosc;
    return this.masaSuchaT(statek) + statek.paliwo * K.towary.Fuel.gestosc + ladunek + ladunekDodatkowyT;
  }

  /** Prędkość w tej chwili (pc/dobę): runda 3 z hierarchii ciągu, inaczej nominalna × pilot. */
  predkoscTeraz(zaloga: readonly Zalogant[] = this.stan.zaloga): number {
    const ef = this.efekty(zaloga);
    if (!this.runda3) return ef.predkosc;
    return (K.predkoscNominalna * this.ciagTf() * ef.mnoznikPilota) / (K.statek.stalaPredkosci * this.masaStatkuT());
  }

  /** Obsada statku (runda 3): miejsca w załodze wynikają z modułów; inaczej miejscaZalogi kanonu. */
  miejscaZalogi(statek: Statek = this.statek()): number {
    return this.runda3 ? obsada(statek.moduly) : K.miejscaZalogi;
  }

  /**
   * Parametry lotu dla statku: masa startowa (z podanym paliwem i ładunkiem dodatkowym), ciąg, pilot, mnożnik paliwa.
   */
  private parametryLotu(zaloga: readonly Zalogant[], paliwoM3: number, ladunekDodatkowyT: number, pilot: boolean, nawigator: boolean, synergia: boolean) {
    const ef = this.efekty(zaloga);
    const statek = this.statek();
    let ladunek = ladunekDodatkowyT;
    for (const t of TOWARY) ladunek += statek.ladownia[t].m3 * K.towary[t].gestosc;
    return {
      masaStartT: this.masaSuchaT(statek) + paliwoM3 * K.towary.Fuel.gestosc + ladunek,
      ciagTf: this.ciagTf(statek),
      pilot: pilot ? ef.mnoznikPilota : 1,
      mnoznikPaliwa: (nawigator ? ef.mnoznikNawigatora : 1) * (synergia ? ef.mnoznikSynergii : 1),
      wariant: this.wariantPaliwa,
    };
  }

  /**
   * Lot na dystans: doby i paliwo. Runda 3 liczy z hierarchii ciągu (masa z bieżącym paliwem i ładunkiem),
   * poza rundą 3 dystans / prędkość i 1 m³/pc × mnożnik nawigatora.
   */
  obliczLot(dystansPc: number, zaloga: readonly Zalogant[] = this.stan.zaloga, paliwoM3 = this.stan.paliwo, ladunekDodatkowyT = 0): { doby: number; paliwo: number; dobyNominalne: number; bezZalogi: number; poNawigatorze: number; predkoscStart: number; predkoscMeta: number } {
    const ef = this.efekty(zaloga);
    if (!this.runda3) {
      const bezZalogi = dystansPc * K.kosztPaliwaNaParsek;
      const poNawigatorze = bezZalogi * ef.mnoznikNawigatora;
      return { doby: dystansPc / ef.predkosc, paliwo: poNawigatorze * ef.mnoznikSynergii, dobyNominalne: dystansPc / K.predkoscNominalna, bezZalogi, poNawigatorze, predkoscStart: ef.predkosc, predkoscMeta: ef.predkosc };
    }
    const pelny = lot(dystansPc, this.parametryLotu(zaloga, paliwoM3, ladunekDodatkowyT, true, true, true));
    const nominalny = lot(dystansPc, this.parametryLotu(zaloga, paliwoM3, ladunekDodatkowyT, false, true, true));
    const bezZalogi = lot(dystansPc, this.parametryLotu(zaloga, paliwoM3, ladunekDodatkowyT, false, false, false));
    const poNawigatorze = lot(dystansPc, this.parametryLotu(zaloga, paliwoM3, ladunekDodatkowyT, false, true, false));
    return { doby: pelny.doby, paliwo: pelny.paliwoM3, dobyNominalne: nominalny.doby, bezZalogi: bezZalogi.paliwoM3, poNawigatorze: poNawigatorze.paliwoM3, predkoscStart: pelny.predkoscStart, predkoscMeta: pelny.predkoscMeta };
  }

  /** Najdalszy dystans na podanym paliwie przy bieżącej masie (runda 3) albo paliwo / (1 m³/pc × mnożnik). */
  zasiegNaPaliwie(paliwoM3: number, zaloga: readonly Zalogant[] = this.stan.zaloga, ladunekDodatkowyT = 0): number {
    if (!this.runda3) return paliwoM3 / (K.kosztPaliwaNaParsek * this.efekty(zaloga).mnoznikPaliwa);
    return zasiegNaPaliwie(paliwoM3, this.parametryLotu(zaloga, paliwoM3, ladunekDodatkowyT, true, true, true));
  }

  /** Czy stoimy w doku stolicy znanej cywilizacji (tylko tam działa stocznia). */
  wStoczni(idWezla: string = this.stan.pozycja): boolean {
    const w = this.wezel(idWezla);
    if (w.typ !== 'planeta' || !this.cywilizacjaZnana(w.cywilizacja)) return false;
    return this.cywilizacja(w.cywilizacja)!.stolica === idWezla;
  }

  /**
   * Wycena kolejnego szczebla: k × mediana zysku na kurs zmierzona na bieżącym szczeblu (potrzeba
   * co najmniej `minKursowDoWycenySzczebla` kursów o dodatniej medianie). Kurs = loty między kolejnymi dokami ze sprzedażą.
   */
  wycenaSzczebla(): WycenaSzczebla | null {
    if (!this.progresja) return null;
    const nastepny = this.stan.szczebel + 1;
    if (nastepny >= K.drabinaKadlubow.szczebli) return null;
    const m = Math.pow(P.progresja.mnoznikSzczebla, nastepny);
    const zyski = this.stan.zyskiKursow[this.stan.szczebel] ?? [];
    const baza = this.runda3
      ? { nastepny, kursow: zyski.length, ladowniaM3: ladowniaM3(konfiguracjaSzczebla(nastepny)), bakM3: bakSzczeblaM3(nastepny) }
      : { nastepny, kursow: zyski.length, ladowniaM3: K.ladownia * m, bakM3: K.bak * m };
    if (zyski.length < P.progresja.minKursowDoWycenySzczebla) {
      return { ...baza, kwotaKr: null, medianaZyskuKr: null, powod: `stocznia wycenia kadłub po ${P.progresja.minKursowDoWycenySzczebla} kursach na obecnym szczeblu (masz ${zyski.length})` };
    }
    const med = mediana(zyski);
    if (!(med > 0)) return { ...baza, kwotaKr: null, medianaZyskuKr: med, powod: 'mediana zysku na kurs nie jest dodatnia' };
    return { ...baza, kwotaKr: zaokr(P.progresja.k * med), medianaZyskuKr: med };
  }

  /** Kupno kolejnego szczebla w stoczni stolicy: ładownia, bak i masa rosną × mnoznikSzczebla; paliwo i ładunek zostają. */
  kupSzczebel(): { szczebel: number; kwotaKr: number } {
    if (!this.progresja) throw new Error('Drabina kadłubów działa tylko w trybie progresji');
    if (!this.wStoczni()) throw new Error('Stocznia jest tylko w doku stolicy');
    const w = this.wycenaSzczebla();
    if (!w) throw new Error('To już najwyższy szczebel');
    if (!this.stoczniaDopuszcza(w.nastepny)) throw new Error(`Stocznia tej cywilizacji buduje kadłuby do szczebla wymagającego tieru ${P.runda3.statek.tierSzczebla[w.nastepny]}`);
    if (w.kwotaKr === null) throw new Error(w.powod ?? 'Brak wyceny');
    if (w.kwotaKr > this.stan.kr) throw new Error('Brak gotówki');
    this.stan.kr -= w.kwotaKr;
    this.okres.deltaKr -= w.kwotaKr;
    this.stan.szczebel = w.nastepny;
    if (this.runda3) {
      this.statek().moduly = { ...konfiguracjaSzczebla(w.nastepny) };
      this.oknoStoczni('kadlub');
    }
    this.stan.zyskiKursow[w.nastepny] ??= [];
    this.stan.wydanoNaKadlub += w.kwotaKr;
    this.stan.kursStart.kadlubKr += w.kwotaKr;
    this.okres.kadlub = { szczebel: w.nastepny, kwotaKr: w.kwotaKr };
    this.kamien(`szczebel:${w.nastepny}`);
    return { szczebel: w.nastepny, kwotaKr: w.kwotaKr };
  }

  private kamien(klucz: string): void {
    if (this.stan.kamienie[klucz] === undefined) this.stan.kamienie[klucz] = this.stan.doba;
  }

  // ---------- Tiery cywilizacji ----------

  tierCywilizacji(idCyw: string): number {
    return this.stan.tiery[idCyw] ?? 1;
  }

  /** Koszyk kolejnego tieru cywilizacji (null na najwyższym tierze albo bez progresji). */
  koszykTieru(idCyw: string) {
    if (!this.progresja || this.runda3) return null;
    const nastepny = this.tierCywilizacji(idCyw) + 1;
    if (nastepny > K.TierCount) return null;
    return P.progresja.koszyki.find((k) => k.tier === nastepny) ?? null;
  }

  /** Dzienny „PKB” portów cywilizacji: konsumpcja (łącznie z uśpioną) × cena bazowa, w WU/dobę. */
  pkbDobowyWU(idCyw: string): number {
    const cyw = this.cywilizacja(idCyw);
    if (!cyw) return 0;
    let suma = 0;
    for (const id of cyw.planety) {
      for (const t of TOWARY_I_PALIWO) {
        const poz = this.stan.rynki[id][t];
        suma += (poz.konsumpcja + poz.konsumpcjaUspiona) * K.towary[t].basePrice;
      }
    }
    return suma;
  }

  /** Postęp awansu: próg = progAwansu × mnożnik tieru × PKB, podzielony między towary koszyka według udziałów. */
  postepAwansu(idCyw: string): PostepAwansu {
    const tier = this.tierCywilizacji(idCyw);
    const koszyk = this.koszykTieru(idCyw);
    const pkbWU = this.pkbDobowyWU(idCyw);
    if (!koszyk) return { tier, nastepny: null, pkbWU, progWU: 0, towary: [], udzial: 1 };
    const progWU = P.progresja.progAwansu * koszyk.mnoznikProgu * pkbWU;
    const dostawy = this.stan.dostawy[idCyw] ?? {};
    const towary = (Object.keys(koszyk.udzialy) as Towar[]).map((towar) => ({
      towar,
      potrzebneWU: progWU * (koszyk.udzialy[towar] ?? 0),
      dostarczoneWU: dostawy[towar] ?? 0,
    }));
    const udzial = Math.min(...towary.map((x) => (x.potrzebneWU > 0 ? x.dostarczoneWU / x.potrzebneWU : 1)));
    return { tier, nastepny: koszyk.tier, pkbWU, progWU, towary, udzial };
  }

  /** Zalicza sprzedaż towaru koszyka na planecie cywilizacji; przy pełnym koszyku awansuje tier. */
  private zaliczDostawe(idCyw: string, towar: Towar, m3: number): void {
    const koszyk = this.koszykTieru(idCyw);
    if (!koszyk || !(koszyk.udzialy[towar]! > 0)) return;
    const d = (this.stan.dostawy[idCyw] ??= {});
    d[towar] = (d[towar] ?? 0) + m3 * K.towary[towar].basePrice;
    const postep = this.postepAwansu(idCyw);
    if (postep.udzial < 1 - EPS) return;
    // Awans: konsumpcja i norma towarów koszyka rosną na wszystkich planetach cywilizacji; produkcja bez zmian.
    const cyw = this.cywilizacja(idCyw)!;
    const m = P.progresja.mnoznikKonsumpcjiAwansu;
    for (const t of Object.keys(koszyk.udzialy) as Towar[]) {
      for (const id of cyw.planety) {
        const poz = this.stan.rynki[id][t];
        poz.konsumpcja *= m;
        poz.konsumpcjaUspiona *= m;
        poz.norma *= m;
      }
      cyw.potrzebyM3NaDobe[t] *= m;
    }
    this.stan.tiery[idCyw] = koszyk.tier;
    this.stan.dostawy[idCyw] = {};
    this.okres.awanse.push({ cywilizacja: idCyw, nazwa: cyw.nazwa, tier: koszyk.tier });
    this.kamien(`tier:${idCyw}:${koszyk.tier}`);
    this.kamien(`cywilizacja:pierwsza:T${koszyk.tier}`);
    const n = this.swiat.cywilizacje.length;
    const naSzczycie = this.swiat.cywilizacje.filter((c) => this.tierCywilizacji(c.id) >= K.TierCount).length;
    if (naSzczycie >= Math.ceil(n / 2)) this.kamien(`cywilizacja:polowa:T${K.TierCount}`);
    if (naSzczycie >= n) this.kamien(`cywilizacja:wszystkie:T${K.TierCount}`);
  }

  // ---------- XP załogi ----------

  /** Dodaje XP wszystkim załogantom (tryb progresji), aktualizuje tier, umiejętność i płacę, zapisuje kamienie. */
  private dodajXP(xp: number): void {
    if (!this.progresja || xp <= 0) return;
    for (const z of this.stan.zaloga) {
      if (z.xp === undefined) continue;
      const przed = tierZalogi(z.xp);
      z.xp += xp;
      aktualizujZaloganta(z);
      const po = tierZalogi(z.xp);
      for (let t = przed + 1; t <= po; t++) this.kamien(`zaloga:tier:${t}`);
    }
    const szczyt = K.TierCount - 1;
    if (this.stan.zaloga.length >= K.miejscaZalogi && this.stan.zaloga.every((z) => z.xp !== undefined && tierZalogi(z.xp) >= szczyt)) this.kamien('zaloga:wszyscy:legenda');
  }

  // ---------- Odczyt świata ----------

  wezel(id: string = this.stan.pozycja): Wezel {
    const w = this.graf.wezly.get(id);
    if (!w) throw new Error(`Nieznany węzeł ${id}`);
    return w;
  }

  cywilizacja(id: string | undefined) {
    return this.swiat.cywilizacje.find((c) => c.id === id);
  }

  cywilizacjaZnana(idCyw: string | undefined): boolean {
    return !!idCyw && !!this.stan.znaneCywilizacje[idCyw];
  }

  /** Czy węzeł ma rynek, który gracz może poznać (planeta znanej cywilizacji). */
  rynekZnany(idWezla: string): boolean {
    const w = this.wezel(idWezla);
    return w.typ === 'planeta' && this.cywilizacjaZnana(w.cywilizacja);
  }

  /** Czy węzeł sprzedaje paliwo (planeta albo plemiona; układ przelotowy nie). */
  maPaliwo(idWezla: string = this.stan.pozycja): boolean {
    return this.wezel(idWezla).typ !== 'przelot';
  }

  /** Odległość w linii prostej od statku (łączność). */
  odlegloscOdStatku(idWezla: string): number {
    return odleglosc(this.wezel(), this.wezel(idWezla));
  }

  wLacznosci(idWezla: string): boolean {
    return idWezla === this.stan.pozycja || this.odlegloscOdStatku(idWezla) <= K.zasiegLacznosci + EPS;
  }

  /**
   * Co gracz wie o rynku planety. Tryb `pelna`: wszystko na żywo. Tryb `zasieg`: na żywo w zasięgu łączności,
   * poza nim ostatni odczyt z odwiedzonej planety (z wiekiem), a nieodwiedzonej planety nie widać wcale.
   */
  informacjaORynku(idWezla: string): InformacjaORynku | null {
    if (!this.rynekZnany(idWezla)) return null;
    if (this.informacja === 'pelna' || this.wLacznosci(idWezla)) return { tryb: 'zywa', rynek: this.stan.rynki[idWezla], wiekDob: 0 };
    const o = this.stan.odczyty[idWezla];
    if (!o) return null;
    return { tryb: 'odczyt', rynek: o.rynek, wiekDob: this.stan.doba - o.doba };
  }

  efekty(zaloga: readonly Zalogant[] = this.stan.zaloga): EfektyZalogi {
    return efektyZalogi(zaloga);
  }

  private kluczPamieci(idWezla: string, towar: Towar): string {
    return `${idWezla}|${towar}`;
  }

  /**
   * Licznik pamięci zakupu pary (planeta, towar) po `skokiWPrzod` kolejnych skokach statku aktywnego (i `dobyWPrzod` dobach).
   * Runda 3 (pamięć floty): A = skoki statku, który kupił; B = skoki statku, który sprzedaje; C = czas (pamiecCzasDob ≙ 5 skoków).
   */
  licznikPamieci(idWezla: string, towar: Towar, skokiWPrzod = 0, dobyWPrzod = 0): number {
    if (!this.runda3) return Math.max(0, (this.stan.pamiecZakupu[this.kluczPamieci(idWezla, towar)] ?? 0) - skokiWPrzod);
    const wpis = this.stan.pamiecFloty[this.kluczPamieci(idWezla, towar)];
    if (!wpis) return 0;
    const N = P.pamiecZakupuSkokow;
    const wariant = this.wariantPamieciFloty;
    if (wariant === 'C') {
      const minelo = this.stan.doba + dobyWPrzod - wpis.doba;
      return Math.max(0, Math.ceil(((P.runda3.pamiecCzasDob - minelo) / P.runda3.pamiecCzasDob) * N - 1e-9));
    }
    const statek = wariant === 'A' ? wpis.statek : this.stan.aktywny;
    const skokiTeraz = this.stan.statki[statek].skoki + (statek === this.stan.aktywny ? skokiWPrzod : 0);
    return Math.max(0, N - (skokiTeraz - (wpis.skokiStatkow[statek] ?? skokiTeraz)));
  }

  /**
   * Kara za odsprzedaż w miejscu zakupu (ułamek ceny sprzedaży): wariant A nie ma kary (spread stały),
   * schodek = pełne tradeSpread dopóki licznik > 0, liniowy = tradeSpread × licznik / pamiecZakupuSkokow.
   */
  karaSprzedazy(idWezla: string, towar: Towar, skokiWPrzod = 0, dobyWPrzod = 0): number {
    const konfig = P.wariantySpreadu[this.wariantSpreadu];
    if (konfig.tryb !== 'pamiec') return 0;
    const licznik = this.licznikPamieci(idWezla, towar, skokiWPrzod, dobyWPrzod);
    if (licznik <= 0) return 0;
    return konfig.kara === 'liniowy' ? (K.tradeSpread * licznik) / P.pamiecZakupuSkokow : K.tradeSpread;
  }

  /** Ceny jednostkowe towaru (kr/m³) według tego, co gracz wie o planecie. */
  ceny(idWezla: string, towar: Towar, udzial = this.efekty().udzialHandlowca, skokiWPrzod = 0): Ceny | null {
    const info = this.informacjaORynku(idWezla);
    if (!info) return null;
    const poz = info.rynek[towar];
    if (poz.dostepny === false) return null;
    const baza = cenaBazowaWU(K.towary[towar].basePrice, poz, this.obciecieNacisku);
    const kara = this.karaSprzedazy(idWezla, towar, skokiWPrzod);
    return {
      kupnoKr: kr(baza * mnoznikKupna(udzial, this.spreadPodstawowy)),
      sprzedazKr: kr(baza * mnoznikSprzedazy(udzial, this.spreadPodstawowy, kara)),
      kara,
      licznikPamieci: this.licznikPamieci(idWezla, towar, skokiWPrzod),
      bazowaKr: kr(baza),
      nacisk: nacisk(poz.zapas / poz.norma, this.obciecieNacisku),
      zapasM3: poz.zapas,
      normaM3: poz.norma,
      zapasDoby: poz.konsumpcja > 0 ? poz.zapas / poz.konsumpcja : Infinity,
      bilansNaDobe: poz.produkcja - poz.konsumpcja,
      informacja: info.tryb,
      wiekDob: info.wiekDob,
    };
  }

  /** Cena jednostkowa paliwa w węźle (kr/m³); null, gdy nie ma paliwa albo brak informacji. */
  cenaPaliwa(idWezla: string = this.stan.pozycja): number | null {
    const w = this.wezel(idWezla);
    if (w.typ === 'przelot') return null;
    if (w.typ === 'tankowanie') return kr(K.towary.Fuel.basePrice);
    if (idWezla === this.stan.pozycja) return kr(cenaBazowaWU(K.towary.Fuel.basePrice, this.stan.rynki[idWezla].Fuel, this.obciecieNacisku));
    const info = this.informacjaORynku(idWezla);
    if (!info) return null;
    return kr(cenaBazowaWU(K.towary.Fuel.basePrice, info.rynek.Fuel, this.obciecieNacisku));
  }

  /** Cena paliwa tutaj; w układzie bez paliwa cena bazowa (do wycen odniesienia). */
  cenaPaliwaTutaj(): number {
    return this.cenaPaliwa() ?? kr(K.towary.Fuel.basePrice);
  }

  // ---------- Wyceny (bez mutacji) ----------

  private wycenaNaRynku(towar: Towar, m3: number, rodzaj: 'kupno' | 'sprzedaz', udzial: number, rynek: Rynek[Towar], kara = 0): Wycena {
    const base = K.towary[towar].basePrice;
    const sp = this.spreadPodstawowy;
    const ob = this.obciecieNacisku;
    const znak = rodzaj === 'kupno' ? -1 : 1;
    const po = { ...rynek, zapas: rynek.zapas + znak * m3 };
    const kwotaWU = rodzaj === 'kupno' ? kwotaKupnaWU(base, rynek, m3, udzial, sp, ob) : kwotaSprzedazyWU(base, rynek, m3, udzial, sp, kara, ob);
    const kwotaBezWU = rodzaj === 'kupno' ? kwotaKupnaWU(base, rynek, m3, 0, sp, ob) : kwotaSprzedazyWU(base, rynek, m3, 0, sp, kara, ob);
    const kwotaBezKaryWU = rodzaj === 'kupno' ? kwotaBezWU : kwotaSprzedazyWU(base, rynek, m3, 0, sp, 0, ob);
    const mn = rodzaj === 'kupno' ? mnoznikKupna(udzial, sp) : mnoznikSprzedazy(udzial, sp, kara);
    const kwotaKr = zaokr(kr(kwotaWU));
    return {
      m3,
      kwotaKr,
      cenaSredniaKr: m3 > 0 ? kwotaKr / m3 : 0,
      cenaJednPrzedKr: kr(cenaBazowaWU(base, rynek, ob) * mn),
      cenaJednPoKr: kr(cenaBazowaWU(base, po, ob) * mn),
      naciskPrzed: nacisk(rynek.zapas / rynek.norma, ob),
      naciskPo: nacisk(po.zapas / po.norma, ob),
      kwotaBezHandlowcaKr: zaokr(kr(kwotaBezWU)),
      kwotaBezKaryKr: zaokr(kr(kwotaBezKaryWU)),
      kara,
    };
  }

  private rynekDoWyceny(idWezla: string): Rynek {
    if (idWezla === this.stan.pozycja) {
      if (!this.rynekZnany(idWezla)) throw new Error('Tu nie ma rynku');
      return this.stan.rynki[idWezla];
    }
    const info = this.informacjaORynku(idWezla);
    if (!info) throw new Error('Brak informacji o tym rynku');
    return info.rynek;
  }

  wycenaKupna(towar: Towar, m3: number, idWezla = this.stan.pozycja, udzial = this.efekty().udzialHandlowca): Wycena {
    return this.wycenaNaRynku(towar, m3, 'kupno', udzial, this.rynekDoWyceny(idWezla)[towar]);
  }

  /** Wycena sprzedaży tutaj albo na innej planecie; `skokiWPrzod` to skoki do wykonania przed sprzedażą (licznik pamięci maleje). */
  wycenaSprzedazy(towar: Towar, m3: number, idWezla = this.stan.pozycja, udzial = this.efekty().udzialHandlowca, skokiWPrzod = 0): Wycena {
    return this.wycenaNaRynku(towar, m3, 'sprzedaz', udzial, this.rynekDoWyceny(idWezla)[towar], this.karaSprzedazy(idWezla, towar, skokiWPrzod));
  }

  /** Wycena sprzedaży na planecie za `doby` dób: odczyt na żywo rzutowany w przód, stary odczyt bez rzutowania. */
  wycenaSprzedazyZa(towar: Towar, m3: number, idWezla: string, doby: number, udzial = this.efekty().udzialHandlowca, skokiWPrzod = 0): Wycena {
    const info = idWezla === this.stan.pozycja ? ({ tryb: 'zywa', rynek: this.rynekDoWyceny(idWezla), wiekDob: 0 } as InformacjaORynku) : this.informacjaORynku(idWezla);
    if (!info) throw new Error('Brak informacji o tym rynku');
    const rynek = info.tryb === 'zywa' ? zapasPo(info.rynek[towar], doby) : info.rynek[towar];
    return this.wycenaNaRynku(towar, m3, 'sprzedaz', udzial, rynek, this.karaSprzedazy(idWezla, towar, skokiWPrzod));
  }

  wycenaPaliwa(m3: number, idWezla = this.stan.pozycja): { m3: number; kwotaKr: number; cenaSredniaKr: number } {
    const w = this.wezel(idWezla);
    if (w.typ === 'przelot') return { m3, kwotaKr: 0, cenaSredniaKr: 0 };
    const kwotaWU = w.typ === 'tankowanie' ? K.towary.Fuel.basePrice * m3 : kwotaPaliwaWU(this.stan.rynki[idWezla].Fuel, m3, this.obciecieNacisku);
    const kwotaKr = zaokr(kr(kwotaWU));
    return { m3, kwotaKr, cenaSredniaKr: m3 > 0 ? kwotaKr / m3 : 0 };
  }

  objetoscZajeta(): number {
    const naukowiec = this.runda3 && this.statek().naukowiec ? P.runda3.statek.naukowiecM3 : 0;
    return TOWARY.reduce((s, t) => s + this.stan.ladownia[t].m3, 0) + naukowiec;
  }

  masaZajeta(): number {
    return TOWARY.reduce((s, t) => s + this.stan.ladownia[t].m3 * K.towary[t].gestosc, 0);
  }

  /** Największa ilość towaru, jaką da się tu kupić: zapas, objętość, masa i gotówka. */
  maxKupno(towar: Towar, gotowka = this.stan.kr, idWezla = this.stan.pozycja, udzial = this.efekty().udzialHandlowca): number {
    if (!this.rynekZnany(idWezla)) return 0;
    const poz = this.rynekDoWyceny(idWezla)[towar];
    if (poz.dostepny === false) return 0;
    const g = K.towary[towar].gestosc;
    let hi = Math.min(poz.zapas, this.ladownia() - this.objetoscZajeta(), (this.maxMasa() - this.masaZajeta()) / g);
    hi = Math.max(0, hi);
    if (this.wycenaKupna(towar, hi, idWezla, udzial).kwotaKr <= gotowka) return hi;
    let lo = 0;
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2;
      if (this.wycenaKupna(towar, mid, idWezla, udzial).kwotaKr <= gotowka) lo = mid;
      else hi = mid;
    }
    return lo;
  }

  maxPaliwo(gotowka = this.stan.kr): number {
    if (!this.maPaliwo()) return 0;
    let hi = Math.max(0, this.bak() - this.stan.paliwo);
    if (this.wycenaPaliwa(hi).kwotaKr <= gotowka) return hi;
    let lo = 0;
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2;
      if (this.wycenaPaliwa(mid).kwotaKr <= gotowka) lo = mid;
      else hi = mid;
    }
    return lo;
  }

  potrzebnePaliwo(dystansPc: number, zaloga: readonly Zalogant[] = this.stan.zaloga, ladunekDodatkowyT = 0): number {
    return this.obliczLot(dystansPc, zaloga, this.runda3 ? Math.max(this.stan.paliwo, this.potrzebnePaliwoPrzyblizenie(dystansPc, zaloga, ladunekDodatkowyT)) : this.stan.paliwo, ladunekDodatkowyT).paliwo;
  }

  /** Przybliżenie paliwa na odcinek (do iteracji w rundzie 3: masa zależy od paliwa, które trzeba mieć na starcie). */
  private potrzebnePaliwoPrzyblizenie(dystansPc: number, zaloga: readonly Zalogant[], ladunekDodatkowyT: number): number {
    let paliwo = this.obliczLot(dystansPc, zaloga, this.stan.paliwo, ladunekDodatkowyT).paliwo;
    for (let i = 0; i < 3; i++) paliwo = this.obliczLot(dystansPc, zaloga, paliwo, ladunekDodatkowyT).paliwo;
    return paliwo;
  }

  /** Węzły osiągalne z bieżącej pozycji na obecnym paliwie, najkrótszą ścieżką. */
  zasieg(paliwo = this.stan.paliwo, zaloga: readonly Zalogant[] = this.stan.zaloga): Map<string, Osiagalny> {
    const maxDystans = this.zasiegNaPaliwie(paliwo, zaloga) + EPS;
    const d = this.graf.dijkstra(this.stan.pozycja, maxDystans);
    const wynik = new Map<string, Osiagalny>();
    for (const [id, w] of d) {
      const potrzebne = this.obliczLot(w.dystans, zaloga, paliwo).paliwo;
      if (potrzebne <= paliwo + EPS) wynik.set(id, { id, dystans: w.dystans, paliwo: potrzebne, sciezka: Graf.sciezkaZ(d, id)! });
    }
    return wynik;
  }

  /** Wartość firmy = kr + ładunki wszystkich statków (w doku z rynkiem po cenie sprzedaży, inaczej po koszcie zakupu). */
  wartoscFirmy(): number {
    let suma = this.stan.kr;
    for (const s of this.stan.statki) suma += this.wartoscLadowniStatku(s.id);
    return suma;
  }

  /** Wartość ładowni statku aktywnego. */
  wartoscLadowni(): number {
    return this.wartoscLadowniStatku(this.stan.aktywny);
  }

  wartoscLadowniStatku(i: number): number {
    const s = this.stan.statki[i];
    const wDoku = s.wLocie === null && this.rynekZnany(s.pozycja);
    const poprzedni = this.stan.aktywny;
    this.stan.aktywny = i;
    let suma = 0;
    try {
      for (const t of TOWARY) {
        const poz = s.ladownia[t];
        if (poz.m3 <= 0) continue;
        suma += wDoku ? this.wycenaSprzedazy(t, poz.m3).kwotaKr : zaokr(poz.kosztKr);
      }
    } finally {
      this.stan.aktywny = poprzedni;
    }
    return suma;
  }

  celWartosci(): number {
    return K.startingCredits * P.celMnoznikWartosci;
  }

  // ---------- Akcje w doku ----------

  kup(towar: Towar, m3: number): Transakcja {
    const tu = this.stan.pozycja;
    if (!this.rynekZnany(tu)) throw new Error('Tu nie ma rynku');
    if (!(m3 > 0) || !Number.isFinite(m3)) throw new Error('Ilość musi być dodatnia');
    const poz = this.stan.rynki[tu][towar];
    if (poz.dostepny === false) throw new Error('Tej cywilizacji ten towar jeszcze nie istnieje (tier za niski)');
    if (m3 > poz.zapas + EPS) throw new Error('Planeta nie ma tyle w zapasie');
    if (this.objetoscZajeta() + m3 > this.ladownia() + EPS) throw new Error('Brak miejsca w ładowni');
    if (this.masaZajeta() + m3 * K.towary[towar].gestosc > this.maxMasa() + EPS) throw new Error('Przekroczona masa ładunku');
    const w = this.wycenaKupna(towar, m3);
    if (w.kwotaKr > this.stan.kr) throw new Error('Brak gotówki');
    this.stan.kr -= w.kwotaKr;
    this.okres.deltaKr -= w.kwotaKr;
    poz.zapas -= m3;
    const l = this.stan.ladownia[towar];
    l.m3 += m3;
    l.kosztKr += w.kwotaKr;
    // Pochodzenie ładunku (cywilizacja zakupu): dostawa koszyka awansu liczy tylko towar kupiony u innej cywilizacji.
    const cywTu = this.wezel(tu).cywilizacja ?? '';
    l.pochodzenie[cywTu] = (l.pochodzenie[cywTu] ?? 0) + m3;
    // Pamięć zakupu: (towar, planeta, licznik skoków) bez ceny kupna; w rundzie 3 pamięć floty (doba i liczniki skoków statków).
    this.stan.pamiecZakupu[this.kluczPamieci(tu, towar)] = P.pamiecZakupuSkokow;
    if (this.runda3) {
      const skokiStatkow: Record<number, number> = {};
      for (const s of this.stan.statki) skokiStatkow[s.id] = s.skoki;
      this.stan.pamiecFloty[this.kluczPamieci(tu, towar)] = { doba: this.stan.doba, statek: this.stan.aktywny, skokiStatkow };
    }
    const t: Transakcja = {
      rodzaj: 'kupno',
      planeta: tu,
      towar,
      m3,
      kwotaKr: w.kwotaKr,
      kwotaBezHandlowcaKr: w.kwotaBezHandlowcaKr,
      kwotaBezKaryKr: w.kwotaBezKaryKr,
      cenaJednPrzedKr: w.cenaJednPrzedKr,
      cenaJednPoKr: w.cenaJednPoKr,
      naciskPrzed: w.naciskPrzed,
      naciskPo: w.naciskPo,
    };
    this.okres.transakcje.push(t);
    return t;
  }

  sprzedaj(towar: Towar, m3: number): Transakcja {
    const tu = this.stan.pozycja;
    if (!this.rynekZnany(tu)) throw new Error('Tu nie ma rynku');
    if (!(m3 > 0) || !Number.isFinite(m3)) throw new Error('Ilość musi być dodatnia');
    const l = this.stan.ladownia[towar];
    if (m3 > l.m3 + EPS) throw new Error('Nie masz tyle w ładowni');
    if (this.stan.rynki[tu][towar].dostepny === false) throw new Error('Ta cywilizacja nie zna jeszcze tego towaru (tier za niski)');
    m3 = Math.min(m3, l.m3);
    // Pierwsza sprzedaż w tym doku zamyka kurs: zysk = wartość przy przylocie tutaj − wartość przy przylocie do poprzedniego doku ze sprzedażą (+ wydatki na kadłub).
    if (!this.okres.transakcje.some((t) => t.rodzaj === 'sprzedaz')) {
      const ks = this.stan.kursStart;
      (this.stan.zyskiKursow[ks.szczebel] ??= []).push(this.okres.wartoscNaStarcie - ks.wartosc + ks.kadlubKr);
      this.stan.kursStart = { wartosc: this.okres.wartoscNaStarcie, szczebel: this.stan.szczebel, kadlubKr: 0 };
    }
    const w = this.wycenaSprzedazy(towar, m3);
    const kosztZakupu = zaokr((l.kosztKr * m3) / l.m3);
    const cywTu = this.wezel(tu).cywilizacja ?? '';
    // Sprzedana ilość schodzi z pochodzenia proporcjonalnie; do koszyka liczy się część kupiona u innych cywilizacji.
    const udzialSprzedany = m3 / l.m3;
    let dostawaM3 = 0;
    for (const c of Object.keys(l.pochodzenie)) {
      const czesc = l.pochodzenie[c] * udzialSprzedany;
      if (c !== cywTu) dostawaM3 += czesc;
      l.pochodzenie[c] -= czesc;
      if (l.pochodzenie[c] < EPS) delete l.pochodzenie[c];
    }
    this.stan.kr += w.kwotaKr;
    this.okres.deltaKr += w.kwotaKr;
    this.stan.rynki[tu][towar].zapas += m3;
    l.kosztKr -= kosztZakupu;
    l.m3 -= m3;
    if (l.m3 < EPS) {
      l.m3 = 0;
      l.kosztKr = 0;
      l.pochodzenie = {};
    }
    const t: Transakcja = {
      rodzaj: 'sprzedaz',
      planeta: tu,
      towar,
      m3,
      kwotaKr: w.kwotaKr,
      kwotaBezHandlowcaKr: w.kwotaBezHandlowcaKr,
      kwotaBezKaryKr: w.kwotaBezKaryKr,
      cenaJednPrzedKr: w.cenaJednPrzedKr,
      cenaJednPoKr: w.cenaJednPoKr,
      naciskPrzed: w.naciskPrzed,
      naciskPo: w.naciskPo,
      kosztZakupuKr: kosztZakupu,
    };
    this.okres.transakcje.push(t);
    if (this.progresja && !this.runda3 && cywTu && dostawaM3 > EPS) this.zaliczDostawe(cywTu, towar, dostawaM3);
    return t;
  }

  tankuj(m3: number): { m3: number; kwotaKr: number } {
    if (!(m3 > 0) || !Number.isFinite(m3)) throw new Error('Ilość musi być dodatnia');
    if (!this.maPaliwo()) throw new Error('W układzie przelotowym nie ma paliwa');
    if (this.stan.paliwo + m3 > this.bak() + EPS) throw new Error('Bak nie pomieści tyle paliwa');
    const w = this.wezel();
    const wyc = this.wycenaPaliwa(m3);
    if (wyc.kwotaKr > this.stan.kr) throw new Error('Brak gotówki');
    this.stan.kr -= wyc.kwotaKr;
    this.okres.deltaKr -= wyc.kwotaKr;
    this.stan.paliwo = Math.min(this.bak(), this.stan.paliwo + m3);
    // Paliwo jest zawsze dostępne: przy pustym zapasie planeta sprzedaje po cenie maksymalnej z wzoru.
    if (w.typ === 'planeta') {
      const poz = this.stan.rynki[w.id].Fuel;
      poz.zapas = Math.max(0, poz.zapas - m3);
    }
    this.okres.paliwoKupioneM3 += m3;
    this.okres.paliwoKosztKr += wyc.kwotaKr;
    return { m3, kwotaKr: wyc.kwotaKr };
  }

  zatrudnij(idKandydata: string): Zalogant {
    const i = this.stan.kandydaci.findIndex((k) => k.id === idKandydata);
    if (i < 0) throw new Error('Nie ma takiego kandydata');
    if (this.stan.zaloga.length >= this.miejscaZalogi()) throw new Error('Brak wolnych miejsc w załodze');
    const [z] = this.stan.kandydaci.splice(i, 1);
    this.stan.zaloga.push(z);
    return z;
  }

  zwolnij(idZaloganta: string): Zalogant {
    const i = this.stan.zaloga.findIndex((z) => z.id === idZaloganta);
    if (i < 0) throw new Error('Nie ma takiego załoganta');
    const [z] = this.stan.zaloga.splice(i, 1);
    return z;
  }

  // ---------- Lot ----------

  sprawdzTrase(trasa: string[]): { dystans: number; doby: number; paliwo: number; blad?: string } {
    const ef = this.efekty();
    try {
      if (trasa.length < 2) return { dystans: 0, doby: 0, paliwo: 0, blad: 'Wybierz cel na mapie' };
      if (this.statek().wLocie) return { dystans: 0, doby: 0, paliwo: 0, blad: 'Statek jest w locie' };
      if (trasa[0] !== this.stan.pozycja) return { dystans: 0, doby: 0, paliwo: 0, blad: 'Trasa musi zaczynać się tutaj' };
      const dystans = this.graf.dlugoscTrasy(trasa);
      const l = this.obliczLot(dystans);
      const paliwo = l.paliwo;
      const doby = l.doby;
      if (paliwo > this.stan.paliwo + EPS) return { dystans, doby, paliwo, blad: 'Za mało paliwa na tę trasę' };
      const place = Math.round(ef.placeNaDobe * doby);
      if (place > this.stan.kr) return { dystans, doby, paliwo, blad: `Za mało gotówki na płace załogi w locie (${place} kr)` };
      if (this.stan.koniec) return { dystans, doby, paliwo, blad: 'Gra zakończona' };
      return { dystans, doby, paliwo };
    } catch (e) {
      return { dystans: 0, doby: 0, paliwo: 0, blad: (e as Error).message };
    }
  }

  /**
   * Lot statku aktywnego: start (paliwo i płace schodzą od razu, lot jest zaplanowany), a potem świat przewija się
   * do przylotu tego statku, dokując po drodze inne statki, które przylatują wcześniej. Zwraca raport z tego lotu.
   */
  lec(trasa: string[]): Raport {
    const i = this.stan.aktywny;
    this.wystartuj(trasa);
    this.przewinDo(this.stan.statki[i].wLocie!.przylot);
    this.stan.aktywny = i;
    return this.ostatnieRaporty[i]!;
  }

  /** Start lotu statku aktywnego bez przewijania czasu (pętla floty: `nastepnyPrzylot` dokuje statki po kolei). */
  wystartuj(trasa: string[]): void {
    const s = this.sprawdzTrase(trasa);
    if (s.blad) throw new Error(s.blad);
    const ef = this.efekty();
    const statek = this.statek();
    const z = this.stan.pozycja;
    const l = this.obliczLot(s.dystans);
    this.zapiszOdczyt(z);
    // Paliwo i płace schodzą na starcie (płace za czas lotu).
    const place = zaokr(ef.placeNaDobe * l.doby);
    const placeNominalne = zaokr(ef.placeNaDobe * l.dobyNominalne);
    this.stan.kr -= place;
    this.okres.deltaKr -= place;
    statek.paliwo = Math.max(0, statek.paliwo - l.paliwo);
    statek.wLocie = {
      trasa: [...trasa],
      dystans: s.dystans,
      dobaStart: this.stan.doba,
      przylot: this.stan.doba + l.doby,
      doby: l.doby,
      dobyNominalne: l.dobyNominalne,
      paliwoZuzyteM3: l.paliwo,
      bezZalogiM3: l.bezZalogi,
      poNawigatorzeM3: l.poNawigatorze,
      placeKr: place,
      placeNominalneKr: placeNominalne,
      cenaOdniesieniaKr: this.cenaPaliwaTutaj(),
      predkoscStart: l.predkoscStart,
      predkoscMeta: l.predkoscMeta,
    };
  }

  /** Najbliższy zaplanowany przylot (doba) albo null, gdy żaden statek nie leci. */
  nastepnyPrzylotDoba(): number | null {
    let min: number | null = null;
    for (const s of this.stan.statki) if (s.wLocie && (min === null || s.wLocie.przylot < min)) min = s.wLocie.przylot;
    return min;
  }

  /**
   * Przewija świat do najbliższego przylotu, dokuje ten statek (staje się aktywny) i zwraca jego raport;
   * null, gdy żaden statek nie leci. Przy remisie dokuje statek o niższym numerze.
   */
  nastepnyPrzylot(): Raport | null {
    const doba = this.nastepnyPrzylotDoba();
    if (doba === null) return null;
    const i = this.stan.statki.find((s) => s.wLocie && s.wLocie.przylot <= doba + EPS)!.id;
    this.przewinDo(doba, i);
    this.stan.aktywny = i;
    return this.ostatnieRaporty[i];
  }

  /** Czeka w doku `doby` dób (czas płynie: rynki żyją, inne statki przylatują). */
  czekaj(doby: number): void {
    if (!(doby > 0)) return;
    const i = this.stan.aktywny;
    this.przewinDo(this.stan.doba + doby);
    this.stan.aktywny = i;
  }

  /**
   * Przewija czas świata do `doDoby`: rynki żyją, statki przylatujące po drodze dokują (w kolejności przylotu; przy remisie
   * `pierwszy` albo niższy numer), a na końcu dokują statki z przylotem dokładnie w `doDoby`.
   */
  private przewinDo(doDoby: number, pierwszy: number | null = null): void {
    for (;;) {
      let najblizszy: Statek | null = null;
      for (const s of this.stan.statki) {
        if (!s.wLocie || s.wLocie.przylot > doDoby + EPS) continue;
        if (!najblizszy || s.wLocie.przylot < najblizszy.wLocie!.przylot - EPS || (Math.abs(s.wLocie.przylot - najblizszy.wLocie!.przylot) <= EPS && s.id === pierwszy)) najblizszy = s;
      }
      if (!najblizszy) break;
      this.uplywCzasu(najblizszy.wLocie!.przylot - this.stan.doba);
      this.przylot(najblizszy.id);
    }
    this.uplywCzasu(doDoby - this.stan.doba);
  }

  /** Upływ dt dób bez zdarzeń statków: rynki, gotowość cywilizacji (runda 3). */
  private uplywCzasu(dt: number): void {
    if (!(dt > EPS)) return;
    for (const rynek of Object.values(this.stan.rynki)) {
      for (const t of TOWARY_I_PALIWO) krokRynku(rynek[t], dt);
    }
    this.stan.doba += dt;
    this.poUplywieCzasu(dt);
  }

  /** Przylot statku `i`: pamięć zakupu, XP, dokowanie, raport (linie sumują się do przepływów gotówki statku w okresie). */
  private przylot(i: number): void {
    const poprzedni = this.stan.aktywny;
    this.stan.aktywny = i;
    const statek = this.statek();
    const w = statek.wLocie!;
    const okres = this.okres;
    const ef = this.efekty();
    const z = w.trasa[0];
    const cel = w.trasa[w.trasa.length - 1];
    const stanPrzed = { saldo: okres.saldoNaStarcie, wartosc: okres.wartoscNaStarcie };
    const skoki = w.trasa.length - 1;
    statek.skoki += skoki;
    // Pamięć zakupu statku: każdy wykonany skok zmniejsza liczniki o 1 (runda 3 liczy z pamięci floty).
    for (const klucz of Object.keys(statek.pamiecZakupu)) {
      const nowy = statek.pamiecZakupu[klucz] - skoki;
      if (nowy > 0) statek.pamiecZakupu[klucz] = nowy;
      else delete statek.pamiecZakupu[klucz];
    }
    // XP załogi za doby lotu (efekty tego lotu liczyły się przy starej umiejętności).
    this.dodajXP(P.progresja.xpNaDobeLotu * w.doby);
    statek.wLocie = null;
    statek.pozycja = cel;
    statek.numerLotu += 1;
    const kontakt = this.zadokuj();
    if (kontakt) this.dodajXP(P.progresja.xpZaKontakt);
    this.sprawdzPoziomFirmy();
    this.stan.koniec = this.stan.doba >= this.limitDob - EPS;

    const zuzyte = w.paliwoZuzyteM3;
    const bezZalogi = w.bezZalogiM3;
    const oszczNaw = bezZalogi - w.poNawigatorzeM3;
    const oszczSyn = w.poNawigatorzeM3 - (this.runda3 ? this.obliczLotBezPilota(w) : zuzyte);
    const cenaOdniesienia = w.cenaOdniesieniaKr;
    const place = w.placeKr;
    const placeNominalne = w.placeNominalneKr;
    const sprzedaze = okres.transakcje.filter((t) => t.rodzaj === 'sprzedaz');
    const zakupy = okres.transakcje.filter((t) => t.rodzaj === 'kupno');
    const sprzedazBaza = sprzedaze.reduce((a, t) => a + t.kwotaBezKaryKr, 0);
    const karaOdsprzedazy = sprzedaze.reduce((a, t) => a + (t.kwotaBezKaryKr - t.kwotaBezHandlowcaKr), 0);
    const sprzedazHandlowiec = sprzedaze.reduce((a, t) => a + (t.kwotaKr - t.kwotaBezHandlowcaKr), 0);
    const zakupBaza = zakupy.reduce((a, t) => a + t.kwotaBezHandlowcaKr, 0);
    const zakupHandlowiec = zakupy.reduce((a, t) => a + (t.kwotaBezHandlowcaKr - t.kwotaKr), 0);
    const oszczNawKr = zaokr(oszczNaw * cenaOdniesienia);
    const oszczSynKr = zaokr(oszczSyn * cenaOdniesienia);
    const paliwoKupione = okres.paliwoKosztKr;
    const pilotKr = placeNominalne - place;
    const nazwaZ = this.wezel(z).nazwa;

    const linie: LiniaRaportu[] = [];
    linie.push({ klucz: 'sprzedaz', etykieta: `Sprzedaż towarów w ${nazwaZ} (ceny bez handlowca${karaOdsprzedazy !== 0 ? ' i bez kary' : ''})`, kr: sprzedazBaza });
    if (karaOdsprzedazy !== 0) linie.push({ klucz: 'kara_odsprzedazy', etykieta: 'Kara za odsprzedaż w miejscu zakupu', kr: -karaOdsprzedazy, opis: `pamięć zakupu: ${Math.round(K.tradeSpread * 100)}% ceny, dopóki od zakupu nie minie ${P.pamiecZakupuSkokow} skoków` });
    if (ef.najlepszy.handlowiec || sprzedazHandlowiec !== 0) linie.push({ klucz: 'handlowiec_sprzedaz', etykieta: 'Handlowiec: lepsze ceny sprzedaży', kr: sprzedazHandlowiec, opis: `pozycja w oknie spreadu ${Math.round(ef.udzialHandlowca * 100)}%` });
    linie.push({ klucz: 'zakup', etykieta: `Zakup towarów w ${nazwaZ} (ceny bez handlowca)`, kr: -zakupBaza });
    if (ef.najlepszy.handlowiec || zakupHandlowiec !== 0) linie.push({ klucz: 'handlowiec_zakup', etykieta: 'Handlowiec: niższe ceny zakupu', kr: zakupHandlowiec });
    linie.push({
      klucz: 'paliwo',
      etykieta: `Paliwo: zakup w doku${ef.najlepszy.nawigator || ef.synergia ? ' + zużycie, które załoga zaoszczędziła' : ''}`,
      kr: -(paliwoKupione + oszczNawKr + oszczSynKr),
      opis: `kupiono ${okres.paliwoKupioneM3.toFixed(1)} m³, zużyto w locie ${zuzyte.toFixed(1)} m³ (bez załogi ${bezZalogi.toFixed(1)} m³)`,
    });
    if (ef.najlepszy.nawigator) linie.push({ klucz: 'nawigator', etykieta: `Nawigator: paliwo zaoszczędzone (${oszczNaw.toFixed(1)} m³)`, kr: oszczNawKr, opis: `mnożnik zużycia ${ef.mnoznikNawigatora.toFixed(3)}` });
    if (ef.synergia) linie.push({ klucz: 'synergia', etykieta: `Synergia „trasa zgrana” (${oszczSyn.toFixed(1)} m³)`, kr: oszczSynKr, opis: 'pilot i nawigator z tej samej cywilizacji' });
    linie.push({ klucz: 'place', etykieta: `Płace załogi za ${w.dobyNominalne.toFixed(1)} doby przy prędkości nominalnej`, kr: -placeNominalne, opis: `${ef.placeNaDobe} kr/dobę` });
    if (ef.najlepszy.pilot) linie.push({ klucz: 'pilot', etykieta: `Pilot: lot ${w.doby < w.dobyNominalne ? 'krótszy' : 'dłuższy'} o ${Math.abs(w.dobyNominalne - w.doby).toFixed(1)} doby`, kr: pilotKr, opis: `prędkość ${(this.runda3 ? w.predkoscStart : ef.predkosc).toFixed(2)} pc/dobę` });
    if (okres.kadlub) linie.push({ klucz: 'stocznia', etykieta: `Stocznia: kadłub szczebla ${okres.kadlub.szczebel}`, kr: -okres.kadlub.kwotaKr, opis: `ładownia ${Math.round(this.ladownia())} m³, bak ${Math.round(this.bak())} m³` });
    if (okres.nowyStatek) linie.push({ klucz: 'nowy_statek', etykieta: `Stocznia: nowy statek (${this.stan.statki[okres.nowyStatek.id].nazwa})`, kr: -okres.nowyStatek.kwotaKr, opis: `poziom firmy ${this.stan.poziomFirmy}: do ${this.limitStatkow()} statków` });
    for (const a of okres.awanse) linie.push({ klucz: 'awans', etykieta: `Awans cywilizacji ${a.nazwa} na tier ${a.tier}`, kr: 0, opis: this.runda3 ? `kontrakt rozwojowy tieru ${a.tier} dostarczony do akademii z naukowcem` : `dostarczony koszyk tieru ${a.tier}: popyt portów na towary koszyka × ${P.progresja.mnoznikKonsumpcjiAwansu}` });
    if (kontakt) linie.push({ klucz: 'kontakt', etykieta: `Kontakt z cywilizacją ${kontakt.nazwa}`, kr: 0, opis: kontakt.opis });

    const zmianaSalda = linie.reduce((a, l) => a + l.kr, 0);
    if (zmianaSalda !== okres.deltaKr) {
      throw new Error(`Raport nie sumuje się do przepływów statku: ${zmianaSalda} vs ${okres.deltaKr}`);
    }

    const wynikHandlowy: WynikHandlowy[] = [];
    for (const t of TOWARY) {
      const moje = sprzedaze.filter((x) => x.towar === t);
      if (moje.length === 0) continue;
      const przychod = moje.reduce((a, x) => a + x.kwotaKr, 0);
      const koszt = moje.reduce((a, x) => a + (x.kosztZakupuKr ?? 0), 0);
      wynikHandlowy.push({ towar: t, m3: moje.reduce((a, x) => a + x.m3, 0), przychodKr: przychod, kosztZakupuKr: koszt, zyskKr: przychod - koszt });
    }

    const raport: Raport = {
      numerLotu: statek.numerLotu,
      z,
      do: cel,
      trasa: [...w.trasa],
      dystansPc: w.dystans,
      doby: w.doby,
      dobyNominalne: w.dobyNominalne,
      dobaStart: w.dobaStart,
      dobaKoniec: this.stan.doba,
      linie,
      zmianaSalda,
      saldoPrzed: stanPrzed.saldo,
      saldoPo: stanPrzed.saldo + zmianaSalda,
      wartoscPrzed: stanPrzed.wartosc,
      wartoscPo: this.wartoscFirmy(),
      transakcje: [...okres.transakcje],
      wynikHandlowy,
      paliwo: {
        kupionoM3: okres.paliwoKupioneM3,
        kosztZakupuKr: paliwoKupione,
        zuzytoM3: zuzyte,
        bezZalogiM3: bezZalogi,
        oszczednoscNawigatoraM3: oszczNaw,
        oszczednoscSynergiiM3: oszczSyn,
        cenaOdniesieniaKr: cenaOdniesienia,
        wBakuPo: statek.paliwo,
      },
      zaloga: {
        placeNaDobe: ef.placeNaDobe,
        predkosc: this.runda3 ? w.predkoscStart : ef.predkosc,
        mnoznikPaliwa: ef.mnoznikPaliwa,
        udzialHandlowca: ef.udzialHandlowca,
        synergia: ef.synergia,
        sklad: statek.zaloga.map((x) => ({ ...x })),
      },
      kontakt,
      awanse: okres.awanse.length ? [...okres.awanse] : undefined,
      kadlub: okres.kadlub ?? undefined,
      statek: this.runda3 ? statek.id : undefined,
      predkoscStart: this.runda3 ? w.predkoscStart : undefined,
      predkoscMeta: this.runda3 ? w.predkoscMeta : undefined,
      koniecGry: this.stan.koniec,
    };
    this.stan.raporty.push(raport);
    this.ostatnieRaporty[i] = raport;
    this.stan.aktywny = poprzedni;
  }

  /** Paliwo lotu bez pilota, ale z nawigatorem i synergią (do linii synergii w rundzie 3, gdzie pilot zmienia też spalanie). */
  private obliczLotBezPilota(w: { dystans: number; paliwoZuzyteM3: number }): number {
    // Masa startowa odtworzona: paliwo na starcie = paliwo teraz + zużyte (statek już przyleciał).
    const statek = this.statek();
    const l = lot(w.dystans, this.parametryLotu(statek.zaloga, statek.paliwo + w.paliwoZuzyteM3, 0, false, true, true));
    return l.paliwoM3;
  }

  // ---------- Pomocnicze ----------

  private nowyOkres(): Okres {
    return { transakcje: [], paliwoKupioneM3: 0, paliwoKosztKr: 0, saldoNaStarcie: this.stan.kr, wartoscNaStarcie: this.wartoscFirmy(), deltaKr: 0, kadlub: null, nowyStatek: null, awanse: [] };
  }

  /** Zapamiętuje odczyt rynku odwiedzonej planety (tylko w trybie `zasieg`). */
  private zapiszOdczyt(idWezla: string): void {
    if (this.informacja !== 'zasieg') return;
    if (!this.rynekZnany(idWezla) || !(this.stan.wizyty[idWezla] > 0)) return;
    this.stan.odczyty[idWezla] = { doba: this.stan.doba, rynek: kopiaRynku(this.stan.rynki[idWezla]) };
  }

  /** Dokowanie: licznik wizyt, kontakt z nieznaną cywilizacją, odczyty w łączności, kandydaci do załogi. */
  private zadokuj(): Raport['kontakt'] | undefined {
    const w = this.wezel();
    this.stan.wizyty[w.id] = (this.stan.wizyty[w.id] ?? 0) + 1;
    let kontakt: Raport['kontakt'];
    if (w.typ === 'planeta' && w.cywilizacja && !this.stan.znaneCywilizacje[w.cywilizacja]) {
      this.stan.znaneCywilizacje[w.cywilizacja] = true;
      const cyw = this.cywilizacja(w.cywilizacja)!;
      for (const id of cyw.planety) {
        for (const t of TOWARY_I_PALIWO) {
          const poz = this.stan.rynki[id][t];
          if (poz.konsumpcjaUspiona > 0) {
            poz.konsumpcja = poz.konsumpcjaUspiona;
            poz.konsumpcjaUspiona = 0;
          }
        }
      }
      kontakt = {
        cywilizacja: cyw.id,
        nazwa: cyw.nazwa,
        opis: `Odsłonięto rynki ${cyw.planety.length} planet (stolica: ${this.wezel(cyw.stolica).nazwa}). Odblokowano ich popyt na ${P.nazwyTowarow.Electronics.toLowerCase()}.`,
      };
      const znanych = this.swiat.cywilizacje.filter((c) => this.stan.znaneCywilizacje[c.id]).length;
      this.kamien(`kontakt:${znanych}`);
      if (znanych >= this.swiat.cywilizacje.length) this.kamien('kontakt:wszystkie');
    }
    if (this.informacja === 'zasieg') {
      for (const inny of this.swiat.wezly) {
        if (inny.typ === 'planeta' && this.stan.wizyty[inny.id] > 0 && this.wLacznosci(inny.id)) this.zapiszOdczyt(inny.id);
      }
    }
    if (w.typ === 'planeta') {
      const rng = this.rng.odgalezienie(`kandydaci:${w.id}:${this.stan.wizyty[w.id]}`);
      this.stan.kandydaci = generujKandydatow(rng, this.swiat.cywilizacje.map((c) => c.id), P.liczbaKandydatow, `${w.id}-${this.stan.wizyty[w.id]}`, this.progresja);
    } else {
      this.stan.kandydaci = [];
    }
    this.okres = this.nowyOkres();
    return kontakt;
  }
}

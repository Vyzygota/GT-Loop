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
import { generujSwiat } from './swiat';
import { Graf } from './trasa';
import { efektyZalogi, generujKandydatow } from './zaloga';
import {
  TOWARY,
  TOWARY_I_PALIWO,
  type Ceny,
  type EfektyZalogi,
  type LiniaRaportu,
  type Osiagalny,
  type PozycjaLadowni,
  type Raport,
  type Rynek,
  type Swiat,
  type Towar,
  type Transakcja,
  type Wezel,
  type Wycena,
  type WynikHandlowy,
  type Zalogant,
} from './typy';

const EPS = 1e-9;

export interface Stan {
  doba: number;
  kr: number;
  paliwo: number;
  pozycja: string;
  ladownia: Record<Towar, PozycjaLadowni>;
  zaloga: Zalogant[];
  kandydaci: Zalogant[];
  rynki: Record<string, Rynek>;
  znaneCywilizacje: Record<string, boolean>;
  wizyty: Record<string, number>;
  numerLotu: number;
  koniec: boolean;
  raporty: Raport[];
}

interface Okres {
  transakcje: Transakcja[];
  paliwoKupioneM3: number;
  paliwoKosztKr: number;
  saldoNaStarcie: number;
  wartoscNaStarcie: number;
}

function zaokr(x: number): number {
  return Math.round(x);
}

/** Gra: czysta symulacja bez DOM. UI i bot wywołują wyłącznie jej metody. */
export class Gra {
  readonly swiat: Swiat;
  readonly graf: Graf;
  readonly stan: Stan;
  private okres!: Okres;
  private readonly rng: Losowosc;

  constructor(ziarno: string) {
    const { swiat, rynki } = generujSwiat(ziarno);
    this.swiat = swiat;
    this.graf = new Graf(swiat.wezly, swiat.krawedzie);
    this.rng = new Losowosc(ziarno);
    const ladownia = {} as Record<Towar, PozycjaLadowni>;
    for (const t of TOWARY) ladownia[t] = { m3: 0, kosztKr: 0 };
    const znane: Record<string, boolean> = {};
    for (const c of swiat.cywilizacje) znane[c.id] = c.znanaNaStarcie;
    this.stan = {
      doba: 0,
      kr: K.startingCredits,
      paliwo: K.bak,
      pozycja: swiat.startId,
      ladownia,
      zaloga: [],
      kandydaci: [],
      rynki,
      znaneCywilizacje: znane,
      wizyty: {},
      numerLotu: 0,
      koniec: false,
      raporty: [],
    };
    this.zadokuj();
  }

  // ---------- Odczyt świata ----------

  wezel(id: string = this.stan.pozycja): Wezel {
    const w = this.graf.wezly.get(id);
    if (!w) throw new Error(`Nieznany węzeł ${id}`);
    return w;
  }

  cywilizacjaZnana(idCyw: string | undefined): boolean {
    return !!idCyw && !!this.stan.znaneCywilizacje[idCyw];
  }

  rynekZnany(idWezla: string): boolean {
    const w = this.wezel(idWezla);
    return w.typ === 'planeta' && this.cywilizacjaZnana(w.cywilizacja);
  }

  efekty(zaloga: readonly Zalogant[] = this.stan.zaloga): EfektyZalogi {
    return efektyZalogi(zaloga);
  }

  /** Ceny jednostkowe towaru na znanej planecie (kr/m³) przy danym udziale handlowca. */
  ceny(idWezla: string, towar: Towar, udzial = this.efekty().udzialHandlowca): Ceny | null {
    if (!this.rynekZnany(idWezla)) return null;
    const poz = this.stan.rynki[idWezla][towar];
    const baza = cenaBazowaWU(K.towary[towar].basePrice, poz);
    const bilans = poz.produkcja - poz.konsumpcja;
    return {
      kupnoKr: kr(baza * mnoznikKupna(udzial)),
      sprzedazKr: kr(baza * mnoznikSprzedazy(udzial)),
      bazowaKr: kr(baza),
      nacisk: nacisk(poz.zapas / poz.norma),
      zapasM3: poz.zapas,
      normaM3: poz.norma,
      zapasDoby: poz.konsumpcja > 0 ? poz.zapas / poz.konsumpcja : Infinity,
      bilansNaDobe: bilans,
    };
  }

  /** Cena jednostkowa paliwa w węźle (kr/m³). */
  cenaPaliwa(idWezla: string = this.stan.pozycja): number {
    const w = this.wezel(idWezla);
    if (w.typ === 'tankowanie') return kr(K.towary.Fuel.basePrice);
    return kr(cenaBazowaWU(K.towary.Fuel.basePrice, this.stan.rynki[idWezla].Fuel));
  }

  // ---------- Wyceny (bez mutacji) ----------

  private wycenaNaPlanecie(idWezla: string, towar: Towar, m3: number, rodzaj: 'kupno' | 'sprzedaz', udzial: number, rynek = this.stan.rynki[idWezla][towar]): Wycena {
    const base = K.towary[towar].basePrice;
    const znak = rodzaj === 'kupno' ? -1 : 1;
    const po = { ...rynek, zapas: rynek.zapas + znak * m3 };
    const kwotaWU = rodzaj === 'kupno' ? kwotaKupnaWU(base, rynek, m3, udzial) : kwotaSprzedazyWU(base, rynek, m3, udzial);
    const kwotaBezWU = rodzaj === 'kupno' ? kwotaKupnaWU(base, rynek, m3, 0) : kwotaSprzedazyWU(base, rynek, m3, 0);
    const mn = rodzaj === 'kupno' ? mnoznikKupna(udzial) : mnoznikSprzedazy(udzial);
    const kwotaKr = zaokr(kr(kwotaWU));
    return {
      m3,
      kwotaKr,
      cenaSredniaKr: m3 > 0 ? kwotaKr / m3 : 0,
      cenaJednPrzedKr: kr(cenaBazowaWU(base, rynek) * mn),
      cenaJednPoKr: kr(cenaBazowaWU(base, po) * mn),
      naciskPrzed: nacisk(rynek.zapas / rynek.norma),
      naciskPo: nacisk(po.zapas / po.norma),
      kwotaBezHandlowcaKr: zaokr(kr(kwotaBezWU)),
    };
  }

  wycenaKupna(towar: Towar, m3: number, idWezla = this.stan.pozycja, udzial = this.efekty().udzialHandlowca): Wycena {
    if (!this.rynekZnany(idWezla)) throw new Error('Rynek nieznany');
    return this.wycenaNaPlanecie(idWezla, towar, m3, 'kupno', udzial);
  }

  wycenaSprzedazy(towar: Towar, m3: number, idWezla = this.stan.pozycja, udzial = this.efekty().udzialHandlowca): Wycena {
    if (!this.rynekZnany(idWezla)) throw new Error('Rynek nieznany');
    return this.wycenaNaPlanecie(idWezla, towar, m3, 'sprzedaz', udzial);
  }

  /** Wycena sprzedaży na znanej planecie za `doby` dób (zapas rzutowany w przód). */
  wycenaSprzedazyZa(towar: Towar, m3: number, idWezla: string, doby: number, udzial = this.efekty().udzialHandlowca): Wycena {
    if (!this.rynekZnany(idWezla)) throw new Error('Rynek nieznany');
    const rynek = zapasPo(this.stan.rynki[idWezla][towar], doby);
    return this.wycenaNaPlanecie(idWezla, towar, m3, 'sprzedaz', udzial, rynek);
  }

  wycenaPaliwa(m3: number, idWezla = this.stan.pozycja): { m3: number; kwotaKr: number; cenaSredniaKr: number } {
    const w = this.wezel(idWezla);
    const kwotaWU = w.typ === 'tankowanie' ? K.towary.Fuel.basePrice * m3 : kwotaPaliwaWU(this.stan.rynki[idWezla].Fuel, m3);
    const kwotaKr = zaokr(kr(kwotaWU));
    return { m3, kwotaKr, cenaSredniaKr: m3 > 0 ? kwotaKr / m3 : 0 };
  }

  objetoscZajeta(): number {
    return TOWARY.reduce((s, t) => s + this.stan.ladownia[t].m3, 0);
  }

  masaZajeta(): number {
    return TOWARY.reduce((s, t) => s + this.stan.ladownia[t].m3 * K.towary[t].gestosc, 0);
  }

  /** Największa ilość towaru, jaką da się tu kupić: zapas, objętość, masa i gotówka. */
  maxKupno(towar: Towar, gotowka = this.stan.kr, idWezla = this.stan.pozycja, udzial = this.efekty().udzialHandlowca): number {
    if (!this.rynekZnany(idWezla)) return 0;
    const poz = this.stan.rynki[idWezla][towar];
    const g = K.towary[towar].gestosc;
    let hi = Math.min(poz.zapas, K.ladownia - this.objetoscZajeta(), (K.maxMasaLadunku - this.masaZajeta()) / g);
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
    let hi = Math.max(0, K.bak - this.stan.paliwo);
    if (this.wycenaPaliwa(hi).kwotaKr <= gotowka) return hi;
    let lo = 0;
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2;
      if (this.wycenaPaliwa(mid).kwotaKr <= gotowka) lo = mid;
      else hi = mid;
    }
    return lo;
  }

  potrzebnePaliwo(dystansPc: number, zaloga: readonly Zalogant[] = this.stan.zaloga): number {
    return dystansPc * K.kosztPaliwaNaParsek * this.efekty(zaloga).mnoznikPaliwa;
  }

  /** Węzły osiągalne z bieżącej pozycji na obecnym paliwie, najkrótszą ścieżką. */
  zasieg(paliwo = this.stan.paliwo, zaloga: readonly Zalogant[] = this.stan.zaloga): Map<string, Osiagalny> {
    const d = this.graf.dijkstra(this.stan.pozycja);
    const wynik = new Map<string, Osiagalny>();
    for (const [id, w] of d) {
      const potrzebne = this.potrzebnePaliwo(w.dystans, zaloga);
      if (potrzebne <= paliwo + EPS) {
        wynik.set(id, { id, dystans: w.dystans, paliwo: potrzebne, sciezka: this.graf.najkrotszaSciezka(this.stan.pozycja, id)! });
      }
    }
    return wynik;
  }

  /** Wartość firmy = kr + ładunek po cenie sprzedaży w bieżącym doku (w punkcie plemion: po koszcie zakupu). */
  wartoscFirmy(): number {
    return this.stan.kr + this.wartoscLadowni();
  }

  wartoscLadowni(): number {
    const tu = this.stan.pozycja;
    let suma = 0;
    for (const t of TOWARY) {
      const poz = this.stan.ladownia[t];
      if (poz.m3 <= 0) continue;
      suma += this.rynekZnany(tu) ? this.wycenaSprzedazy(t, poz.m3).kwotaKr : zaokr(poz.kosztKr);
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
    if (m3 > poz.zapas + EPS) throw new Error('Planeta nie ma tyle w zapasie');
    if (this.objetoscZajeta() + m3 > K.ladownia + EPS) throw new Error('Brak miejsca w ładowni');
    if (this.masaZajeta() + m3 * K.towary[towar].gestosc > K.maxMasaLadunku + EPS) throw new Error('Przekroczona masa ładunku');
    const w = this.wycenaKupna(towar, m3);
    if (w.kwotaKr > this.stan.kr) throw new Error('Brak gotówki');
    this.stan.kr -= w.kwotaKr;
    poz.zapas -= m3;
    const l = this.stan.ladownia[towar];
    l.m3 += m3;
    l.kosztKr += w.kwotaKr;
    const t: Transakcja = {
      rodzaj: 'kupno',
      planeta: tu,
      towar,
      m3,
      kwotaKr: w.kwotaKr,
      kwotaBezHandlowcaKr: w.kwotaBezHandlowcaKr,
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
    m3 = Math.min(m3, l.m3);
    const w = this.wycenaSprzedazy(towar, m3);
    const kosztZakupu = zaokr((l.kosztKr * m3) / l.m3);
    this.stan.kr += w.kwotaKr;
    this.stan.rynki[tu][towar].zapas += m3;
    l.kosztKr -= kosztZakupu;
    l.m3 -= m3;
    if (l.m3 < EPS) {
      l.m3 = 0;
      l.kosztKr = 0;
    }
    const t: Transakcja = {
      rodzaj: 'sprzedaz',
      planeta: tu,
      towar,
      m3,
      kwotaKr: w.kwotaKr,
      kwotaBezHandlowcaKr: w.kwotaBezHandlowcaKr,
      cenaJednPrzedKr: w.cenaJednPrzedKr,
      cenaJednPoKr: w.cenaJednPoKr,
      naciskPrzed: w.naciskPrzed,
      naciskPo: w.naciskPo,
      kosztZakupuKr: kosztZakupu,
    };
    this.okres.transakcje.push(t);
    return t;
  }

  tankuj(m3: number): { m3: number; kwotaKr: number } {
    if (!(m3 > 0) || !Number.isFinite(m3)) throw new Error('Ilość musi być dodatnia');
    if (this.stan.paliwo + m3 > K.bak + EPS) throw new Error('Bak nie pomieści tyle paliwa');
    const w = this.wezel();
    const wyc = this.wycenaPaliwa(m3);
    if (wyc.kwotaKr > this.stan.kr) throw new Error('Brak gotówki');
    this.stan.kr -= wyc.kwotaKr;
    this.stan.paliwo = Math.min(K.bak, this.stan.paliwo + m3);
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
    if (this.stan.zaloga.length >= K.miejscaZalogi) throw new Error('Brak wolnych miejsc w załodze');
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
      if (trasa[0] !== this.stan.pozycja) return { dystans: 0, doby: 0, paliwo: 0, blad: 'Trasa musi zaczynać się tutaj' };
      const dystans = this.graf.dlugoscTrasy(trasa);
      const paliwo = this.potrzebnePaliwo(dystans);
      const doby = dystans / ef.predkosc;
      if (paliwo > this.stan.paliwo + EPS) return { dystans, doby, paliwo, blad: 'Za mało paliwa na tę trasę' };
      const place = Math.round(ef.placeNaDobe * doby);
      if (place > this.stan.kr) return { dystans, doby, paliwo, blad: `Za mało gotówki na płace załogi w locie (${place} kr)` };
      if (this.stan.koniec) return { dystans, doby, paliwo, blad: 'Gra zakończona' };
      return { dystans, doby, paliwo };
    } catch (e) {
      return { dystans: 0, doby: 0, paliwo: 0, blad: (e as Error).message };
    }
  }

  lec(trasa: string[]): Raport {
    const s = this.sprawdzTrase(trasa);
    if (s.blad) throw new Error(s.blad);
    const ef = this.efekty();
    const okres = this.okres;
    const stanPrzed = { saldo: okres.saldoNaStarcie, wartosc: okres.wartoscNaStarcie };
    const z = this.stan.pozycja;
    const cel = trasa[trasa.length - 1];
    const cenaOdniesienia = this.cenaPaliwa(z);

    // Paliwo: bez załogi, nawigator, synergia.
    const bezZalogi = s.dystans * K.kosztPaliwaNaParsek;
    const poNawigatorze = bezZalogi * ef.mnoznikNawigatora;
    const zuzyte = poNawigatorze * ef.mnoznikSynergii;
    const oszczNaw = bezZalogi - poNawigatorze;
    const oszczSyn = poNawigatorze - zuzyte;
    this.stan.paliwo = Math.max(0, this.stan.paliwo - zuzyte);

    // Czas i płace.
    const dobyNominalne = s.dystans / K.predkoscNominalna;
    const place = zaokr(ef.placeNaDobe * s.doby);
    const placeNominalne = zaokr(ef.placeNaDobe * dobyNominalne);
    this.stan.kr -= place;
    const dobaStart = this.stan.doba;
    this.stan.doba += s.doby;

    // Świat żyje.
    for (const rynek of Object.values(this.stan.rynki)) {
      for (const t of TOWARY_I_PALIWO) krokRynku(rynek[t], s.doby);
    }

    // Przylot, kontakt, nowi kandydaci.
    this.stan.pozycja = cel;
    this.stan.numerLotu += 1;
    const kontakt = this.zadokuj();
    this.stan.koniec = this.stan.doba >= P.dobyGry - EPS;

    // Raport: linie sumują się do zmiany salda.
    const sprzedaze = okres.transakcje.filter((t) => t.rodzaj === 'sprzedaz');
    const zakupy = okres.transakcje.filter((t) => t.rodzaj === 'kupno');
    const sprzedazBaza = sprzedaze.reduce((a, t) => a + t.kwotaBezHandlowcaKr, 0);
    const sprzedazHandlowiec = sprzedaze.reduce((a, t) => a + (t.kwotaKr - t.kwotaBezHandlowcaKr), 0);
    const zakupBaza = zakupy.reduce((a, t) => a + t.kwotaBezHandlowcaKr, 0);
    const zakupHandlowiec = zakupy.reduce((a, t) => a + (t.kwotaBezHandlowcaKr - t.kwotaKr), 0);
    const oszczNawKr = zaokr(oszczNaw * cenaOdniesienia);
    const oszczSynKr = zaokr(oszczSyn * cenaOdniesienia);
    const paliwoKupione = okres.paliwoKosztKr;
    const pilotKr = placeNominalne - place;
    const nazwaCelu = this.wezel(cel).nazwa;
    const nazwaZ = this.wezel(z).nazwa;

    const linie: LiniaRaportu[] = [];
    linie.push({ klucz: 'sprzedaz', etykieta: `Sprzedaż towarów w ${nazwaZ} (ceny bez handlowca)`, kr: sprzedazBaza });
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
    linie.push({ klucz: 'place', etykieta: `Płace załogi za ${dobyNominalne.toFixed(1)} doby przy prędkości nominalnej`, kr: -placeNominalne, opis: `${ef.placeNaDobe} kr/dobę` });
    if (ef.najlepszy.pilot) linie.push({ klucz: 'pilot', etykieta: `Pilot: lot ${s.doby < dobyNominalne ? 'krótszy' : 'dłuższy'} o ${Math.abs(dobyNominalne - s.doby).toFixed(1)} doby`, kr: pilotKr, opis: `prędkość ${ef.predkosc.toFixed(2)} pc/dobę` });
    if (kontakt) linie.push({ klucz: 'kontakt', etykieta: `Kontakt z cywilizacją ${kontakt.nazwa}`, kr: 0, opis: kontakt.opis });

    const zmianaSalda = linie.reduce((a, l) => a + l.kr, 0);
    if (zmianaSalda !== this.stan.kr - stanPrzed.saldo) {
      throw new Error(`Raport nie sumuje się do zmiany salda: ${zmianaSalda} vs ${this.stan.kr - stanPrzed.saldo}`);
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
      numerLotu: this.stan.numerLotu,
      z,
      do: cel,
      trasa: [...trasa],
      dystansPc: s.dystans,
      doby: s.doby,
      dobyNominalne,
      dobaStart,
      dobaKoniec: this.stan.doba,
      linie,
      zmianaSalda,
      saldoPrzed: stanPrzed.saldo,
      saldoPo: this.stan.kr,
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
        wBakuPo: this.stan.paliwo,
      },
      zaloga: {
        placeNaDobe: ef.placeNaDobe,
        predkosc: ef.predkosc,
        mnoznikPaliwa: ef.mnoznikPaliwa,
        udzialHandlowca: ef.udzialHandlowca,
        synergia: ef.synergia,
        sklad: this.stan.zaloga.map((x) => ({ ...x })),
      },
      kontakt,
      koniecGry: this.stan.koniec,
    };
    void nazwaCelu;
    this.stan.raporty.push(raport);
    return raport;
  }

  // ---------- Pomocnicze ----------

  private nowyOkres(): Okres {
    return { transakcje: [], paliwoKupioneM3: 0, paliwoKosztKr: 0, saldoNaStarcie: this.stan.kr, wartoscNaStarcie: this.wartoscFirmy() };
  }

  /** Dokowanie: licznik wizyt, kontakt z nieznaną cywilizacją, kandydaci do załogi. */
  private zadokuj(): Raport['kontakt'] | undefined {
    const w = this.wezel();
    this.stan.wizyty[w.id] = (this.stan.wizyty[w.id] ?? 0) + 1;
    let kontakt: Raport['kontakt'];
    if (w.typ === 'planeta' && w.cywilizacja && !this.stan.znaneCywilizacje[w.cywilizacja]) {
      this.stan.znaneCywilizacje[w.cywilizacja] = true;
      const cyw = this.swiat.cywilizacje.find((c) => c.id === w.cywilizacja)!;
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
        opis: `Odsłonięto rynki planet: ${cyw.planety.map((id) => this.wezel(id).nazwa).join(', ')}. Odblokowano ich popyt na ${P.nazwyTowarow.Electronics.toLowerCase()}.`,
      };
    }
    if (w.typ === 'planeta') {
      const rng = this.rng.odgalezienie(`kandydaci:${w.id}:${this.stan.wizyty[w.id]}`);
      this.stan.kandydaci = generujKandydatow(rng, this.swiat.cywilizacje.map((c) => c.id), P.liczbaKandydatow, `${w.id}-${this.stan.wizyty[w.id]}`);
    } else {
      this.stan.kandydaci = [];
    }
    this.okres = this.nowyOkres();
    return kontakt;
  }
}

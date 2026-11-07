import { K, P } from './stale';
import type { WariantPaliwa } from './typy';

/**
 * Lot z hierarchii ciągu (kanon, werdykty 08.09 i 23.09): ciąg → masa → prędkość → paliwo.
 * Prędkość v = predkoscBazowa × (ciąg / masa) ÷ stalaPredkosci × pilot; masa maleje w locie o spalone paliwo (1 t/m³),
 * więc statek przyspiesza. Obie wersje paliwa mają postać zamkniętą, liczoną ciągle (dokładniej niż krok co skok).
 */

export interface ParametryLotu {
  /** Masa na starcie lotu: kadłub + moduły + paliwo + ładunek (t). */
  masaStartT: number;
  ciagTf: number;
  /** Mnożnik umiejętności pilota (1 = brak pilota). */
  pilot: number;
  /** Mnożnik zużycia paliwa z nawigatora i synergii (1 = brak). */
  mnoznikPaliwa: number;
  wariant: WariantPaliwa;
}

export interface WynikLotu {
  doby: number;
  paliwoM3: number;
  /** Prędkość na starcie i na mecie (pc/dobę). */
  predkoscStart: number;
  predkoscMeta: number;
}

/** Stała C = predkoscBazowa × ciąg ÷ stalaPredkosci (pc/dobę × t): prędkość = pilot × C / masa. */
export function stalaCiagu(ciagTf: number, pilot = 1): number {
  return (K.predkoscNominalna * ciagTf * pilot) / K.statek.stalaPredkosci;
}

export function predkoscPrzyMasie(masaT: number, ciagTf: number, pilot = 1): number {
  return stalaCiagu(ciagTf, pilot) / masaT;
}

/**
 * Lot na dystans d. Wariant R: spalanie b = 4 m³/dobę × mnożnik, dm/dt = −b, v = C/m ⇒
 * t = (m₀/b)(1 − e^(−b·d/C)), paliwo = b·t. Wariant D: dawka a = 1 m³/pc × mnożnik, masa maleje o a na pc ⇒
 * t = (m₀·d − a·d²/2)/C, paliwo = a·d. Gdy paliwa brakuje, wynik ma paliwoM3 > paliwo w baku (sprawdza wywołujący).
 */
export function lot(dystansPc: number, p: ParametryLotu): WynikLotu {
  const C = stalaCiagu(p.ciagTf, p.pilot);
  const m0 = p.masaStartT;
  if (!(dystansPc > 0)) return { doby: 0, paliwoM3: 0, predkoscStart: C / m0, predkoscMeta: C / m0 };
  if (p.wariant === 'R') {
    const b = K.statek.spalanieRM3NaDobe * p.mnoznikPaliwa;
    const doby = (m0 / b) * (1 - Math.exp((-b * dystansPc) / C));
    const paliwo = b * doby;
    return { doby, paliwoM3: paliwo, predkoscStart: C / m0, predkoscMeta: C / Math.max(1e-9, m0 - paliwo) };
  }
  const a = K.statek.dawkaDM3NaPc * p.mnoznikPaliwa;
  const paliwo = a * dystansPc;
  const doby = (m0 * dystansPc - (a * dystansPc * dystansPc) / 2) / C;
  return { doby, paliwoM3: paliwo, predkoscStart: C / m0, predkoscMeta: C / Math.max(1e-9, m0 - paliwo) };
}

/** Największy dystans, na jaki starczy `paliwoM3` (odwrotność `lot`). */
export function zasiegNaPaliwie(paliwoM3: number, p: ParametryLotu): number {
  if (!(paliwoM3 > 0)) return 0;
  const C = stalaCiagu(p.ciagTf, p.pilot);
  if (p.wariant === 'R') {
    const b = K.statek.spalanieRM3NaDobe * p.mnoznikPaliwa;
    const m0 = p.masaStartT;
    if (paliwoM3 >= m0) return Infinity;
    return (C / b) * Math.log(m0 / (m0 - paliwoM3));
  }
  return paliwoM3 / (K.statek.dawkaDM3NaPc * p.mnoznikPaliwa);
}

/** Zasięg przy stałej masie (liczby kontrolne kanonu: 100 / 78,4 / 24,8 pc na 100 m³ w wariancie R). */
export function zasiegPrzyStalejMasie(paliwoM3: number, p: ParametryLotu): number {
  const v = predkoscPrzyMasie(p.masaStartT, p.ciagTf, p.pilot);
  if (p.wariant === 'R') return (paliwoM3 / (K.statek.spalanieRM3NaDobe * p.mnoznikPaliwa)) * v;
  return paliwoM3 / (K.statek.dawkaDM3NaPc * p.mnoznikPaliwa);
}

// ---------- Kadłub, moduły, obsada ----------

export interface Konfiguracja {
  reaktory: number;
  ladownie: number;
}

export function konfiguracjaSzczebla(szczebel: number): Konfiguracja {
  const k = P.runda3.statek.konfiguracje;
  return k[Math.min(szczebel, k.length - 1)];
}

/** Masa konstrukcji kadłuba szczebla N: (jedynka − reaktor) × mnoznikKadluba^N. */
export function masaKonstrukcjiT(szczebel: number): number {
  return (K.statek.masaJedynkiSuchaT - P.runda3.statek.masaReaktoraT) * Math.pow(P.runda3.statek.mnoznikKadluba, szczebel);
}

/** Masa sucha: konstrukcja + reaktory + moduły ładowni. */
export function masaSuchaT(szczebel: number, konf: Konfiguracja): number {
  const S = P.runda3.statek;
  return masaKonstrukcjiT(szczebel) + konf.reaktory * S.masaReaktoraT + konf.ladownie * S.masaModuluLadowniT;
}

export function ciagTf(konf: Konfiguracja): number {
  return konf.reaktory * K.statek.dyszNaReaktor * K.statek.ciagDyszyTf;
}

export function ladowniaM3(konf: Konfiguracja): number {
  return konf.ladownie * P.runda3.statek.modulLadowniM3;
}

export function bakSzczeblaM3(szczebel: number): number {
  const b = P.runda3.statek.bakM3;
  return b[Math.min(szczebel, b.length - 1)];
}

/** Objętość wewnętrzna kadłuba szczebla N (do sprawdzenia, czy konfiguracja się mieści). */
export function objetoscKadlubaM3(szczebel: number): number {
  return P.runda3.statek.objetoscJedynkiM3 * Math.pow(P.runda3.statek.mnoznikKadluba, szczebel);
}

export function objetoscModulowM3(szczebel: number, konf: Konfiguracja): number {
  return konf.reaktory * K.statek.objetoscReaktoraM3 + ladowniaM3(konf) + bakSzczeblaM3(szczebel);
}

/** Obsada (założenie, werdykt 25.08 bez listy): kokpit 1 + 1 na reaktor + 1 na każde (rozpoczęte) 4 moduły ładowni. */
export function obsada(konf: Konfiguracja): number {
  const o = P.runda3.statek.obsada;
  return o.kokpit + konf.reaktory * o.naReaktor + Math.ceil(konf.ladownie / o.naModulyLadowni);
}

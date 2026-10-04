import { K } from './stale';
import type { PozycjaRynku } from './typy';
import { P } from './stale';

export function ogranicz(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

/** Nacisk cenowy z kanonu: clamp(max(zapas/norma, floor)^(−w), min, max). */
export function nacisk(stosunek: number): number {
  const r = Math.max(stosunek, K.StockRatioFloor);
  return ogranicz(Math.pow(r, -K.StockPriceWeight), K.StockPressureMin, K.StockPressureMax);
}

// Granice przedziałów, na których nacisk jest stały albo czysto potęgowy.
const W = K.StockPriceWeight;
const R_MAX = Math.pow(K.StockPressureMax, -1 / W); // poniżej: nacisk = max
const R_MIN = Math.pow(K.StockPressureMin, -1 / W); // powyżej: nacisk = min

/**
 * Całka ∫_{r0}^{r1} nacisk(r) dr w postaci zamkniętej (r0 ≤ r1).
 * Cena krańcowa: każdy kolejny m³ wyceniany jest przy zapasie, jaki jest w tej chwili,
 * więc duża transakcja sama sobie psuje cenę, a podział na części niczego nie zmienia.
 */
export function calkaNacisku(r0: number, r1: number): number {
  if (!(r1 > r0)) return 0;
  const punkty = [K.StockRatioFloor, R_MAX, R_MIN].filter((p) => p > r0 && p < r1).sort((a, b) => a - b);
  const granice = [r0, ...punkty, r1];
  let suma = 0;
  for (let i = 0; i + 1 < granice.length; i++) {
    const a = granice[i];
    const b = granice[i + 1];
    const srodek = (a + b) / 2;
    const potegowy = srodek >= K.StockRatioFloor && srodek > R_MAX && srodek < R_MIN;
    if (potegowy) {
      const e = 1 - W;
      suma += (Math.pow(b, e) - Math.pow(a, e)) / e;
    } else {
      suma += nacisk(srodek) * (b - a);
    }
  }
  return suma;
}

/**
 * Mnożnik okna spreadu przy kupnie przez gracza; udział ∈ [0,1) to pozycja handlowca.
 * `spread` to spread podstawowy wariantu (A: tradeSpread na każdej transakcji; B/D: 0; C: 0,10).
 */
export function mnoznikKupna(udzialHandlowca: number, spread = K.tradeSpread): number {
  return 1 + (spread / 2) * (1 - udzialHandlowca);
}

/** Mnożnik sprzedaży: okno spreadu podstawowego, a na to kara za odsprzedaż w miejscu zakupu (ułamek ceny). */
export function mnoznikSprzedazy(udzialHandlowca: number, spread = K.tradeSpread, kara = 0): number {
  return (1 - (spread / 2) * (1 - udzialHandlowca)) * (1 - kara);
}

export function cenaBazowaWU(basePrice: number, poz: PozycjaRynku): number {
  return basePrice * nacisk(poz.zapas / poz.norma);
}

/** Łączna kwota w WU za kupno m3 (zapas spada z z do z − m3). */
export function kwotaKupnaWU(basePrice: number, poz: PozycjaRynku, m3: number, udzial: number, spread = K.tradeSpread): number {
  const n = poz.norma;
  return basePrice * mnoznikKupna(udzial, spread) * n * calkaNacisku((poz.zapas - m3) / n, poz.zapas / n);
}

/** Łączna kwota w WU za sprzedaż m3 (zapas rośnie z z do z + m3). */
export function kwotaSprzedazyWU(basePrice: number, poz: PozycjaRynku, m3: number, udzial: number, spread = K.tradeSpread, kara = 0): number {
  const n = poz.norma;
  return basePrice * mnoznikSprzedazy(udzial, spread, kara) * n * calkaNacisku(poz.zapas / n, (poz.zapas + m3) / n);
}

/** Paliwo na planecie: BasePrice × nacisk, bez spreadu. */
export function kwotaPaliwaWU(poz: PozycjaRynku, m3: number): number {
  const n = poz.norma;
  return K.towary.Fuel.basePrice * n * calkaNacisku((poz.zapas - m3) / n, poz.zapas / n);
}

const EPS_CZASU = 1e-9;

/**
 * Dobowa wymiana NPC (m³/dobę): handlarze NPC ciągną zapas ku normie w tempie `tempoWymianyNPC`,
 * ale nie szybciej niż sufit = otwartość × dobowa konsumpcja × mnożnik. Otwartość 0 = brak wymiany (świat S).
 */
export function wymianaNPC(poz: PozycjaRynku): number {
  if (poz.otwartosc <= 0) return 0;
  const sufit = poz.otwartosc * poz.konsumpcja * P.galaktyka.mnoznikSufituNPC;
  const chec = P.galaktyka.tempoWymianyNPC * (poz.norma - poz.zapas);
  return ogranicz(chec, -sufit, sufit);
}

/** Sufit dobowej wymiany NPC dla pozycji (m³/dobę). */
export function sufitWymianyNPC(poz: PozycjaRynku): number {
  return poz.otwartosc * poz.konsumpcja * P.galaktyka.mnoznikSufituNPC;
}

/**
 * Upływ dt dób: produkcja dodaje, konsumpcja zabiera, zapas w [0, maxZapasWNormach × norma].
 * Bez wymiany NPC jedna aktualizacja liniowa (jak w świecie S); z wymianą NPC krok co najwyżej jednej doby,
 * bo wymiana zależy od bieżącego zapasu.
 */
export function krokRynku(poz: PozycjaRynku, dt: number): void {
  if (!(dt > 0)) return;
  const max = P.maxZapasWNormach * poz.norma;
  const bilans = poz.produkcja - poz.konsumpcja;
  if (poz.otwartosc <= 0) {
    poz.zapas = ogranicz(poz.zapas + bilans * dt, 0, max);
    return;
  }
  let pozostalo = dt;
  while (pozostalo > EPS_CZASU) {
    const krok = Math.min(1, pozostalo);
    poz.zapas = ogranicz(poz.zapas + (bilans + wymianaNPC(poz)) * krok, 0, max);
    pozostalo -= krok;
  }
}

/** Rzut zapasu w przód bez mutacji (do planowania). */
export function zapasPo(poz: PozycjaRynku, dt: number): PozycjaRynku {
  const kopia = { ...poz };
  krokRynku(kopia, dt);
  return kopia;
}

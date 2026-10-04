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

/** Mnożnik okna spreadu przy kupnie przez gracza; udział ∈ [0,1) to pozycja handlowca. */
export function mnoznikKupna(udzialHandlowca: number): number {
  return 1 + (K.tradeSpread / 2) * (1 - udzialHandlowca);
}

export function mnoznikSprzedazy(udzialHandlowca: number): number {
  return 1 - (K.tradeSpread / 2) * (1 - udzialHandlowca);
}

export function cenaBazowaWU(basePrice: number, poz: PozycjaRynku): number {
  return basePrice * nacisk(poz.zapas / poz.norma);
}

/** Łączna kwota w WU za kupno m3 (zapas spada z z do z − m3). */
export function kwotaKupnaWU(basePrice: number, poz: PozycjaRynku, m3: number, udzial: number): number {
  const n = poz.norma;
  return basePrice * mnoznikKupna(udzial) * n * calkaNacisku((poz.zapas - m3) / n, poz.zapas / n);
}

/** Łączna kwota w WU za sprzedaż m3 (zapas rośnie z z do z + m3). */
export function kwotaSprzedazyWU(basePrice: number, poz: PozycjaRynku, m3: number, udzial: number): number {
  const n = poz.norma;
  return basePrice * mnoznikSprzedazy(udzial) * n * calkaNacisku(poz.zapas / n, (poz.zapas + m3) / n);
}

/** Paliwo na planecie: BasePrice × nacisk, bez spreadu. */
export function kwotaPaliwaWU(poz: PozycjaRynku, m3: number): number {
  const n = poz.norma;
  return K.towary.Fuel.basePrice * n * calkaNacisku((poz.zapas - m3) / n, poz.zapas / n);
}

/** Upływ dt dób: produkcja dodaje, konsumpcja zabiera, zapas w [0, maxZapasWNormach × norma]. */
export function krokRynku(poz: PozycjaRynku, dt: number): void {
  const bilans = poz.produkcja - poz.konsumpcja;
  poz.zapas = ogranicz(poz.zapas + bilans * dt, 0, P.maxZapasWNormach * poz.norma);
}

/** Rzut zapasu w przód bez mutacji (do planowania). */
export function zapasPo(poz: PozycjaRynku, dt: number): PozycjaRynku {
  const kopia = { ...poz };
  krokRynku(kopia, dt);
  return kopia;
}

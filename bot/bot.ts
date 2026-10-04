import { K, P } from '../sim/index';
import { zagrajZiarno, type WynikZiarna } from './strategia';

function mediana(xs: number[]): number {
  if (xs.length === 0) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  const i = Math.floor(s.length / 2);
  return s.length % 2 ? s[i] : (s[i - 1] + s[i]) / 2;
}

function top(lista: string[], n: number): [string, number][] {
  const licznik = new Map<string, number>();
  for (const x of lista) licznik.set(x, (licznik.get(x) ?? 0) + 1);
  return [...licznik.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);
}

export function uruchomBota(liczba = P.bot.liczbaZiaren, pierwsze = P.bot.pierwszeZiarno): { wyniki: WynikZiarna[]; tekst: string } {
  const start = Date.now();
  const wyniki: WynikZiarna[] = [];
  for (let i = 0; i < liczba; i++) wyniki.push(zagrajZiarno(String(pierwsze + i)));
  const zZyskiem = wyniki.filter((w) => w.zysk).length;
  const podwoili = wyniki.filter((w) => w.wartoscKoncowa >= K.startingCredits * P.celMnoznikWartosci).length;
  const pierwsze_ = wyniki.map((w) => w.pierwszyZyskownyLot).filter((x): x is number => x !== null);
  const kontakt = wyniki.filter((w) => w.kontaktDoba !== null).length;
  const linie = [
    `Bot: ${liczba} ziaren × ${P.dobyGry} dób, strategia zachłanna (${((Date.now() - start) / 1000).toFixed(1)} s)`,
    `Ziarna z zyskiem (wartość końcowa > start): ${((100 * zZyskiem) / liczba).toFixed(1)}%`,
    `Ziarna z podwojeniem wartości: ${((100 * podwoili) / liczba).toFixed(1)}%`,
    `Mediana lotów do pierwszej zyskownej trasy: ${mediana(pierwsze_)} (brak zyskownej trasy w ${liczba - pierwsze_.length} ziarnach)`,
    `Mediana wartości firmy na koniec: ${Math.round(mediana(wyniki.map((w) => w.wartoscKoncowa))).toLocaleString('pl-PL')} kr (start ${K.startingCredits.toLocaleString('pl-PL')} kr)`,
    `Mediana liczby lotów: ${mediana(wyniki.map((w) => w.loty))}; kontakt z nieznaną cywilizacją w ${kontakt} ziarnach`,
    `Najczęstsze trasy:`,
    ...top(wyniki.flatMap((w) => w.trasy), P.bot.topN).map(([t, n]) => `  ${n.toString().padStart(5)} × ${t}`),
    `Najczęstsze towary (jako ładunek lotu):`,
    ...top(wyniki.flatMap((w) => w.towary), P.bot.topN).map(([t, n]) => `  ${n.toString().padStart(5)} × ${P.nazwyTowarow[t as keyof typeof P.nazwyTowarow]}`),
  ];
  return { wyniki, tekst: linie.join('\n') };
}

const uruchomionyBezposrednio = process.argv[1] && /bot\.ts$|bot\.js$/.test(process.argv[1]);
if (uruchomionyBezposrednio) {
  const liczba = process.argv[2] ? Number(process.argv[2]) : undefined;
  console.log(uruchomBota(liczba).tekst);
}

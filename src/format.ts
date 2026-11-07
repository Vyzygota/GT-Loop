import { P, type Rola, type TowarLubPaliwo } from '../sim/index';

const krFmt = new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 0 });
const ulamekFmt = new Intl.NumberFormat('pl-PL', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const dwaFmt = new Intl.NumberFormat('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function kr(x: number): string {
  return `${krFmt.format(Math.round(x))} kr`;
}

export function krZnak(x: number): string {
  const r = Math.round(x);
  return `${r > 0 ? '+' : ''}${krFmt.format(r)} kr`;
}

export function m3(x: number): string {
  return `${ulamekFmt.format(x)} m³`;
}

export function doby(x: number): string {
  return `${ulamekFmt.format(x)} dób`;
}

export function pc(x: number): string {
  return `${ulamekFmt.format(x)} pc`;
}

export function liczba1(x: number): string {
  return ulamekFmt.format(x);
}

export function liczba2(x: number): string {
  return dwaFmt.format(x);
}

export function procent(x: number): string {
  return `${Math.round(x * 100)}%`;
}

export function nazwaTowaru(t: TowarLubPaliwo): string {
  return P.nazwyTowarow[t];
}

export function nazwaRoli(r: Rola): string {
  return P.nazwyRol[r];
}

export function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

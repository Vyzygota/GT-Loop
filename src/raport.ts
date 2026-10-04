import { K, type Gra, type Raport } from '../sim/index';
import { doby, esc, kr, krZnak, liczba1, liczba2, m3, nazwaTowaru, pc } from './format';

function klasa(x: number): string {
  return x > 0 ? 'zysk' : x < 0 ? 'strata' : '';
}

function wniosek(gra: Gra, r: Raport): string {
  const dWartosc = r.wartoscPo - r.wartoscPrzed;
  const handel = r.wynikHandlowy.reduce((s, w) => s + w.zyskKr, 0);
  const koszty = r.paliwo.kosztZakupuKr + Math.abs(r.linie.find((l) => l.klucz === 'place')?.kr ?? 0) - (r.linie.find((l) => l.klucz === 'pilot')?.kr ?? 0);
  const czesci: string[] = [];
  if (r.wynikHandlowy.length) {
    czesci.push(`Na sprzedanych towarach ${handel >= 0 ? 'zarobiłeś' : 'straciłeś'} <b>${kr(Math.abs(handel))}</b> względem ich kosztu zakupu.`);
  } else {
    czesci.push('W tym doku nic nie sprzedałeś.');
  }
  czesci.push(`Lot kosztował ${kr(koszty)} (paliwo kupione w doku + płace).`);
  const zal = r.linie.filter((l) => ['handlowiec_sprzedaz', 'handlowiec_zakup', 'nawigator', 'synergia', 'pilot'].includes(l.klucz)).reduce((s, l) => s + l.kr, 0);
  if (r.zaloga.sklad.length) czesci.push(`Załoga dała łącznie <b>${krZnak(zal)}</b> ponad to, co dałby lot bez niej.`);
  czesci.push(`Wartość firmy ${dWartosc >= 0 ? 'wzrosła' : 'spadła'} o <b class="${klasa(dWartosc)}">${krZnak(dWartosc)}</b> (ładunek wyceniony po cenach sprzedaży w ${esc(gra.wezel(r.do).nazwa)}).`);
  return czesci.join(' ');
}

export function modalRaportu(gra: Gra, r: Raport): string {
  const linie = r.linie
    .map(
      (l) => `<tr><td class="lewo">${esc(l.etykieta)}${l.opis ? `<div class="szary maly">${esc(l.opis)}</div>` : ''}</td><td class="${klasa(l.kr)}">${krZnak(l.kr)}</td></tr>`,
    )
    .join('');
  const transakcje = r.transakcje
    .map(
      (t) => `<tr><td class="lewo">${t.rodzaj === 'kupno' ? 'Kupno' : 'Sprzedaż'} · ${nazwaTowaru(t.towar)}</td><td>${liczba1(t.m3)} m³</td><td>${kr(t.kwotaKr)}</td><td>${kr(t.kwotaKr / t.m3)}</td><td>${kr(t.cenaJednPrzedKr)} → ${kr(t.cenaJednPoKr)}</td><td>${liczba2(t.naciskPrzed)} → ${liczba2(t.naciskPo)}</td></tr>`,
    )
    .join('');
  const handel = r.wynikHandlowy
    .map((w) => `<tr><td class="lewo">${nazwaTowaru(w.towar)}</td><td>${liczba1(w.m3)} m³</td><td>${kr(w.przychodKr)}</td><td>${kr(w.kosztZakupuKr)}</td><td class="${klasa(w.zyskKr)}">${krZnak(w.zyskKr)}</td></tr>`)
    .join('');
  const koniec = r.koniecGry ? modalKonca(gra) : '';
  return `<div class="modal-tlo" data-modal="raport"><div class="modal">
    <h2>Raport po locie nr ${r.numerLotu}: ${esc(gra.wezel(r.z).nazwa)} → ${esc(gra.wezel(r.do).nazwa)}</h2>
    <div class="szary maly">${r.trasa.map((id) => esc(gra.wezel(id).nazwa)).join(' → ')} · ${pc(r.dystansPc)} · ${doby(r.doby)} (nominalnie ${doby(r.dobyNominalne)}) · doba ${liczba1(r.dobaStart)} → ${liczba1(r.dobaKoniec)}</div>
    <div class="wniosek">${wniosek(gra, r)}</div>
    <h3>Zmiana salda, linia po linii</h3>
    <table><tbody>${linie}
      <tr class="suma"><td class="lewo">Razem = zmiana salda</td><td class="${klasa(r.zmianaSalda)}">${krZnak(r.zmianaSalda)}</td></tr>
      <tr><td class="lewo szary">Saldo</td><td>${kr(r.saldoPrzed)} → ${kr(r.saldoPo)}</td></tr>
      <tr><td class="lewo szary">Wartość firmy (kr + ładunek po cenach sprzedaży w doku)</td><td>${kr(r.wartoscPrzed)} → ${kr(r.wartoscPo)} <span class="${klasa(r.wartoscPo - r.wartoscPrzed)}">(${krZnak(r.wartoscPo - r.wartoscPrzed)})</span></td></tr>
    </tbody></table>
    ${handel ? `<h3>Wynik na sprzedanych towarach (przychód − koszt ich zakupu)</h3><table><thead><tr><th>Towar</th><th>Ilość</th><th>Przychód</th><th>Koszt zakupu</th><th>Zysk</th></tr></thead><tbody>${handel}</tbody></table>` : ''}
    ${transakcje ? `<h3>Transakcje w ${esc(gra.wezel(r.z).nazwa)} i ich wpływ na ceny</h3><table><thead><tr><th>Transakcja</th><th>Ilość</th><th>Kwota</th><th>Śr. cena</th><th>Cena jedn. przed → po</th><th>Nacisk przed → po</th></tr></thead><tbody>${transakcje}</tbody></table>` : ''}
    <h3>Paliwo i czas</h3>
    <div class="maly">Zużyto ${m3(r.paliwo.zuzytoM3)} (bez załogi byłoby ${m3(r.paliwo.bezZalogiM3)}); w baku zostało ${m3(r.paliwo.wBakuPo)}. Oszczędności wyceniono po ${kr(r.paliwo.cenaOdniesieniaKr)}/m³ (cena paliwa w porcie startu).
      Prędkość ${liczba2(r.zaloga.predkosc)} pc/dobę; płace ${kr(r.zaloga.placeNaDobe)}/dobę.</div>
    ${r.kontakt ? `<h3>Kontakt: ${esc(r.kontakt.nazwa)}</h3><div class="maly">${esc(r.kontakt.opis)}</div>` : ''}
    ${koniec}
    <div class="stopka"><button class="glowny" data-akcja="zamknij-raport">${r.koniecGry ? 'Pokaż stan końcowy' : 'Wróć do doku'}</button></div>
  </div></div>`;
}

export function modalKonca(gra: Gra): string {
  const wartosc = gra.wartoscFirmy();
  const cel = gra.celWartosci();
  const sukces = wartosc >= cel;
  return `<div class="wniosek" style="border-color:${sukces ? 'var(--zysk)' : 'var(--strata)'}">
    <b>Koniec gry po ${liczba1(gra.stan.doba)} dobach (limit ${gra.limitDob}).</b> Wartość firmy: <b>${kr(wartosc)}</b> z ${kr(K.startingCredits)} na starcie (×${liczba2(wartosc / K.startingCredits)}).
    ${sukces ? 'Cel osiągnięty: wartość firmy podwojona.' : `Cel nieosiągnięty: zabrakło ${kr(cel - wartosc)} do ${kr(cel)}.`}
    Lotów: ${gra.stan.numerLotu}. Nową grę zaczniesz przyciskiem w nagłówku (możesz zmienić ziarno).
  </div>`;
}

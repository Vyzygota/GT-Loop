import { Gra, K, P, type Raport, type Towar } from '../sim/index';
import { esc, kr, liczba1 } from './format';
import { animujLot, renderujMape } from './mapa';
import { panelCywilizacji, panelLadowni, panelRynku, panelTrasy, panelZalogi, tablicaCen } from './panele';
import { modalKonca, modalRaportu } from './raport';

interface StanUI {
  gra: Gra;
  trasa: string[];
  ilosci: Record<string, number>;
  raport: Raport | null;
  wLocie: boolean;
  komunikat: string;
  ekranKonca: boolean;
}

const app = document.getElementById('app')!;

function ziarnoZAdresu(): string {
  const m = /ziarno=([^&]+)/.exec(location.hash);
  return m ? decodeURIComponent(m[1]) : String(P.bot.pierwszeZiarno);
}

/** Flaga #szybko=1 skraca animację lotu (używa jej smoke test). */
const szybko = /szybko=1/.test(location.hash);

let ui: StanUI = nowaGra(ziarnoZAdresu());

function nowaGra(ziarno: string): StanUI {
  location.hash = `ziarno=${encodeURIComponent(ziarno)}${szybko ? '&szybko=1' : ''}`;
  return { gra: new Gra(ziarno), trasa: [], ilosci: {}, raport: null, wLocie: false, komunikat: '', ekranKonca: false };
}

function naglowek(): string {
  const g = ui.gra;
  const wartosc = g.wartoscFirmy();
  const cel = g.celWartosci();
  const postep = Math.min(1, Math.max(0, (wartosc - K.startingCredits) / (cel - K.startingCredits)));
  return `<header>
    <h1>GalaxyTrader: Pętla</h1>
    <div class="miara"><span class="et">Doba</span><span class="w" id="licznik-dob">${liczba1(g.stan.doba)} / ${P.dobyGry}</span></div>
    <div class="miara"><span class="et">Saldo</span><span class="w">${kr(g.stan.kr)}</span></div>
    <div class="miara"><span class="et">Wartość firmy</span><span class="w">${kr(wartosc)}</span></div>
    <div class="miara"><span class="et">Cel: ${kr(cel)} w ${P.dobyGry} dób</span><div class="cel-pasek" title="${Math.round(postep * 100)}% drogi do celu"><div style="width:${(postep * 100).toFixed(1)}%"></div></div></div>
    <div class="miara"><span class="et">Paliwo</span><span class="w">${liczba1(g.stan.paliwo)} / ${K.bak} m³</span></div>
    <div class="miara"><span class="et">Lotów</span><span class="w">${g.stan.numerLotu}</span></div>
    <div class="ziarno"><label class="maly">Ziarno <input type="text" id="ziarno" value="${esc(g.swiat.ziarno)}" /></label><button data-akcja="nowa-gra">Nowa gra</button></div>
  </header>`;
}

function renderuj(): void {
  const g = ui.gra;
  const modal = ui.raport ? modalRaportu(g, ui.raport) : ui.ekranKonca ? `<div class="modal-tlo" data-modal="koniec"><div class="modal"><h2>Koniec gry</h2>${modalKonca(g)}<div class="stopka"><button class="glowny" data-akcja="zamknij-koniec">Zamknij</button></div></div></div>` : '';
  app.innerHTML = `${naglowek()}
    <details class="pomoc"><summary>Jak grać (pętla: dok → decyzje → lot → raport)</summary>
      <ol>
        <li>W doku czas stoi. Kupuj tanio to, czego gdzie indziej brakuje (tablica cen na dole), sprzedawaj to, co przywiozłeś, tankuj.</li>
        <li>Zatrudniaj załogę: handlowiec poprawia ceny, nawigator oszczędza paliwo, pilot skraca lot. Pilot i nawigator z tej samej cywilizacji dają synergię.</li>
        <li>Wybierz cel na mapie (albo klikając wiersz tablicy cen) i naciśnij „Leć”. Lot kosztuje paliwo i płace za doby w drodze.</li>
        <li>Raport po locie pokazuje linia po linii, skąd wzięła się zmiana salda. Cel: podwoić wartość firmy w ${P.dobyGry} dób.</li>
        <li>Każdy m³, który sprzedasz, obniża cenę na tej planecie; wożenie w kółko tego samego przestaje się opłacać. Nieznana cywilizacja odsłania rynek po pierwszym lądowaniu.</li>
      </ol>
    </details>
    <main>
      <div>
        <div class="panel mapa-kontener">
          <h2>Mapa <span class="szary maly">zielony pierścień = w zasięgu na obecnym paliwie · kreskowane = cywilizacja nieznana · trójkąt = tankowanie</span></h2>
          ${renderujMape(g, ui.trasa)}
          ${ui.wLocie ? '<div class="lot-info" id="lot-info">W locie…</div>' : ''}
        </div>
        ${panelTrasy(g, ui.trasa)}
        ${panelCywilizacji(g)}
      </div>
      <div>
        ${ui.komunikat ? `<div class="panel blad" id="komunikat">${esc(ui.komunikat)}</div>` : ''}
        ${panelRynku(g, ui.ilosci)}
        ${panelLadowni(g)}
        ${panelZalogi(g)}
      </div>
      ${tablicaCen(g)}
    </main>
    ${modal}`;
  if (ui.wLocie) {
    for (const b of app.querySelectorAll<HTMLButtonElement>('main button')) b.disabled = true;
  }
}

function ustawTrase(cel: string): void {
  const g = ui.gra;
  const ostatni = ui.trasa[ui.trasa.length - 1] ?? g.stan.pozycja;
  if (cel === ostatni && ui.trasa.length > 1) {
    ui.trasa.pop();
    return;
  }
  if (cel === g.stan.pozycja) {
    ui.trasa = [];
    return;
  }
  const baza = ui.trasa.length ? ui.trasa : [g.stan.pozycja];
  if (g.graf.dystansKrawedzi(ostatni, cel) !== undefined && ui.trasa.length) {
    ui.trasa = [...baza, cel];
  } else {
    ui.trasa = g.graf.najkrotszaSciezka(g.stan.pozycja, cel) ?? [];
  }
}

function sprobuj(akcja: () => void): void {
  try {
    ui.komunikat = '';
    akcja();
  } catch (e) {
    ui.komunikat = (e as Error).message;
  }
}

async function lec(): Promise<void> {
  const g = ui.gra;
  const trasa = [...ui.trasa];
  const s = g.sprawdzTrase(trasa);
  if (s.blad) {
    ui.komunikat = s.blad;
    renderuj();
    return;
  }
  const dobaStart = g.stan.doba;
  ui.wLocie = true;
  ui.komunikat = '';
  renderuj();
  const svg = app.querySelector('svg.mapa') as SVGSVGElement;
  const raport = g.lec(trasa);
  const licznik = document.getElementById('licznik-dob');
  const info = document.getElementById('lot-info');
  await animujLot(svg, g, trasa, dobaStart, raport.dobaKoniec, szybko ? P.ui.skrotTestowy : 1, (doba) => {
    if (licznik) licznik.textContent = `${liczba1(doba)} / ${P.dobyGry}`;
    if (info) info.textContent = `W locie: ${esc(g.wezel(raport.z).nazwa)} → ${esc(g.wezel(raport.do).nazwa)}, doba ${liczba1(doba)}`;
  });
  ui.wLocie = false;
  ui.trasa = [];
  ui.ilosci = {};
  ui.raport = raport;
  renderuj();
}

app.addEventListener('click', (ev) => {
  const cel = ev.target as HTMLElement;
  const wezel = cel.closest<SVGGElement>('[data-wezel]');
  if (wezel && !ui.wLocie) {
    ustawTrase(wezel.dataset.wezel!);
    renderuj();
    return;
  }
  const wiersz = cel.closest<HTMLElement>('[data-cel]');
  if (wiersz && !cel.closest('button') && !ui.wLocie) {
    const id = wiersz.dataset.cel!;
    ui.trasa = id === ui.gra.stan.pozycja ? [] : (ui.gra.graf.najkrotszaSciezka(ui.gra.stan.pozycja, id) ?? []);
    renderuj();
    return;
  }
  const przycisk = cel.closest<HTMLElement>('[data-akcja]');
  if (!przycisk) return;
  const akcja = przycisk.dataset.akcja!;
  const towar = przycisk.dataset.towar as Towar | undefined;
  const g = ui.gra;
  const ilosc = (klucz: string) => Math.max(0, Math.floor(Number(ui.ilosci[klucz] ?? 0)));
  switch (akcja) {
    case 'nowa-gra': {
      const ziarno = (document.getElementById('ziarno') as HTMLInputElement).value.trim() || String(P.bot.pierwszeZiarno);
      ui = nowaGra(ziarno);
      break;
    }
    case 'kup':
      sprobuj(() => g.kup(towar!, ilosc(towar!)));
      break;
    case 'kup-max':
      sprobuj(() => {
        const m = Math.floor(g.maxKupno(towar!));
        if (m > 0) g.kup(towar!, m);
        ui.ilosci[towar!] = 0;
      });
      break;
    case 'sprzedaj':
      sprobuj(() => g.sprzedaj(towar!, ilosc(towar!)));
      break;
    case 'sprzedaj-wszystko':
      sprobuj(() => {
        g.sprzedaj(towar!, g.stan.ladownia[towar!].m3);
        ui.ilosci[towar!] = 0;
      });
      break;
    case 'tankuj':
      sprobuj(() => g.tankuj(ilosc('Fuel')));
      break;
    case 'tankuj-pelny':
      sprobuj(() => {
        const m = g.maxPaliwo();
        if (m > 1e-6) g.tankuj(m);
        ui.ilosci.Fuel = 0;
      });
      break;
    case 'zatrudnij':
      sprobuj(() => g.zatrudnij(przycisk.dataset.id!));
      break;
    case 'zwolnij':
      sprobuj(() => g.zwolnij(przycisk.dataset.id!));
      break;
    case 'wyczysc-trase':
      ui.trasa = [];
      break;
    case 'lec':
      void lec();
      return;
    case 'zamknij-raport':
      ui.ekranKonca = !!ui.raport?.koniecGry;
      ui.raport = null;
      break;
    case 'zamknij-koniec':
      ui.ekranKonca = false;
      break;
  }
  renderuj();
});

app.addEventListener('input', (ev) => {
  const pole = ev.target as HTMLInputElement;
  const klucz = pole.dataset.ilosc;
  if (!klucz) return;
  ui.ilosci[klucz] = Number(pole.value) || 0;
  // Odśwież tylko wycenę w wierszu, zachowując fokus pola.
  const fokus = pole;
  const pozycja = fokus.selectionStart;
  renderuj();
  const nowe = app.querySelector<HTMLInputElement>(`input[data-ilosc="${klucz}"]`);
  if (nowe) {
    nowe.focus();
    if (pozycja !== null) nowe.setSelectionRange(pozycja, pozycja);
  }
});

app.addEventListener('keydown', (ev) => {
  const pole = ev.target as HTMLInputElement;
  if (ev.key === 'Enter' && pole.id === 'ziarno') {
    ui = nowaGra(pole.value.trim() || String(P.bot.pierwszeZiarno));
    renderuj();
  }
});

renderuj();

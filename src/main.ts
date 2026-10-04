import { Gra, K, P, type Raport, type Skala, type Towar, type TrybInformacji, type WariantSpreadu } from '../sim/index';
import { esc, kr, liczba1 } from './format';
import { animujLot, poziomMapy, renderujMape, warstwaTrasy, widokCalosci, widokStatku, type Widok } from './mapa';
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
  widok: Widok;
  pokazWszystkieCeny: boolean;
}

const app = document.getElementById('app')!;
const SKALE: Skala[] = ['S', 'M', 'L'];
const TRYBY: TrybInformacji[] = ['pelna', 'zasieg'];
const WARIANTY: WariantSpreadu[] = ['A', 'B', 'C', 'D', 'E'];

function parametryZAdresu(): { ziarno: string; skala: Skala; informacja: TrybInformacji; spread: WariantSpreadu; szybko: boolean } {
  const h = location.hash;
  const wez = (k: string) => {
    const m = new RegExp(`${k}=([^&]+)`).exec(h);
    return m ? decodeURIComponent(m[1]) : null;
  };
  const skala = wez('skala');
  const informacja = wez('informacja');
  const spread = wez('spread');
  return {
    ziarno: wez('ziarno') ?? String(P.bot.pierwszeZiarno),
    skala: SKALE.includes(skala as Skala) ? (skala as Skala) : P.skala,
    informacja: TRYBY.includes(informacja as TrybInformacji) ? (informacja as TrybInformacji) : P.informacja,
    spread: WARIANTY.includes(spread as WariantSpreadu) ? (spread as WariantSpreadu) : P.spread,
    szybko: wez('szybko') === '1',
  };
}

/** Flaga #szybko=1 skraca animację lotu (używa jej smoke test). */
const szybko = parametryZAdresu().szybko;

let ui: StanUI = nowaGra(parametryZAdresu().ziarno, parametryZAdresu().skala, parametryZAdresu().informacja, parametryZAdresu().spread);

function nowaGra(ziarno: string, skala: Skala, informacja: TrybInformacji, spread: WariantSpreadu): StanUI {
  location.hash = `ziarno=${encodeURIComponent(ziarno)}&skala=${skala}&informacja=${informacja}&spread=${spread}${szybko ? '&szybko=1' : ''}`;
  const gra = new Gra(ziarno, { skala, informacja, spread });
  return { gra, trasa: [], ilosci: {}, raport: null, wLocie: false, komunikat: '', ekranKonca: false, widok: widokStartowy(gra), pokazWszystkieCeny: false };
}

function widokStartowy(gra: Gra): Widok {
  const calosc = widokCalosci(gra);
  // Duża galaktyka: zacznij przybliżony na statek, resztę pokazuje przycisk „Cały świat”.
  return calosc.w > P.ui.poziomyMapy.sredniPc ? widokStatku(gra, P.ui.poziomyMapy.sredniPc) : calosc;
}

function naglowek(): string {
  const g = ui.gra;
  const wartosc = g.wartoscFirmy();
  const cel = g.celWartosci();
  const postep = Math.min(1, Math.max(0, (wartosc - K.startingCredits) / (cel - K.startingCredits)));
  const opcje = (lista: string[], wybrana: string) => lista.map((x) => `<option value="${x}" ${x === wybrana ? 'selected' : ''}>${x}</option>`).join('');
  return `<header>
    <h1>GalaxyTrader: Pętla</h1>
    <div class="miara"><span class="et">Doba</span><span class="w" id="licznik-dob">${liczba1(g.stan.doba)} / ${g.limitDob}</span></div>
    <div class="miara"><span class="et">Saldo</span><span class="w">${kr(g.stan.kr)}</span></div>
    <div class="miara"><span class="et">Wartość firmy</span><span class="w">${kr(wartosc)}</span></div>
    <div class="miara"><span class="et">Cel: ${kr(cel)} w ${g.limitDob} dób</span><div class="cel-pasek" title="${Math.round(postep * 100)}% drogi do celu"><div style="width:${(postep * 100).toFixed(1)}%"></div></div></div>
    <div class="miara"><span class="et">Paliwo</span><span class="w">${liczba1(g.stan.paliwo)} / ${K.bak} m³</span></div>
    <div class="miara"><span class="et">Lotów</span><span class="w">${g.stan.numerLotu}</span></div>
    <div class="ziarno">
      <label class="maly">Skala <select id="skala">${opcje(SKALE, g.skala)}</select></label>
      <label class="maly">Informacja <select id="informacja">${opcje(TRYBY, g.informacja)}</select></label>
      <label class="maly" title="${esc(P.wariantySpreadu[g.wariantSpreadu].opis ?? '')}">Spread <select id="spread">${opcje(WARIANTY, g.wariantSpreadu)}</select></label>
      <label class="maly">Ziarno <input type="text" id="ziarno" value="${esc(g.swiat.ziarno)}" /></label>
      <button data-akcja="nowa-gra">Nowa gra</button>
    </div>
  </header>`;
}

function renderuj(): void {
  const g = ui.gra;
  const modal = ui.raport ? modalRaportu(g, ui.raport) : ui.ekranKonca ? `<div class="modal-tlo" data-modal="koniec"><div class="modal"><h2>Koniec gry</h2>${modalKonca(g)}<div class="stopka"><button class="glowny" data-akcja="zamknij-koniec">Zamknij</button></div></div></div>` : '';
  const legenda = g.swiat.skala === 'S' ? 'zielony pierścień = w zasięgu na obecnym paliwie · kreskowane = cywilizacja nieznana · trójkąt = tankowanie' : 'kolor = cywilizacja · trójkąt = plemiona (paliwo) · kropka = układ przelotowy · puste kółko = brak informacji o cenach · kreskowane = ostatni odczyt · kółko wokół statku = łączność';
  app.innerHTML = `${naglowek()}
    <details class="pomoc"><summary>Jak grać (pętla: dok → decyzje → lot → raport)</summary>
      <ol>
        <li>W doku czas stoi. Kupuj tanio to, czego gdzie indziej brakuje (tablica cen na dole), sprzedawaj to, co przywiozłeś, tankuj.</li>
        <li>Zatrudniaj załogę: handlowiec poprawia ceny, nawigator oszczędza paliwo, pilot skraca lot. Pilot i nawigator z tej samej cywilizacji dają synergię.</li>
        <li>Wybierz cel na mapie (kółko myszy przybliża, przeciąganie przesuwa; albo kliknij wiersz tablicy cen) i naciśnij „Leć”. Lot kosztuje paliwo i płace za doby w drodze. Bak to 100 pc: dalsze trasy planuj z tankowaniem po drodze (planety i plemiona), układy przelotowe nie mają nic.</li>
        <li>Raport po locie pokazuje linia po linii, skąd wzięła się zmiana salda. Cel: podwoić wartość firmy w ${g.limitDob} dób.</li>
        <li>Każdy m³, który sprzedasz, obniża cenę na tej planecie. Cywilizacje otwarte (wysoka otwartość) mają głębokie rynki, które NPC szybko odbudowują; zamknięte są płytkie i długo zepsute. Lądowanie u nieznanej cywilizacji odsłania jej rynki.${g.wariantSpreadu !== 'A' ? ` Wariant spreadu <b>${g.wariantSpreadu}</b>: zamiast stałego spreadu obowiązuje pamięć zakupu: odsprzedaż towaru na planecie, gdzie go kupiłeś, jest karana ${Math.round(K.tradeSpread * 100)}% ceny, dopóki nie wykonasz ${P.pamiecZakupuSkokow} skoków${g.spreadPodstawowy > 0 ? `; poza tym spread podstawowy ${Math.round(g.spreadPodstawowy * 100)}%` : '; poza tym kupno i sprzedaż po tej samej cenie, więc handlowiec nie ma na co wpływać'}.` : ''}${g.informacja === 'zasieg' ? ` W trybie <b>zasięg</b> ceny na żywo widzisz tylko w łączności ${K.zasiegLacznosci} pc od statku, a dalej tylko ostatni odczyt z planet, na których byłeś.` : ''}</li>
      </ol>
    </details>
    <main>
      <div>
        <div class="panel mapa-kontener">
          <h2>Mapa <span class="szary maly">${legenda}</span></h2>
          <div class="mapa-przyciski">
            <button data-akcja="zoom-plus" title="Przybliż">+</button><button data-akcja="zoom-minus" title="Oddal">−</button>
            <button data-akcja="zoom-calosc">Cały świat</button><button data-akcja="zoom-statek">Statek</button>
            <span class="szary maly">okno ${Math.round(ui.widok.w)} pc</span>
          </div>
          ${renderujMape(g, ui.trasa, ui.widok)}
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
      ${tablicaCen(g, ui.pokazWszystkieCeny)}
    </main>
    ${modal}`;
  if (ui.wLocie) {
    for (const b of app.querySelectorAll<HTMLButtonElement>('main button')) b.disabled = true;
  }
}

/** Zmiana okna mapy bez pełnego renderowania, chyba że zmienia się poziom przybliżenia (nazwy, rozmiary). */
function ustawWidok(nowy: Widok): void {
  const poprzedni = ui.widok;
  ui.widok = nowy;
  const svg = app.querySelector<SVGSVGElement>('svg.mapa');
  if (!svg || poziomMapy(poprzedni.w) !== poziomMapy(nowy.w) || Math.abs(nowy.w / poprzedni.w - 1) > 0.25) {
    renderuj();
    return;
  }
  svg.setAttribute('viewBox', `${nowy.x.toFixed(1)} ${nowy.y.toFixed(1)} ${nowy.w.toFixed(1)} ${nowy.h.toFixed(1)}`);
}

function przybliz(czynnik: number, srodek?: { x: number; y: number }): void {
  const w = ui.widok;
  const calosc = widokCalosci(ui.gra);
  const noweW = Math.min(calosc.w * 1.5, Math.max(calosc.w / 40, w.w * czynnik));
  const noweH = (noweW * w.h) / w.w;
  const s = srodek ?? { x: w.x + w.w / 2, y: w.y + w.h / 2 };
  const ux = (s.x - w.x) / w.w;
  const uy = (s.y - w.y) / w.h;
  ustawWidok({ x: s.x - ux * noweW, y: s.y - uy * noweH, w: noweW, h: noweH });
}

function punktMapy(svg: SVGSVGElement, ev: MouseEvent): { x: number; y: number } {
  const r = svg.getBoundingClientRect();
  const vb = svg.viewBox.baseVal;
  // preserveAspectRatio meet: skala wspólna, mapa wyśrodkowana.
  const skala = Math.min(r.width / vb.width, r.height / vb.height);
  const ox = (r.width - vb.width * skala) / 2;
  const oy = (r.height - vb.height * skala) / 2;
  return { x: vb.x + (ev.clientX - r.left - ox) / skala, y: vb.y + (ev.clientY - r.top - oy) / skala };
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
    if (licznik) licznik.textContent = `${liczba1(doba)} / ${g.limitDob}`;
    if (info) info.textContent = `W locie: ${g.wezel(raport.z).nazwa} → ${g.wezel(raport.do).nazwa}, doba ${liczba1(doba)}`;
  });
  ui.wLocie = false;
  ui.trasa = [];
  ui.ilosci = {};
  ui.raport = raport;
  // Po przylocie okno podąża za statkiem, jeśli wyleciał poza nie.
  const p = g.wezel();
  const w = ui.widok;
  if (p.x < w.x || p.x > w.x + w.w || p.y < w.y || p.y > w.y + w.h) ui.widok = widokStatku(g, w.w);
  renderuj();
}

let przeciaganie: { x: number; y: number; widok: Widok; ruszyl: boolean } | null = null;

app.addEventListener('mousedown', (ev) => {
  const svg = (ev.target as Element).closest('svg.mapa') as SVGSVGElement | null;
  if (!svg || ev.button !== 0) return;
  przeciaganie = { x: ev.clientX, y: ev.clientY, widok: { ...ui.widok }, ruszyl: false };
});
window.addEventListener('mousemove', (ev) => {
  if (!przeciaganie) return;
  const svg = app.querySelector<SVGSVGElement>('svg.mapa');
  if (!svg) return;
  const r = svg.getBoundingClientRect();
  const vb = svg.viewBox.baseVal;
  const skala = Math.min(r.width / vb.width, r.height / vb.height);
  const dx = (ev.clientX - przeciaganie.x) / skala;
  const dy = (ev.clientY - przeciaganie.y) / skala;
  if (Math.abs(ev.clientX - przeciaganie.x) + Math.abs(ev.clientY - przeciaganie.y) > 3) przeciaganie.ruszyl = true;
  if (przeciaganie.ruszyl) ustawWidok({ ...przeciaganie.widok, x: przeciaganie.widok.x - dx, y: przeciaganie.widok.y - dy });
});
window.addEventListener('mouseup', () => {
  if (przeciaganie?.ruszyl) renderuj();
  przeciaganie = null;
});
app.addEventListener(
  'wheel',
  (ev) => {
    const svg = (ev.target as Element).closest('svg.mapa') as SVGSVGElement | null;
    if (!svg) return;
    ev.preventDefault();
    przybliz(ev.deltaY > 0 ? 1.25 : 0.8, punktMapy(svg, ev));
  },
  { passive: false },
);

app.addEventListener('click', (ev) => {
  const cel = ev.target as HTMLElement;
  if (przeciaganie?.ruszyl) return;
  const wezel = cel.closest<SVGGElement>('[data-wezel]');
  if (wezel && !ui.wLocie) {
    ustawTrase(wezel.dataset.wezel!);
    const warstwa = app.querySelector('#warstwa-trasy');
    if (warstwa) warstwa.innerHTML = warstwaTrasy(ui.gra, ui.trasa, ui.widok);
    const panel = app.querySelector('.trasa-panel');
    if (panel) panel.outerHTML = panelTrasy(ui.gra, ui.trasa);
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
      const skala = (document.getElementById('skala') as HTMLSelectElement).value as Skala;
      const informacja = (document.getElementById('informacja') as HTMLSelectElement).value as TrybInformacji;
      const spread = (document.getElementById('spread') as HTMLSelectElement).value as WariantSpreadu;
      ui = nowaGra(ziarno, skala, informacja, spread);
      break;
    }
    case 'zoom-plus':
      przybliz(0.6);
      return;
    case 'zoom-minus':
      przybliz(1 / 0.6);
      return;
    case 'zoom-calosc':
      ustawWidok(widokCalosci(g));
      renderuj();
      return;
    case 'zoom-statek':
      ustawWidok(widokStatku(g, Math.min(ui.widok.w, P.ui.poziomyMapy.bliskiPc)));
      renderuj();
      return;
    case 'przelacz-tablice':
      ui.pokazWszystkieCeny = !ui.pokazWszystkieCeny;
      break;
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
      sprobuj(() => g.tankuj(Math.max(0, Number(ui.ilosci.Fuel ?? 0))));
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
  const pozycja = pole.selectionStart;
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
    const skala = (document.getElementById('skala') as HTMLSelectElement).value as Skala;
    const informacja = (document.getElementById('informacja') as HTMLSelectElement).value as TrybInformacji;
    const spread = (document.getElementById('spread') as HTMLSelectElement).value as WariantSpreadu;
    ui = nowaGra(pole.value.trim() || String(P.bot.pierwszeZiarno), skala, informacja, spread);
    renderuj();
  }
});

renderuj();

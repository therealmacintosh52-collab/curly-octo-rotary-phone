/**
 * Behaviour for the per-service interactive blocks (Interactive.astro).
 * Each widget keeps one line of state, shows it under "Your pick" and puts
 * it in the Book button's ?note= so it reaches the shop with the request.
 */
document.querySelectorAll<HTMLElement>('[data-widget]').forEach((w) => {
  const type = w.dataset.widget!;
  const slug = w.dataset.slug!;
  const out = w.querySelector<HTMLElement>('[data-summary]')!;
  const book = w.querySelector<HTMLAnchorElement>('[data-book]')!;
  const $ = <T extends Element>(s: string) => w.querySelector<T>(s)!;
  const $$ = <T extends Element>(s: string) => Array.from(w.querySelectorAll<T>(s));
  // "Your pick" line + the same choices as booking-form answers (?shade=20%&film=Carbon …),
  // so the booking page lands with those chips already picked.
  const set = (text: string, params: Record<string, string> = {}) => {
    out.textContent = text;
    const u = new URL('/book/', location.origin);
    u.searchParams.set('service', slug); u.searchParams.set('note', text.slice(0, 300));
    for (const [k, v] of Object.entries(params)) if (v) u.searchParams.set(k, v);
    book.setAttribute('href', u.pathname + u.search);
  };

  if (type === 'shade') {
    const range = $<HTMLInputElement>('[data-vlt]'), outV = $<HTMLElement>('[data-vlt-out]'), txt = $<SVGTextElement>('[data-vlt-text]');
    const panes = $$<SVGPathElement>('[data-pane]'), rearLegal = $<HTMLElement>('[data-legal-rear]');
    const paint = () => {
      const v = Number(range.value);
      panes.forEach((p) => {
        const pane = p.dataset.pane;
        const vlt = pane === 'windshield' ? 100 : pane === 'front' ? 70 : v;   // fronts fixed at the legal limit
        p.style.fillOpacity = '1';
        const dark = 1 - vlt / 100;
        p.setAttribute('fill', `rgb(${Math.round(169 - 160 * dark)},${Math.round(199 - 190 * dark)},${Math.round(221 - 210 * dark)})`);
      });
      outV.textContent = `${v}%`; txt.textContent = `${v}% VLT`;
      rearLegal.textContent = `Rear at ${v}%: legal (front doors forward stay at 70%)`;
      const film = (w.querySelector<HTMLInputElement>('input[name=film]:checked')?.value) || 'Ceramic';
      set(`${film} film, ${v}% on the rear and back glass, fronts at the legal 70%`, { windows: 'Full car', shade: `${v}%`, film });
    };
    range.addEventListener('input', paint); $$<HTMLInputElement>('input[name=film]').forEach((r) => r.addEventListener('change', paint)); paint();
  }

  if (type === 'colour') {
    const paintEl = $<SVGPathElement>('[data-paint]'), gloss = $<SVGPathElement>('[data-gloss]');
    const paint = () => {
      const col = w.querySelector<HTMLInputElement>('input[name=col]:checked')!;
      const finish = w.querySelector<HTMLInputElement>('input[name=finish]:checked')!.value;
      const cover = w.querySelector<HTMLInputElement>('input[name=cover]:checked')!.value;
      paintEl.setAttribute('fill', col.dataset.hex!);
      gloss.setAttribute('opacity', finish === 'Gloss' ? '1' : finish === 'Satin' ? '.45' : '.12');
      set(`${cover}: ${col.value}, ${finish.toLowerCase()} finish`, { coverage: cover === 'Roof only' ? 'Roof' : cover === 'Hood only' ? 'Hood' : cover, finish, colour: col.value });
    };
    $$<HTMLInputElement>('input[type=radio]').forEach((r) => r.addEventListener('change', paint)); paint();
  }

  if (type === 'lettering') {
    const name = $<HTMLInputElement>('[data-van-in-name]'), tag = $<HTMLInputElement>('[data-van-in-tag]'), count = $<HTMLInputElement>('[data-van-count]');
    const svgName = $<SVGTextElement>('[data-van-name]'), svgTag = $<SVGTextElement>('[data-van-tag]');
    const paint = () => {
      const n = name.value.trim() || 'YOUR BUSINESS', t = tag.value.trim() || '(916) 000-0000';
      svgName.textContent = n.toUpperCase().slice(0, 24); svgTag.textContent = t.slice(0, 28);
      svgName.setAttribute('font-size', n.length > 16 ? '11' : '14');
      const c = Math.max(1, Number(count.value) || 1);
      set(`${c} vehicle${c > 1 ? 's' : ''} lettered for ${n}${t ? ` (${t})` : ''}`, { count: c === 1 ? '1' : c <= 3 ? '2–3' : c <= 10 ? '4–10' : '10+', coverage: 'Lettering only' });
    };
    [name, tag, count].forEach((i) => i.addEventListener('input', paint)); paint();
  }

  if (type === 'zones') {
    const boxes = $$<HTMLInputElement>('[data-zone-box]'), shapes = $$<SVGPathElement>('[data-zone]'), hint = $<HTMLElement>('[data-zone-hint]');
    const paint = () => {
      const on = boxes.filter((b) => b.checked);
      shapes.forEach((s) => s.classList.toggle('is-on', boxes.some((b) => b.checked && b.dataset.zoneBox === s.dataset.zone)));
      const ids = on.map((b) => b.dataset.zoneBox);
      const front = ['hood', 'bumper', 'fenders', 'mirrors'].every((z) => ids.includes(z));
      const pkg = ids.length === 7 ? 'Full-car film' : front && ids.length === 4 ? 'Front package' : front ? 'Front package plus extras' : ids.length ? 'Custom coverage' : 'Nothing selected';
      hint.textContent = ids.length === 7 ? 'Full car: every painted panel, for cars kept a long time or dark colours that show every chip.' : front && ids.length === 4 ? 'Front package: hood, bumper, fenders and mirrors. That is where the chips land.' : ids.length ? 'Custom: we cut film for exactly these panels.' : 'Tap a panel on the car or tick a box.';
      set(`${pkg}: ${on.map((b) => b.value.toLowerCase()).join(', ') || 'none'}`, { coverage: pkg === 'Front package plus extras' ? 'Front + extras' : pkg === 'Full-car film' ? 'Full car' : pkg === 'Custom coverage' ? 'Custom' : 'Front package' });
    };
    boxes.forEach((b) => b.addEventListener('change', paint));
    shapes.forEach((s) => s.addEventListener('click', () => { const b = boxes.find((x) => x.dataset.zoneBox === s.dataset.zone); if (b) { b.checked = !b.checked; paint(); } }));
    paint();
  }

  if (type === 'timeline') {
    const years = $<HTMLInputElement>('[data-years]'), outY = $<HTMLElement>('[data-years-out]');
    const per: Record<string, number> = { wax: 6, sealant: 2.4, ceramic: 0 };   // applications per year
    const paint = () => {
      const y = Number(years.value);
      outY.textContent = `${y} year${y > 1 ? 's' : ''}`;
      const max = per.wax * 5;
      $$<HTMLElement>('[data-bar]').forEach((bar) => {
        const k = bar.dataset.bar!, n = k === 'ceramic' ? 1 : Math.round(per[k] * y);
        bar.querySelector<HTMLElement>('[data-bar-count]')!.textContent = `${n} application${n > 1 ? 's' : ''}`;
        bar.querySelector<HTMLElement>('.iw__bar-track i')!.style.width = `${Math.max(4, (n / max) * 100)}%`;
      });
      set(`Ceramic coating; keeping the car about ${y} year${y > 1 ? 's' : ''}`);
    };
    years.addEventListener('input', paint); paint();
  }

  if (type === 'stages') {
    const swirls = $<SVGRectElement>('[data-swirls]'), shine = $<SVGRectElement>('[data-shine]');
    const paint = () => {
      const r = w.querySelector<HTMLInputElement>('input[name=stage]:checked')!;
      const sw = Number(r.dataset.swirl);
      swirls.setAttribute('opacity', String(sw)); shine.setAttribute('opacity', String(0.08 + (0.35 - sw) * 0.9));
      set(r.value, { stage: r.value.startsWith('One') ? 'One' : r.value.startsWith('Two') ? 'Two' : 'Three' });
    };
    $$<HTMLInputElement>('input[name=stage]').forEach((r) => r.addEventListener('change', paint)); paint();
  }

  if (type === 'builder') {
    const items = $$<HTMLInputElement>('[data-item]');
    const key = slug === 'detailing' ? 'addons' : slug === 'upholstery' ? 'areas' : 'items';
    const paint = () => { const on = items.filter((i) => i.checked).map((i) => i.value); set(on.length ? on.join(', ') : 'Tick what the car needs', { [key]: on.join(',') }); };
    items.forEach((i) => i.addEventListener('change', paint)); paint();
  }

  if (type === 'symptoms') {
    const btns = $$<HTMLButtonElement>('[data-symptom]'), answers = $$<HTMLElement>('[data-answer]');
    const paint = () => {
      const on = btns.filter((b) => b.getAttribute('aria-pressed') === 'true');
      answers.forEach((a) => { a.hidden = !on.some((b) => b.dataset.symptom === a.dataset.answer); });
      const picked = on.map((b) => b.textContent!.trim());
      set(picked.length ? picked.join(', ') : 'Tap what you see', slug === 'tint-removal-repair' ? { problem: picked.join(',') } : { type: picked[0] || '', symptoms: picked.join(', ') });
    };
    btns.forEach((b) => b.addEventListener('click', () => { b.setAttribute('aria-pressed', b.getAttribute('aria-pressed') === 'true' ? 'false' : 'true'); paint(); }));
    paint();
  }
});

(function () {
  const container = document.getElementById('worldDetail');
  if (!container) return;

  function textOrNull(value) {
    if (value === null || value === undefined) return null;
    const text = String(value).trim();
    return text ? text : null;
  }

  function numberOrNull(value) {
    if (value === null || value === undefined || value === '') return null;
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
  }

  function renderState(message) {
    container.innerHTML = '';
    const state = document.createElement('p');
    state.className = 'world-state';
    state.textContent = message;
    container.appendChild(state);
  }

  function createCopySection(title, value) {
    if (!value) return null;

    const section = document.createElement('section');
    section.className = 'world-section';

    const heading = document.createElement('h2');
    heading.textContent = title;

    const copy = document.createElement('p');
    copy.className = 'world-copy';
    copy.textContent = value;

    section.append(heading, copy);
    return section;
  }

  function renderWorld(id, worldJson, electrumJson) {
    const stewardName = textOrNull(worldJson?.stewardName) || textOrNull(worldJson?.name) || id;
    const sigilPrompt = textOrNull(worldJson?.sigilPrompt) || textOrNull(worldJson?.sigil?.prompt);
    const strategy = textOrNull(worldJson?.strategyStatement) || textOrNull(worldJson?.intention);

    const currentElectrum = numberOrNull(electrumJson?.currentElectrum ?? electrumJson?.electrum);
    const breathsAvailable = numberOrNull(electrumJson?.breathsAvailable);
    const cycle = numberOrNull(electrumJson?.cycle ?? worldJson?.cycle);

    container.innerHTML = '';

    const article = document.createElement('article');
    article.className = 'world-card';

    const name = document.createElement('h1');
    name.className = 'world-name';
    name.textContent = stewardName;

    const viewport = document.createElement('div');
    viewport.className = 'world-viewport';
    viewport.setAttribute('aria-hidden', 'true');

    const glyph = document.createElement('span');
    glyph.className = 'world-glyph';
    glyph.textContent = '✶';

    const sigil = document.createElement('img');
    sigil.className = 'world-sigil';
    sigil.alt = `${stewardName} sigil`;
    sigil.loading = 'lazy';
    sigil.src = `/worlds/${encodeURIComponent(id)}/sigil.png`;

    sigil.addEventListener('load', () => {
      sigil.classList.add('is-ready');
      glyph.setAttribute('hidden', 'hidden');
    });

    sigil.addEventListener('error', () => {
      sigil.remove();
      glyph.removeAttribute('hidden');
    });

    viewport.append(glyph, sigil);

    const stats = document.createElement('p');
    stats.className = 'world-stats';
    stats.textContent = `ELECTRUM: ${currentElectrum ?? '—'} • BREATHS: ${breathsAvailable ?? '—'} • CYCLE: ${cycle ?? '—'}`;

    article.append(name, viewport, stats);

    const sigilSection = createCopySection('Sigil Prompt', sigilPrompt);
    if (sigilSection) article.appendChild(sigilSection);

    const strategySection = createCopySection('Strategy / Intention', strategy);
    if (strategySection) article.appendChild(strategySection);

    container.appendChild(article);
  }

  async function main() {
    const params = new URLSearchParams(window.location.search);
    const id = (params.get('id') || '').trim();

    if (!id) {
      renderState('NO WORLD SELECTED.');
      return;
    }

    let worldJson;
    try {
      const worldRes = await fetch(`/worlds/${encodeURIComponent(id)}/world.json`, { cache: 'no-store' });
      if (!worldRes.ok) throw new Error(String(worldRes.status));
      worldJson = await worldRes.json();
    } catch {
      renderState('WORLD NOT FOUND.');
      return;
    }

    let electrumJson = null;
    try {
      const electrumRes = await fetch(`/worlds/${encodeURIComponent(id)}/electrum.json`, { cache: 'no-store' });
      if (electrumRes.ok) {
        electrumJson = await electrumRes.json();
      }
    } catch {
      electrumJson = null;
    }

    renderWorld(id, worldJson, electrumJson);
  }

  main();
})();

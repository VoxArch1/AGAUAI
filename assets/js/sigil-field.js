(function () {
  const grid = document.getElementById('sigilGrid');
  if (!grid) return;

  function formatStat(label, value) {
    return `${label}: ${value ?? '—'}`;
  }

  function worldStats(world) {
    return [
      formatStat('ELECTRUM', world.currentElectrum),
      formatStat('BREATHS', world.breathsAvailable),
      formatStat('CYCLE', world.cycle)
    ].join(' • ');
  }

  function renderEmpty() {
    grid.innerHTML = '';

    const empty = document.createElement('p');
    empty.className = 'sigil-empty';
    empty.append('NO SIGNALS YET.');

    const hint = document.createElement('span');
    hint.textContent = 'Add a world under /worlds/';
    empty.appendChild(document.createElement('br'));
    empty.appendChild(hint);

    grid.appendChild(empty);
  }

  function createTile(world) {
    const card = document.createElement('a');
    const statsLine = worldStats(world);

    card.className = 'sigil-tile';
    card.href = `/world.html?id=${encodeURIComponent(world.id)}`;
    card.setAttribute('aria-label', `${world.stewardName}. ${statsLine}`);

    const viewport = document.createElement('div');
    viewport.className = 'sigil-viewport';

    const glyph = document.createElement('span');
    glyph.className = 'sigil-glyph';
    glyph.textContent = '✶';
    viewport.appendChild(glyph);

    const sigilImg = document.createElement('img');
    sigilImg.className = 'sigil-image';
    sigilImg.loading = 'lazy';
    sigilImg.alt = `${world.stewardName} sigil`;
    sigilImg.src = `/worlds/${encodeURIComponent(world.id)}/sigil.png`;

    sigilImg.addEventListener('load', () => {
      sigilImg.classList.add('is-ready');
      glyph.setAttribute('hidden', 'hidden');
    });

    sigilImg.addEventListener('error', () => {
      sigilImg.remove();
      glyph.removeAttribute('hidden');
    });

    viewport.appendChild(sigilImg);

    const name = document.createElement('h2');
    name.className = 'sigil-name';
    name.textContent = world.stewardName;

    const stats = document.createElement('p');
    stats.className = 'sigil-stats';
    stats.textContent = statsLine;

    card.append(viewport, name, stats);
    return card;
  }

  function renderWorlds(worlds) {
    if (!Array.isArray(worlds) || worlds.length === 0) {
      renderEmpty();
      return;
    }

    const fragment = document.createDocumentFragment();
    worlds.forEach((world) => {
      fragment.appendChild(createTile(world));
    });

    grid.innerHTML = '';
    grid.appendChild(fragment);
  }

  fetch('./data/worlds-index.json', { cache: 'no-store' })
    .then((response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    })
    .then((payload) => renderWorlds(payload?.worlds))
    .catch(() => renderEmpty());
})();

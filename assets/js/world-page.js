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
    container.innerHTML = `<p class="world-state">${message}</p>`;
  }

  function renderWorld(id, worldJson, electrumJson) {
    const stewardName = textOrNull(worldJson?.stewardName) || textOrNull(worldJson?.name) || id;
    const sigilPrompt = textOrNull(worldJson?.sigilPrompt) || textOrNull(worldJson?.sigil?.prompt);
    const strategy = textOrNull(worldJson?.strategyStatement) || textOrNull(worldJson?.intention);

    const currentElectrum = numberOrNull(electrumJson?.currentElectrum ?? electrumJson?.electrum);
    const breathsAvailable = numberOrNull(electrumJson?.breathsAvailable);
    const cycle = numberOrNull(electrumJson?.cycle ?? worldJson?.cycle);

    container.innerHTML = `
      <article class="world-card">
        <h1 class="world-name">${stewardName}</h1>
        <div class="world-viewport" aria-hidden="true">
          <span class="world-glyph">✶</span>
          <img class="world-sigil" alt="${stewardName} sigil" loading="lazy" src="/worlds/${encodeURIComponent(id)}/sigil.png" />
        </div>
        <p class="world-stats">ELECTRUM: ${currentElectrum ?? '—'} • BREATHS: ${breathsAvailable ?? '—'} • CYCLE: ${cycle ?? '—'}</p>
        ${sigilPrompt ? `<section class="world-section"><h2>Sigil Prompt</h2><p class="world-copy"></p></section>` : ''}
        ${strategy ? `<section class="world-section"><h2>Strategy / Intention</h2><p class="world-copy"></p></section>` : ''}
      </article>
    `;

    const sigil = container.querySelector('.world-sigil');
    const glyph = container.querySelector('.world-glyph');
    if (sigil && glyph) {
      sigil.addEventListener('load', () => {
        sigil.classList.add('is-ready');
        glyph.setAttribute('hidden', 'hidden');
      });
      sigil.addEventListener('error', () => {
        sigil.remove();
        glyph.removeAttribute('hidden');
      });
    }

    const copies = container.querySelectorAll('.world-copy');
    let copyIndex = 0;
    if (sigilPrompt && copies[copyIndex]) {
      copies[copyIndex].textContent = sigilPrompt;
      copyIndex += 1;
    }
    if (strategy && copies[copyIndex]) {
      copies[copyIndex].textContent = strategy;
    }
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

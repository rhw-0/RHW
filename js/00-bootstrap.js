/* Utilities required while the first dashboard script is loading. */
if (typeof window.debounce !== 'function') {
  window.debounce = function debounceBootstrap(func, wait) {
    let timeout;
    return (...args) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func(...args), wait);
    };
  };
}

/* The runtime smoke harness inlines the V4 bundle after the stable dashboard
   scripts. In that environment dynamic loading would execute the app twice. */
if (!window.__RHW_SMOKE_INLINE__) {
  /* V4 is intentionally layered on top of the stable V3.6 command dashboard.
     Load every V4 stylesheet immediately to avoid an unstyled app-shell flash,
     but wait until the stable dashboard has initialized before booting V4 JS. */
  (function bootstrapRhwV4Preview() {
    [
      ['./css/12-app-v40.css', 'rhwV4App'],
      ['./css/13-app-v40-navigation.css', 'rhwV40Nodes'],
      ['./css/14-app-v40-composer.css', 'rhwV40Composer'],
      ['./css/15-app-v40-audit.css', 'rhwV40Polish'],
      ['./css/16-app-v40-operations.css', 'rhwV40Operations'],
      ['./css/17-app-v40-calculator-polish.css', 'rhwV40CalculatorPolish']
    ].forEach(([href, dataKey]) => {
      if (document.querySelector(`link[href="${href}"]`)) return;
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = href;
      link.dataset[dataKey] = 'true';
      document.head.appendChild(link);
    });

    window.addEventListener('DOMContentLoaded', () => {
      if (document.documentElement.dataset.rhwApp === 'v4') return;
      const files = [
        ['./js/12-app-config.js', 'rhwV4Config'],
        ['./js/13-app-v40.js', 'rhwV4Core'],
        ['./js/14-app-v40-cache.js', 'rhwV4Storage'],
        ['./js/15-app-v40-navigation.js', 'rhwV4Command'],
        ['./js/16-app-v40-composer.js', 'rhwV4Comms'],
        ['./js/16a-app-v40-comms-safety.js', 'rhwV4CommsSafety'],
        ['./assets/recipes/catalog-v1-part-01.js', 'rhwV4RecipeCatalog01'],
        ['./assets/recipes/catalog-v1-part-02.js', 'rhwV4RecipeCatalog02'],
        ['./assets/recipes/catalog-v1-part-03.js', 'rhwV4RecipeCatalog03'],
        ['./assets/recipes/catalog-v1-part-04.js', 'rhwV4RecipeCatalog04'],
        ['./assets/recipes/catalog-v1-part-05.js', 'rhwV4RecipeCatalog05'],
        ['./assets/recipes/catalog-v1-part-06.js', 'rhwV4RecipeCatalog06'],
        ['./js/17-app-v40-operations-core.js', 'rhwV4OperationsCore'],
        ['./js/18-app-v40-operations-ui.js', 'rhwV4OperationsUi'],
        ['./js/19-app-v40-runtime.js', 'rhwV4Runtime']
      ];

      const loadNext = index => {
        if (index >= files.length) return;
        const [src, dataKey] = files[index];
        const script = document.createElement('script');
        script.src = src;
        script.dataset[dataKey] = 'true';
        script.addEventListener('load', () => loadNext(index + 1), { once: true });
        script.addEventListener('error', () => console.error(`RHW V4 asset failed to load: ${src}`), { once: true });
        document.body.appendChild(script);
      };
      loadNext(0);
    }, { once: true });
  })();
}

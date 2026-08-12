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
    const RHW_V4_ASSET_REV = '4.0.2-release-1';
    const versioned = src => `${src}?v=${encodeURIComponent(RHW_V4_ASSET_REV)}`;

    [
      ['./css/12-app-v40.css', 'rhwV4App'],
      ['./css/13-app-v40-navigation.css', 'rhwV40Nodes'],
      ['./css/14-app-v40-composer.css', 'rhwV40Composer'],
      ['./css/15-app-v40-audit.css', 'rhwV40Polish'],
      ['./css/16-app-v40-operations.css', 'rhwV40Operations'],
      ['./css/17-app-v40-calculator-polish.css', 'rhwV40CalculatorPolish'],
      ['./css/18-app-v40-nav-hierarchy.css', 'rhwV40NavHierarchy'],
      ['./css/19-app-v402-fixes.css', 'rhwV402Fixes']
    ].forEach(([href, dataKey]) => {
      if (document.querySelector(`link[data-${dataKey.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`)}="true"]`)) return;
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = versioned(href);
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
        ['./js/16b-app-v40-newswire-manager.js', 'rhwV4NewswireManager'],
        ['./js/16c-app-v40-newswire-ordering.js', 'rhwV4NewswireOrdering'],
        ['./assets/recipes/catalog-v1-part-01.js', 'rhwV4RecipeCatalog01'],
        ['./assets/recipes/catalog-v1-part-02.js', 'rhwV4RecipeCatalog02'],
        ['./assets/recipes/catalog-v1-part-03.js', 'rhwV4RecipeCatalog03'],
        ['./assets/recipes/catalog-v1-part-04.js', 'rhwV4RecipeCatalog04'],
        ['./assets/recipes/catalog-v1-part-05.js', 'rhwV4RecipeCatalog05'],
        ['./assets/recipes/catalog-v1-part-06.js', 'rhwV4RecipeCatalog06'],
        ['./js/17-app-v40-operations-core.js', 'rhwV4OperationsCore'],
        ['./js/18-app-v40-operations-ui.js', 'rhwV4OperationsUi'],
        ['./js/18a-app-v40-nav-hierarchy.js', 'rhwV4NavHierarchy'],
        ['./js/18b-app-v40-production-pricing.js', 'rhwV4ProductionPricing'],
        ['./js/18c-app-v40-recipe-corrections.js', 'rhwV4RecipeCorrections'],
        ['./js/18d-app-v40-final-ui-polish.js', 'rhwV4FinalUiPolish'],
        ['./js/20-app-v402-fixes.js', 'rhwV402Fixes'],
        ['./js/19-app-v40-runtime.js', 'rhwV4Runtime']
      ];

      const loadNext = index => {
        if (index >= files.length) return;
        const [src, dataKey] = files[index];
        const script = document.createElement('script');
        script.src = versioned(src);
        script.dataset[dataKey] = 'true';
        script.addEventListener('load', () => loadNext(index + 1), { once: true });
        script.addEventListener('error', () => console.error(`RHW V4 asset failed to load: ${src}`), { once: true });
        document.body.appendChild(script);
      };
      loadNext(0);
    }, { once: true });
  })();
}
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

/* V4 is intentionally layered on top of the stable V3.6 command dashboard.
   Load every V4 stylesheet immediately to avoid an unstyled app-shell flash,
   but wait until the stable dashboard has initialized before booting V4 JS. */
(function bootstrapRhwV4Preview() {
  [
    ['./css/12-app-v40.css', 'rhwV4App'],
    ['./css/13-app-v40-navigation.css', 'rhwV40Nodes'],
    ['./css/14-app-v40-composer.css', 'rhwV40Composer'],
    ['./css/15-app-v40-audit.css', 'rhwV40Audit']
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

    const config = document.createElement('script');
    config.src = './js/12-app-config.js';
    config.dataset.rhwV4Config = 'true';
    config.addEventListener('load', () => {
      const app = document.createElement('script');
      app.src = './js/13-app-v40.js';
      app.dataset.rhwV4App = 'true';
      app.addEventListener('load', () => {
        const cacheTools = document.createElement('script');
        cacheTools.src = './js/14-app-v40-cache.js';
        cacheTools.dataset.rhwV4Cache = 'true';
        cacheTools.addEventListener('load', () => {
          const nodes = document.createElement('script');
          nodes.src = './js/15-app-v40-navigation.js';
          nodes.dataset.rhwV4Nodes = 'true';
          nodes.addEventListener('load', () => {
            const composer = document.createElement('script');
            composer.src = './js/16-app-v40-composer.js';
            composer.dataset.rhwV4Composer = 'true';
            composer.addEventListener('load', () => {
              const audit = document.createElement('script');
              audit.src = './js/17-app-v40-audit.js';
              audit.dataset.rhwV40Audit = 'true';
              document.body.appendChild(audit);
            }, { once: true });
            document.body.appendChild(composer);
          }, { once: true });
          document.body.appendChild(nodes);
        }, { once: true });
        document.body.appendChild(cacheTools);
      }, { once: true });
      document.body.appendChild(app);
    }, { once: true });
    document.body.appendChild(config);
  }, { once: true });
})();

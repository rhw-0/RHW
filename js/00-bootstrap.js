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
   Load the presentation stylesheet immediately, but wait until every legacy
   dashboard script has finished before booting the app shell and COMMS tools. */
(function bootstrapRhwV4Preview() {
  if (!document.querySelector('link[data-rhw-v4-app]')) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = './css/12-app-v40.css';
    link.dataset.rhwV4App = 'true';
    document.head.appendChild(link);
  }

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
        document.body.appendChild(cacheTools);
      }, { once: true });
      document.body.appendChild(app);
    }, { once: true });
    document.body.appendChild(config);
  }, { once: true });
})();

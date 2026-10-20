(() => {
  'use strict';
  const supported = Object.keys(GODFIELD_CATALOG.languages);
  function detectLanguage(search, languages) {
    const explicit = new URLSearchParams(search).get('lang');
    if (supported.includes(explicit)) return explicit;
    // Mirror the game: try each browser language exactly, then by its prefix.
    for (const lang of languages) {
      if (supported.includes(lang)) return lang;
      const match = supported.find(candidate => lang.startsWith(candidate.slice(0, 2)));
      if (match) return match;
    }
    return 'en';
  }
  function item(id, language) {
    if (!Number.isSafeInteger(id) || id <= 0) return null;
    const model = GODFIELD_CATALOG.models[id - 1];
    if (!model) return null;
    const locale = GODFIELD_CATALOG.languages[language] ?? GODFIELD_CATALOG.languages.en;
    const name = locale.names[id - 1] || GODFIELD_CATALOG.languages.en.names[id - 1];
    const stats = [];
    if (model.atk) stats.push((locale.stats[model.isPlusAtk ? 'plusAtk' : 'atk']).replace('{{atk}}', model.atk));
    if (model.def) stats.push(locale.stats.def.replace('{{def}}', model.def));
    if (model.cost) stats.push(locale.stats.cost.replace('{{mp}}', model.cost));
    return {
      ...model, name, stats,
      categoryLabel: locale.categories[model.category],
      image: `https://godfield.net/images/items/${encodeURIComponent(model.category)}/${encodeURIComponent(model.imageName)}.webp`
    };
  }
  globalThis.GodfieldLocalization = Object.freeze({ supported, detectLanguage, item });
})();

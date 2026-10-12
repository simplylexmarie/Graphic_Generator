// ---------- Bakken-Young: the studio adapter ----------
// What the shared calendar and Clear modules need to know about this studio. There's no
// calendar for Bakken-Young yet; when its clients.js entry gets a calendar block, the panel
// appears and each post's hook text fills the headline. Generating options from the calendar
// needs specsFor/buildOption here (see src/springforth/studio.js for the pattern).
const STUDIO = {
  slug: 'bakken-young', name: 'Bakken-Young', filePrefix: 'BakkenYoung',
  buckets: [],
  bucketTopics: {},
  headlineTemplate: 'headline',
  // blank page: the logo on the current photo, nothing else
  blank(){ S.template = 'logo'; S.els = []; },
};

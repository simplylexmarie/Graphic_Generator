// ---------- McMillan: the studio adapter ----------
// What the shared calendar and Clear modules need to know about this studio. There's no
// calendar for McMillan yet; when its clients.js entry gets a calendar block, the panel
// appears and each post's hook text fills the headline. Generating options from the calendar
// needs specsFor/buildOption here (see src/springforth/studio.js for the pattern).
const STUDIO = {
  slug: 'mcmillan', name: 'McMillan', filePrefix: 'McMillan',
  buckets: [],
  bucketTopics: {},
  headlineTemplate: 'headline',
  // blank page: the logo on the green art background
  blank(){
    S.template = 'logo'; S.els = [];
    if (S.bg.kind === 'collage') { S.bg.kind = 'art'; S.bg.cells = null; }
  },
};

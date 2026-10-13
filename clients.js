// One entry per client. The welcome page and every tool's client dropdown read from this list.
window.BI_CLIENTS = [
  {
    slug: 'bakken-young',
    name: 'Bakken-Young',
    full: 'Bakken-Young Funeral & Cremation Services',
    tagline: 'Social graphics',
    accent: '#19441f',
    accent2: '#719587',
    logo: 'bakken-young/logo.png'
  },
  {
    slug: 'mcmillan',
    name: 'McMillan',
    full: 'McMillan Precision Electric Motors',
    tagline: 'Social graphics',
    accent: '#034226',
    accent2: '#006c40',
    logo: 'mcmillan/logo.png'
  },
  {
    slug: 'springforth',
    name: 'Spring Forth',
    full: 'Spring Forth Academy',
    tagline: 'Social graphics',
    accent: '#03a2c6',
    accent2: '#1cc1e0',
    logo: 'springforth/logo.png',
    // The monthly posting schedule. One tab per month, shared as "anyone with the link can
    // view", read straight from the browser with no key. headerRow/firstPostRow are the
    // sheet's own row numbers, kept for reference — the reader finds the header row by its
    // contents, because the CSV endpoint drops empty leading rows. The column letters are
    // the fallback for headers that have no text of their own (DATE is one).
    calendar: {
      sheetId: '193QX-MsW4weMBOw9WRUNWAtE6iNmF5EMj1Rge5n3dcY',
      url: 'https://docs.google.com/spreadsheets/d/193QX-MsW4weMBOw9WRUNWAtE6iNmF5EMj1Rge5n3dcY/edit',
      headerRow: 10,
      firstPostRow: 12,
      cols: { week:'B', day:'C', date:'J', bucket:'K', hook:'L', image:'M', post:'N' },
      // the days AI drafting posts on by default (it can be changed when drafting)
      postDays: ['Mon', 'Wed'],
      // phase 2: an Apps Script web app that files the PNG in Drive and writes column M
      driveEndpoint: null
    }
  }
];

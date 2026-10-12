"""Shared studio features, added to every client's page at build time.

Every studio is built from the same editor, so the same anchors exist in each. This adds the
pieces that aren't specific to any one client:

  • the social calendar (reads the client's Google Sheet; only shows for a client whose
    clients.js entry has a `calendar` block)
  • "Generate from calendar" with three options, and the whole-month batch — shown when the
    studio's adapter knows how to build options (STUDIO.specsFor / STUDIO.buildOption)
  • Save to Drive (shown once calendar.driveEndpoint is set)
  • Clear, and scroll/pinch zoom for photos

Each studio supplies its adapter in src/<slug>/studio.js: a `STUDIO` object with its slug,
display name, file prefix, buckets and how to blank its page, plus the option builder if it
has one.
"""
import pathlib
ROOT = pathlib.Path(__file__).resolve().parent.parent.parent
SHARED = ROOT / 'src/shared'
MODULES = ['calendar.js', 'options.js', 'month.js', 'clear.js', 'zoom.js']

CAL_SECTION = """    <div class="sec" id="calSec" hidden>
      <h2>Calendar <button class="btn link" id="calSync" title="Re-read the sheet now">Refresh</button> <button class="btn link" id="calOpen" title="Open the schedule in Google Sheets">Open calendar</button></h2>
      <div class="cal-nav">
        <button class="btn sm" id="calPrev" title="Previous month with a tab" aria-label="Previous month">‹</button>
        <select id="calMonth" aria-label="Month"></select>
        <button class="btn sm" id="calNext" title="Next month with a tab" aria-label="Next month">›</button>
      </div>
      <p class="hint" id="calStatus"></p>
      <button class="btn sm" id="calMonthGen" style="width:100%;margin-bottom:6px" title="One graphic for every post in this month, with layouts and borders mixed">\U0001F5D3 Generate the whole month</button>
      <div class="cal-grid" id="calGrid"></div>
      <div class="cal-legend" id="calLegend"></div>
      <div id="calDetail"></div>
    </div>
"""

RIGHT_SECTIONS = """    <div class="sec opts" id="opts" hidden>
      <h2>Options for this post <button class="btn link" id="optsClose" title="Hide the options">Close</button></h2>
      <div class="opts-row" id="optsRow"></div>
      <button class="btn sm" id="optsMore" style="width:100%;margin-top:8px" title="Three more, with the next-best photos">More options</button>
    </div>
    <div class="sec" id="monthSec" hidden>
      <h2><span id="monthTitle">This month</span> <button class="btn link" id="monthClose" title="Put the month set away">Close</button></h2>
      <p class="hint" style="margin:0 0 6px">Click a post to open it on the canvas and adjust it — your changes are kept.</p>
      <div class="opts-row" id="monthGrid"></div>
      <button class="btn sm primary" id="monthZip" style="width:100%;margin-top:8px" title="Every graphic as a PNG named by date, plus captions.txt">Download all (zip)</button>
      <button class="btn sm" id="monthDrive" style="width:100%;margin-top:6px" hidden title="File every graphic in the Drive folder and show it in the calendar sheet">☁ Save all to Drive</button>
    </div>
"""


def _rep(html, a, b):
    assert html.count(a) == 1, ('shared anchor', html.count(a), a[:80])
    return html.replace(a, b)


def apply(html, slug):
    adapter = (ROOT / 'src' / slug / 'studio.js').read_text()
    css = (SHARED / 'calendar.css').read_text()
    js = '\n'.join([adapter] + [(SHARED / m).read_text() for m in MODULES])

    html = _rep(html, '</style>', css + '</style>') if html.count('</style>') == 1 else \
        html.replace('</style>', css + '</style>', 1)
    html = _rep(html, '  <aside class="panel" id="left">\n', '  <aside class="panel" id="left">\n' + CAL_SECTION)
    html = _rep(html, '  <aside class="panel" id="right">\n', '  <aside class="panel" id="right">\n' + RIGHT_SECTIONS)
    html = _rep(html, '<button class="btn sm gen" id="genBtn"',
                '<button class="btn sm gen" id="calGen" hidden disabled title="Pick a post in the calendar first">\U0001F4C5 Generate from calendar</button>\n'
                '      <button class="btn sm gen" id="genBtn"')
    html = _rep(html, '<button class="btn sm" id="resetBtn" title="Put everything back where the template starts">Reset layout</button>',
                '<button class="btn sm" id="resetBtn" title="Put everything back where the template starts">Reset layout</button>\n'
                '    <button class="btn sm" id="clearBtn" title="Start over on a blank page (Undo brings it back)">Clear</button>')
    html = _rep(html, '<button class="btn primary" id="dlBtn">Download PNG</button>',
                '<button class="btn sm" id="driveBtn" hidden title="File this graphic in the Drive folder and show it in the calendar sheet">☁ Save to Drive</button>\n'
                '    <button class="btn primary" id="dlBtn">Download PNG</button>')
    # a graphic made for a calendar post is named after it, so a month's files sort by date
    html = _rep(html, 'function filename(size){\n',
                'function filename(size){\n  { const cal = (size == null) && calFilename(); if (cal) return cal; }\n')
    html = _rep(html, 'saveBlob(blob, filename()); markUsed();',
                'saveBlob(blob, filename()); markUsed(); markPostDone(selectedPost());')
    html = _rep(html, '// ---------- misc ----------', js + '\n// ---------- misc ----------')
    return html

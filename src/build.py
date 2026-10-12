#!/usr/bin/env python3
"""Build each client's studio page from its template + assets.
Usage: python3 src/build.py            (builds every client)

Logos ship as image files next to each studio (<client>/brand/*.png) rather than being
inlined, so browsers cache them. Every page gets the same head extras (favicon, description,
noindex) and a version stamp on clients.js so a changed client list is picked up without a
hard refresh.
"""
import pathlib, re, shutil, time
ROOT = pathlib.Path(__file__).resolve().parent.parent
VERSION = time.strftime('%Y%m%d%H%M')

def head_extras(html, desc, icon):
    # these are private client tools: keep them out of search results and image search
    extra = ('<meta name="robots" content="noindex, nofollow, noimageindex">\n'
             f'<meta name="description" content="{desc}">\n'
             f'<link rel="icon" href="{icon}">\n')
    html = html.replace('<meta charset="utf-8">\n', '<meta charset="utf-8">\n' + extra, 1)
    return re.sub(r'src="(\.\./)?clients\.js(\?v=\d+)?"', lambda m: f'src="{m.group(1) or ""}clients.js?v={VERSION}"', html)

def ship_logos(slug, tpl, files):
    """Copy each logo into <slug>/brand/ and point the template's placeholder at it."""
    out = ROOT/slug/'brand'; out.mkdir(parents=True, exist_ok=True)
    for key, src in files:
        shutil.copyfile(src, out/src.name)
        tpl = tpl.replace(f'data:image/png;base64,{key}', f'brand/{src.name}')
    return tpl

def build_bakken_young():
    tpl = (ROOT/'src/template-bakken-young.html').read_text()
    html = ship_logos('bakken-young', tpl, [('__LOGO_B64__', ROOT/'assets/bakken-young/logo-white.png')])
    html = head_extras(html, 'Bakken-Young social graphics studio', 'logo.png')
    (ROOT/'bakken-young/index.html').write_text(html); print('bakken-young  ok')

def build_mcmillan():
    src = ROOT/'src/template-mcmillan.html'
    if not src.exists(): print('mcmillan      (no template yet)'); return
    A = ROOT/'assets/mcmillan'
    html = ship_logos('mcmillan', src.read_text(), [('__LOGO_B64__', A/'logo-white.png'),
                      ('__MARK_B64__', A/'mark-white.png'), ('__LOGOC_B64__', A/'logo-color.png')])
    html = head_extras(html, 'McMillan social graphics studio', 'logo.png')
    (ROOT/'mcmillan/index.html').write_text(html); print('mcmillan      ok')

def build_springforth():
    src = ROOT/'src/template-springforth.html'
    if not src.exists(): print('springforth   (no template yet)'); return
    A = ROOT/'assets/springforth'
    html = ship_logos('springforth', src.read_text(), [
        ('__MARK_B64__', A/'mark-color.png'), ('__MARKW_B64__', A/'mark-white.png'),
        ('__LOCKUP_B64__', A/'lockup-color.png'), ('__LOCKUPW_B64__', A/'lockup-white.png'),
        ('__WORD_B64__', A/'wordmark-h.png'), ('__WORDW_B64__', A/'wordmark-h-white.png')])
    html = head_extras(html, 'Spring Forth Academy social graphics studio', 'logo.png')
    (ROOT/'springforth/index.html').write_text(html); print('springforth   ok')

def build_welcome():
    p = ROOT/'index.html'; html = p.read_text()
    if 'name="robots"' not in html:
        html = head_extras(html, 'Brilliant Impact client graphics studio', "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='14' fill='%231ea4e2'/%3E%3Ctext x='32' y='42' font-family='Arial' font-weight='700' font-size='28' fill='white' text-anchor='middle'%3EBI%3C/text%3E%3C/svg%3E")
    else:
        html = re.sub(r'src="clients\.js(\?v=\d+)?"', f'src="clients.js?v={VERSION}"', html)
    p.write_text(html); print('welcome       ok')

if __name__ == '__main__':
    build_bakken_young(); build_mcmillan(); build_springforth(); build_welcome()

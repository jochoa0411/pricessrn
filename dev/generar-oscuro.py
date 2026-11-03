#!/usr/bin/env python3
"""Genera modo-oscuro.css a partir de los <style> de cotizador.html (paleta tipo iOS: negro #000, tarjetas #1c1c1e, relleno #2c2c2e,
texto #f5f5f7 / #98989d, bordes #38383a; blanco y negro). Uso: cd ~/lgm-precios && python3 dev/generar-oscuro.py"""
import re, colorsys
html = open('cotizador.html', encoding='utf-8').read()
css = '\n'.join(re.findall(r'<style[^>]*>(.*?)</style>', html, re.S))
css = re.sub(r'/\*.*?\*/', '', css, flags=re.S)
NAMED = {'white': '#ffffff', 'black': '#000000', 'transparent': None}
def hex2rgb(h):
    h = h.lstrip('#')
    if len(h) == 3: h = ''.join(c*2 for c in h)
    return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))
def rgb2hex(r, g, b): return '#%02x%02x%02x' % (r, g, b)
def info(r, g, b):
    h, l, s = colorsys.rgb_to_hls(r/255, g/255, b/255)
    return h*360, l, s
CARD, FILL, FILL2, TXT, TXT2, LINE = '#1c1c1e', '#2c2c2e', '#3a3a3c', '#f5f5f7', '#98989d', '#38383a'
def mapc(kind, r, g, b, a=None, ctx=''):
    h, l, s = info(r, g, b)
    verde = 80 <= h <= 170 and s > .2
    rojo = (h < 20 or h > 340) and s > .35
    ambar = 20 <= h < 55 and s > .45
    azul = 190 <= h <= 260 and s > .35
    if kind == 'bg':
        if l > .96: return '#2c2c2e' if re.search(r'input|select|textarea|\.field|\.sw\b', ctx) else CARD
        if verde and l < .3: return TXT            # botón primario verde -> blanco
        if verde and l >= .3 and l < .6: return '#d1d1d6'
        if (verde or azul) and l >= .8: return FILL
        if rojo and l >= .8: return '#3a1f1d'
        if ambar and l >= .8: return '#3a2f1a'
        if l >= .6 and s <= .25: return FILL if l >= .85 else FILL2
        return None
    if kind == 'color':
        if l > .96: return None
        if verde and l < .45: return TXT
        if rojo: return '#ff6961'
        if ambar: return '#ff9f0a'
        if azul: return '#64a8ff'
        if l < .45: return TXT
        if l < .7: return TXT2
        return None
    if kind == 'border':
        if l > .6 or (verde and l >= .3): return LINE
        if verde: return '#48484a'
        return None
def conv(kind, val, ctx):
    cambio = [False]
    def rep(m):
        t = m.group(0)
        a = None
        if t.startswith('#'): r, g, b = hex2rgb(t)
        elif t.lower().startswith('rgb'):
            n = [float(x) for x in re.findall(r'[\d.]+', t)]
            r, g, b = [int(x) for x in n[:3]]; a = n[3] if len(n) > 3 else None
            if a is not None and a < .08: return t
            if kind == 'bg' and r+g+b == 0: return t
        elif t.lower() in NAMED and NAMED[t.lower()]: r, g, b = hex2rgb(NAMED[t.lower()])
        else: return t
        n = mapc(kind, r, g, b, a, ctx)
        if not n: return t
        cambio[0] = True
        if a is not None and a < 1:
            rr, gg, bb = hex2rgb(n); return 'rgba(%d,%d,%d,%s)' % (rr, gg, bb, a)
        return n
    out = re.sub(r'#[0-9a-fA-F]{3,6}\b|rgba?\([^)]*\)|\bwhite\b|\bblack\b', rep, val)
    return out if cambio[0] else None
def prefijar(sel):
    sel = sel.strip()
    if sel.startswith('html'): return 'html.tema-oscuro' + sel[4:]
    if sel.startswith('body'): return 'html.tema-oscuro ' + sel
    if sel.startswith(':root'): return 'html.tema-oscuro' + sel[5:]
    return 'html.tema-oscuro ' + sel
def reglas(bloque):
    out = []
    for m in re.finditer(r'([^{}]+)\{([^{}]*)\}', bloque):
        sel, body = m.group(1).strip(), m.group(2)
        if sel.startswith('@') or not sel: continue
        decls = []
        primario = False
        for d in body.split(';'):
            if ':' not in d: continue
            p, v = d.split(':', 1); p = p.strip().lower(); v = v.strip()
            kind = 'bg' if p in ('background', 'background-color') else 'color' if p in ('color', 'fill', 'stroke', 'caret-color') else 'border' if p.startswith('border') or p == 'outline' or p == 'outline-color' else None
            if not kind: continue
            nv = conv(kind, v, sel)
            if nv:
                decls.append('%s: %s !important' % (p, nv.replace('!important', '').strip()))
                if kind == 'bg' and TXT in nv and 'gradient' not in nv: primario = True
        if primario and not any(x.startswith('color') for x in decls): decls.append('color: #000 !important')
        if decls:
            sels = ', '.join(prefijar(s) for s in sel.split(','))
            out.append('%s { %s }' % (sels, '; '.join(decls)))
    return out
res = []
# separa bloques @media (se conservan salvo print) de las reglas sueltas
resto = css
for m in re.finditer(r'@media([^{]+)\{((?:[^{}]*\{[^{}]*\})*)\}', css):
    cond, interior = m.group(1).strip(), m.group(2)
    resto = resto.replace(m.group(0), '')
    if 'print' in cond: continue
    rr = reglas(interior)
    if rr: res.append('@media %s {\n  %s\n}' % (cond, '\n  '.join(rr)))
base = reglas(re.sub(r'@(keyframes|font-face)[^{]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}', '', resto))
cab = '/* GENERADO por dev/generar-oscuro.py — no editar a mano; los retoques van en modo-oscuro-extra.css */\n'
open('modo-oscuro.css', 'w', encoding='utf-8').write(cab + '\n'.join(base + res) + '\n')
print(len(base), 'reglas base,', len(res), 'bloques media')

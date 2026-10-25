"""Builds index.html from the files in src/ (the HTML shell plus the JavaScript parts in order)."""
import glob
import os

here = os.path.dirname(os.path.abspath(__file__))
src = os.path.join(here, 'src')
head = open(os.path.join(src, '00_head.html')).read()
js = ''
for f in sorted(glob.glob(os.path.join(src, '*.js'))):
    js += '\n// ==== ' + os.path.basename(f) + ' ====\n' + open(f).read()
three = '<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>'
split = head.index('</style>') + len('</style>')
page = ('<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n'
        '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
        + head[:split] + '\n</head>\n<body>\n' + head[split:] + '\n' + three +
        '\n<script>\n(function(){\n' + js + '\n})();\n</script>\n</body>\n</html>\n')
open(os.path.join(here, 'index.html'), 'w').write(page)
print('built index.html,', len(page), 'bytes')

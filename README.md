# tradigital

Multi-angle G2 character builder for Cartoon Animator (CrazyTalk Animator).

Status: backend SWF pipeline (reader, shape encoder, template assembler). See `docs/g2-template-spec.md`
for the template structure and `examples/` for a sample character spec.

```
npm run dump -- template.swf out.json            # inspect a template SWF
node tools/build-swf.js examples/demo-arms.json out/demo.swf
BILLY_SWF=/path/to/Billy\ Red\ Shirt.swf npm test   # template-dependent tests are skipped without it
```

`examples/template.swf` is not committed (`*.swf` is gitignored); copy your template there.

## Run it yourself

Needs Node 20+ (tested on 22). Your template SWF is not in the repo (`*.swf` is gitignored), so you supply it.

```
git clone -b claude/g2-crazy-talk-animator-o1absg https://github.com/toontitan/tradigital.git
cd tradigital
npm install
copy "Billy Red Shirt.swf" examples\template.swf      # Windows   (macOS/Linux: cp ... examples/template.swf)
npm run build:web
npm run server                                         # then open http://localhost:3001
```

Options: `PORT=8080` changes the port, `TEMPLATE_SWF=/path/to/template.swf` points at a template elsewhere.
On a server: run the same steps and put it behind a reverse proxy. There is no login, so do not expose it publicly as is;
exports are written to the browser's downloads and nothing is stored server-side.
Dev mode with hot reload: `npm run server` in one terminal and `npm run web` in another (http://localhost:5173).

## Editor

```
npm run build:web && npm run server     # http://localhost:3001  (template: examples/template.swf or TEMPLATE_SWF)
npm run server & npm run web            # dev: vite on :5173 proxies /api to :3001
```

Pick a view (left thumbnails) and a part, draw with Pen / Brush / Eraser / Fill / Select (shortcuts V P B E G),
link a mirror to the reflected partner, then Export SWF. Characters save as JSON (Save / Open, autosaved in the browser).
Undrawn single-frame parts export as neutral grey silhouettes; eyes, brows, nose, mouth and hands keep the template's frames.

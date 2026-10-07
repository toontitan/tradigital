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

## Editor

```
npm run build:web && npm run server     # http://localhost:3001  (template: examples/template.swf or TEMPLATE_SWF)
npm run server & npm run web            # dev: vite on :5173 proxies /api to :3001
```

Pick a view (left thumbnails) and a part, draw with Pen / Brush / Eraser / Fill / Select (shortcuts V P B E G),
link a mirror to the reflected partner, then Export SWF. Characters save as JSON (Save / Open, autosaved in the browser).
Undrawn single-frame parts export as neutral grey silhouettes; eyes, brows, nose, mouth and hands keep the template's frames.

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

// API: GET /api/template (slot geometry for the editor), POST /api/export (character JSON -> SWF).
// Template path: TEMPLATE_SWF env or examples/template.swf. Serves web/dist when built.
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TemplateSwf } from '../src/swf/template.js';
import { describeTemplate } from '../src/model/templateInfo.js';
import { compileCharacter } from '../src/model/compile.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function createApp(templatePath = process.env.TEMPLATE_SWF ?? path.join(root, 'examples/template.swf')) {
  const app = express();
  app.use(express.json({ limit: '50mb' }));
  let info = null, buffer = null;
  const load = () => {
    if (!fs.existsSync(templatePath)) throw new Error(`template SWF not found at ${templatePath} (set TEMPLATE_SWF)`);
    buffer ??= fs.readFileSync(templatePath);
    info ??= describeTemplate(new TemplateSwf(buffer));
    return { info, buffer };
  };
  app.get('/api/template', (req, res) => { try { res.json(load().info); } catch (e) { res.status(500).json({ error: e.message }); } });
  app.post('/api/export', (req, res) => {
    try {
      const { swf, report } = compileCharacter(req.body, load().buffer);
      res.set({ 'Content-Type': 'application/x-shockwave-flash', 'X-Report': encodeURIComponent(JSON.stringify({ drawn: report.drawn.length, mirrored: report.mirrored.length, fallback: report.fallback.length, warnings: report.warnings })), 'Access-Control-Expose-Headers': 'X-Report' });
      res.send(swf);
    } catch (e) { res.status(400).json({ error: e.message }); }
  });
  const dist = path.join(root, 'web/dist');
  if (fs.existsSync(dist)) { app.use(express.static(dist)); app.get(/^\/(?!api).*/, (req, res) => res.sendFile(path.join(dist, 'index.html'))); }
  return app;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = process.env.PORT ?? 3001;
  createApp().listen(port, () => console.log(`tradigital server on http://localhost:${port}`));
}

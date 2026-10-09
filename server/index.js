// API: GET /api/template (rig geometry for the editor), POST /api/export (character JSON -> SWF).
// No template file is needed: the built-in rig (src/rig/rigs/<RIG>.json, default "mojo") is used.
// Optional: TEMPLATE_SWF=/path/to/file.swf reads the layout from that SWF instead. Serves web/dist when built.
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Rig } from '../src/rig/rig.js';
import { extractRig } from '../src/rig/extract.js';
import { describeTemplate } from '../src/model/templateInfo.js';
import { compileFromRig } from '../src/model/compile-rig.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function loadRig({ templatePath = process.env.TEMPLATE_SWF, rigName = process.env.RIG ?? 'mojo' } = {}) {
  if (templatePath) {
    if (!fs.existsSync(templatePath)) throw new Error(`template SWF not found at ${templatePath}`);
    return new Rig(extractRig(fs.readFileSync(templatePath), path.basename(templatePath)));
  }
  const file = path.join(root, 'src/rig/rigs', `${rigName}.json`);
  if (!fs.existsSync(file)) throw new Error(`no built-in rig named ${rigName}`);
  return new Rig(JSON.parse(fs.readFileSync(file, 'utf8')));
}

export function createApp(rigOptions) {
  const app = express();
  app.use(express.json({ limit: '50mb' }));
  let rig = null, info = null;
  const load = () => { rig ??= loadRig(rigOptions); info ??= { ...describeTemplate(rig), rig: rig.name }; return { rig, info }; };
  app.get('/api/template', (req, res) => { try { res.json(load().info); } catch (e) { res.status(500).json({ error: e.message }); } });
  app.get('/api/rig', (req, res) => { try { res.json(load().rig.data); } catch (e) { res.status(500).json({ error: e.message }); } });
  app.post('/api/export', (req, res) => {
    try {
      const { swf, report } = compileFromRig(req.body, load().rig);
      res.set({
        'Content-Type': 'application/x-shockwave-flash',
        'X-Report': encodeURIComponent(JSON.stringify({ views: report.views, drawn: report.drawn.length, mirrored: report.mirrored.length, sets: report.expression.length, placeholders: report.placeholders.length, dots: report.dots.length, warnings: report.warnings })),
        'Access-Control-Expose-Headers': 'X-Report',
      });
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

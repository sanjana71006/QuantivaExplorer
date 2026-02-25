#!/usr/bin/env node
/*
  generate_2d_images.js

  Reads `frontend/public/processed_dataset.json` (array of molecule objects)
  and downloads a 2D PNG for each molecule from PubChem using SMILES or name.

  Usage:
    node generate_2d_images.js [--start=0] [--end=100] [--concurrency=6]

  Files are written to `frontend/public/molecule_images/{molecule_id || index}.png`.
  Existing files are skipped.

  Notes:
  - This script uses the PubChem PUG REST API; be kind to their service and use small concurrency.
  - If your dataset is large, consider running in batches.
*/

const fs = require('fs');
const path = require('path');
const https = require('https');

function fetchUrlBuffer(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': '3D-Viewer-Image-Downloader/1.0' } }, (res) => {
      const { statusCode } = res;
      const contentType = res.headers['content-type'] || '';
      if (statusCode !== 200) {
        // consume stream
        res.resume();
        return reject(new Error(`HTTP ${statusCode}`));
      }
      if (!contentType.includes('image')) {
        res.resume();
        return reject(new Error(`Unexpected content-type ${contentType}`));
      }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    });
    req.on('error', (err) => reject(err));
    req.setTimeout(20000, () => {
      req.abort();
      reject(new Error('Timeout'));
    });
  });
}

async function ensureDir(dir) {
  await fs.promises.mkdir(dir, { recursive: true });
}

function parseArgs() {
  const args = process.argv.slice(2);
  const out = {};
  args.forEach((a) => {
    if (a.startsWith('--')) {
      const [k, v] = a.slice(2).split('=');
      out[k] = v === undefined ? true : v;
    }
  });
  return out;
}

(async function main() {
  try {
    const args = parseArgs();
    const start = parseInt(args.start || '0', 10) || 0;
    const endArg = args.end;
    const end = endArg !== undefined ? parseInt(endArg, 10) : undefined;
    const concurrency = parseInt(args.concurrency || '6', 10) || 6;

    const datasetPath = path.resolve(__dirname, '..', '..', 'frontend', 'public', 'processed_dataset.json');
    if (!fs.existsSync(datasetPath)) {
      console.error('Dataset file not found:', datasetPath);
      process.exit(1);
    }

    const raw = await fs.promises.readFile(datasetPath, 'utf8');
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) {
      console.error('Expected JSON array in processed_dataset.json');
      process.exit(1);
    }

    const outDir = path.resolve(__dirname, '..', '..', 'frontend', 'public', 'molecule_images');
    await ensureDir(outDir);

    const items = data.slice(start, end === undefined ? undefined : end);
    console.log(`Will process ${items.length} molecules (start=${start}${end ? ` end=${end}` : ''}) with concurrency=${concurrency}`);

    let processed = 0;
    let success = 0;
    let skipped = 0;
    let failed = 0;

    const queue = items.slice();

    async function worker() {
      while (queue.length > 0) {
        const item = queue.shift();
        processed++;
        const id = item.molecule_id || item.id || item.CID || `${start + processed}`;
        const safeName = (item.name || '').replace(/[^a-zA-Z0-9-_ ]/g, '').slice(0, 60) || id;
        const fileName = `${id}.png`;
        const outPath = path.join(outDir, fileName);
        if (fs.existsSync(outPath)) {
          skipped++;
          process.stdout.write(`.${processed}`);
          continue;
        }

        const smiles = item.smiles || item.SMILES || item.SMILE || '';
        const name = item.name || item.title || '';

        const endpoints = [];
        if (smiles) endpoints.push(`https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/smiles/${encodeURIComponent(smiles)}/PNG?image_size=400x400`);
        if (name) endpoints.push(`https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${encodeURIComponent(name)}/PNG?image_size=400x400`);
        // fallback to CID if present
        if (item.CID || item.cid) endpoints.push(`https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${encodeURIComponent(item.CID || item.cid)}/PNG?image_size=400x400`);

        let fetched = false;
        for (const url of endpoints) {
          try {
            const buf = await fetchUrlBuffer(url);
            await fs.promises.writeFile(outPath, buf);
            success++;
            fetched = true;
            process.stdout.write(`+`);
            break;
          } catch (err) {
            // console.error('fetch failed', url, err.message);
            process.stdout.write(`-`);
            continue;
          }
        }
        if (!fetched) {
          failed++;
        }

        // small sleep to be polite
        await new Promise((r) => setTimeout(r, 120));
      }
    }

    const workers = [];
    for (let i = 0; i < concurrency; i++) workers.push(worker());

    await Promise.all(workers);

    console.log('\nDone. stats:', { processed, success, skipped, failed });
    if (failed > 0) process.exit(2);
    process.exit(0);
  } catch (err) {
    console.error('Failure:', err && err.message ? err.message : err);
    process.exit(1);
  }
})();

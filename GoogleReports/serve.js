const http = require('http');
const fs   = require('fs');
const path = require('path');

const root    = path.join(__dirname, '..');
const envFile = path.join(__dirname, '.env');
const mime    = { '.html':'text/html', '.css':'text/css', '.js':'application/javascript' };

// Parse .env manually — no dependencies needed
function loadEnv(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8')
      .split('\n')
      .reduce((acc, line) => {
        const [k, ...rest] = line.split('=');
        if (k && k.trim() && !k.trim().startsWith('#')) {
          acc[k.trim()] = rest.join('=').trim();
        }
        return acc;
      }, {});
  } catch (_) {
    return {};
  }
}

function buildS3ConfigScript(env) {
  const scripts = [];

  const s3 = {
    region:    env.S3_REGION     || 'us-east-1',
    bucket:    env.S3_BUCKET     || '',
    prefix:    env.S3_PREFIX     || '',
    accessKey: env.S3_ACCESS_KEY || '',
    secretKey: env.S3_SECRET_KEY || '',
  };
  if (s3.bucket && s3.accessKey && s3.secretKey)
    scripts.push(`window.__S3_CFG__=${JSON.stringify(s3)};`);

  const gcs = {
    bucket:    env.GCS_BUCKET     || '',
    prefix:    env.GCS_PREFIX     || '',
    accessKey: env.GCS_ACCESS_KEY || '',
    secretKey: env.GCS_SECRET_KEY || '',
  };
  if (gcs.bucket && gcs.accessKey && gcs.secretKey)
    scripts.push(`window.__GCS_CFG__=${JSON.stringify(gcs)};`);

  if (!scripts.length) return '';
  return `<script>${scripts.join('')}</script>`;
}

http.createServer((req, res) => {
  const filePath = path.join(
    root,
    req.url === '/' ? '/GoogleReports/workspace-usage-report.html' : req.url
  );

  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }

    const ext = path.extname(filePath);
    let body = data;

    // For the main HTML, inject S3 config from .env before </head>
    if (ext === '.html') {
      const env    = loadEnv(envFile);
      const script = buildS3ConfigScript(env);
      if (script) {
        body = Buffer.from(data.toString().replace('</head>', script + '\n</head>'));
      }
    }

    res.writeHead(200, { 'Content-Type': mime[ext] || 'text/plain' });
    res.end(body);
  });
}).listen(3030, () => console.log('Serving on http://localhost:3030'));

const fs = require('fs');
const path = require('path');
const https = require('https');

const ASSETS_DIR = path.join(__dirname, '../assets');
const LANG_DIR = path.join(ASSETS_DIR, 'languages');

// Ensure directories exist
if (!fs.existsSync(LANG_DIR)) {
  fs.mkdirSync(LANG_DIR, { recursive: true });
}

// Copy tree-sitter.wasm from node_modules
try {
  const treeSitterWasmPath = require.resolve('web-tree-sitter/tree-sitter.wasm');
  fs.copyFileSync(treeSitterWasmPath, path.join(ASSETS_DIR, 'tree-sitter.wasm'));
  console.log('Copied tree-sitter.wasm from node_modules');
} catch (e) {
  console.error('Could not find web-tree-sitter/tree-sitter.wasm. Ensure dependencies are installed.');
}

const LANGUAGES = [
  'typescript',
  'javascript',
  'python',
  'rust',
  'html',
  'css',
];

const downloadFile = (urlString, dest) => {
  return new Promise((resolve, reject) => {
    // Ensure we are working with a URL object to handle relative paths later
    const currentUrl = new URL(urlString);

    const request = https.get(urlString, (response) => {
      // HANDLE REDIRECTS (301, 302)
      if (response.statusCode === 301 || response.statusCode === 302) {
        if (!response.headers.location) {
          reject(new Error(`Redirect with no location header for ${urlString}`));
          return;
        }

        // Resolve relative URLs (e.g. "/package/..." -> "https://unpkg.com/package/...")
        const nextUrl = new URL(response.headers.location, currentUrl.href).href;
        
        downloadFile(nextUrl, dest)
          .then(resolve)
          .catch(reject);
        return;
      }

      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download ${urlString}: Status ${response.statusCode}`));
        return;
      }

      const file = fs.createWriteStream(dest);
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        console.log(`Downloaded ${path.basename(dest)}`);
        resolve();
      });
    });

    request.on('error', (err) => {
      if (fs.existsSync(dest)) fs.unlink(dest, () => {});
      reject(err);
    });
  });
};

(async () => {
  console.log('Downloading language WASM files...');
  for (const lang of LANGUAGES) {
    const url = `https://unpkg.com/tree-sitter-wasms/out/tree-sitter-${lang}.wasm`;
    const dest = path.join(LANG_DIR, `tree-sitter-${lang}.wasm`);
    try {
      await downloadFile(url, dest);
    } catch (e) {
      console.warn(`Warning: Could not download ${lang} WASM. Error: ${e.message}`);
    }
  }
  console.log('Asset setup complete.');
  process.exit(0);
})();
import { defineConfig } from 'vite';
import { resolve, dirname } from 'path';
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, unlinkSync } from 'fs';
import { spawn, execSync } from 'child_process';
import { join, relative } from 'path';
import https from 'https';

const repoRoot = resolve(import.meta.dirname, '../..');
const gamePath = process.env.VITE_GAME_PATH || '';

/**
 * Vite plugin: editor file-save endpoint.
 * The editor POSTs to /__editor_save with { path, content }
 * and this plugin writes the file to disk.
 */
function editorSavePlugin() {
  return {
    name: 'immersio-editor-save',
    configureServer(server) {
      server.middlewares.use('/__editor_save', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end('Method not allowed');
          return;
        }

        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
          try {
            const { path: filePath, content } = JSON.parse(body);
            if (!filePath || !content) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: 'Missing path or content' }));
              return;
            }

            // Resolve relative to repo root
            const absPath = resolve(repoRoot, filePath);

            // Safety: only allow writing inside the games/ directory
            const gamesRoot = resolve(repoRoot, 'games');
            if (!absPath.startsWith(gamesRoot)) {
              res.statusCode = 403;
              res.end(JSON.stringify({ error: 'Can only write to games/ directory' }));
              return;
            }

            // Ensure parent directory exists
            const dir = dirname(absPath);
            if (!existsSync(dir)) {
              mkdirSync(dir, { recursive: true });
            }

            writeFileSync(absPath, content, 'utf-8');

            console.log(`  [editor-save] Wrote: ${filePath}`);
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: true, path: filePath }));
          } catch (err) {
            console.error('  [editor-save] Error:', err.message);
            res.statusCode = 500;
            res.end(JSON.stringify({ error: err.message }));
          }
        });
      });
    },
  };
}

/**
 * Vite plugin: binary file upload endpoint for GLB imports.
 * The editor POSTs binary data to /__editor_upload?path=relative/path
 * and this plugin writes it to disk.
 */
function editorUploadPlugin() {
  return {
    name: 'immersio-editor-upload',
    configureServer(server) {
      server.middlewares.use('/__editor_upload', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end('Method not allowed');
          return;
        }

        const url = new URL(req.url, 'http://localhost');
        const filePath = url.searchParams.get('path');
        if (!filePath) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: 'Missing path query param' }));
          return;
        }

        const absPath = resolve(repoRoot, filePath);
        const gamesRoot = resolve(repoRoot, 'games');
        if (!absPath.startsWith(gamesRoot)) {
          res.statusCode = 403;
          res.end(JSON.stringify({ error: 'Can only write to games/ directory' }));
          return;
        }

        const chunks = [];
        req.on('data', chunk => chunks.push(chunk));
        req.on('end', () => {
          try {
            const buffer = Buffer.concat(chunks);
            const dir = dirname(absPath);
            if (!existsSync(dir)) {
              mkdirSync(dir, { recursive: true });
            }
            writeFileSync(absPath, buffer);
            console.log(`  [editor-upload] Wrote: ${filePath} (${buffer.length} bytes)`);
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: true, path: filePath, size: buffer.length }));
          } catch (err) {
            console.error('  [editor-upload] Error:', err.message);
            res.statusCode = 500;
            res.end(JSON.stringify({ error: err.message }));
          }
        });
      });
    },
  };
}

/**
 * Vite plugin: read file endpoint for level loading.
 * The editor GETs /__editor_load?path=relative/path
 * and this plugin returns the file contents.
 */
function editorLoadPlugin() {
  return {
    name: 'immersio-editor-load',
    configureServer(server) {
      server.middlewares.use('/__editor_load', (req, res) => {
        if (req.method !== 'GET') {
          res.statusCode = 405;
          res.end('Method not allowed');
          return;
        }

        const url = new URL(req.url, 'http://localhost');
        const filePath = url.searchParams.get('path');
        if (!filePath) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: 'Missing path query param' }));
          return;
        }

        const absPath = resolve(repoRoot, filePath);
        if (!existsSync(absPath)) {
          res.statusCode = 404;
          res.end(JSON.stringify({ error: 'File not found' }));
          return;
        }

        try {
          const content = readFileSync(absPath, 'utf-8');
          res.statusCode = 200;
          res.setHeader('Content-Type', 'text/plain');
          res.end(content);
        } catch (err) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: err.message }));
        }
      });
    },
  };
}

/**
 * Scaffold a game from framework templates if its engine is missing.
 * Copies all .tpl files from framework/templates/src/ → game/src/,
 * stripping .tpl extension and replacing {{VARIABLES}} with defaults.
 * Skips files that already exist (e.g. level configs created by the editor).
 */
function scaffoldGame(gameDir, gameSlug) {
  // Always re-scaffold template files to pick up framework updates.
  // Only level configs and game-specific puzzle files are preserved.

  const gameName = gameSlug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  const templateVars = {
    '{{GAME_NAME}}': gameName,
    '{{GAME_SLUG}}': gameSlug,
    '{{GAME_DESCRIPTION}}': `${gameName} — an Immersio game`,
    '{{PLAYER_HEIGHT}}': '1.6',
    '{{MOVE_SPEED}}': '4.0',
    '{{SNAP_ANGLE}}': 'Math.PI / 4',
    '{{THREE_VERSION}}': '^0.170.0',
    '{{VITE_VERSION}}': '^6.0.0',
    '{{AUTHOR}}': 'Developer',
    '{{YEAR}}': String(new Date().getFullYear()),
  };

  const templatesDir = resolve(repoRoot, 'framework/templates/src');
  console.log(`  [run-game] Scaffolding framework files for ${gameSlug}...`);

  function walkDir(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        walkDir(fullPath);
      } else if (entry.name.endsWith('.tpl')) {
        const relPath = relative(templatesDir, fullPath).replace(/\.tpl$/, '');
        const destPath = resolve(gameDir, 'src', relPath);

        // Only scaffold files that don't already exist — engine customizer
        // or the user may have modified them after initial scaffolding.
        if (existsSync(destPath)) continue;

        let content = readFileSync(fullPath, 'utf-8');
        for (const [key, value] of Object.entries(templateVars)) {
          content = content.split(key).join(value);
        }

        const destDir = dirname(destPath);
        if (!existsSync(destDir)) mkdirSync(destDir, { recursive: true });
        writeFileSync(destPath, content, 'utf-8');
      }
    }
  }

  walkDir(templatesDir);

  // Also scaffold main.js from template if it's a stub
  const mainJsPath = resolve(gameDir, 'src/main.js');
  const mainContent = existsSync(mainJsPath) ? readFileSync(mainJsPath, 'utf-8') : '';
  if (!mainContent.includes('Engine')) {
    const mainTpl = resolve(repoRoot, 'framework/templates/src/main.js.tpl');
    if (existsSync(mainTpl)) {
      let tplContent = readFileSync(mainTpl, 'utf-8');
      for (const [key, value] of Object.entries(templateVars)) {
        tplContent = tplContent.split(key).join(value);
      }
      writeFileSync(mainJsPath, tplContent, 'utf-8');
    }
  }

  console.log(`  [run-game] Scaffold complete for ${gameSlug}`);
}

/**
 * Vite plugin: game server management endpoints.
 * POST /__editor_run_game  — { gameSlug } → spawns vite dev server for the game
 * POST /__editor_stop_game — kills the running game server
 */
let gameServerProcess = null;
let gameServerSlug = null;

function killGameServer() {
  if (gameServerProcess) {
    try {
      // Kill the process group (negative PID) to clean up children
      process.kill(-gameServerProcess.pid, 'SIGTERM');
    } catch {
      // Already dead
    }
    gameServerProcess = null;
    gameServerSlug = null;
  }
}

/** Kill any process occupying port 5173 (stale server from previous session) */
function killPort5173() {
  try {
    const result = execSync("lsof -ti :5173", { encoding: 'utf-8' }).trim();
    if (result) {
      for (const pid of result.split('\n')) {
        try { process.kill(parseInt(pid), 'SIGTERM'); } catch { /* ignore */ }
      }
      console.log('  [run-game] Killed stale process on port 5173');
      // Give it a moment to release the port
      execSync('sleep 1');
    }
  } catch { /* no process on port */ }
}

function isGameServerAlive() {
  if (!gameServerProcess) return false;
  try {
    process.kill(gameServerProcess.pid, 0);
    return true;
  } catch {
    gameServerProcess = null;
    return false;
  }
}

function pollGameReady(url, timeoutMs = 15000) {
  const start = Date.now();
  return new Promise((resolveP, rejectP) => {
    function attempt() {
      if (Date.now() - start > timeoutMs) {
        rejectP(new Error('Game server did not become ready within timeout'));
        return;
      }
      const req = https.get(url, { rejectUnauthorized: false }, (res) => {
        // Any response means the server is up
        res.resume();
        resolveP();
      });
      req.on('error', () => {
        setTimeout(attempt, 500);
      });
      req.setTimeout(2000, () => {
        req.destroy();
        setTimeout(attempt, 500);
      });
    }
    attempt();
  });
}

function editorRunGamePlugin() {
  return {
    name: 'immersio-editor-run-game',
    configureServer(server) {
      // Clean up game server when editor server closes
      server.httpServer?.on('close', killGameServer);

      // --- POST /__editor_run_game ---
      server.middlewares.use('/__editor_run_game', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end('Method not allowed');
          return;
        }

        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', async () => {
          try {
            const { gameSlug } = JSON.parse(body);
            if (!gameSlug) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: 'Missing gameSlug' }));
              return;
            }

            const gameDir = resolve(repoRoot, 'games', gameSlug);
            const gamesRoot = resolve(repoRoot, 'games');
            if (!gameDir.startsWith(gamesRoot) || !existsSync(gameDir)) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: 'Invalid game slug or game not found' }));
              return;
            }

            // If a server is already running for the SAME game, return its URL
            if (isGameServerAlive() && gameServerSlug === gameSlug) {
              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({
                success: true,
                url: 'https://localhost:5173',
                pid: gameServerProcess.pid,
                alreadyRunning: true,
              }));
              return;
            }

            // Kill existing server if it's for a different game
            if (isGameServerAlive()) {
              killGameServer();
            }

            // Scaffold framework files if game is a stub
            scaffoldGame(gameDir, gameSlug);

            // Install dependencies if needed
            if (!existsSync(resolve(gameDir, 'node_modules'))) {
              console.log(`  [run-game] Installing dependencies for ${gameSlug}...`);
              execSync('npm install', { cwd: gameDir, stdio: 'inherit' });
            }

            // Kill any stale process on port 5173
            killPort5173();

            // Spawn vite dev server
            console.log(`  [run-game] Starting game server for ${gameSlug}...`);
            const child = spawn('npx', ['vite'], {
              cwd: gameDir,
              stdio: 'inherit',
              detached: true,
              shell: true,
            });

            child.on('error', (err) => {
              console.error(`  [run-game] Process error: ${err.message}`);
              gameServerProcess = null;
            });

            child.on('exit', (code) => {
              console.log(`  [run-game] Game server exited with code ${code}`);
              gameServerProcess = null;
            });

            // Don't let the child keep the editor process alive
            child.unref();
            gameServerProcess = child;
            gameServerSlug = gameSlug;

            // Poll until the game server is ready
            await pollGameReady('https://localhost:5173');

            console.log(`  [run-game] Game server ready (PID ${child.pid})`);
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({
              success: true,
              url: 'https://localhost:5173',
              pid: child.pid,
            }));
          } catch (err) {
            console.error('  [run-game] Error:', err.message);
            res.statusCode = 500;
            res.end(JSON.stringify({ error: err.message }));
          }
        });
      });

      // --- POST /__editor_stop_game ---
      server.middlewares.use('/__editor_stop_game', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end('Method not allowed');
          return;
        }

        try {
          killGameServer();
          console.log('  [run-game] Game server stopped');
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ success: true }));
        } catch (err) {
          console.error('  [run-game] Stop error:', err.message);
          res.statusCode = 500;
          res.end(JSON.stringify({ error: err.message }));
        }
      });
    },
  };
}

/**
 * Vite plugin: read all engine source files from a game.
 * GET /__editor_engine_files?gameSlug=<slug>
 * Returns { files: { "engine/Engine.js": "content...", ... } }
 * Skips src/levels/ (level configs are not engine files).
 */
function editorEngineFilesPlugin() {
  return {
    name: 'immersio-editor-engine-files',
    configureServer(server) {
      server.middlewares.use('/__editor_engine_files', (req, res) => {
        if (req.method !== 'GET') {
          res.statusCode = 405;
          res.end('Method not allowed');
          return;
        }

        const url = new URL(req.url, 'http://localhost');
        const gameSlug = url.searchParams.get('gameSlug');
        if (!gameSlug) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: 'Missing gameSlug query param' }));
          return;
        }

        const gameDir = resolve(repoRoot, 'games', gameSlug);
        const gamesRoot = resolve(repoRoot, 'games');
        if (!gameDir.startsWith(gamesRoot)) {
          res.statusCode = 403;
          res.end(JSON.stringify({ error: 'Can only read from games/ directory' }));
          return;
        }

        const srcDir = resolve(gameDir, 'src');
        const files = {};

        if (existsSync(srcDir)) {
          function walkSrc(dir) {
            let entries;
            try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
            for (const entry of entries) {
              const fullPath = join(dir, entry.name);
              if (entry.isDirectory()) {
                walkSrc(fullPath);
              } else if (entry.name.endsWith('.js')) {
                const relPath = relative(srcDir, fullPath);
                // Skip level config files (level1.js, level2.js, etc.) — those are game content, not engine
                if (/^levels\/level\d+\.js$/.test(relPath)) continue;
                try {
                  files[relPath] = readFileSync(fullPath, 'utf-8');
                } catch { /* skip unreadable files */ }
              }
            }
          }
          walkSrc(srcDir);
        }

        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ files }));
      });
    },
  };
}

/**
 * POST /__editor_reset_engine?gameSlug=<slug>
 * Re-scaffolds all engine files from templates, overwriting any AI modifications.
 * Skips levels/ and puzzle/puzzles/ (game-specific content).
 */
/**
 * GET /__editor_asset?path=games/<slug>/public/models/1/file.glb
 * Serves binary files (GLB models) from the repo.
 */
function editorAssetPlugin() {
  return {
    name: 'immersio-editor-asset',
    configureServer(server) {
      server.middlewares.use('/__editor_asset', (req, res) => {
        if (req.method !== 'GET') {
          res.statusCode = 405;
          res.end('Method not allowed');
          return;
        }

        const url = new URL(req.url, 'http://localhost');
        const filePath = url.searchParams.get('path');
        if (!filePath) {
          res.statusCode = 400;
          res.end('Missing path query param');
          return;
        }

        const absPath = resolve(repoRoot, filePath);
        const gamesRoot = resolve(repoRoot, 'games');
        if (!absPath.startsWith(gamesRoot)) {
          res.statusCode = 403;
          res.end('Can only serve from games/ directory');
          return;
        }

        if (!existsSync(absPath)) {
          res.statusCode = 404;
          res.end('File not found');
          return;
        }

        try {
          const data = readFileSync(absPath);
          const ext = absPath.split('.').pop().toLowerCase();
          const mimeTypes = {
            glb: 'model/gltf-binary',
            gltf: 'model/gltf+json',
            png: 'image/png',
            jpg: 'image/jpeg',
            jpeg: 'image/jpeg',
          };
          res.statusCode = 200;
          res.setHeader('Content-Type', mimeTypes[ext] || 'application/octet-stream');
          res.setHeader('Content-Length', data.length);
          res.end(data);
        } catch (err) {
          res.statusCode = 500;
          res.end(err.message);
        }
      });
    },
  };
}

function editorResetEnginePlugin() {
  return {
    name: 'immersio-editor-reset-engine',
    configureServer(server) {
      server.middlewares.use('/__editor_reset_engine', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end('Method not allowed');
          return;
        }

        const url = new URL(req.url, 'http://localhost');
        const gameSlug = url.searchParams.get('gameSlug');
        if (!gameSlug) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: 'Missing gameSlug query param' }));
          return;
        }

        const gameDir = resolve(repoRoot, 'games', gameSlug);
        const gamesRoot = resolve(repoRoot, 'games');
        if (!gameDir.startsWith(gamesRoot) || !existsSync(gameDir)) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: 'Invalid game slug or game not found' }));
          return;
        }

        try {
          const gameName = gameSlug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
          const templateVars = {
            '{{GAME_NAME}}': gameName,
            '{{GAME_SLUG}}': gameSlug,
            '{{PLAYER_HEIGHT}}': '1.6',
            '{{MOVE_SPEED}}': '4.0',
            '{{SNAP_ANGLE}}': 'Math.PI / 4',
            '{{THREE_VERSION}}': '^0.170.0',
            '{{VITE_VERSION}}': '^6.0.0',
            '{{GAME_DESCRIPTION}}': '',
            '{{AUTHOR}}': 'Developer',
            '{{YEAR}}': String(new Date().getFullYear()),
          };

          const templatesDir = resolve(repoRoot, 'framework/templates/src');

          function walkAndReset(dir) {
            for (const entry of readdirSync(dir, { withFileTypes: true })) {
              const fullPath = join(dir, entry.name);
              if (entry.isDirectory()) {
                walkAndReset(fullPath);
              } else if (entry.name.endsWith('.tpl')) {
                const relPath = relative(templatesDir, fullPath).replace(/\.tpl$/, '');
                // Skip level configs and puzzle files
                if (relPath.startsWith('levels/level') || relPath.startsWith('puzzle/puzzles/')) continue;

                const destPath = resolve(gameDir, 'src', relPath);
                let content = readFileSync(fullPath, 'utf-8');
                for (const [key, value] of Object.entries(templateVars)) {
                  content = content.split(key).join(value);
                }
                const destDir = dirname(destPath);
                if (!existsSync(destDir)) mkdirSync(destDir, { recursive: true });
                writeFileSync(destPath, content, 'utf-8');
              }
            }
          }

          walkAndReset(templatesDir);

          // Reset custom behaviors module to empty stub
          const behaviorsDir = resolve(gameDir, 'src/custom');
          if (!existsSync(behaviorsDir)) mkdirSync(behaviorsDir, { recursive: true });
          const behaviorsStub = `// Custom behaviors module — generated by the Immersio Editor engine customizer.\n// This file is overwritten by AI when engine instructions are applied.\n\nexport function init(engine) {}\nexport function update(engine, dt) {}\n`;
          writeFileSync(resolve(behaviorsDir, 'behaviors.js'), behaviorsStub, 'utf-8');
          console.log(`  [reset-engine] Reset custom/behaviors.js to stub`);

          console.log(`  [reset-engine] Engine files reset to defaults for ${gameSlug}`);

          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ success: true }));
        } catch (err) {
          console.error('  [reset-engine] Error:', err.message);
          res.statusCode = 500;
          res.end(JSON.stringify({ error: err.message }));
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [editorSavePlugin(), editorUploadPlugin(), editorLoadPlugin(), editorAssetPlugin(), editorRunGamePlugin(), editorEngineFilesPlugin(), editorResetEnginePlugin()],
  server: {
    port: 5174,
    open: false,
    proxy: {
      // Proxy OpenAI API calls to avoid CORS issues.
      '/api/openai': {
        target: 'https://api.openai.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/openai/, ''),
      },
      // Proxy Ollama API calls (local LLM server).
      '/api/ollama': {
        target: 'http://localhost:11434',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/ollama/, ''),
      },
    },
  },
  define: {
    'import.meta.env.VITE_GAME_SLUG': JSON.stringify(process.env.VITE_GAME_SLUG || ''),
    'import.meta.env.VITE_GAME_PATH': JSON.stringify(gamePath),
    'import.meta.env.VITE_LEVEL_NUMBER': JSON.stringify(process.env.VITE_LEVEL_NUMBER || '1'),
  },
  resolve: {
    alias: {
      '@game': gamePath,
      '@framework': resolve(repoRoot, 'framework'),
    },
  },
  publicDir: gamePath ? resolve(gamePath, 'public') : 'public',
});

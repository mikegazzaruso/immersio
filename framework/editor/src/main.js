import { EditorApp } from './EditorApp.js';

const gameSlug = import.meta.env.VITE_GAME_SLUG;
const levelNumber = parseInt(import.meta.env.VITE_LEVEL_NUMBER, 10) || 1;

if (!gameSlug) {
  document.getElementById('app').innerHTML = `
    <div style="display:flex;align-items:center;justify-content:center;height:100%;flex-direction:column;gap:12px;">
      <h1 style="color:#e06060;">No game specified</h1>
      <p>Launch the editor via CLI: <code style="background:#2a2a3e;padding:4px 8px;border-radius:4px;">npm run editor &lt;game-slug&gt; &lt;level&gt;</code></p>
    </div>
  `;
} else {
  const app = new EditorApp({
    container: document.getElementById('app'),
    gameSlug,
    levelNumber,
  });
  app.init().catch(err => console.error('Editor init failed:', err));
}

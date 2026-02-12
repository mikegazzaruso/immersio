const ICON_SAVE = `<svg viewBox="0 0 16 16"><path d="M2 1h10l2 2v11a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1zm2 0v4h6V1H4zm1 8h6v5H5V9z"/></svg>`;
const ICON_FOLDER = `<svg viewBox="0 0 16 16"><path d="M1 3h5l2 2h6v9H2V3z"/></svg>`;
const ICON_UNDO = `<svg viewBox="0 0 16 16"><path d="M4 7l4-4v2.5C12 5.5 14 8 14 12c-1.5-3-4-4-6-4V10L4 7z"/></svg>`;
const ICON_REDO = `<svg viewBox="0 0 16 16"><path d="M12 7L8 3v2.5C4 5.5 2 8 2 12c1.5-3 4-4 6-4V10l4-3z"/></svg>`;
const ICON_GRID = `<svg viewBox="0 0 16 16"><path d="M0 0h5v5H0zM6 0h4v5H6zM11 0h5v5h-5zM0 6h5v4H0zM6 6h4v4H6zM11 6h5v4h-5zM0 11h5v5H0zM6 11h4v5H6zM11 11h5v5h-5z"/></svg>`;
const ICON_AXES = `<svg viewBox="0 0 16 16"><path d="M2 14V2h1v11h11v1H2z" fill="currentColor"/><path d="M3 13l4-8" stroke="#ef5350" stroke-width="1.5" fill="none"/><path d="M3 13l8-4" stroke="#42a5f5" stroke-width="1.5" fill="none"/><path d="M3 13V5" stroke="#66bb6a" stroke-width="1.5" fill="none"/></svg>`;
const ICON_FIT = `<svg viewBox="0 0 16 16"><path d="M1 1h4v1H2v3H1V1zm10 0h4v4h-1V2h-3V1zM1 11h1v3h3v1H1v-4zm13 0v4h-4v-1h3v-3h1z"/><circle cx="8" cy="8" r="3"/></svg>`;
const ICON_ENV = `<svg viewBox="0 0 16 16"><circle cx="8" cy="5" r="3"/><path d="M2 14c0-3.3 2.7-6 6-6s6 2.7 6 6"/></svg>`;
const ICON_AI = `<svg viewBox="0 0 16 16"><path d="M8 1l2 4 4.5.7-3.2 3.1.8 4.5L8 11.2 3.9 13.3l.8-4.5L1.5 5.7 6 5z"/></svg>`;
const ICON_IMPORT = `<svg viewBox="0 0 16 16"><path d="M8 1v8m0 0L5 6m3 3l3-3" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M2 10v3a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-3" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round"/></svg>`;
const ICON_PLAY = `<svg viewBox="0 0 16 16"><path d="M3 2l10 6-10 6V2z"/></svg>`;
const ICON_PLAY_LEVEL = `<svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M6 4.5l6 3.5-6 3.5z"/></svg>`;
const ICON_ENGINE = `<svg viewBox="0 0 16 16"><path d="M8.5 1v1.05A5.5 5.5 0 0 1 13 7.5c0 .52-.07 1.02-.21 1.5H14a.5.5 0 0 1 0 1h-1.6a5.5 5.5 0 0 1-8.8 0H2a.5.5 0 0 1 0-1h1.21A5.48 5.48 0 0 1 3 7.5a5.5 5.5 0 0 1 4.5-5.45V1a.5.5 0 0 1 1 0zM8 3.5a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM6 7h1V6a.5.5 0 0 1 1 0v1h1a.5.5 0 0 1 0 1H8v1a.5.5 0 0 1-1 0V8H6a.5.5 0 0 1 0-1z"/></svg>`;
const ICON_INIT = `<svg viewBox="0 0 16 16"><path d="M8 1.5A6.5 6.5 0 0 0 1.5 8H4l-3 4-3-4h2.5A7.5 7.5 0 0 1 8 .5v1zm0 13A6.5 6.5 0 0 0 14.5 8H12l3-4 3 4h-2.5A7.5 7.5 0 0 1 8 15.5v-1z"/><path d="M6 5h4v1.5H8.5V11h-1V6.5H6V5z"/></svg>`;
const ICON_TITLE = `<svg viewBox="0 0 16 16"><path d="M2 2h12v2H2V2zm0 3h8v1H2V5zm10-1l3 4h-2v6h-2V8H9l3-4zM2 7h6v1H2V7zm0 2h6v1H2V9zm0 2h6v1H2v-1z"/></svg>`;
const ICON_ABOUT = `<svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M8 4.5a.75.75 0 1 1 0 1.5.75.75 0 0 1 0-1.5zM7 7h2v4.5H7V7z"/></svg>`;
const ICON_SETTINGS = `<svg viewBox="0 0 16 16"><path d="M6.5 1h3l.4 2.1c.3.1.6.3.9.5l2-.8 1.5 2.6-1.6 1.3c0 .2.1.4.1.6s0 .4-.1.6l1.6 1.3-1.5 2.6-2-.8c-.3.2-.6.4-.9.5L9.5 15h-3l-.4-2.1c-.3-.1-.6-.3-.9-.5l-2 .8-1.5-2.6 1.6-1.3c0-.2-.1-.4-.1-.6s0-.4.1-.6L1.7 6.8l1.5-2.6 2 .8c.3-.2.6-.4.9-.5L6.5 1zM8 5.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z"/></svg>`;

export class Toolbar {
  constructor({ gameSlug, levelNumber, onAction }) {
    this.gameSlug = gameSlug;
    this.levelNumber = levelNumber;
    this.onAction = onAction;
    this.el = null;
    this._toggleState = { grid: true, axes: true };
  }

  build() {
    this.el = document.createElement('div');
    this.el.className = 'editor-toolbar';

    // Title
    const title = document.createElement('span');
    title.className = 'toolbar-title';
    title.textContent = `${this.gameSlug} — Level ${this.levelNumber}`;
    this.el.appendChild(title);

    // File group
    this.el.appendChild(this._group([
      this._btn('Init', ICON_INIT, 'initLevel'),
      this._btn('Save', ICON_SAVE, 'save', 'Ctrl+S'),
      this._btn('Load', ICON_FOLDER, 'load', 'Ctrl+O'),
      this._btn('Import', ICON_IMPORT, 'importAssets', 'Ctrl+I'),
    ]));

    // Edit group
    this.el.appendChild(this._group([
      this._btn('Undo', ICON_UNDO, 'undo', 'Ctrl+Z'),
      this._btn('Redo', ICON_REDO, 'redo', 'Ctrl+Shift+Z'),
    ]));

    // View group
    this.el.appendChild(this._group([
      this._btn('Grid', ICON_GRID, 'toggleGrid', 'G', true),
      this._btn('Axes', ICON_AXES, 'toggleAxes', 'A', true),
      this._btn('Fit', ICON_FIT, 'zoomToFit', 'F'),
    ]));

    // Environment
    this.el.appendChild(this._group([
      this._btn('Env', ICON_ENV, 'aiEnvDialog'),
    ]));

    // Title Screen
    this.el.appendChild(this._group([
      this._btn('Title Screen', ICON_TITLE, 'titleScreenDialog'),
    ]));

    // Engine
    this.el.appendChild(this._group([
      this._btn('Engine', ICON_ENGINE, 'engineDialog'),
    ]));

    // Run Game + Run Level
    const runBtn = this._btn('Run Game', ICON_PLAY, 'runGame');
    runBtn.classList.add('run-btn');
    this._runBtn = runBtn;
    const runLevelBtn = this._btn(`Run Level ${this.levelNumber}`, ICON_PLAY_LEVEL, 'runLevel');
    runLevelBtn.classList.add('run-btn');
    this._runLevelBtn = runLevelBtn;
    this.el.appendChild(this._group([runBtn, runLevelBtn]));

    // Spacer
    const spacer = document.createElement('div');
    spacer.className = 'toolbar-spacer';
    this.el.appendChild(spacer);

    // AI group
    this.el.appendChild(this._group([
      this._btn('AI Env', ICON_AI, 'aiEnvDialog', null, false, true),
    ]));

    // Settings + About group
    const settingsGroup = this._group([
      this._btn('Settings', ICON_SETTINGS, 'openSettings'),
      this._btn('About', ICON_ABOUT, 'openAbout'),
    ]);
    this._settingsBtn = settingsGroup.querySelector('[data-action="openSettings"]');
    this.el.appendChild(settingsGroup);

    // Keyboard shortcuts
    this._setupShortcuts();

    return this.el;
  }

  _group(buttons) {
    const g = document.createElement('div');
    g.className = 'toolbar-group';
    buttons.forEach(b => g.appendChild(b));
    return g;
  }

  _btn(label, icon, action, shortcut, isToggle = false, isAI = false) {
    const btn = document.createElement('button');
    btn.className = 'toolbar-btn' + (isAI ? ' ai-btn' : '');
    btn.innerHTML = icon + `<span>${label}</span>`;
    if (shortcut) btn.title = `${label} (${shortcut})`;
    else btn.title = label;

    if (isToggle && this._toggleState[action.replace('toggle', '').toLowerCase()]) {
      btn.classList.add('active');
    }

    btn.addEventListener('click', () => {
      if (isToggle) {
        const key = action.replace('toggle', '').toLowerCase();
        this._toggleState[key] = !this._toggleState[key];
        btn.classList.toggle('active');
        this.onAction(action, this._toggleState[key]);
      } else {
        this.onAction(action);
      }
    });

    btn.dataset.action = action;
    return btn;
  }

  _setupShortcuts() {
    document.addEventListener('keydown', (e) => {
      // Don't fire shortcuts when typing in inputs
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      const ctrl = e.ctrlKey || e.metaKey;

      if (ctrl && e.key === 's') {
        e.preventDefault();
        this.onAction('save');
      } else if (ctrl && e.key === 'o') {
        e.preventDefault();
        this.onAction('load');
      } else if (ctrl && e.key === 'i') {
        e.preventDefault();
        this.onAction('importAssets');
      } else if (ctrl && e.shiftKey && e.key === 'z') {
        e.preventDefault();
        this.onAction('redo');
      } else if (ctrl && e.key === 'z') {
        e.preventDefault();
        this.onAction('undo');
      } else if (e.key === 'g' && !ctrl) {
        const btn = this.el.querySelector('[data-action="toggleGrid"]');
        if (btn) btn.click();
      } else if (e.key === 'f' && !ctrl) {
        this.onAction('zoomToFit');
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        this.onAction('delete');
      }
    });
  }

  /** Update the displayed title (e.g., after loading a different level) */
  setTitle(gameSlug, levelNumber) {
    const title = this.el.querySelector('.toolbar-title');
    if (title) title.textContent = `${gameSlug} — Level ${levelNumber}`;
  }

  /** Set the Run Game button running state */
  setRunning(running) {
    if (!this._runBtn) return;
    this._runBtn.classList.toggle('running', running);
  }

  /** Show or hide the red indicator dot on the settings gear icon */
  setSettingsIndicator(needsSetup) {
    if (!this._settingsBtn) return;
    const existing = this._settingsBtn.querySelector('.settings-indicator-dot');
    if (needsSetup && !existing) {
      const dot = document.createElement('span');
      dot.className = 'settings-indicator-dot';
      this._settingsBtn.appendChild(dot);
    } else if (!needsSetup && existing) {
      existing.remove();
    }
  }
}

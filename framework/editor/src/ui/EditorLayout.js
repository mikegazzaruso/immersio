import { Toolbar } from './Toolbar.js';
import { SceneTreePanel } from './SceneTreePanel.js';
import { PropertiesPanel } from './PropertiesPanel.js';
import { AIPromptOverlay } from './AIPromptOverlay.js';
import { SettingsPanel } from './SettingsPanel.js';
import { EngineCustomPanel } from './EngineCustomPanel.js';
import { StatusBar } from './StatusBar.js';
import { ContextMenu } from './ContextMenu.js';
import { ErrorPopup } from './ErrorPopup.js';
import './editor.css';

export class EditorLayout {
  constructor({ container, gameSlug, levelNumber }) {
    this.container = container;
    this.gameSlug = gameSlug;
    this.levelNumber = levelNumber;

    this.root = null;
    this.viewportEl = null;
    this.toolbar = null;
    this.sceneTree = null;
    this.properties = null;
    this.aiPrompt = null;
    this.settingsPanel = null;
    this.enginePanel = null;
    this.statusBar = null;
    this.contextMenu = null;
    this.errorPopup = null;

    // Event callbacks
    this._listeners = {};
  }

  /** Register an event callback: 'save', 'load', 'undo', 'redo', 'toggleGrid', etc. */
  on(event, fn) {
    if (!this._listeners[event]) this._listeners[event] = [];
    this._listeners[event].push(fn);
  }

  emit(event, data) {
    const fns = this._listeners[event];
    if (fns) fns.forEach(fn => fn(data));
  }

  build() {
    this.root = document.createElement('div');
    this.root.id = 'editor-root';

    // Toolbar
    this.toolbar = new Toolbar({
      gameSlug: this.gameSlug,
      levelNumber: this.levelNumber,
      onAction: (action, data) => this.emit(action, data),
    });
    this.root.appendChild(this.toolbar.build());

    // Left panel — Scene Tree
    this.sceneTree = new SceneTreePanel({
      onSelect: (item) => this.emit('select', item),
      onContextMenu: (item, x, y) => this._showTreeContextMenu(item, x, y),
    });
    const leftPanel = this.sceneTree.build();
    this._setupResize(leftPanel, 'right', '--panel-left-width');
    this.root.appendChild(leftPanel);

    // Viewport container
    this.viewportEl = document.createElement('div');
    this.viewportEl.className = 'editor-viewport';
    this.root.appendChild(this.viewportEl);

    // Right panel — Properties
    this.properties = new PropertiesPanel({
      onChange: (prop, value) => this.emit('propertyChange', { prop, value }),
    });
    const rightPanel = this.properties.build();
    this._setupResize(rightPanel, 'left', '--panel-right-width');
    this.root.appendChild(rightPanel);

    // AI Prompt Overlay (on viewport)
    this.aiPrompt = new AIPromptOverlay({
      onSubmit: (prompt, coords) => this.emit('aiPrompt', { prompt, coords }),
      onEnvSubmit: (prompt) => this.emit('aiEnvPrompt', { prompt }),
    });
    this.viewportEl.appendChild(this.aiPrompt.build());

    // Settings Panel (modal, appended to body)
    this.settingsPanel = new SettingsPanel({
      onSave: (settings) => this.emit('settingsChanged', settings),
    });
    document.body.appendChild(this.settingsPanel.build());

    // Engine Customization Panel (modal, appended to body)
    this.enginePanel = new EngineCustomPanel({
      onSubmit: (prompt) => this.emit('enginePrompt', { prompt }),
    });
    document.body.appendChild(this.enginePanel.build());

    // Status Bar
    this.statusBar = new StatusBar();
    this.root.appendChild(this.statusBar.build());

    // Context Menu (global)
    this.contextMenu = new ContextMenu();
    document.body.appendChild(this.contextMenu.build());

    // Error Popup (global)
    this.errorPopup = new ErrorPopup();

    // Close context menu on click anywhere
    document.addEventListener('mousedown', (e) => {
      if (!e.target.closest('.context-menu')) {
        this.contextMenu.hide();
      }
    });

    this.container.appendChild(this.root);
    return this;
  }

  /** Returns the DOM element where the 3D renderer should be mounted */
  getViewportElement() {
    return this.viewportEl;
  }

  /** Returns viewport dimensions */
  getViewportSize() {
    return {
      width: this.viewportEl.clientWidth,
      height: this.viewportEl.clientHeight,
    };
  }

  /** Update scene tree data */
  updateSceneTree(data) {
    this.sceneTree.update(data);
  }

  /** Update properties panel for selected object */
  updateProperties(obj) {
    this.properties.update(obj);
  }

  /** Update status bar */
  updateStatus(data) {
    this.statusBar.update(data);
  }

  /** Show AI prompt at viewport click position */
  showAIPrompt(screenX, screenY, worldCoords) {
    this.aiPrompt.show(screenX, screenY, worldCoords);
  }

  /** Show error popup with copyable details */
  showError(title, message, detail) {
    this.errorPopup.show(title, message, detail);
  }

  /** Set AI processing state */
  setAIProcessing(processing) {
    const msg = this.aiPrompt.setProcessing(processing);
    this.statusBar.setAIStatus(processing ? 'processing' : 'idle', msg);
  }

  /** Resize handle setup */
  _setupResize(panel, side, cssVar) {
    const handle = document.createElement('div');
    handle.className = `resize-handle resize-handle-${side}`;
    panel.appendChild(handle);

    let startX, startWidth;

    const onMouseMove = (e) => {
      const delta = side === 'right' ? e.clientX - startX : startX - e.clientX;
      const newWidth = Math.max(
        parseInt(getComputedStyle(document.documentElement).getPropertyValue('--panel-min-width')),
        Math.min(
          parseInt(getComputedStyle(document.documentElement).getPropertyValue('--panel-max-width')),
          startWidth + delta
        )
      );
      document.documentElement.style.setProperty(cssVar, newWidth + 'px');
      this.emit('resize');
    };

    const onMouseUp = () => {
      handle.classList.remove('dragging');
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    handle.addEventListener('mousedown', (e) => {
      e.preventDefault();
      startX = e.clientX;
      startWidth = panel.offsetWidth;
      handle.classList.add('dragging');
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    });
  }

  _showTreeContextMenu(item, x, y) {
    const isProp = item.category === 'props' || ['prop', 'composite', 'mesh'].includes(item.type);
    const items = [];
    if (isProp) {
      items.push({ label: 'Modify with AI...', action: 'modifyAI' });
      items.push({ separator: true });
    }
    items.push(
      { label: 'Duplicate', action: 'duplicate', shortcut: 'Ctrl+D' },
      { label: 'Rename', action: 'rename', shortcut: 'F2' },
      { separator: true },
      { label: 'Delete', action: 'delete', shortcut: 'Del', danger: true },
    );
    this.contextMenu.show(x, y, items, (action) => {
      if (action === 'modifyAI') {
        this._showModifyDialog(item);
      } else {
        this.emit('treeAction', { action, item });
      }
    });
  }

  _showModifyDialog(item) {
    const backdrop = document.createElement('div');
    backdrop.className = 'settings-backdrop';
    backdrop.style.display = 'flex';

    const modal = document.createElement('div');
    modal.className = 'settings-modal';
    modal.style.maxWidth = '500px';

    // Header
    const header = document.createElement('div');
    header.className = 'settings-header';
    const title = document.createElement('span');
    title.className = 'settings-title';
    title.textContent = `Modify: ${item.name || 'Object'}`;
    header.appendChild(title);
    const closeBtn = document.createElement('button');
    closeBtn.className = 'settings-close';
    closeBtn.innerHTML = '&times;';
    closeBtn.addEventListener('click', () => backdrop.remove());
    header.appendChild(closeBtn);
    modal.appendChild(header);

    // Body
    const body = document.createElement('div');
    body.className = 'settings-body';
    body.style.padding = '16px';

    const hint = document.createElement('div');
    hint.style.cssText = 'font-size:12px;color:var(--text-muted);margin-bottom:8px;';
    hint.textContent = 'Describe the change — shape, behavior, animation, physics, anything:';
    body.appendChild(hint);

    const textarea = document.createElement('textarea');
    textarea.className = 'settings-input';
    textarea.style.cssText = 'width:100%;height:80px;resize:vertical;font-family:inherit;font-size:13px;';
    textarea.placeholder = 'e.g., "make the ears much longer" or "it should explode when the player touches it"';
    body.appendChild(textarea);

    // Spinner + rotating nerd messages
    const spinnerWrap = document.createElement('div');
    spinnerWrap.style.cssText = 'display:none;align-items:center;gap:10px;margin-top:12px;';

    const spinnerIcon = document.createElement('div');
    spinnerIcon.style.cssText = 'width:18px;height:18px;border:2px solid var(--accent-primary);border-top-color:transparent;border-radius:50%;animation:spin 0.8s linear infinite;flex-shrink:0;';
    spinnerWrap.appendChild(spinnerIcon);

    const spinnerText = document.createElement('div');
    spinnerText.style.cssText = 'font-size:12px;color:var(--accent-primary);';
    spinnerWrap.appendChild(spinnerText);
    body.appendChild(spinnerWrap);

    // Inject keyframes if not already present
    if (!document.getElementById('modify-spinner-style')) {
      const style = document.createElement('style');
      style.id = 'modify-spinner-style';
      style.textContent = '@keyframes spin{to{transform:rotate(360deg)}}';
      document.head.appendChild(style);
    }

    const nerdMessages = [
      'Consulting the ancient shader scrolls...',
      'Reticulating splines...',
      'Adjusting vertex normals with bare hands...',
      'Feeding the neural hamsters...',
      'Compiling imagination into polygons...',
      'Asking the GPU nicely...',
      'Rolling a D20 for creativity...',
      'Refactoring the matrix of reality...',
      'Brewing procedural geometry potion...',
      'Convincing electrons to cooperate...',
      'Translating vibes into vertices...',
      'Deploying tiny 3D elves...',
    ];
    let msgInterval = null;

    const startSpinner = () => {
      spinnerWrap.style.display = 'flex';
      let idx = Math.floor(Math.random() * nerdMessages.length);
      spinnerText.textContent = nerdMessages[idx];
      msgInterval = setInterval(() => {
        idx = (idx + 1) % nerdMessages.length;
        spinnerText.textContent = nerdMessages[idx];
      }, 2500);
    };

    const stopSpinner = () => {
      spinnerWrap.style.display = 'none';
      if (msgInterval) { clearInterval(msgInterval); msgInterval = null; }
    };

    // Error display
    const errorEl = document.createElement('div');
    errorEl.style.cssText = 'font-size:12px;color:var(--accent-danger);margin-top:8px;display:none;';
    body.appendChild(errorEl);

    modal.appendChild(body);

    // Footer
    const footer = document.createElement('div');
    footer.className = 'settings-footer';
    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'settings-btn';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', () => { stopSpinner(); backdrop.remove(); });
    footer.appendChild(cancelBtn);

    const submitBtn = document.createElement('button');
    submitBtn.className = 'settings-btn settings-btn-primary';
    submitBtn.textContent = 'Apply';
    const submit = () => {
      const prompt = textarea.value.trim();
      if (!prompt) return;
      footer.style.display = 'none';
      textarea.disabled = true;
      errorEl.style.display = 'none';
      startSpinner();
      this.emit('modifyWithAI', {
        item,
        prompt,
        onDone: (err) => {
          stopSpinner();
          if (err) {
            errorEl.textContent = err;
            errorEl.style.display = 'block';
            footer.style.display = '';
            textarea.disabled = false;
          } else {
            backdrop.remove();
          }
        },
      });
    };
    submitBtn.addEventListener('click', submit);
    textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit();
    });
    footer.appendChild(submitBtn);
    modal.appendChild(footer);

    backdrop.appendChild(modal);
    backdrop.addEventListener('mousedown', (e) => {
      if (e.target === backdrop) backdrop.remove();
    });
    document.body.appendChild(backdrop);

    setTimeout(() => textarea.focus(), 100);
  }

  /** Show stunning About / Credits modal */
  showAbout() {
    const backdrop = document.createElement('div');
    backdrop.className = 'settings-backdrop';
    backdrop.style.cssText = 'display:flex;background:rgba(0,0,0,0.85);';

    const modal = document.createElement('div');
    modal.style.cssText = `
      position:relative;
      width:480px;max-width:92vw;
      background:linear-gradient(135deg, #0f0c29 0%, #1a1a3e 40%, #24243e 100%);
      border:1px solid rgba(79,195,247,0.3);
      border-radius:16px;
      box-shadow:0 0 60px rgba(79,195,247,0.15), 0 0 120px rgba(206,147,216,0.08), 0 20px 60px rgba(0,0,0,0.6);
      overflow:hidden;
      animation:promptFadeIn 0.3s ease;
      text-align:center;
      padding:0;
    `;

    // Animated glow border effect
    const glowTop = document.createElement('div');
    glowTop.style.cssText = `
      position:absolute;top:0;left:0;right:0;height:2px;
      background:linear-gradient(90deg,transparent,#4fc3f7,#ce93d8,#4fc3f7,transparent);
      background-size:200% 100%;
      animation:aboutShimmer 3s linear infinite;
    `;
    modal.appendChild(glowTop);

    // Inject keyframes
    if (!document.getElementById('about-modal-style')) {
      const style = document.createElement('style');
      style.id = 'about-modal-style';
      style.textContent = `
        @keyframes aboutShimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        @keyframes aboutFloat {
          0%,100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
        @keyframes aboutPulseGlow {
          0%,100% { text-shadow: 0 0 20px rgba(79,195,247,0.4), 0 0 40px rgba(79,195,247,0.1); }
          50% { text-shadow: 0 0 30px rgba(79,195,247,0.6), 0 0 60px rgba(206,147,216,0.2); }
        }
      `;
      document.head.appendChild(style);
    }

    // Content wrapper
    const content = document.createElement('div');
    content.style.cssText = 'padding:40px 32px 32px;';

    // Logo / Title
    const logo = document.createElement('div');
    logo.style.cssText = `
      font-size:42px;font-weight:800;letter-spacing:2px;
      background:linear-gradient(135deg, #4fc3f7, #ce93d8, #81c784);
      -webkit-background-clip:text;-webkit-text-fill-color:transparent;
      background-clip:text;
      animation:aboutFloat 4s ease-in-out infinite;
      margin-bottom:4px;
    `;
    logo.textContent = 'IMMERSIO';
    content.appendChild(logo);

    // Subtitle
    const subtitle = document.createElement('div');
    subtitle.style.cssText = `
      font-size:13px;letter-spacing:3px;text-transform:uppercase;
      color:#4fc3f7;opacity:0.7;margin-bottom:28px;
      animation:aboutPulseGlow 3s ease-in-out infinite;
    `;
    subtitle.textContent = 'Level Editor';
    content.appendChild(subtitle);

    // Divider line
    const divider = document.createElement('div');
    divider.style.cssText = `
      width:60px;height:1px;margin:0 auto 24px;
      background:linear-gradient(90deg,transparent,#4fc3f7,transparent);
    `;
    content.appendChild(divider);

    // Credits
    const credits = document.createElement('div');
    credits.style.cssText = 'margin-bottom:24px;';

    const madeBy = document.createElement('div');
    madeBy.style.cssText = 'font-size:12px;color:#6a6a80;text-transform:uppercase;letter-spacing:2px;margin-bottom:8px;';
    madeBy.textContent = 'Created by';
    credits.appendChild(madeBy);

    const authorName = document.createElement('div');
    authorName.style.cssText = `
      font-size:22px;font-weight:600;
      color:#e0e0e0;letter-spacing:1px;margin-bottom:6px;
    `;
    authorName.textContent = 'Mike Gazzaruso';
    credits.appendChild(authorName);

    const roleDesc = document.createElement('div');
    roleDesc.style.cssText = 'font-size:12px;color:#a0a0b8;line-height:1.6;';
    roleDesc.innerHTML = 'Editor &bull; Framework &bull; Dream Pipeline';
    credits.appendChild(roleDesc);

    content.appendChild(credits);

    // Divider
    const divider2 = divider.cloneNode();
    content.appendChild(divider2);

    // Tech stack badges
    const badges = document.createElement('div');
    badges.style.cssText = 'display:flex;justify-content:center;gap:8px;margin:20px 0;flex-wrap:wrap;';
    const techs = ['Three.js', 'WebXR', 'Vite', 'AI-Powered'];
    for (const tech of techs) {
      const badge = document.createElement('span');
      badge.style.cssText = `
        padding:4px 12px;border-radius:12px;
        font-size:11px;font-weight:600;letter-spacing:0.5px;
        background:rgba(79,195,247,0.1);
        border:1px solid rgba(79,195,247,0.25);
        color:#4fc3f7;
      `;
      badge.textContent = tech;
      badges.appendChild(badge);
    }
    content.appendChild(badges);

    // GitHub link
    const ghWrap = document.createElement('div');
    ghWrap.style.cssText = 'margin-top:20px;';
    const ghLink = document.createElement('a');
    ghLink.href = 'https://github.com/mikegazzaruso/immersio';
    ghLink.target = '_blank';
    ghLink.rel = 'noopener noreferrer';
    ghLink.style.cssText = `
      display:inline-flex;align-items:center;gap:8px;
      padding:8px 20px;border-radius:8px;
      background:rgba(255,255,255,0.06);
      border:1px solid rgba(255,255,255,0.12);
      color:#e0e0e0;font-size:13px;font-weight:500;
      text-decoration:none;
      transition:background 0.2s, border-color 0.2s, color 0.2s;
      cursor:pointer;
    `;
    ghLink.addEventListener('mouseenter', () => {
      ghLink.style.background = 'rgba(79,195,247,0.12)';
      ghLink.style.borderColor = 'rgba(79,195,247,0.4)';
      ghLink.style.color = '#4fc3f7';
    });
    ghLink.addEventListener('mouseleave', () => {
      ghLink.style.background = 'rgba(255,255,255,0.06)';
      ghLink.style.borderColor = 'rgba(255,255,255,0.12)';
      ghLink.style.color = '#e0e0e0';
    });

    // GitHub SVG icon
    const ghIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    ghIcon.setAttribute('viewBox', '0 0 16 16');
    ghIcon.setAttribute('width', '16');
    ghIcon.setAttribute('height', '16');
    ghIcon.style.fill = 'currentColor';
    ghIcon.innerHTML = '<path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>';
    ghLink.appendChild(ghIcon);

    const ghText = document.createElement('span');
    ghText.textContent = 'mikegazzaruso/immersio';
    ghLink.appendChild(ghText);
    ghWrap.appendChild(ghLink);
    content.appendChild(ghWrap);

    // Version / year
    const version = document.createElement('div');
    version.style.cssText = 'margin-top:20px;font-size:11px;color:#6a6a80;';
    version.textContent = `v1.0 \u2014 ${new Date().getFullYear()}`;
    content.appendChild(version);

    modal.appendChild(content);

    // Close on backdrop click
    backdrop.appendChild(modal);
    backdrop.addEventListener('mousedown', (e) => {
      if (e.target === backdrop) backdrop.remove();
    });

    // Close on Escape
    const onKey = (e) => {
      if (e.key === 'Escape') { backdrop.remove(); document.removeEventListener('keydown', onKey); }
    };
    document.addEventListener('keydown', onKey);

    document.body.appendChild(backdrop);
  }

  /** Show title screen generation dialog */
  showTitleScreenDialog(hasExisting) {
    const backdrop = document.createElement('div');
    backdrop.className = 'settings-backdrop';
    backdrop.style.display = 'flex';

    const modal = document.createElement('div');
    modal.className = 'settings-modal';
    modal.style.maxWidth = '500px';

    // Header
    const header = document.createElement('div');
    header.className = 'settings-header';
    const title = document.createElement('span');
    title.className = 'settings-title';
    title.textContent = 'Title Screen';
    header.appendChild(title);
    const closeBtn = document.createElement('button');
    closeBtn.className = 'settings-close';
    closeBtn.innerHTML = '&times;';
    closeBtn.addEventListener('click', () => backdrop.remove());
    header.appendChild(closeBtn);
    modal.appendChild(header);

    // Body
    const body = document.createElement('div');
    body.className = 'settings-body';
    body.style.padding = '16px';

    // Warning if title screen already exists
    if (hasExisting) {
      const warning = document.createElement('div');
      warning.style.cssText = 'font-size:12px;color:var(--accent-danger);font-weight:600;margin-bottom:10px;';
      warning.textContent = 'A title screen already exists. This will replace it.';
      body.appendChild(warning);
    }

    // Prompt hint + textarea
    const hint = document.createElement('div');
    hint.style.cssText = 'font-size:12px;color:var(--text-muted);margin-bottom:8px;';
    hint.textContent = 'Describe the title screen \u2014 atmosphere, style, effects, anything:';
    body.appendChild(hint);

    const textarea = document.createElement('textarea');
    textarea.className = 'settings-input';
    textarea.style.cssText = 'width:100%;height:80px;resize:vertical;font-family:inherit;font-size:13px;';
    textarea.placeholder = 'epic dark fantasy with floating particles and glowing runes';
    body.appendChild(textarea);

    // Game Title input
    const titleLabel = document.createElement('div');
    titleLabel.style.cssText = 'font-size:12px;color:var(--text-muted);margin-top:12px;margin-bottom:4px;';
    titleLabel.textContent = 'Game Title';
    body.appendChild(titleLabel);

    const titleInput = document.createElement('input');
    titleInput.type = 'text';
    titleInput.className = 'settings-input';
    titleInput.style.cssText = 'width:100%;font-family:inherit;font-size:13px;';
    titleInput.placeholder = this.gameSlug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    body.appendChild(titleInput);

    // Subtitle input
    const subtitleLabel = document.createElement('div');
    subtitleLabel.style.cssText = 'font-size:12px;color:var(--text-muted);margin-top:12px;margin-bottom:4px;';
    subtitleLabel.textContent = 'Subtitle (optional)';
    body.appendChild(subtitleLabel);

    const subtitleInput = document.createElement('input');
    subtitleInput.type = 'text';
    subtitleInput.className = 'settings-input';
    subtitleInput.style.cssText = 'width:100%;font-family:inherit;font-size:13px;';
    subtitleInput.placeholder = 'A VR Adventure';
    body.appendChild(subtitleInput);

    // Spinner + rotating nerd messages
    const spinnerWrap = document.createElement('div');
    spinnerWrap.style.cssText = 'display:none;align-items:center;gap:10px;margin-top:12px;';

    const spinnerIcon = document.createElement('div');
    spinnerIcon.style.cssText = 'width:18px;height:18px;border:2px solid var(--accent-primary);border-top-color:transparent;border-radius:50%;animation:spin 0.8s linear infinite;flex-shrink:0;';
    spinnerWrap.appendChild(spinnerIcon);

    const spinnerText = document.createElement('div');
    spinnerText.style.cssText = 'font-size:12px;color:var(--accent-primary);';
    spinnerWrap.appendChild(spinnerText);
    body.appendChild(spinnerWrap);

    // Inject keyframes if not already present
    if (!document.getElementById('modify-spinner-style')) {
      const style = document.createElement('style');
      style.id = 'modify-spinner-style';
      style.textContent = '@keyframes spin{to{transform:rotate(360deg)}}';
      document.head.appendChild(style);
    }

    const nerdMessages = [
      'Composing the opening credits...',
      'Arranging dramatic camera angles...',
      'Summoning the title font gods...',
      'Calibrating epic vibes...',
      'Rendering imaginary particles...',
      'Asking the GPU for one more favor...',
      'Rolling opening credits...',
      'Polishing the hero shot...',
      'Tuning atmospheric reverb...',
      'Deploying cinematic fog...',
    ];
    let msgInterval = null;

    const startSpinner = () => {
      spinnerWrap.style.display = 'flex';
      let idx = Math.floor(Math.random() * nerdMessages.length);
      spinnerText.textContent = nerdMessages[idx];
      msgInterval = setInterval(() => {
        idx = (idx + 1) % nerdMessages.length;
        spinnerText.textContent = nerdMessages[idx];
      }, 2500);
    };

    const stopSpinner = () => {
      spinnerWrap.style.display = 'none';
      if (msgInterval) { clearInterval(msgInterval); msgInterval = null; }
    };

    // Error display
    const errorEl = document.createElement('div');
    errorEl.style.cssText = 'font-size:12px;color:var(--accent-danger);margin-top:8px;display:none;';
    body.appendChild(errorEl);

    modal.appendChild(body);

    // Footer
    const footer = document.createElement('div');
    footer.className = 'settings-footer';
    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'settings-btn';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', () => { stopSpinner(); backdrop.remove(); });
    footer.appendChild(cancelBtn);

    const submitBtn = document.createElement('button');
    submitBtn.className = 'settings-btn settings-btn-primary';
    submitBtn.textContent = 'Generate';
    const submit = () => {
      const prompt = textarea.value.trim();
      if (!prompt) return;
      footer.style.display = 'none';
      textarea.disabled = true;
      titleInput.disabled = true;
      subtitleInput.disabled = true;
      errorEl.style.display = 'none';
      startSpinner();
      this.emit('titleScreenPrompt', {
        prompt,
        titleText: titleInput.value.trim() || this.gameSlug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        subtitle: subtitleInput.value.trim(),
        onDone: (err) => {
          stopSpinner();
          if (err) {
            errorEl.textContent = err;
            errorEl.style.display = 'block';
            footer.style.display = '';
            textarea.disabled = false;
            titleInput.disabled = false;
            subtitleInput.disabled = false;
          } else {
            backdrop.remove();
          }
        },
      });
    };
    submitBtn.addEventListener('click', submit);

    // Ctrl/Cmd+Enter triggers submit from any input
    const onInputKeydown = (e) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit();
    };
    textarea.addEventListener('keydown', onInputKeydown);
    titleInput.addEventListener('keydown', onInputKeydown);
    subtitleInput.addEventListener('keydown', onInputKeydown);

    footer.appendChild(submitBtn);
    modal.appendChild(footer);

    backdrop.appendChild(modal);
    backdrop.addEventListener('mousedown', (e) => {
      if (e.target === backdrop) backdrop.remove();
    });

    // Close on Escape
    const onKey = (e) => {
      if (e.key === 'Escape') { stopSpinner(); backdrop.remove(); document.removeEventListener('keydown', onKey); }
    };
    document.addEventListener('keydown', onKey);

    document.body.appendChild(backdrop);

    setTimeout(() => textarea.focus(), 100);
  }

  /** Show confirmation dialog for level init */
  showInitConfirm() {
    const backdrop = document.createElement('div');
    backdrop.className = 'settings-backdrop';
    backdrop.style.display = 'flex';

    const modal = document.createElement('div');
    modal.className = 'settings-modal';
    modal.style.maxWidth = '420px';

    // Header
    const header = document.createElement('div');
    header.className = 'settings-header';
    const title = document.createElement('span');
    title.className = 'settings-title';
    title.textContent = 'Initialize Level';
    header.appendChild(title);
    const closeBtn = document.createElement('button');
    closeBtn.className = 'settings-close';
    closeBtn.innerHTML = '&times;';
    closeBtn.addEventListener('click', () => backdrop.remove());
    header.appendChild(closeBtn);
    modal.appendChild(header);

    // Body
    const body = document.createElement('div');
    body.className = 'settings-body';
    body.style.padding = '16px';

    const warning = document.createElement('div');
    warning.style.cssText = 'font-size:13px;color:var(--accent-danger);font-weight:600;margin-bottom:8px;';
    warning.textContent = 'Warning: This action cannot be undone!';
    body.appendChild(warning);

    const desc = document.createElement('div');
    desc.style.cssText = 'font-size:13px;color:var(--text-primary);line-height:1.5;';
    desc.textContent = 'This will clear the entire level — environment, decorations, props, and behaviors — and save the empty level to disk.';
    body.appendChild(desc);

    modal.appendChild(body);

    // Footer
    const footer = document.createElement('div');
    footer.className = 'settings-footer';
    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'settings-btn';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', () => backdrop.remove());
    footer.appendChild(cancelBtn);

    const confirmBtn = document.createElement('button');
    confirmBtn.className = 'settings-btn';
    confirmBtn.style.cssText = 'background:var(--accent-danger);color:#fff;';
    confirmBtn.textContent = 'Initialize';
    confirmBtn.addEventListener('click', () => {
      backdrop.remove();
      this.emit('initLevelConfirmed');
    });
    footer.appendChild(confirmBtn);
    modal.appendChild(footer);

    backdrop.appendChild(modal);
    backdrop.addEventListener('mousedown', (e) => {
      if (e.target === backdrop) backdrop.remove();
    });
    document.body.appendChild(backdrop);
  }

  dispose() {
    this.root?.remove();
    this.contextMenu?.hide();
  }
}

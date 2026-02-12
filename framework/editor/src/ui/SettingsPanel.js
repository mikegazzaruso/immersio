const STORAGE_KEY_API = 'immersio-editor-ai-key';
const STORAGE_KEY_MODEL = 'immersio-editor-ai-model';
const STORAGE_KEY_PREFS = 'immersio-editor-prefs';
const STORAGE_KEY_PROVIDER = 'immersio_ai_provider';

const DEFAULT_PREFS = {
  gridSize: 20,
  snapToGrid: false,
  snapSize: 1.0,
  autoSave: false,
};

const OLLAMA_BASE = '/api/ollama';
const MIN_PARAM_BILLIONS = 8;

export class SettingsPanel {
  constructor({ onSave }) {
    this.onSave = onSave;
    this.el = null;
    this._visible = false;
    this._testStatus = null;
    this._keyVisible = false;

    // Load saved state
    this._provider = localStorage.getItem(STORAGE_KEY_PROVIDER) || 'openai';
    this._apiKey = localStorage.getItem(STORAGE_KEY_API) || '';
    this._model = localStorage.getItem(STORAGE_KEY_MODEL) || 'gpt-4o';
    this._prefs = { ...DEFAULT_PREFS, ...this._loadPrefs() };

    // Ollama state
    this._ollamaModels = []; // { name, paramSize, paramBillions, disabled }
    this._ollamaStatus = 'unknown'; // 'unknown' | 'checking' | 'connected' | 'offline'

    // Draft state (before save)
    this._draft = {
      provider: this._provider,
      apiKey: this._apiKey,
      model: this._model,
      prefs: { ...this._prefs },
    };
  }

  hasApiKey() { return !!this._apiKey; }
  getApiKey() { return this._apiKey; }
  getModel() { return this._model; }
  getProvider() { return this._provider; }
  getPrefs() { return { ...this._prefs }; }

  /** Check if any provider is configured */
  isConfigured() {
    if (this._provider === 'ollama') return this._ollamaStatus === 'connected' && !!this._model;
    return !!this._apiKey;
  }

  build() {
    this.el = document.createElement('div');
    this.el.className = 'settings-backdrop';
    this.el.style.display = 'none';
    this.el.addEventListener('mousedown', (e) => {
      if (e.target === this.el) this.hide();
    });

    const modal = document.createElement('div');
    modal.className = 'settings-modal';
    this.el.appendChild(modal);

    // Header
    const header = document.createElement('div');
    header.className = 'settings-header';
    header.innerHTML = `<span class="settings-title">Settings</span>`;
    const closeBtn = document.createElement('button');
    closeBtn.className = 'settings-close';
    closeBtn.innerHTML = '&times;';
    closeBtn.addEventListener('click', () => this.hide());
    header.appendChild(closeBtn);
    modal.appendChild(header);

    // Body
    this._bodyEl = document.createElement('div');
    this._bodyEl.className = 'settings-body';
    modal.appendChild(this._bodyEl);

    // Footer
    const footer = document.createElement('div');
    footer.className = 'settings-footer';
    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'settings-btn';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', () => this.hide());
    footer.appendChild(cancelBtn);
    const saveBtn = document.createElement('button');
    saveBtn.className = 'settings-btn settings-btn-primary';
    saveBtn.textContent = 'Save';
    saveBtn.addEventListener('click', () => this._save());
    footer.appendChild(saveBtn);
    modal.appendChild(footer);

    this._onKeyDown = (e) => {
      if (e.key === 'Escape' && this._visible) this.hide();
    };
    document.addEventListener('keydown', this._onKeyDown);

    this._renderBody();
    return this.el;
  }

  /** Re-render the body content based on current draft provider */
  _renderBody() {
    this._bodyEl.innerHTML = '';

    // -- AI Provider Section --
    this._bodyEl.appendChild(this._buildSectionHeader('AI Provider'));

    // Provider selector
    this._bodyEl.appendChild(this._buildRow('Provider', () => {
      const select = document.createElement('select');
      select.className = 'settings-select';
      for (const p of [
        { value: 'openai', label: 'OpenAI' },
        { value: 'ollama', label: 'Ollama (Local)' },
      ]) {
        const opt = document.createElement('option');
        opt.value = p.value;
        opt.textContent = p.label;
        if (p.value === this._draft.provider) opt.selected = true;
        select.appendChild(opt);
      }
      select.addEventListener('change', () => {
        this._draft.provider = select.value;
        // Reset model to default for the new provider
        if (select.value === 'openai') {
          this._draft.model = 'gpt-4o';
        }
        this._renderBody();
        if (select.value === 'ollama') {
          this._fetchOllamaModels();
        }
      });
      return select;
    }));

    if (this._draft.provider === 'openai') {
      this._renderOpenAISection();
    } else {
      this._renderOllamaSection();
    }

    // -- Editor Preferences Section --
    this._bodyEl.appendChild(this._buildSectionHeader('Editor Preferences'));
    this._renderPrefsSection();
  }

  // ---- OpenAI Section ----

  _renderOpenAISection() {
    // API Key
    this._bodyEl.appendChild(this._buildRow('API Key', () => {
      const wrap = document.createElement('div');
      wrap.className = 'settings-key-wrap';

      const input = document.createElement('input');
      input.type = 'password';
      input.className = 'settings-input settings-key-input';
      input.placeholder = 'sk-...';
      input.value = this._draft.apiKey;
      input.autocomplete = 'off';
      input.spellcheck = false;
      input.addEventListener('input', () => {
        this._draft.apiKey = input.value;
        this._testStatus = null;
        this._updateTestIndicator();
      });
      this._keyInput = input;
      wrap.appendChild(input);

      const toggleBtn = document.createElement('button');
      toggleBtn.className = 'settings-key-toggle';
      toggleBtn.textContent = 'Show';
      toggleBtn.addEventListener('click', () => {
        this._keyVisible = !this._keyVisible;
        input.type = this._keyVisible ? 'text' : 'password';
        toggleBtn.textContent = this._keyVisible ? 'Hide' : 'Show';
      });
      wrap.appendChild(toggleBtn);

      const clearBtn = document.createElement('button');
      clearBtn.className = 'settings-key-clear';
      clearBtn.textContent = 'Clear';
      clearBtn.addEventListener('click', () => {
        input.value = '';
        this._draft.apiKey = '';
        this._testStatus = null;
        this._updateTestIndicator();
      });
      wrap.appendChild(clearBtn);
      return wrap;
    }));

    const keyInfo = document.createElement('div');
    keyInfo.className = 'settings-info';
    keyInfo.innerHTML = `Your API key is stored locally in your browser and sent only to OpenAI.
      <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener">Get an API key</a>`;
    this._bodyEl.appendChild(keyInfo);

    // Model selector
    this._bodyEl.appendChild(this._buildRow('Model', () => {
      const select = document.createElement('select');
      select.className = 'settings-select';
      for (const m of [
        { value: 'gpt-5.2', label: 'gpt-5.2 (best quality)' },
        { value: 'gpt-4o', label: 'gpt-4o (recommended)' },
        { value: 'gpt-4o-mini', label: 'gpt-4o-mini (faster / cheaper)' },
      ]) {
        const opt = document.createElement('option');
        opt.value = m.value;
        opt.textContent = m.label;
        if (m.value === this._draft.model) opt.selected = true;
        select.appendChild(opt);
      }
      // Sync draft to actual dropdown value (handles stale Ollama model names)
      this._draft.model = select.value;
      select.addEventListener('change', () => {
        this._draft.model = select.value;
      });
      this._modelSelect = select;
      return select;
    }));

    // Test connection
    const testRow = document.createElement('div');
    testRow.className = 'settings-test-row';
    const testBtn = document.createElement('button');
    testBtn.className = 'settings-test-btn';
    testBtn.textContent = 'Test Connection';
    testBtn.addEventListener('click', () => this._testOpenAIConnection());
    testRow.appendChild(testBtn);
    const testIndicator = document.createElement('span');
    testIndicator.className = 'settings-test-indicator';
    this._testIndicator = testIndicator;
    testRow.appendChild(testIndicator);
    this._bodyEl.appendChild(testRow);
  }

  // ---- Ollama Section ----

  _renderOllamaSection() {
    // Status row
    this._bodyEl.appendChild(this._buildRow('Status', () => {
      const wrap = document.createElement('div');
      wrap.style.cssText = 'display:flex; align-items:center; gap:8px;';
      const dot = document.createElement('span');
      dot.className = 'settings-ollama-dot';
      wrap.appendChild(dot);
      const text = document.createElement('span');
      text.style.cssText = 'font-size:12px;';
      wrap.appendChild(text);
      this._ollamaDot = dot;
      this._ollamaStatusText = text;
      this._updateOllamaStatus();

      const refreshBtn = document.createElement('button');
      refreshBtn.className = 'settings-key-toggle';
      refreshBtn.textContent = 'Refresh';
      refreshBtn.style.marginLeft = 'auto';
      refreshBtn.addEventListener('click', () => this._fetchOllamaModels());
      wrap.appendChild(refreshBtn);

      return wrap;
    }));

    // Warning
    const warn = document.createElement('div');
    warn.className = 'settings-info';
    warn.style.color = 'var(--accent-warning)';
    warn.textContent = `Requires a model with at least ${MIN_PARAM_BILLIONS}B parameters for reliable 3D generation. Smaller models are listed but not selectable.`;
    this._bodyEl.appendChild(warn);

    // Ollama info
    const info = document.createElement('div');
    info.className = 'settings-info';
    info.innerHTML = `Ollama must be running on <code style="color:var(--text-accent)">localhost:11434</code>.
      <a href="https://ollama.com" target="_blank" rel="noopener">Install Ollama</a>`;
    this._bodyEl.appendChild(info);

    // Model selector
    this._bodyEl.appendChild(this._buildRow('Model', () => {
      const select = document.createElement('select');
      select.className = 'settings-select';
      this._ollamaModelSelect = select;
      this._populateOllamaModels();
      select.addEventListener('change', () => {
        this._draft.model = select.value;
      });
      return select;
    }));

    // Auto-fetch if we haven't loaded yet
    if (this._ollamaStatus === 'unknown') {
      this._fetchOllamaModels();
    }
  }

  async _fetchOllamaModels() {
    this._ollamaStatus = 'checking';
    this._updateOllamaStatus();

    try {
      const res = await fetch(`${OLLAMA_BASE}/api/tags`, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      this._ollamaModels = (data.models || []).map(m => {
        const paramBillions = this._parseParamSize(m);
        return {
          name: m.name,
          paramSize: m.details?.parameter_size || '?',
          paramBillions,
          disabled: paramBillions > 0 && paramBillions < MIN_PARAM_BILLIONS,
        };
      });

      // Sort: enabled first (by size desc), then disabled (by size desc)
      this._ollamaModels.sort((a, b) => {
        if (a.disabled !== b.disabled) return a.disabled ? 1 : -1;
        return b.paramBillions - a.paramBillions;
      });

      this._ollamaStatus = 'connected';

      // Auto-select first enabled model if current draft model isn't in the list
      const enabledModels = this._ollamaModels.filter(m => !m.disabled);
      if (enabledModels.length > 0) {
        const currentInList = enabledModels.find(m => m.name === this._draft.model);
        if (!currentInList) {
          this._draft.model = enabledModels[0].name;
        }
      }
    } catch (err) {
      console.warn('Ollama not reachable:', err.message);
      this._ollamaModels = [];
      this._ollamaStatus = 'offline';
    }

    this._updateOllamaStatus();
    this._populateOllamaModels();
  }

  /** Parse parameter size in billions from Ollama model data */
  _parseParamSize(model) {
    // Try details.parameter_size first: "8.0B", "70B", "3.8B"
    const paramStr = model.details?.parameter_size || '';
    const match = paramStr.match(/([\d.]+)\s*[Bb]/);
    if (match) return parseFloat(match[1]);

    // Fallback: parse from model name — "llama3.1:8b", "qwen2.5:72b"
    const nameMatch = model.name.match(/(\d+(?:\.\d+)?)\s*[Bb]/i);
    if (nameMatch) return parseFloat(nameMatch[1]);

    // Unknown size — assume it could be large enough, mark as 0 (unknown)
    return 0;
  }

  _updateOllamaStatus() {
    if (!this._ollamaDot || !this._ollamaStatusText) return;
    const dot = this._ollamaDot;
    const text = this._ollamaStatusText;

    if (this._ollamaStatus === 'checking') {
      dot.style.background = 'var(--accent-warning)';
      text.textContent = 'Checking...';
      text.style.color = 'var(--accent-warning)';
    } else if (this._ollamaStatus === 'connected') {
      const enabled = this._ollamaModels.filter(m => !m.disabled).length;
      dot.style.background = 'var(--accent-secondary)';
      text.textContent = `Connected — ${this._ollamaModels.length} model${this._ollamaModels.length !== 1 ? 's' : ''} found (${enabled} usable)`;
      text.style.color = 'var(--accent-secondary)';
    } else if (this._ollamaStatus === 'offline') {
      dot.style.background = 'var(--accent-danger)';
      text.textContent = 'Ollama not running';
      text.style.color = 'var(--accent-danger)';
    } else {
      dot.style.background = 'var(--text-muted)';
      text.textContent = 'Not checked';
      text.style.color = 'var(--text-muted)';
    }
  }

  _populateOllamaModels() {
    const select = this._ollamaModelSelect;
    if (!select) return;
    select.innerHTML = '';

    if (this._ollamaModels.length === 0) {
      const opt = document.createElement('option');
      opt.disabled = true;
      opt.selected = true;
      opt.textContent = this._ollamaStatus === 'offline'
        ? 'Ollama not running'
        : 'No models installed';
      select.appendChild(opt);
      return;
    }

    for (const m of this._ollamaModels) {
      const opt = document.createElement('option');
      opt.value = m.name;
      const sizeLabel = m.paramSize !== '?' ? ` (${m.paramSize})` : '';

      if (m.disabled) {
        opt.disabled = true;
        opt.textContent = `${m.name}${sizeLabel} — too small`;
        opt.style.color = 'var(--text-muted)';
      } else {
        opt.textContent = `${m.name}${sizeLabel}`;
      }

      if (m.name === this._draft.model && !m.disabled) opt.selected = true;
      select.appendChild(opt);
    }
  }

  // ---- Editor Preferences ----

  _renderPrefsSection() {
    this._bodyEl.appendChild(this._buildRow('Grid Size', () => {
      const input = document.createElement('input');
      input.type = 'number';
      input.className = 'settings-input settings-input-sm';
      input.min = 5;
      input.max = 100;
      input.value = this._draft.prefs.gridSize;
      input.addEventListener('change', () => {
        this._draft.prefs.gridSize = parseInt(input.value, 10) || 20;
      });
      return input;
    }));

    this._bodyEl.appendChild(this._buildRow('Snap to Grid', () => {
      const label = document.createElement('label');
      label.className = 'settings-toggle';
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = this._draft.prefs.snapToGrid;
      cb.addEventListener('change', () => { this._draft.prefs.snapToGrid = cb.checked; });
      const slider = document.createElement('span');
      slider.className = 'settings-toggle-slider';
      label.appendChild(cb);
      label.appendChild(slider);
      return label;
    }));

    this._bodyEl.appendChild(this._buildRow('Snap Size', () => {
      const select = document.createElement('select');
      select.className = 'settings-select settings-select-sm';
      for (const val of [0.25, 0.5, 1.0]) {
        const opt = document.createElement('option');
        opt.value = val;
        opt.textContent = val.toString();
        if (val === this._draft.prefs.snapSize) opt.selected = true;
        select.appendChild(opt);
      }
      select.addEventListener('change', () => {
        this._draft.prefs.snapSize = parseFloat(select.value);
      });
      return select;
    }));

    this._bodyEl.appendChild(this._buildRow('Auto-save', () => {
      const label = document.createElement('label');
      label.className = 'settings-toggle';
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = this._draft.prefs.autoSave;
      cb.addEventListener('change', () => { this._draft.prefs.autoSave = cb.checked; });
      const slider = document.createElement('span');
      slider.className = 'settings-toggle-slider';
      label.appendChild(cb);
      label.appendChild(slider);
      return label;
    }));
  }

  // ---- Shared UI ----

  show() {
    this._draft = {
      provider: this._provider,
      apiKey: this._apiKey,
      model: this._model,
      prefs: { ...this._prefs },
    };
    this._testStatus = null;
    this._keyVisible = false;

    this._renderBody();
    this.el.style.display = 'flex';
    this._visible = true;

    if (this._draft.provider === 'ollama') {
      this._fetchOllamaModels();
    } else if (!this._draft.apiKey && this._keyInput) {
      setTimeout(() => this._keyInput?.focus(), 100);
    }
  }

  hide() {
    this.el.style.display = 'none';
    this._visible = false;
  }

  isVisible() { return this._visible; }

  _buildSectionHeader(text) {
    const h = document.createElement('div');
    h.className = 'settings-section-header';
    h.textContent = text;
    return h;
  }

  _buildRow(label, buildControl) {
    const row = document.createElement('div');
    row.className = 'settings-row';
    const lbl = document.createElement('label');
    lbl.className = 'settings-label';
    lbl.textContent = label;
    row.appendChild(lbl);
    const ctrl = document.createElement('div');
    ctrl.className = 'settings-control';
    ctrl.appendChild(buildControl());
    row.appendChild(ctrl);
    return row;
  }

  _updateTestIndicator() {
    if (!this._testIndicator) return;
    if (this._testStatus === 'testing') {
      this._testIndicator.className = 'settings-test-indicator testing';
      this._testIndicator.textContent = 'Testing...';
    } else if (this._testStatus === 'ok') {
      this._testIndicator.className = 'settings-test-indicator ok';
      this._testIndicator.textContent = 'Connected';
    } else if (this._testStatus === 'error') {
      this._testIndicator.className = 'settings-test-indicator error';
      this._testIndicator.textContent = 'Invalid key';
    } else {
      this._testIndicator.className = 'settings-test-indicator';
      this._testIndicator.textContent = '';
    }
  }

  async _testOpenAIConnection() {
    const key = this._draft.apiKey.trim();
    if (!key) {
      this._testStatus = 'error';
      if (this._testIndicator) this._testIndicator.textContent = 'No key entered';
      this._updateTestIndicator();
      return;
    }
    this._testStatus = 'testing';
    this._updateTestIndicator();
    try {
      const res = await fetch('https://api.openai.com/v1/models', {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${key}` },
      });
      this._testStatus = res.ok ? 'ok' : 'error';
      if (!res.ok && this._testIndicator) {
        this._testIndicator.textContent = `Error (${res.status})`;
      }
    } catch {
      this._testStatus = 'error';
    }
    this._updateTestIndicator();
  }

  _save() {
    const provider = this._draft.provider;
    const key = provider === 'openai' ? this._draft.apiKey.trim() : '';
    const model = this._draft.model;
    const prefs = { ...this._draft.prefs };
    const baseURL = provider === 'ollama' ? OLLAMA_BASE : '/api/openai';

    // Persist
    localStorage.setItem(STORAGE_KEY_PROVIDER, provider);
    if (key) {
      localStorage.setItem(STORAGE_KEY_API, key);
    } else {
      localStorage.removeItem(STORAGE_KEY_API);
    }
    localStorage.setItem(STORAGE_KEY_MODEL, model);
    localStorage.setItem(STORAGE_KEY_PREFS, JSON.stringify(prefs));

    this._provider = provider;
    this._apiKey = key;
    this._model = model;
    this._prefs = prefs;

    this.hide();

    if (this.onSave) {
      this.onSave({ provider, apiKey: key, model, baseURL, prefs });
    }
  }

  _loadPrefs() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_PREFS);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }
}

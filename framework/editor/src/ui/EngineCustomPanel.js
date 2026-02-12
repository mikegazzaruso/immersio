const ENGINE_SPINNER_MESSAGES = [
  'Rewiring the engine...',
  'Compiling new physics...',
  'Patching control systems...',
  'Integrating custom behaviors...',
  'Calibrating game mechanics...',
  'Soldering new circuits...',
  'Flashing firmware update...',
  'Optimizing game loop...',
];

export class EngineCustomPanel {
  constructor({ onSubmit }) {
    this.onSubmit = onSubmit;
    this.el = null;
    this._visible = false;
    this._processing = false;
    this._instructions = [];
    this._lastMessageIndex = -1;
    this._spinnerInterval = null;
  }

  build() {
    this.el = document.createElement('div');
    this.el.className = 'engine-panel-backdrop';
    this.el.style.display = 'none';
    this.el.addEventListener('mousedown', (e) => {
      if (e.target === this.el && !this._processing) this.hide();
    });

    const panel = document.createElement('div');
    panel.className = 'engine-panel';
    this.el.appendChild(panel);

    // Header
    const header = document.createElement('div');
    header.className = 'settings-header';
    const titleWrap = document.createElement('div');
    titleWrap.innerHTML = `<span class="settings-title">Engine Customization</span>`;
    header.appendChild(titleWrap);
    const closeBtn = document.createElement('button');
    closeBtn.className = 'settings-close';
    closeBtn.innerHTML = '&times;';
    closeBtn.addEventListener('click', () => {
      if (!this._processing) this.hide();
    });
    header.appendChild(closeBtn);
    panel.appendChild(header);

    // Body
    const body = document.createElement('div');
    body.className = 'engine-panel-body';
    panel.appendChild(body);
    this._bodyEl = body;

    // Subtitle
    const subtitle = document.createElement('div');
    subtitle.className = 'engine-panel-subtitle';
    subtitle.textContent = 'Describe physics, interactions, controls, or any engine behavior changes.';
    body.appendChild(subtitle);

    // Instructions history
    this._historyEl = document.createElement('div');
    this._historyEl.className = 'engine-panel-history';
    body.appendChild(this._historyEl);

    // Input area (textarea + button)
    this._inputArea = document.createElement('div');
    this._inputArea.className = 'engine-panel-input-area';
    body.appendChild(this._inputArea);

    this._textarea = document.createElement('textarea');
    this._textarea.className = 'engine-panel-textarea';
    this._textarea.placeholder = 'e.g. When pressing B, fire a projectile forward...';
    this._textarea.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        this._submit();
      }
    });
    this._inputArea.appendChild(this._textarea);

    const hint = document.createElement('div');
    hint.className = 'engine-panel-hint';
    hint.textContent = 'Cmd/Ctrl+Enter to apply \u00B7 Esc to close';
    this._inputArea.appendChild(hint);

    const applyBtn = document.createElement('button');
    applyBtn.className = 'settings-btn settings-btn-primary';
    applyBtn.textContent = 'Apply';
    applyBtn.addEventListener('click', () => this._submit());
    this._applyBtn = applyBtn;
    this._inputArea.appendChild(applyBtn);

    // Spinner (hidden by default)
    this._spinnerEl = document.createElement('div');
    this._spinnerEl.className = 'engine-spinner';
    this._spinnerEl.style.display = 'none';
    this._spinnerTextEl = document.createElement('span');
    this._spinnerTextEl.className = 'ai-prompt-spinner-text';
    this._spinnerEl.appendChild(this._spinnerTextEl);
    body.appendChild(this._spinnerEl);

    // Keyboard: Escape to close
    this._onKeyDown = (e) => {
      if (e.key === 'Escape' && this._visible && !this._processing) this.hide();
    };
    document.addEventListener('keydown', this._onKeyDown);

    this._renderHistory();
    return this.el;
  }

  show() {
    this._processing = false;
    this._inputArea.style.display = '';
    this._spinnerEl.style.display = 'none';
    this._textarea.value = '';
    this._renderHistory();
    this.el.style.display = 'flex';
    this._visible = true;
    requestAnimationFrame(() => this._textarea.focus());
  }

  hide() {
    this.el.style.display = 'none';
    this._visible = false;
    this._stopSpinnerRotation();
  }

  isVisible() { return this._visible; }

  setProcessing(processing) {
    this._processing = processing;
    if (processing) {
      this._inputArea.style.display = 'none';
      this._spinnerTextEl.textContent = this._getRandomMessage();
      this._spinnerEl.style.display = '';
      this._startSpinnerRotation();
    } else {
      this._stopSpinnerRotation();
      this._spinnerEl.style.display = 'none';
      this._inputArea.style.display = '';
      this._textarea.value = '';
      requestAnimationFrame(() => this._textarea.focus());
    }
  }

  addInstruction(text) {
    this._instructions.push(text);
    this._renderHistory();
  }

  getInstructions() {
    return [...this._instructions];
  }

  setInstructions(arr) {
    this._instructions = Array.isArray(arr) ? [...arr] : [];
    this._renderHistory();
  }

  _renderHistory() {
    if (!this._historyEl) return;
    this._historyEl.innerHTML = '';

    if (this._instructions.length === 0) {
      this._historyEl.style.display = 'none';
      return;
    }

    this._historyEl.style.display = '';
    const label = document.createElement('div');
    label.className = 'engine-history-label';
    label.textContent = 'Applied Instructions';
    this._historyEl.appendChild(label);

    for (const text of this._instructions) {
      const card = document.createElement('div');
      card.className = 'engine-instruction-card';
      card.textContent = text;
      this._historyEl.appendChild(card);
    }
  }

  _submit() {
    const prompt = this._textarea.value.trim();
    if (!prompt || this._processing) return;
    this.setProcessing(true);
    this.onSubmit?.(prompt);
  }

  _getRandomMessage() {
    let idx;
    do {
      idx = Math.floor(Math.random() * ENGINE_SPINNER_MESSAGES.length);
    } while (idx === this._lastMessageIndex && ENGINE_SPINNER_MESSAGES.length > 1);
    this._lastMessageIndex = idx;
    return ENGINE_SPINNER_MESSAGES[idx];
  }

  _startSpinnerRotation() {
    this._stopSpinnerRotation();
    this._spinnerInterval = setInterval(() => {
      this._spinnerTextEl.textContent = this._getRandomMessage();
    }, 3000);
  }

  _stopSpinnerRotation() {
    if (this._spinnerInterval) {
      clearInterval(this._spinnerInterval);
      this._spinnerInterval = null;
    }
  }
}

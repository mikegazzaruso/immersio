const LOADING_MESSAGES = [
  'Summoning geometry from the void...',
  'Tessellating your imagination...',
  'Consulting the three.js spirits...',
  'Materializing your vision...',
  'Sculpting vertices with care...',
  'Weaving polygons together...',
  'Painting textures in the ether...',
  'Aligning normals to perfection...',
  'Baking ambient occlusion vibes...',
  'Compiling shader magic...',
  'Rendering dreams into meshes...',
  'Extruding creativity...',
  'UV-unwrapping your thoughts...',
  'Calculating the perfect bounding box...',
  'Assembling the scene graph...',
  'Dispatching triangles to the GPU...',
  'Interpolating between genius and art...',
  'Convincing the vertices to behave...',
  'Whispering to the fragment shader...',
  'Asking the normals which way is up...',
];

export class AIPromptOverlay {
  constructor({ onSubmit, onEnvSubmit }) {
    this.onSubmit = onSubmit;
    this.onEnvSubmit = onEnvSubmit;
    this.el = null;
    this._container = null;
    this._input = null;
    this._coordsEl = null;
    this._spinnerEl = null;
    this._spinnerTextEl = null;
    this._worldCoords = null;
    this._processing = false;
    this._envDialog = null;
    this._lastMessageIndex = -1;
  }

  build() {
    this.el = document.createElement('div');
    this.el.className = 'ai-prompt-overlay';
    this.el.style.display = 'none';

    this._container = document.createElement('div');
    this._container.className = 'ai-prompt-container';

    // Coordinates display
    this._coordsEl = document.createElement('div');
    this._coordsEl.className = 'ai-prompt-coords';
    this._container.appendChild(this._coordsEl);

    // Input
    this._input = document.createElement('input');
    this._input.type = 'text';
    this._input.className = 'ai-prompt-input';
    this._input.placeholder = 'Describe what to create here...';
    this._input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && this._input.value.trim()) {
        e.preventDefault();
        this._submit();
      } else if (e.key === 'Escape') {
        this.hide();
      }
    });
    // Prevent clicks inside the prompt from propagating to the viewport
    // mousedown handler (which hides the prompt when clicking outside it)
    this._container.addEventListener('mousedown', (e) => e.stopPropagation());
    this._container.appendChild(this._input);

    // Hint
    const hint = document.createElement('div');
    hint.className = 'ai-prompt-hint';
    hint.textContent = 'Enter to submit \u00B7 Esc to cancel';
    this._container.appendChild(hint);

    // Spinner (hidden by default)
    this._spinnerEl = document.createElement('div');
    this._spinnerEl.className = 'ai-prompt-spinner';
    this._spinnerEl.style.display = 'none';
    this._spinnerTextEl = document.createElement('span');
    this._spinnerTextEl.className = 'ai-prompt-spinner-text';
    this._spinnerEl.appendChild(this._spinnerTextEl);
    this._container.appendChild(this._spinnerEl);

    this.el.appendChild(this._container);
    return this.el;
  }

  /**
   * Show the prompt overlay at a screen position within the viewport.
   * @param {number} x - X offset within viewport element
   * @param {number} y - Y offset within viewport element
   * @param {{ x: number, y: number, z: number }} worldCoords - 3D world position
   */
  show(x, y, worldCoords) {
    this._worldCoords = worldCoords;
    this._processing = false;

    // Position the overlay — keep it within viewport bounds
    const parent = this.el.parentElement;
    if (!parent) return;

    const pw = parent.clientWidth;
    const ph = parent.clientHeight;
    const promptW = 300;
    const promptH = 100;

    let left = x + 12; // offset from cursor
    let top = y + 12;

    // Clamp to viewport
    if (left + promptW > pw) left = x - promptW - 12;
    if (top + promptH > ph) top = y - promptH - 12;
    if (left < 0) left = 8;
    if (top < 0) top = 8;

    this.el.style.left = left + 'px';
    this.el.style.top = top + 'px';
    this.el.style.display = 'block';

    // Show coordinates
    const fmt = (n) => n.toFixed(2);
    this._coordsEl.textContent = `World: (${fmt(worldCoords.x)}, ${fmt(worldCoords.y)}, ${fmt(worldCoords.z)})`;

    // Reset input
    this._input.value = '';
    this._input.style.display = '';
    this._spinnerEl.style.display = 'none';

    // Focus after animation frame
    requestAnimationFrame(() => this._input.focus());
  }

  hide() {
    this.el.style.display = 'none';
    this._input.value = '';
    this._processing = false;
  }

  setProcessing(processing) {
    this._processing = processing;
    if (processing) {
      const msg = this._getRandomMessage();
      this._spinnerTextEl.textContent = msg;
      this._input.style.display = 'none';
      this._spinnerEl.style.display = '';
      return msg;
    } else {
      this.hide();
      return null;
    }
  }

  _getRandomMessage() {
    let idx;
    do {
      idx = Math.floor(Math.random() * LOADING_MESSAGES.length);
    } while (idx === this._lastMessageIndex && LOADING_MESSAGES.length > 1);
    this._lastMessageIndex = idx;
    return LOADING_MESSAGES[idx];
  }

  _submit() {
    const prompt = this._input.value.trim();
    if (!prompt || this._processing) return;
    this.setProcessing(true);
    this.onSubmit?.(prompt, this._worldCoords);
  }

  // --- AI Environment Dialog ---

  /**
   * @param {boolean} hasExistingEnv — if true, show confirmation first
   */
  showEnvDialog(hasExistingEnv = false) {
    if (this._envDialog) return; // already open

    if (hasExistingEnv) {
      this._showEnvConfirmation();
    } else {
      this._showEnvPromptDialog();
    }
  }

  _showEnvConfirmation() {
    const overlay = document.createElement('div');
    overlay.className = 'ai-env-dialog';

    const content = document.createElement('div');
    content.className = 'ai-env-dialog-content';

    const title = document.createElement('div');
    title.className = 'ai-env-dialog-title';
    title.textContent = 'Reinitialize Environment';
    content.appendChild(title);

    const msg = document.createElement('p');
    msg.style.cssText = 'color: #e0e0e0; font-size: 13px; margin: 8px 0 12px; line-height: 1.5;';
    msg.textContent = 'Are you sure you want to reinitialize the environment? This will replace the current environment and all its decorations with a new AI-generated one.';
    content.appendChild(msg);

    const actions = document.createElement('div');
    actions.className = 'ai-env-dialog-actions';

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', () => {
      overlay.remove();
    });

    const confirmBtn = document.createElement('button');
    confirmBtn.className = 'primary';
    confirmBtn.textContent = 'Yes, Reinitialize';
    confirmBtn.addEventListener('click', () => {
      overlay.remove();
      this._showEnvPromptDialog();
    });

    actions.appendChild(cancelBtn);
    actions.appendChild(confirmBtn);
    content.appendChild(actions);
    overlay.appendChild(content);

    // Close on Escape
    overlay.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') overlay.remove();
    });
    overlay.addEventListener('mousedown', (e) => {
      if (e.target === overlay) overlay.remove();
    });

    document.body.appendChild(overlay);
    requestAnimationFrame(() => confirmBtn.focus());
  }

  _showEnvPromptDialog() {
    const overlay = document.createElement('div');
    overlay.className = 'ai-env-dialog';

    const content = document.createElement('div');
    content.className = 'ai-env-dialog-content';

    const title = document.createElement('div');
    title.className = 'ai-env-dialog-title';
    title.textContent = 'AI Environment Generator';
    content.appendChild(title);

    const textarea = document.createElement('textarea');
    textarea.placeholder = 'Describe your dream environment...\ne.g., "enchanted forest at twilight with glowing mushrooms and floating lanterns"';
    content.appendChild(textarea);

    // Spinner (hidden initially)
    const spinner = document.createElement('div');
    spinner.className = 'ai-prompt-spinner';
    spinner.style.display = 'none';
    const spinnerText = document.createElement('span');
    spinnerText.className = 'ai-prompt-spinner-text';
    spinner.appendChild(spinnerText);
    content.appendChild(spinner);

    const actions = document.createElement('div');
    actions.className = 'ai-env-dialog-actions';

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', () => this.hideEnvDialog());

    const submitBtn = document.createElement('button');
    submitBtn.className = 'primary';
    submitBtn.textContent = 'Generate Environment';
    submitBtn.addEventListener('click', () => {
      const prompt = textarea.value.trim();
      if (prompt && !this._envProcessing) {
        this._envProcessing = true;
        // Show spinner, hide input
        textarea.style.display = 'none';
        spinnerText.textContent = this._getRandomMessage();
        spinner.style.display = '';
        submitBtn.disabled = true;
        submitBtn.textContent = 'Generating...';
        cancelBtn.style.display = 'none';
        this.onEnvSubmit?.(prompt);
      }
    });

    actions.appendChild(cancelBtn);
    actions.appendChild(submitBtn);
    content.appendChild(actions);
    overlay.appendChild(content);

    // Store references for processing state control
    this._envDialogSpinner = spinner;
    this._envDialogSpinnerText = spinnerText;
    this._envDialogTextarea = textarea;
    this._envDialogSubmitBtn = submitBtn;
    this._envDialogCancelBtn = cancelBtn;

    // Close on Escape (only if not processing)
    const onKeyDown = (e) => {
      if (e.key === 'Escape' && !this._envProcessing) this.hideEnvDialog();
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        submitBtn.click();
      }
    };
    overlay.addEventListener('keydown', onKeyDown);

    // Close on overlay click (not content, not while processing)
    overlay.addEventListener('mousedown', (e) => {
      if (e.target === overlay && !this._envProcessing) this.hideEnvDialog();
    });

    document.body.appendChild(overlay);
    this._envDialog = overlay;
    this._envProcessing = false;

    requestAnimationFrame(() => textarea.focus());
  }

  /** Called by EditorApp when env AI completes (success or error) */
  setEnvProcessing(processing) {
    this._envProcessing = processing;
    if (!processing) {
      this.hideEnvDialog();
    }
  }

  hideEnvDialog() {
    if (this._envDialog) {
      this._envDialog.remove();
      this._envDialog = null;
    }
    this._envProcessing = false;
    this._envDialogSpinner = null;
    this._envDialogSpinnerText = null;
    this._envDialogTextarea = null;
    this._envDialogSubmitBtn = null;
    this._envDialogCancelBtn = null;
  }
}

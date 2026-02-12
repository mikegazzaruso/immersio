export class StatusBar {
  constructor() {
    this.el = null;
    this._cursorEl = null;
    this._objectsEl = null;
    this._aiDot = null;
    this._aiLabel = null;
    this._lastActionEl = null;
  }

  build() {
    this.el = document.createElement('div');
    this.el.className = 'editor-statusbar';

    // Cursor position
    this._cursorEl = this._addItem('Cursor: (0.00, 0.00, 0.00)');

    // Object count
    this._objectsEl = this._addItem('Objects: 0');

    // Spacer
    const spacer = document.createElement('div');
    spacer.className = 'status-spacer';
    this.el.appendChild(spacer);

    // Last action
    this._lastActionEl = this._addItem('Ready');

    // AI status
    const aiItem = document.createElement('div');
    aiItem.className = 'status-item';
    this._aiDot = document.createElement('span');
    this._aiDot.className = 'status-dot';
    aiItem.appendChild(this._aiDot);
    this._aiLabel = document.createElement('span');
    this._aiLabel.textContent = 'AI: idle';
    aiItem.appendChild(this._aiLabel);
    this.el.appendChild(aiItem);

    return this.el;
  }

  /**
   * Update status bar values.
   * @param {{ cursor?: {x,y,z}, objectCount?: number, lastAction?: string }} data
   */
  update(data) {
    if (data.cursor) {
      const c = data.cursor;
      this._cursorEl.textContent = `Cursor: (${c.x.toFixed(2)}, ${c.y.toFixed(2)}, ${c.z.toFixed(2)})`;
    }
    if (data.objectCount !== undefined) {
      this._objectsEl.textContent = `Objects: ${data.objectCount}`;
    }
    if (data.lastAction) {
      this._lastActionEl.textContent = data.lastAction;
    }
  }

  /** Set AI processing status: 'idle' | 'processing' | 'error' */
  setAIStatus(status, message) {
    this._aiDot.className = 'status-dot';
    switch (status) {
      case 'processing':
        this._aiDot.classList.add('processing');
        this._aiLabel.textContent = message || 'AI: processing...';
        break;
      case 'error':
        this._aiDot.classList.add('error');
        this._aiLabel.textContent = 'AI: error';
        break;
      default:
        this._aiLabel.textContent = 'AI: idle';
    }
  }

  _addItem(text) {
    const item = document.createElement('div');
    item.className = 'status-item';
    item.textContent = text;
    this.el.appendChild(item);
    return item;
  }
}

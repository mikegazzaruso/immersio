/**
 * ErrorPopup — modal popup for displaying errors with copyable text.
 */
export class ErrorPopup {
  constructor() {
    this._backdrop = null;
  }

  build() {
    // We create the DOM on-demand in show(), nothing to mount upfront
    return document.createDocumentFragment();
  }

  /**
   * Show an error popup.
   * @param {string} title — short error title
   * @param {string} message — human-readable description
   * @param {string} [detail] — raw error/response text (copyable)
   */
  show(title, message, detail = '') {
    this.hide(); // remove any existing popup

    this._backdrop = document.createElement('div');
    this._backdrop.className = 'error-popup-backdrop';
    this._backdrop.addEventListener('mousedown', (e) => {
      if (e.target === this._backdrop) this.hide();
    });

    const popup = document.createElement('div');
    popup.className = 'error-popup';

    // Header
    const header = document.createElement('div');
    header.className = 'error-popup-header';

    const titleEl = document.createElement('div');
    titleEl.className = 'error-popup-title';
    titleEl.textContent = title || 'Error';

    const closeBtn = document.createElement('button');
    closeBtn.className = 'error-popup-close';
    closeBtn.innerHTML = '&times;';
    closeBtn.addEventListener('click', () => this.hide());

    header.appendChild(titleEl);
    header.appendChild(closeBtn);
    popup.appendChild(header);

    // Body
    const body = document.createElement('div');
    body.className = 'error-popup-body';

    if (message) {
      const msgEl = document.createElement('div');
      msgEl.className = 'error-popup-message';
      msgEl.textContent = message;
      body.appendChild(msgEl);
    }

    if (detail) {
      const detailEl = document.createElement('div');
      detailEl.className = 'error-popup-detail';
      detailEl.textContent = detail;
      body.appendChild(detailEl);
    }

    popup.appendChild(body);

    // Footer
    const footer = document.createElement('div');
    footer.className = 'error-popup-footer';

    // Copy button — copies full error text
    const copyBtn = document.createElement('button');
    copyBtn.className = 'error-popup-btn error-popup-btn-copy';
    copyBtn.textContent = 'Copy Error';
    copyBtn.addEventListener('click', () => {
      const textToCopy = [title, message, detail].filter(Boolean).join('\n\n');
      navigator.clipboard.writeText(textToCopy).then(() => {
        copyBtn.textContent = 'Copied!';
        copyBtn.classList.add('copied');
        setTimeout(() => {
          copyBtn.textContent = 'Copy Error';
          copyBtn.classList.remove('copied');
        }, 2000);
      });
    });

    const okBtn = document.createElement('button');
    okBtn.className = 'error-popup-btn';
    okBtn.textContent = 'OK';
    okBtn.addEventListener('click', () => this.hide());

    footer.appendChild(copyBtn);
    footer.appendChild(okBtn);
    popup.appendChild(footer);

    this._backdrop.appendChild(popup);
    document.body.appendChild(this._backdrop);

    // ESC to close
    this._escHandler = (e) => {
      if (e.key === 'Escape') this.hide();
    };
    document.addEventListener('keydown', this._escHandler);
  }

  hide() {
    if (this._backdrop) {
      this._backdrop.remove();
      this._backdrop = null;
    }
    if (this._escHandler) {
      document.removeEventListener('keydown', this._escHandler);
      this._escHandler = null;
    }
  }
}

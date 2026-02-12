export class ContextMenu {
  constructor() {
    this.el = null;
    this._onSelect = null;
  }

  build() {
    this.el = document.createElement('div');
    this.el.className = 'context-menu';
    this.el.style.display = 'none';
    return this.el;
  }

  /**
   * Show context menu at screen position.
   * @param {number} x - Screen X
   * @param {number} y - Screen Y
   * @param {Array<{ label?: string, action?: string, shortcut?: string, danger?: boolean, separator?: boolean }>} items
   * @param {(action: string) => void} onSelect
   */
  show(x, y, items, onSelect) {
    this._onSelect = onSelect;
    this.el.innerHTML = '';

    for (const item of items) {
      if (item.separator) {
        const sep = document.createElement('div');
        sep.className = 'context-menu-separator';
        this.el.appendChild(sep);
        continue;
      }

      const el = document.createElement('div');
      el.className = 'context-menu-item' + (item.danger ? ' danger' : '');

      const label = document.createElement('span');
      label.textContent = item.label;
      el.appendChild(label);

      if (item.shortcut) {
        const sc = document.createElement('span');
        sc.className = 'context-menu-shortcut';
        sc.textContent = item.shortcut;
        el.appendChild(sc);
      }

      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const cb = this._onSelect;
        this.hide();
        cb?.(item.action);
      });

      this.el.appendChild(el);
    }

    // Position — clamp to viewport
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let left = x;
    let top = y;

    this.el.style.display = 'block';
    this.el.style.left = left + 'px';
    this.el.style.top = top + 'px';

    // After rendering, check bounds
    requestAnimationFrame(() => {
      const rect = this.el.getBoundingClientRect();
      if (rect.right > vw) left = vw - rect.width - 4;
      if (rect.bottom > vh) top = vh - rect.height - 4;
      if (left < 0) left = 4;
      if (top < 0) top = 4;
      this.el.style.left = left + 'px';
      this.el.style.top = top + 'px';
    });
  }

  hide() {
    this.el.style.display = 'none';
    this._onSelect = null;
  }
}

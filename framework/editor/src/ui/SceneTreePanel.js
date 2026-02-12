const CATEGORIES = [
  { key: 'environment', label: 'Environment', iconClass: 'env' },
  { key: 'decorations', label: 'Decorations', iconClass: 'deco' },
  { key: 'props', label: 'Props', iconClass: 'prop' },
  { key: 'exits', label: 'Exits', iconClass: 'exit' },
];

export class SceneTreePanel {
  constructor({ onSelect, onContextMenu }) {
    this.onSelect = onSelect;
    this.onContextMenu = onContextMenu;
    this.el = null;
    this.contentEl = null;
    this.selectedId = null;
    this._data = { environment: [], decorations: [], props: [], exits: [] };
    this._collapsed = {};
    this._expandedItems = {}; // Track expanded composite items
  }

  build() {
    this.el = document.createElement('div');
    this.el.className = 'editor-panel panel-left';

    // Header
    const header = document.createElement('div');
    header.className = 'panel-header';
    header.textContent = 'Scene Tree';
    this.el.appendChild(header);

    // Content
    this.contentEl = document.createElement('div');
    this.contentEl.className = 'panel-content';
    this.el.appendChild(this.contentEl);

    // Click on empty space → deselect all
    // Use mousedown on the whole panel — tree items stop propagation on click,
    // so we use mousedown which fires first. We set a flag that the tree-item
    // click handler will clear, and deselect after a microtask if it wasn't cleared.
    this.el.addEventListener('mousedown', (e) => {
      if (e.target.closest('.tree-item') || e.target.closest('.resize-handle')) return;
      // Deselect
      this.selectedId = null;
      this._updateSelection();
      this.onSelect?.(null);
    });

    this._render();
    return this.el;
  }

  /** Update tree data. Expected shape: { environment: [], decorations: [], props: [], exits: [] } */
  update(data) {
    this._data = data || this._data;
    this._render();
  }

  /** Select an item by id */
  select(id) {
    this.selectedId = id;
    this._updateSelection();
    this.onSelect?.({ id });
  }

  _render() {
    this.contentEl.innerHTML = '';

    for (const cat of CATEGORIES) {
      const items = this._data[cat.key] || [];
      const catEl = document.createElement('div');
      catEl.className = 'tree-category';

      // Category header
      const headerEl = document.createElement('div');
      headerEl.className = 'tree-category-header';
      const arrow = document.createElement('span');
      arrow.className = 'arrow' + (this._collapsed[cat.key] ? ' collapsed' : '');
      arrow.textContent = '\u25BC';
      headerEl.appendChild(arrow);

      const label = document.createElement('span');
      label.textContent = `${cat.label} (${items.length})`;
      headerEl.appendChild(label);

      headerEl.addEventListener('click', () => {
        this._collapsed[cat.key] = !this._collapsed[cat.key];
        arrow.classList.toggle('collapsed');
        itemsEl.classList.toggle('collapsed');
      });

      catEl.appendChild(headerEl);

      // Items
      const itemsEl = document.createElement('div');
      itemsEl.className = 'tree-category-items' + (this._collapsed[cat.key] ? ' collapsed' : '');

      if (items.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'tree-empty';
        empty.textContent = 'No items';
        itemsEl.appendChild(empty);
      } else {
        for (const item of items) {
          const itemEl = this._createItemElement(item, cat.iconClass);
          itemsEl.appendChild(itemEl);
        }
      }

      catEl.appendChild(itemsEl);
      this.contentEl.appendChild(catEl);
    }
  }

  _createItemElement(item, iconClass) {
    const hasChildren = item.children && item.children.length > 0;
    const wrapper = document.createElement('div');

    // Declare childrenEl at function scope so the arrow click handler can reach it
    let childrenEl = null;

    const el = document.createElement('div');
    el.className = 'tree-item' + (item.id === this.selectedId ? ' selected' : '');
    el.dataset.itemId = item.id;

    // Expand arrow for composites
    if (hasChildren) {
      const expandArrow = document.createElement('span');
      expandArrow.className = 'tree-expand-arrow' + (this._expandedItems[item.id] ? '' : ' collapsed');
      expandArrow.textContent = '\u25BC';
      expandArrow.addEventListener('click', (e) => {
        e.stopPropagation();
        this._expandedItems[item.id] = !this._expandedItems[item.id];
        expandArrow.classList.toggle('collapsed');
        childrenEl.classList.toggle('collapsed');
      });
      el.appendChild(expandArrow);
    }

    const icon = document.createElement('div');
    icon.className = `icon ${iconClass}`;
    el.appendChild(icon);

    const label = document.createElement('span');
    label.className = 'label';
    label.textContent = item.name || item.type || item.id;
    el.appendChild(label);

    el.addEventListener('click', (e) => {
      e.stopPropagation();
      this.selectedId = item.id;
      this._updateSelection();
      this.onSelect?.(item);
    });

    el.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.selectedId = item.id;
      this._updateSelection();
      this.onSelect?.(item);
      this.onContextMenu?.(item, e.clientX, e.clientY);
    });

    wrapper.appendChild(el);

    // Children (composite parts)
    if (hasChildren) {
      childrenEl = document.createElement('div');
      childrenEl.className = 'tree-children' + (this._expandedItems[item.id] ? '' : ' collapsed');

      for (const child of item.children) {
        const childEl = this._createChildElement(child, iconClass);
        childrenEl.appendChild(childEl);
      }

      wrapper.appendChild(childrenEl);
    }

    return wrapper;
  }

  _createChildElement(child, iconClass) {
    const el = document.createElement('div');
    el.className = 'tree-item tree-child-item' + (child.id === this.selectedId ? ' selected' : '');
    el.dataset.itemId = child.id;

    // Color dot showing the part's current color
    if (child.color) {
      const colorDot = document.createElement('div');
      colorDot.className = 'tree-part-color';
      colorDot.style.background = child.color;
      el.appendChild(colorDot);
    }

    const label = document.createElement('span');
    label.className = 'label';
    label.textContent = child.name;
    el.appendChild(label);

    el.addEventListener('click', (e) => {
      e.stopPropagation();
      this.selectedId = child.id;
      this._updateSelection();
      this.onSelect?.(child);
    });

    return el;
  }

  _updateSelection() {
    const all = this.contentEl.querySelectorAll('.tree-item');
    all.forEach(el => {
      el.classList.toggle('selected', el.dataset.itemId === this.selectedId);
    });
  }
}

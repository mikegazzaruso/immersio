export class PropertiesPanel {
  constructor({ onChange }) {
    this.onChange = onChange;
    this.el = null;
    this.contentEl = null;
    this._currentObj = null;
  }

  build() {
    this.el = document.createElement('div');
    this.el.className = 'editor-panel panel-right';

    const header = document.createElement('div');
    header.className = 'panel-header';
    header.textContent = 'Properties';
    this.el.appendChild(header);

    this.contentEl = document.createElement('div');
    this.contentEl.className = 'panel-content';
    this.el.appendChild(this.contentEl);

    this._renderEmpty();
    return this.el;
  }

  /** Update properties for the given object. null = no selection. */
  update(obj) {
    this._currentObj = obj;
    if (!obj) {
      this._renderEmpty();
    } else {
      this._renderProperties(obj);
    }
  }

  _renderEmpty() {
    this.contentEl.innerHTML = '';
    const msg = document.createElement('div');
    msg.className = 'props-no-selection';
    msg.textContent = 'Select an object to view properties';
    this.contentEl.appendChild(msg);
  }

  _renderProperties(obj) {
    this.contentEl.innerHTML = '';

    // Info section
    this._addSection('Info', [
      { label: 'Name', value: obj.name || obj.id || '(unnamed)', type: 'text', prop: 'name' },
      { label: 'Type', value: obj.type || 'object', type: 'readonly' },
    ]);

    // Transform section (Position, Rotation, Scale)
    const transformFields = [];
    if (obj.position) {
      transformFields.push({ label: 'Position', value: obj.position, type: 'xyz', prop: 'position', step: 0.1 });
    }
    if (obj.rotation) {
      transformFields.push({ label: 'Rotation', value: obj.rotation, type: 'xyz', prop: 'rotation', step: 0.01 });
    }
    if (obj.scale) {
      transformFields.push({ label: 'Scale', value: obj.scale, type: 'xyz', prop: 'scale', step: 0.01 });
    }
    if (transformFields.length > 0) {
      this._addSection('Transform', transformFields);
    }

    // Type-specific properties
    const extra = this._getTypeSpecificProps(obj);
    if (extra.length > 0) {
      this._addSection('Details', extra);
    }
  }

  _addSection(title, fields) {
    const section = document.createElement('div');
    section.className = 'props-section';

    const header = document.createElement('div');
    header.className = 'props-section-header';
    header.textContent = title;
    section.appendChild(header);

    for (const field of fields) {
      const row = document.createElement('div');
      row.className = 'props-row';

      const label = document.createElement('span');
      label.className = 'props-label';
      label.textContent = field.label;
      row.appendChild(label);

      const valueEl = document.createElement('div');
      valueEl.className = 'props-value';

      if (field.type === 'xyz') {
        valueEl.appendChild(this._createXYZ(field));
      } else if (field.type === 'color') {
        valueEl.appendChild(this._createColorInput(field));
      } else if (field.type === 'number') {
        valueEl.appendChild(this._createNumberInput(field));
      } else if (field.type === 'readonly') {
        const span = document.createElement('span');
        span.style.cssText = 'font-size: 12px; color: var(--text-muted); padding: 0 6px;';
        span.textContent = field.value;
        valueEl.appendChild(span);
      } else {
        valueEl.appendChild(this._createTextInput(field));
      }

      row.appendChild(valueEl);
      section.appendChild(row);
    }

    this.contentEl.appendChild(section);
  }

  _createXYZ(field) {
    const container = document.createElement('div');
    container.className = 'props-xyz';

    const axes = ['x', 'y', 'z'];
    axes.forEach((axis, i) => {
      const wrapper = document.createElement('div');
      wrapper.className = 'axis-field';

      const axisLabel = document.createElement('span');
      axisLabel.className = `axis-label ${axis}`;
      axisLabel.textContent = axis.toUpperCase();
      wrapper.appendChild(axisLabel);

      const input = document.createElement('input');
      input.type = 'number';
      input.className = 'props-input';
      input.value = this._formatNum(field.value[i]);
      input.step = field.step || 0.01;
      input.addEventListener('change', () => {
        const newVal = [...field.value];
        newVal[i] = parseFloat(input.value) || 0;
        this.onChange?.(field.prop, newVal);
      });
      // Drag-to-scrub
      this._addScrub(input, field, i);
      wrapper.appendChild(input);
      container.appendChild(wrapper);
    });

    return container;
  }

  _createNumberInput(field) {
    const input = document.createElement('input');
    input.type = 'number';
    input.className = 'props-input';
    input.value = this._formatNum(field.value);
    input.step = field.step || 0.01;
    if (field.min !== undefined) input.min = field.min;
    if (field.max !== undefined) input.max = field.max;
    input.addEventListener('change', () => {
      this.onChange?.(field.prop, parseFloat(input.value) || 0);
    });
    return input;
  }

  _createTextInput(field) {
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'props-input';
    input.value = field.value;
    input.addEventListener('change', () => {
      this.onChange?.(field.prop, input.value);
    });
    return input;
  }

  _createColorInput(field) {
    const container = document.createElement('div');
    container.style.cssText = 'display: flex; gap: 4px; flex: 1; align-items: center;';

    const swatch = document.createElement('input');
    swatch.type = 'color';
    swatch.className = 'props-color-swatch';
    swatch.value = field.value;
    swatch.addEventListener('input', () => {
      textInput.value = swatch.value;
      this.onChange?.(field.prop, swatch.value);
    });

    const textInput = document.createElement('input');
    textInput.type = 'text';
    textInput.className = 'props-input';
    textInput.value = field.value;
    textInput.addEventListener('change', () => {
      swatch.value = textInput.value;
      this.onChange?.(field.prop, textInput.value);
    });

    container.appendChild(swatch);
    container.appendChild(textInput);
    return container;
  }

  /** Add drag-to-scrub behavior on number input */
  _addScrub(input, field, index) {
    let startX, startVal;

    input.addEventListener('mousedown', (e) => {
      if (document.activeElement === input) return; // already editing
      e.preventDefault();
      startX = e.clientX;
      startVal = parseFloat(input.value) || 0;

      const onMove = (e2) => {
        const delta = (e2.clientX - startX) * (field.step || 0.01);
        const newVal = startVal + delta;
        input.value = this._formatNum(newVal);
        const arr = [...(field.value || [0, 0, 0])];
        arr[index] = newVal;
        this.onChange?.(field.prop, arr);
      };

      const onUp = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        document.body.style.cursor = '';
      };

      document.body.style.cursor = 'ew-resize';
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });
  }

  _getTypeSpecificProps(obj) {
    const props = [];
    const data = obj.data || {};

    // Composite part — show color picker for this part
    if (obj.parentId !== undefined && obj.partIndex !== undefined) {
      if (obj.color) {
        props.push({
          label: 'Color',
          value: obj.color,
          type: 'color',
          prop: `partColor:${obj.parentId}:${obj.partIndex}`,
        });
      }
      return props;
    }

    if (obj.category === 'decorations') {
      if (data.count !== undefined) {
        props.push({ label: 'Count', value: data.count, type: 'number', prop: 'data.count', min: 1, step: 1 });
      }
      if (data.color) {
        props.push({ label: 'Color', value: data.color, type: 'color', prop: 'data.color' });
      }
      if (data.radius) {
        props.push({ label: 'Radius', value: data.radius, type: 'text', prop: 'data.radius' });
      }
      if (data.height) {
        props.push({ label: 'Height', value: data.height, type: 'text', prop: 'data.height' });
      }
      if (data.glowColor) {
        props.push({ label: 'Glow', value: data.glowColor, type: 'color', prop: 'data.glowColor' });
      }
    }

    if (obj.category === 'props') {
      if (data.model) {
        props.push({ label: 'Model', value: data.model, type: 'readonly' });
      }
      if (data.rotationY !== undefined) {
        props.push({ label: 'Rot Y', value: data.rotationY, type: 'number', prop: 'data.rotationY', step: 0.1 });
      }
    }

    if (obj.category === 'exits') {
      if (data.targetLevel !== undefined) {
        props.push({ label: 'Target', value: data.targetLevel, type: 'number', prop: 'data.targetLevel', min: 1, step: 1 });
      }
      if (data.label) {
        props.push({ label: 'Label', value: data.label, type: 'text', prop: 'data.label' });
      }
      if (data.color) {
        props.push({ label: 'Color', value: data.color, type: 'color', prop: 'data.color' });
      }
    }

    return props;
  }

  _formatNum(n) {
    return parseFloat(parseFloat(n).toFixed(3)).toString();
  }
}

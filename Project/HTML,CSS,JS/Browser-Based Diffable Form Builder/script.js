(function() {
    'use strict';

    // ----- DOM refs -----
    const fieldsContainer = document.getElementById('fieldsContainer');
    const fieldTypes = document.getElementById('fieldTypes');
    const editorContent = document.getElementById('editorContent');
    const editorFieldId = document.getElementById('editorFieldId');
    const previewContainer = document.getElementById('previewContainer');
    const addFieldBtn = document.getElementById('addFieldBtn');
    const clearFormBtn = document.getElementById('clearFormBtn');
    const exportHtmlBtn = document.getElementById('exportHtmlBtn');
    const exportJsonBtn = document.getElementById('exportJsonBtn');
    const themeToggle = document.getElementById('themeToggle');
    const themeIcon = document.getElementById('themeIcon');
    const themeLabel = document.getElementById('themeLabel');

    // ----- State -----
    let fields = [];
    let selectedFieldId = null;
    let idCounter = 0;
    let dragData = null;

    // ----- Field types config -----
    const FIELD_TYPES = {
        text: { icon: '📝', label: 'Text Input', defaultLabel: 'Text Field' },
        email: { icon: '✉️', label: 'Email', defaultLabel: 'Email Address' },
        number: { icon: '🔢', label: 'Number', defaultLabel: 'Number' },
        textarea: { icon: '📄', label: 'Textarea', defaultLabel: 'Long Text' },
        select: { icon: '📋', label: 'Select', defaultLabel: 'Select Option' },
        checkbox: { icon: '☑️', label: 'Checkbox', defaultLabel: 'Checkbox' },
        radio: { icon: '🔘', label: 'Radio', defaultLabel: 'Radio Group' },
        date: { icon: '📅', label: 'Date', defaultLabel: 'Date' }
    };

    // ----- Theme -----
    function setTheme(dark) {
        document.body.classList.toggle('dark', dark);
        themeIcon.textContent = dark ? '☀️' : '🌙';
        themeLabel.textContent = dark ? 'Light' : 'Dark';
    }

    themeToggle.addEventListener('click', () => {
        const isDark = document.body.classList.contains('dark');
        setTheme(!isDark);
    });

    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        setTheme(true);
    }

    // ----- Field factory -----
    function createField(type, label) {
        const config = FIELD_TYPES[type];
        const field = {
            id: 'field_' + (++idCounter),
            type: type,
            label: label || config.defaultLabel,
            name: 'field_' + idCounter,
            required: false,
            placeholder: '',
            helpText: '',
            defaultValue: '',
            options: [],
            validation: {
                min: '',
                max: '',
                pattern: '',
                minLength: '',
                maxLength: ''
            },
            conditional: {
                enabled: false,
                fieldId: '',
                operator: 'equals',
                value: ''
            }
        };

        // Add default options for select/radio/checkbox
        if (type === 'select' || type === 'radio') {
            field.options = ['Option 1', 'Option 2', 'Option 3'];
        }
        if (type === 'checkbox') {
            field.options = ['Checkbox Option'];
        }

        return field;
    }

    // ----- Add field -----
    function addField(type) {
        const field = createField(type);
        fields.push(field);
        selectedFieldId = field.id;
        render();
    }

    // ----- Delete field -----
    function deleteField(id) {
        if (!confirm('Delete this field?')) return;
        fields = fields.filter(f => f.id !== id);
        if (selectedFieldId === id) {
            selectedFieldId = fields.length > 0 ? fields[0].id : null;
        }
        render();
    }

    // ----- Duplicate field -----
    function duplicateField(id) {
        const field = fields.find(f => f.id === id);
        if (!field) return;
        const newField = JSON.parse(JSON.stringify(field));
        newField.id = 'field_' + (++idCounter);
        newField.name = 'field_' + idCounter;
        newField.label = field.label + ' (copy)';
        fields.push(newField);
        selectedFieldId = newField.id;
        render();
    }

    // ----- Move field -----
    function moveField(id, direction) {
        const index = fields.findIndex(f => f.id === id);
        if (index === -1) return;
        const newIndex = index + direction;
        if (newIndex < 0 || newIndex >= fields.length) return;
        [fields[index], fields[newIndex]] = [fields[newIndex], fields[index]];
        render();
    }

    // ----- Update field -----
    function updateField(id, updates) {
        const field = fields.find(f => f.id === id);
        if (!field) return;
        Object.assign(field, updates);
        render();
    }

    // ----- Clear form -----
    function clearForm() {
        if (!confirm('Clear all fields?')) return;
        fields = [];
        selectedFieldId = null;
        render();
    }

    // ----- Render -----
    function render() {
        renderFieldsList();
        renderEditor();
        renderPreview();
        updateFieldIdDisplay();
    }

    // ----- Render fields list -----
    function renderFieldsList() {
        if (fields.length === 0) {
            fieldsContainer.innerHTML = '<div class="empty-state">Drop fields here or click "Add Field"</div>';
            return;
        }

        let html = '';
        fields.forEach((field, index) => {
            const config = FIELD_TYPES[field.type];
            const isSelected = field.id === selectedFieldId;
            html += `
                <div class="field-item ${isSelected ? 'selected' : ''}" data-id="${field.id}">
                    <div class="field-info">
                        <span class="field-icon">${config.icon}</span>
                        <span class="field-label">${field.label}</span>
                        <span class="field-type-badge">${config.label}</span>
                        ${field.required ? '<span style="color:#ef4444;font-size:0.7rem;">*</span>' : ''}
                    </div>
                    <div class="field-actions">
                        <button class="btn-duplicate-field" data-action="duplicate" data-id="${field.id}">📋</button>
                        <button class="btn-delete-field" data-action="delete" data-id="${field.id}">🗑️</button>
                    </div>
                </div>
            `;
        });

        fieldsContainer.innerHTML = html;

        // Event listeners for field items
        fieldsContainer.querySelectorAll('.field-item').forEach(el => {
            el.addEventListener('click', (e) => {
                if (e.target.closest('.field-actions')) return;
                const id = el.dataset.id;
                selectedFieldId = id;
                render();
            });
        });

        // Action buttons
        fieldsContainer.querySelectorAll('[data-action="delete"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                deleteField(btn.dataset.id);
            });
        });

        fieldsContainer.querySelectorAll('[data-action="duplicate"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                duplicateField(btn.dataset.id);
            });
        });

        // Drag and drop
        fieldsContainer.addEventListener('dragover', (e) => {
            e.preventDefault();
            fieldsContainer.classList.add('drag-over');
        });

        fieldsContainer.addEventListener('dragleave', () => {
            fieldsContainer.classList.remove('drag-over');
        });

        fieldsContainer.addEventListener('drop', (e) => {
            e.preventDefault();
            fieldsContainer.classList.remove('drag-over');
            const type = e.dataTransfer.getData('field-type');
            if (type && FIELD_TYPES[type]) {
                addField(type);
            }
        });
    }

    // ----- Render editor -----
    function renderEditor() {
        const field = fields.find(f => f.id === selectedFieldId);
        if (!field) {
            editorContent.innerHTML = '<div class="empty-state">Select a field to edit its properties</div>';
            return;
        }

        const config = FIELD_TYPES[field.type];
        const optionsHtml = field.options ? field.options.map((opt, i) => `
            <div style="display:flex;gap:0.3rem;margin-bottom:0.2rem;">
                <input type="text" value="${opt}" data-option-index="${i}" class="option-input" />
                <button class="btn-remove-option" data-index="${i}" style="padding:0.1rem 0.4rem;border:none;border-radius:4px;background:#fee2e2;color:#991b1b;cursor:pointer;font-size:0.7rem;">✕</button>
            </div>
        `).join('') : '';

        const showOptions = field.type === 'select' || field.type === 'radio' || field.type === 'checkbox';
        const showTextArea = field.type === 'textarea';

        let html = `
            <div class="editor-group">
                <label>Field Label</label>
                <input type="text" value="${field.label}" id="editLabel" />
            </div>
            <div class="editor-group">
                <label>Field Name</label>
                <input type="text" value="${field.name}" id="editName" />
            </div>
            <div class="editor-group">
                <label>Placeholder</label>
                <input type="text" value="${field.placeholder || ''}" id="editPlaceholder" />
            </div>
            <div class="editor-group">
                <label>Help Text</label>
                <input type="text" value="${field.helpText || ''}" id="editHelpText" />
            </div>
            <div class="editor-group">
                <label>Default Value</label>
                <input type="text" value="${field.defaultValue || ''}" id="editDefaultValue" />
            </div>
            <div class="editor-group">
                <div class="checkbox-group">
                    <input type="checkbox" ${field.required ? 'checked' : ''} id="editRequired" />
                    <label for="editRequired">Required field</label>
                </div>
            </div>
        `;

        if (showOptions) {
            html += `
                <div class="editor-group">
                    <label>Options</label>
                    <div id="optionsContainer">
                        ${optionsHtml}
                    </div>
                    <button class="btn-add-option" style="padding:0.2rem 0.6rem;border:1px dashed #d1d9e6;border-radius:4px;background:transparent;cursor:pointer;font-size:0.7rem;color:inherit;">➕ Add Option</button>
                </div>
            `;
        }

        if (field.type === 'text' || field.type === 'email' || field.type === 'number' || field.type === 'textarea') {
            html += `
                <div class="editor-group">
                    <label>Validation</label>
                    ${field.type === 'text' || field.type === 'email' || field.type === 'textarea' ? `
                        <div style="display:flex;gap:0.4rem;margin-bottom:0.2rem;">
                            <input type="number" placeholder="Min length" value="${field.validation.minLength || ''}" id="editMinLength" style="flex:1;" />
                            <input type="number" placeholder="Max length" value="${field.validation.maxLength || ''}" id="editMaxLength" style="flex:1;" />
                        </div>
                    ` : ''}
                    ${field.type === 'number' ? `
                        <div style="display:flex;gap:0.4rem;margin-bottom:0.2rem;">
                            <input type="number" placeholder="Min" value="${field.validation.min || ''}" id="editMin" style="flex:1;" />
                            <input type="number" placeholder="Max" value="${field.validation.max || ''}" id="editMax" style="flex:1;" />
                        </div>
                    ` : ''}
                    ${field.type === 'text' || field.type === 'email' ? `
                        <input type="text" placeholder="Pattern (regex)" value="${field.validation.pattern || ''}" id="editPattern" style="width:100%;" />
                    ` : ''}
                </div>
            `;
        }

        // Conditional logic
        const fieldOptions = fields.filter(f => f.id !== field.id).map(f => 
            `<option value="${f.id}" ${field.conditional.fieldId === f.id ? 'selected' : ''}>${f.label}</option>`
        ).join('');

        html += `
            <div class="editor-group">
                <label>Conditional Logic</label>
                <div class="checkbox-group">
                    <input type="checkbox" ${field.conditional.enabled ? 'checked' : ''} id="editConditionalEnabled" />
                    <label for="editConditionalEnabled">Enable conditional visibility</label>
                </div>
                ${field.conditional.enabled ? `
                    <div class="conditional-group">
                        <div class="cond-row">
                            <select id="editConditionalField">
                                <option value="">Select field...</option>
                                ${fieldOptions}
                            </select>
                            <select id="editConditionalOperator">
                                <option value="equals" ${field.conditional.operator === 'equals' ? 'selected' : ''}>Equals</option>
                                <option value="not-equals" ${field.conditional.operator === 'not-equals' ? 'selected' : ''}>Not equals</option>
                                <option value="contains" ${field.conditional.operator === 'contains' ? 'selected' : ''}>Contains</option>
                                <option value="not-contains" ${field.conditional.operator === 'not-contains' ? 'selected' : ''}>Not contains</option>
                                <option value="empty" ${field.conditional.operator === 'empty' ? 'selected' : ''}>Is empty</option>
                                <option value="not-empty" ${field.conditional.operator === 'not-empty' ? 'selected' : ''}>Is not empty</option>
                            </select>
                        </div>
                        ${field.conditional.operator !== 'empty' && field.conditional.operator !== 'not-empty' ? `
                            <div class="cond-row">
                                <input type="text" placeholder="Value" value="${field.conditional.value || ''}" id="editConditionalValue" />
                            </div>
                        ` : ''}
                    </div>
                ` : ''}
            </div>
        `;

        editorContent.innerHTML = html;

        // Editor event listeners
        document.getElementById('editLabel')?.addEventListener('input', (e) => {
            updateField(field.id, { label: e.target.value });
        });

        document.getElementById('editName')?.addEventListener('input', (e) => {
            updateField(field.id, { name: e.target.value });
        });

        document.getElementById('editPlaceholder')?.addEventListener('input', (e) => {
            updateField(field.id, { placeholder: e.target.value });
        });

        document.getElementById('editHelpText')?.addEventListener('input', (e) => {
            updateField(field.id, { helpText: e.target.value });
        });

        document.getElementById('editDefaultValue')?.addEventListener('input', (e) => {
            updateField(field.id, { defaultValue: e.target.value });
        });

        document.getElementById('editRequired')?.addEventListener('change', (e) => {
            updateField(field.id, { required: e.target.checked });
        });

        // Options
        document.querySelectorAll('.option-input').forEach(input => {
            input.addEventListener('input', (e) => {
                const index = parseInt(e.target.dataset.optionIndex);
                const options = [...field.options];
                options[index] = e.target.value;
                updateField(field.id, { options });
            });
        });

        document.querySelectorAll('.btn-remove-option').forEach(btn => {
            btn.addEventListener('click', () => {
                const index = parseInt(btn.dataset.index);
                const options = field.options.filter((_, i) => i !== index);
                updateField(field.id, { options });
            });
        });

        document.querySelector('.btn-add-option')?.addEventListener('click', () => {
            const options = [...field.options, 'New Option'];
            updateField(field.id, { options });
        });

        // Validation
        document.getElementById('editMinLength')?.addEventListener('input', (e) => {
            const validation = { ...field.validation, minLength: e.target.value };
            updateField(field.id, { validation });
        });

        document.getElementById('editMaxLength')?.addEventListener('input', (e) => {
            const validation = { ...field.validation, maxLength: e.target.value };
            updateField(field.id, { validation });
        });

        document.getElementById('editMin')?.addEventListener('input', (e) => {
            const validation = { ...field.validation, min: e.target.value };
            updateField(field.id, { validation });
        });

        document.getElementById('editMax')?.addEventListener('input', (e) => {
            const validation = { ...field.validation, max: e.target.value };
            updateField(field.id, { validation });
        });

        document.getElementById('editPattern')?.addEventListener('input', (e) => {
            const validation = { ...field.validation, pattern: e.target.value };
            updateField(field.id, { validation });
        });

        // Conditional
        document.getElementById('editConditionalEnabled')?.addEventListener('change', (e) => {
            const conditional = { ...field.conditional, enabled: e.target.checked };
            updateField(field.id, { conditional });
        });

        document.getElementById('editConditionalField')?.addEventListener('change', (e) => {
            const conditional = { ...field.conditional, fieldId: e.target.value };
            updateField(field.id, { conditional });
        });

        document.getElementById('editConditionalOperator')?.addEventListener('change', (e) => {
            const conditional = { ...field.conditional, operator: e.target.value };
            updateField(field.id, { conditional });
        });

        document.getElementById('editConditionalValue')?.addEventListener('input', (e) => {
            const conditional = { ...field.conditional, value: e.target.value };
            updateField(field.id, { conditional });
        });
    }

    // ----- Render preview -----
    function renderPreview() {
        if (fields.length === 0) {
            previewContainer.innerHTML = '<div class="empty-state">Build your form to see the live preview</div>';
            return;
        }

        let html = '';
        fields.forEach(field => {
            const config = FIELD_TYPES[field.type];
            const isVisible = checkConditional(field);
            const hiddenClass = isVisible ? '' : 'hidden';

            html += `<div class="preview-field ${hiddenClass}" data-field-id="${field.id}">`;
            html += `<label>${field.label}${field.required ? ' <span class="required-star">*</span>' : ''}</label>`;

            switch (field.type) {
                case 'textarea':
                    html += `<textarea placeholder="${field.placeholder || ''}" ${field.required ? 'required' : ''}></textarea>`;
                    break;
                case 'select':
                    html += `<select ${field.required ? 'required' : ''}>
                        <option value="">Select...</option>
                        ${field.options.map(opt => `<option value="${opt}">${opt}</option>`).join('')}
                    </select>`;
                    break;
                case 'checkbox':
                    field.options.forEach(opt => {
                        html += `<div class="checkbox-option">
                            <input type="checkbox" value="${opt}" />
                            <label>${opt}</label>
                        </div>`;
                    });
                    break;
                case 'radio':
                    field.options.forEach(opt => {
                        html += `<div class="radio-option">
                            <input type="radio" name="${field.name}" value="${opt}" />
                            <label>${opt}</label>
                        </div>`;
                    });
                    break;
                case 'date':
                    html += `<input type="date" ${field.required ? 'required' : ''} />`;
                    break;
                case 'number':
                    html += `<input type="number" placeholder="${field.placeholder || ''}" 
                        ${field.validation.min ? `min="${field.validation.min}"` : ''}
                        ${field.validation.max ? `max="${field.validation.max}"` : ''}
                        ${field.required ? 'required' : ''} />`;
                    break;
                case 'email':
                    html += `<input type="email" placeholder="${field.placeholder || ''}" 
                        ${field.required ? 'required' : ''} 
                        ${field.validation.pattern ? `pattern="${field.validation.pattern}"` : ''} />`;
                    break;
                default: // text
                    html += `<input type="text" placeholder="${field.placeholder || ''}" 
                        ${field.required ? 'required' : ''}
                        ${field.validation.minLength ? `minlength="${field.validation.minLength}"` : ''}
                        ${field.validation.maxLength ? `maxlength="${field.validation.maxLength}"` : ''}
                        ${field.validation.pattern ? `pattern="${field.validation.pattern}"` : ''} />`;
            }

            if (field.helpText) {
                html += `<div style="font-size:0.7rem;opacity:0.6;margin-top:0.2rem;">${field.helpText}</div>`;
            }

            html += `</div>`;
        });

        previewContainer.innerHTML = html;
    }

    // ----- Check conditional -----
    function checkConditional(field) {
        if (!field.conditional.enabled || !field.conditional.fieldId) return true;
        
        const targetField = fields.find(f => f.id === field.conditional.fieldId);
        if (!targetField) return true;

        const value = targetField.defaultValue || '';
        const cond = field.conditional;

        switch (cond.operator) {
            case 'equals': return value === cond.value;
            case 'not-equals': return value !== cond.value;
            case 'contains': return value.includes(cond.value);
            case 'not-contains': return !value.includes(cond.value);
            case 'empty': return value === '';
            case 'not-empty': return value !== '';
            default: return true;
        }
    }

    // ----- Update field ID display -----
    function updateFieldIdDisplay() {
        const field = fields.find(f => f.id === selectedFieldId);
        editorFieldId.textContent = field ? `ID: ${field.id}` : 'No field selected';
    }

    // ----- Export HTML -----
    function exportHTML() {
        if (fields.length === 0) {
            alert('Add some fields first!');
            return;
        }

        let formHtml = `<form id="exported-form" style="max-width:600px;margin:0 auto;padding:20px;font-family:system-ui;">\n`;
        fields.forEach(field => {
            const config = FIELD_TYPES[field.type];
            formHtml += `  <div style="margin-bottom:16px;">\n`;
            formHtml += `    <label style="display:block;font-weight:500;margin-bottom:4px;">${field.label}${field.required ? ' <span style="color:#ef4444;">*</span>' : ''}</label>\n`;

            switch (field.type) {
                case 'textarea':
                    formHtml += `    <textarea placeholder="${field.placeholder || ''}" ${field.required ? 'required' : ''} style="width:100%;padding:8px;border:1px solid #d1d9e6;border-radius:6px;font-family:inherit;"></textarea>\n`;
                    break;
                case 'select':
                    formHtml += `    <select ${field.required ? 'required' : ''} style="width:100%;padding:8px;border:1px solid #d1d9e6;border-radius:6px;font-family:inherit;">\n`;
                    formHtml += `      <option value="">Select...</option>\n`;
                    field.options.forEach(opt => {
                        formHtml += `      <option value="${opt}">${opt}</option>\n`;
                    });
                    formHtml += `    </select>\n`;
                    break;
                case 'checkbox':
                    field.options.forEach(opt => {
                        formHtml += `    <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">\n`;
                        formHtml += `      <input type="checkbox" value="${opt}" />\n`;
                        formHtml += `      <label>${opt}</label>\n`;
                        formHtml += `    </div>\n`;
                    });
                    break;
                case 'radio':
                    field.options.forEach(opt => {
                        formHtml += `    <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">\n`;
                        formHtml += `      <input type="radio" name="${field.name}" value="${opt}" />\n`;
                        formHtml += `      <label>${opt}</label>\n`;
                        formHtml += `    </div>\n`;
                    });
                    break;
                case 'date':
                    formHtml += `    <input type="date" ${field.required ? 'required' : ''} style="width:100%;padding:8px;border:1px solid #d1d9e6;border-radius:6px;font-family:inherit;" />\n`;
                    break;
                case 'number':
                    formHtml += `    <input type="number" placeholder="${field.placeholder || ''}" ${field.required ? 'required' : ''} ${field.validation.min ? `min="${field.validation.min}"` : ''} ${field.validation.max ? `max="${field.validation.max}"` : ''} style="width:100%;padding:8px;border:1px solid #d1d9e6;border-radius:6px;font-family:inherit;" />\n`;
                    break;
                case 'email':
                    formHtml += `    <input type="email" placeholder="${field.placeholder || ''}" ${field.required ? 'required' : ''} ${field.validation.pattern ? `pattern="${field.validation.pattern}"` : ''} style="width:100%;padding:8px;border:1px solid #d1d9e6;border-radius:6px;font-family:inherit;" />\n`;
                    break;
                default:
                    formHtml += `    <input type="text" placeholder="${field.placeholder || ''}" ${field.required ? 'required' : ''} ${field.validation.minLength ? `minlength="${field.validation.minLength}"` : ''} ${field.validation.maxLength ? `maxlength="${field.validation.maxLength}"` : ''} ${field.validation.pattern ? `pattern="${field.validation.pattern}"` : ''} style="width:100%;padding:8px;border:1px solid #d1d9e6;border-radius:6px;font-family:inherit;" />\n`;
            }

            if (field.helpText) {
                formHtml += `    <div style="font-size:12px;opacity:0.6;margin-top:4px;">${field.helpText}</div>\n`;
            }

            formHtml += `  </div>\n`;
        });

        formHtml += `  <button type="submit" style="padding:10px 24px;background:#3b82f6;color:white;border:none;border-radius:6px;font-size:16px;cursor:pointer;">Submit</button>\n`;
        formHtml += `</form>`;

        // Create download
        const blob = new Blob([formHtml], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'form.html';
        a.click();
        URL.revokeObjectURL(url);
    }

    // ----- Export JSON -----
    function exportJSON() {
        if (fields.length === 0) {
            alert('Add some fields first!');
            return;
        }

        const schema = {
            version: '1.0',
            fields: fields.map(f => ({
                id: f.id,
                type: f.type,
                label: f.label,
                name: f.name,
                required: f.required,
                placeholder: f.placeholder,
                helpText: f.helpText,
                defaultValue: f.defaultValue,
                options: f.options || [],
                validation: f.validation,
                conditional: f.conditional
            }))
        };

        const json = JSON.stringify(schema, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'form-schema.json';
        a.click();
        URL.revokeObjectURL(url);
    }

    // ----- Drag from field types -----
    fieldTypes.addEventListener('dragstart', (e) => {
        const btn = e.target.closest('.field-type-btn');
        if (!btn) return;
        e.dataTransfer.setData('field-type', btn.dataset.type);
        e.dataTransfer.effectAllowed = 'copy';
    });

    fieldTypes.querySelectorAll('.field-type-btn').forEach(btn => {
        btn.draggable = true;
    });

    // ----- Add field from button -----
    addFieldBtn.addEventListener('click', () => {
        // Show a quick picker
        const types = Object.keys(FIELD_TYPES);
        const choice = prompt('Enter field type: ' + types.join(', '));
        if (choice && FIELD_TYPES[choice]) {
            addField(choice);
        } else if (choice) {
            alert('Invalid type. Choose from: ' + types.join(', '));
        }
    });

    // ----- Clear form -----
    clearFormBtn.addEventListener('click', clearForm);

    // ----- Export buttons -----
    exportHtmlBtn.addEventListener('click', exportHTML);
    exportJsonBtn.addEventListener('click', exportJSON);

    // ----- Keyboard shortcuts -----
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Delete' && selectedFieldId) {
            deleteField(selectedFieldId);
        }
        if (e.key === 'Escape') {
            selectedFieldId = null;
            render();
        }
    });

    // ----- Expose for debugging -----
    window.__FormBuilder = {
        fields,
        addField,
        deleteField,
        duplicateField,
        clearForm,
        exportHTML,
        exportJSON
    };

    // ----- Initial render -----
    // Add some default fields
    addField('text');
    addField('email');
    addField('textarea');

    console.log('📝 Form Builder initialized!');
    console.log('💡 Drag field types, edit properties, preview live!');
})();
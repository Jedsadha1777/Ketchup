export class InspectorPanel {
    constructor(editor) {
        this.editor = editor;
        this.contentElement = document.getElementById('inspector-content');
    }

    update() {
        if (!this.contentElement) return;

        const selectedIndex = this.editor.objects.getSelected();
        if (selectedIndex === -1) {
            this.contentElement.innerHTML = '<div class="inspector-empty">No object selected</div>';
            return;
        }

        const selectedIndices = this.editor.objects.getSelectedIndices();
        if (selectedIndices.length > 1) {
            this.contentElement.innerHTML = `<div class="inspector-empty">Multiple objects selected (${selectedIndices.length})</div>`;
            return;
        }

        const obj = {
            index: selectedIndex,
            id: this.editor.objects.getIdByIndex(selectedIndex),
            type: this.editor.objects.types[selectedIndex],
            mapType: this.editor.objects.mapTypes[selectedIndex],
            x: this.editor.objects.x[selectedIndex],
            y: this.editor.objects.y[selectedIndex],
            width: this.editor.objects.width[selectedIndex],
            height: this.editor.objects.height[selectedIndex],
            color: this.editor.objects.colors[selectedIndex],
            label: this.editor.objects.labels[selectedIndex],
            extra: this.editor.objects.extra[selectedIndex]
        };

        obj.objectId = this.editor.objects.getObjectId(selectedIndex);
        this.contentElement.innerHTML = this.generateHTML(obj);
        this.bindEvents(obj);
    }

    generateHTML(obj) {
        let html = `
            <div class="inspector-field">
                <div class="inspector-label">Type</div>
                <input type="text" class="inspector-input" value="${obj.type}" readonly>
            </div>
        `;

        if (obj.mapType) {
            html += `
                <div class="inspector-field">
                    <div class="inspector-label">Map Type</div>
                    <input type="text" class="inspector-input" value="${obj.mapType}" readonly>
                </div>
            `;
        }

        html += `
           <div class="inspector-field">
                <div class="inspector-label">Object ID</div>
                <input type="text" class="inspector-input" id="inspector-objectId" value="${obj.objectId || ''}" placeholder="e.g. player, door1">            </div>
        `;

         // Add Z-Order information
        const orderOps = this.editor.objectOrderOps;
        if (orderOps) {
            const zOrder = orderOps.getObjectZOrder(obj.index);
            html += `
                <div class="inspector-field">
                    <div class="inspector-label">Z-Order</div>
                    <div style="display: flex; align-items: center; gap: 4px;">
                        <input type="text" class="inspector-input" value="${zOrder.current} of ${zOrder.total}" readonly style="flex: 1;">
                        <button type="button" id="move-up" style="padding: 2px 6px; font-size: 10px; ${zOrder.canMoveUp ? '' : 'opacity: 0.5; pointer-events: none;'}">↑</button>
                        <button type="button" id="move-down" style="padding: 2px 6px; font-size: 10px; ${zOrder.canMoveDown ? '' : 'opacity: 0.5; pointer-events: none;'}">↓</button>
                    </div>
                </div>
            `;
        }

        html += `
            <div class="inspector-field">
                <div class="inspector-label">Position X</div>
                <input type="number" class="inspector-input" id="inspector-x" value="${obj.x.toFixed(1)}">
            </div>
            <div class="inspector-field">
                <div class="inspector-label">Position Y</div>
                <input type="number" class="inspector-input" id="inspector-y" value="${obj.y.toFixed(1)}">
            </div>
        `;

        if (this.editor.objects.canResize(obj.index)) {
            html += `
                <div class="inspector-field">
                    <div class="inspector-label">Width</div>
                    <input type="number" class="inspector-input" id="inspector-width" value="${obj.width.toFixed(1)}">
                </div>
                <div class="inspector-field">
                    <div class="inspector-label">Height</div>
                    <input type="number" class="inspector-input" id="inspector-height" value="${obj.height.toFixed(1)}">
                </div>
            `;
        }

        // Get available properties from renderer
        const renderer = this.editor.renderers.getRenderer(obj);
        const availableProperties = renderer?.getAvailableProperties?.(obj) || ['color', 'label', 'walkable'];

        // Generate property fields
        for (const property of availableProperties) {
            html += this.generatePropertyField(property, obj);
        }

        return html;
    }

    generatePropertyField(property, obj) {
        switch (property) {
            case 'color':
                return `<div class="inspector-field"><div class="inspector-label">Color</div><input type="color" class="inspector-input" id="inspector-color" value="${obj.color}"></div>`;

            case 'label':
                return `<div class="inspector-field"><div class="inspector-label">Label</div><input type="text" class="inspector-input" id="inspector-label" value="${obj.label || ''}" placeholder="Enter label..."></div>`;

            case 'text':
                return `<div class="inspector-field">
                    <div class="inspector-label">Text Content</div>
                    <textarea class="inspector-input" id="inspector-text" rows="3" placeholder="Enter text content...">${obj.extra?.text || ''}</textarea>
                    <button type="button" class="inspector-input" id="auto-fit-text" style="background: #0066cc; color: white; border: none; padding: 4px 8px; border-radius: 3px; font-size: 11px; margin-top: 4px;">Auto Fit Size</button>
                </div>`;

            case 'opacity':
                return `<div class="inspector-field"><div class="inspector-label">Opacity</div><input type="range" class="inspector-input" id="inspector-opacity" min="0" max="1" step="0.1" value="${obj.extra?.opacity || 1}"></div>`;

            case 'fontSize':
                return `<div class="inspector-field"><div class="inspector-label">Font Size</div><input type="number" class="inspector-input" id="inspector-fontSize" min="8" max="72" value="${obj.extra?.fontSize || 16}"></div>`;

            case 'fontFamily':
                return `<div class="inspector-field"><div class="inspector-label">Font Family</div><select class="inspector-input" id="inspector-fontFamily">
                    <option value="Arial" ${(obj.extra?.fontFamily || 'Arial') === 'Arial' ? 'selected' : ''}>Arial</option>
                    <option value="Times New Roman" ${obj.extra?.fontFamily === 'Times New Roman' ? 'selected' : ''}>Times New Roman</option>
                    <option value="Courier New" ${obj.extra?.fontFamily === 'Courier New' ? 'selected' : ''}>Courier New</option>
                    <option value="Helvetica" ${obj.extra?.fontFamily === 'Helvetica' ? 'selected' : ''}>Helvetica</option>
                </select></div>`;

            case 'textAlign':
                return `<div class="inspector-field"><div class="inspector-label">Text Align</div><select class="inspector-input" id="inspector-textAlign">
                    <option value="left" ${(obj.extra?.textAlign || 'left') === 'left' ? 'selected' : ''}>Left</option>
                    <option value="center" ${obj.extra?.textAlign === 'center' ? 'selected' : ''}>Center</option>
                    <option value="right" ${obj.extra?.textAlign === 'right' ? 'selected' : ''}>Right</option>
                </select></div>`;

            default:
                return '';
        }
    }

    bindEvents(obj) {
        const updateProperty = (property, value, isNumber = false) => {
            const parsedValue = isNumber ? parseFloat(value) : value;
            if (isNumber && isNaN(parsedValue)) return;

            // Property handlers
            const handlers = {
                // Geometry properties
                x: () => this.updateGeometry(property, parsedValue),
                y: () => this.updateGeometry(property, parsedValue),
                width: () => this.updateGeometry(property, parsedValue),
                height: () => this.updateGeometry(property, parsedValue),
                
                // Color property 
                color: () => this.updateBasicProperty('color', parsedValue),
                label: () => this.updateBasicProperty('label', parsedValue),
                objectId: () => this.updateBasicProperty('objectId', parsedValue),

                // Extra properties (text, images)
                text: () => this.updateExtraProperty('text', parsedValue),
                fontSize: () => this.updateExtraProperty('fontSize', parsedValue),
                fontFamily: () => this.updateExtraProperty('fontFamily', parsedValue),
                textAlign: () => this.updateExtraProperty('textAlign', parsedValue),
                opacity: () => this.updateExtraProperty('opacity', parsedValue)
            };

            const handler = handlers[property];
            if (handler) {
                handler();
            }

            this.editor.render();
            this.editor.controlPanel.updateHistoryButtons();
            this.update(); // Refresh inspector
        };

        // Helper methods
        this.updateGeometry = (property, value) => {
            const oldBounds = this.editor.objects.getBounds(obj.index);
            const newBounds = { ...oldBounds, [property]: value };
            
            const cmd = new this.editor.api.createCommands.ResizeObjectCmd(
                this.editor.objects, this.editor.spatialGrid, obj.id, oldBounds, newBounds
            );
            this.editor.history.exec(cmd);
        };
        
        this.updateBasicProperty = (property, value) => {
            let currentValue;
            if (property === 'color') {
                currentValue = this.editor.objects.colors[obj.index];
            } else if (property === 'objectId') {
                currentValue = this.editor.objects.getObjectId(obj.index);
            } else if (property === 'label') {
                currentValue = this.editor.objects.labels[obj.index];
            } else {
                return; // Unknown property
            }
                
            const oldData = { [property]: currentValue };
            const newData = { [property]: value };
            
            const cmd = new this.editor.api.createCommands.UpdateObjectCmd(
                this.editor.objects, obj.id, oldData, newData
            );
            this.editor.history.exec(cmd);
        };
        
        this.updateExtraProperty = (property, value) => {
            if (!this.editor.objects.extra[obj.index]) return;
            
            const oldData = { 
                extra: JSON.parse(JSON.stringify(this.editor.objects.extra[obj.index])) 
            };
            
            const newExtra = JSON.parse(JSON.stringify(this.editor.objects.extra[obj.index]));
            newExtra[property] = value;
            const newData = { extra: newExtra };
            
            const cmd = new this.editor.api.createCommands.UpdateObjectCmd(
                this.editor.objects, obj.id, oldData, newData
            );
            this.editor.history.exec(cmd);
        };

         // Helper function to add event listeners with proper event handling
        const addInputEventListener = (elementId, eventType, handler) => {
            const element = document.getElementById(elementId);
            if (element) {
                element.addEventListener(eventType, (e) => {
                    e.stopPropagation(); // Prevent canvas shortcuts
                    handler(e);
                });
                
                // Also prevent keydown events from reaching the canvas
                element.addEventListener('keydown', (e) => {
                    e.stopPropagation();
                });
                
                // Prevent keyup events too
                element.addEventListener('keyup', (e) => {
                    e.stopPropagation();
                });
            }
        };

       // Bind events
        addInputEventListener('inspector-x', 'change', (e) => updateProperty('x', e.target.value, true));
        addInputEventListener('inspector-y', 'change', (e) => updateProperty('y', e.target.value, true));
        addInputEventListener('inspector-width', 'change', (e) => updateProperty('width', e.target.value, true));
        addInputEventListener('inspector-height', 'change', (e) => updateProperty('height', e.target.value, true));
        
        const colorInput = document.getElementById('inspector-color');
        if (colorInput) {
            let isUpdating = false;
            
            // Live preview ขณะเลือก (ไม่สร้าง command)
            colorInput.addEventListener('input', (e) => {
                if (isUpdating) return;
                isUpdating = true;
                
                // อัปเดตสีทันทีโดยไม่ผ่าน command
                this.editor.objects.colors[obj.index] = e.target.value;
                this.editor.render();
                
                isUpdating = false;
            });
            
            // สร้าง command เมื่อเลือกเสร็จ
            colorInput.addEventListener('change', (e) => {
                if (isUpdating) return;
                updateProperty('color', e.target.value);
            });
        }


        addInputEventListener('inspector-label', 'change', (e) => updateProperty('label', e.target.value));
        
       // Object ID with validation
        addInputEventListener('inspector-objectId', 'change', (e) => {
            const newObjectId = e.target.value.trim();
            
            // Validate Object ID
            if (newObjectId && !this.isValidObjectId(newObjectId)) {
                alert('Object ID must contain only letters, numbers, underscore, and hyphen');
                e.target.value = this.editor.objects.getObjectId(obj.index);
                 return;
             }
            
             if (newObjectId && !this.editor.objects.isObjectIdAvailable(newObjectId) && 
                this.editor.objects.getObjectId(obj.index) !== newObjectId) {
                alert('Object ID already exists');
                e.target.value = this.editor.objects.getObjectId(obj.index);
                return;
             }
            
            updateProperty('objectId', newObjectId);

        });

        


       // Special handling for opacity slider
       const opacityInput = document.getElementById('inspector-opacity');
        if (opacityInput) {
            let isUpdating = false;
            
            // Live preview ขณะเลื่อน (ไม่สร้าง command)
            opacityInput.addEventListener('input', (e) => {
                if (isUpdating) return;
                isUpdating = true;
                
                // อัปเดตค่าทันทีโดยไม่ผ่าน command
                if (this.editor.objects.extra[obj.index]) {
                    this.editor.objects.extra[obj.index].opacity = parseFloat(e.target.value);
                    this.editor.render();
                }
                
                isUpdating = false;
            });
            
            // สร้าง command เมื่อปล่อยเมาส์
            opacityInput.addEventListener('change', (e) => {
                if (isUpdating) return;
                updateProperty('opacity', e.target.value, true);
            });
        }

        

        // Text content - update display immediately, save command on blur
        addInputEventListener('inspector-text', 'input', (e) => {
            // Update display immediately without command
            if (this.editor.objects.extra[obj.index]) {
                this.editor.objects.extra[obj.index].text = e.target.value;
                this.editor.render();
            }
        });
        addInputEventListener('inspector-text', 'blur', (e) => updateProperty('text', e.target.value));
        
        addInputEventListener('inspector-fontSize', 'change', (e) => updateProperty('fontSize', e.target.value, true));
        addInputEventListener('inspector-fontFamily', 'change', (e) => updateProperty('fontFamily', e.target.value));
        addInputEventListener('inspector-textAlign', 'change', (e) => updateProperty('textAlign', e.target.value));

        // Z-Order buttons
        addInputEventListener('move-up', 'click', () => {
            const orderOps = this.editor.objectOrderOps;
            if (orderOps) {
                orderOps.moveForward(obj.index);
                this.update(); // Refresh inspector
            }
        });
        
        addInputEventListener('move-down', 'click', () => {
             const orderOps = this.editor.objectOrderOps;
           if (orderOps) {
               orderOps.moveBackward(obj.index);
               this.update(); // Refresh inspector
           }
        });

        addInputEventListener('auto-fit-text', 'click', () => {
           const textTool = this.editor.tools.get('text');
            if (textTool && textTool.autoFitTextBounds) {
                textTool.autoFitTextBounds(obj.index, this.editor.api);
                this.editor.render();
                this.update(); // Refresh inspector 
            }
        });
    }

    isValidObjectId(objectId) {
        return /^[a-zA-Z0-9_-]+$/.test(objectId);
    }
}
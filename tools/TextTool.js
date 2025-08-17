import { ITool } from '../types/ITool.js';

export class TextTool extends ITool {
    constructor() {
        super('text', 'Text', {
            icon: '📝',
            cursor: 'text'
        });
        this.isEditing = false;
        this.editingIndex = -1;
        this.textInput = null;
        this.tempText = '';
    }

    activate(ctx) {
        ctx.updateCursor(this.cursor);
    }

    deactivate(ctx) {
        this.finishEditing(ctx);
    }

    onPointerDown(e, pos, ctx) {
        // Check if clicking on existing text
        const clickedIndex = ctx.getObjectAt(pos.x, pos.y);

        if (clickedIndex !== -1 && ctx.objects.types[clickedIndex] === 'text') {
            // Edit existing text
            this.startEditing(clickedIndex, ctx);
        } else {
            // If click outside text, switch back to select tool
            if (this.wasAutoSwitched) {
                ctx.useTool('select');
                return;
            } else {
                // Create new text (normal text tool usage)
                this.createNewText(pos, ctx);
            }
        }
    }

    createNewText(pos, ctx) {
        const snapped = ctx.snapPosition(pos.x, pos.y);

        // Calculate initial size based on default text
        const defaultText = 'New Text';
        const defaultFontSize = 16;
        const defaultPadding = 8;

        // Use proper calculation for initial size
       const tempExtra = {
            fontSize: defaultFontSize,
            fontFamily: 'Arial',
            fontWeight: 'normal',
            fontStyle: 'normal',
            lineHeight: 1.2,
            padding: defaultPadding
        };
        const { width: estimatedWidth, height: estimatedHeight } = this.calculateTextBounds(defaultText, tempExtra);

        // Create text object with command
       const cmd = new ctx.createCommands.CreateObjectCmd(
            ctx.objects, ctx.spatialGrid, 'text',
            snapped.x, snapped.y, estimatedWidth, estimatedHeight,
            '#000000', 'text'
        );
        const { id, index } = ctx.history.exec(cmd);

        // Set text-specific properties
        ctx.objects.extra[index] = {
            text: defaultText,
            fontSize: defaultFontSize,
            fontFamily: 'Arial',
            fontWeight: 'normal',
            fontStyle: 'normal',
            textAlign: 'left',
            textBaseline: 'top',
            lineHeight: 1.2,
            padding: defaultPadding
        };

        // Calculate proper bounds based on text
        this.updateTextBounds(index, ctx);

        ctx.objects.selectObject(index);
        ctx.updateInfo();
        ctx.updateInspector();
        ctx.updateHistoryButtons?.();

        ctx.render();

        // Start editing immediately (this will create the command when finished)
        this.startEditing(index, ctx);

        // Store that this is a new text for command handling
        this.isNewText = true;
    }

    startEditing(index, ctx) {
        if (this.isEditing) {
            this.finishEditing(ctx);
        }

        this.isEditing = true;
        this.editingIndex = index;

        const extra = ctx.objects.extra[index];
        if (!extra) return;

         // Store original text for undo
        this.originalText = extra.text || '';
        this.tempText = extra.text || '';

        // Create text input overlay
        this.createTextInput(index, ctx);
        ctx.render();
    }

    createTextInput(index, ctx) {
        // Remove existing input
        this.removeTextInput();

        const bounds = ctx.objects.getBounds(index);
        const extra = ctx.objects.extra[index];

        // Get canvas position relative to document
        const canvasRect = ctx.ctx.canvas.getBoundingClientRect();
        const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
        const scrollY = window.pageYOffset || document.documentElement.scrollTop;

        // Convert world coordinates to screen coordinates
        const screenX = (bounds.x * ctx.zoom) + ctx.panX + canvasRect.left + scrollX;
        const screenY = (bounds.y * ctx.zoom) + ctx.panY + canvasRect.top + scrollY;

        // Use actual bounds size
        const screenWidth = bounds.width * ctx.zoom;
        const screenHeight = bounds.height * ctx.zoom; // Use exact bounds height
        

        // Create contenteditable div
        this.textInput = document.createElement('div');
        this.textInput.contentEditable = true;
        this.textInput.textContent = extra.text || '';

        // Style the input to match the text
        Object.assign(this.textInput.style, {
            position: 'absolute',
            left: `${screenX}px`,
            top: `${screenY}px`,
            width: `${screenWidth}px`,
            height: `${screenHeight}px`,
            fontSize: `${Math.max(extra.fontSize * ctx.zoom, 12)}px`,
            fontFamily: extra.fontFamily,
            fontWeight: extra.fontWeight,
            fontStyle: extra.fontStyle,
            textAlign: extra.textAlign,
            color: ctx.objects.colors[index],
            background: 'rgba(255, 255, 255, 0.9)',
            border: '2px dashed #0066cc',
            borderRadius: '2px',
            padding: `${Math.max(extra.padding * ctx.zoom, 2)}px`,
            lineHeight: extra.lineHeight,
            overflow: 'hidden',
            zIndex: 1000,
            outline: 'none',
            boxSizing: 'border-box',
            wordWrap: 'break-word',
            whiteSpace: 'pre-wrap', // Preserve whitespace and line breaks
        
            cursor: 'text'
        });

        // Event handlers
        this.textInput.addEventListener('blur', () => {
            setTimeout(() => this.finishEditing(ctx), 100);
        });

        this.textInput.addEventListener('keydown', (e) => {
            e.stopPropagation(); // Prevent canvas shortcuts
            if (e.key === 'Escape') {
                e.preventDefault();
                this.cancelEditing(ctx);
            } else if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.finishEditing(ctx);
            }
        });

        this.textInput.addEventListener('input', () => {
            this.tempText = this.textInput.textContent;
            // Auto-resize during editing for better UX
            clearTimeout(this.updateTimeout);
            this.updateTimeout = setTimeout(() => {
                this.updateTextBoundsOnlyGrow(this.editingIndex, ctx, this.tempText);
                this.updateInputPosition(ctx); // Update input size to match new bounds
                ctx.render();
            }, 100); // Slightly longer delay for smoother experience
            ctx.render();
        });

        // Prevent canvas events from interfering
        this.textInput.addEventListener('mousedown', (e) => {
            e.stopPropagation();
        });

        this.textInput.addEventListener('mouseup', (e) => {
            e.stopPropagation();
        });

        // Handle paste to clean up formatting
        this.textInput.addEventListener('paste', (e) => {
            e.preventDefault();
            const text = (e.clipboardData || window.clipboardData).getData('text/plain');
            document.execCommand('insertText', false, text);
        });

        // Handle window resize and scroll
        this.repositionHandler = () => {
            if (this.isEditing && this.editingIndex !== -1) {
                this.updateInputPosition(ctx);
            }
        };

        window.addEventListener('resize', this.repositionHandler);
        window.addEventListener('scroll', this.repositionHandler);

        // Add to DOM and focus
        document.body.appendChild(this.textInput);

        // Focus with a small delay to ensure it's rendered
        setTimeout(() => {
            if (this.textInput) {
                this.textInput.focus();
                // Select all text in contenteditable div
                const range = document.createRange();
                range.selectNodeContents(this.textInput);
                const selection = window.getSelection();
                selection.removeAllRanges();
                selection.addRange(range);
            }
        }, 10);
    }

    updateInputPosition(ctx) {
        if (!this.textInput || this.editingIndex === -1) return;

        const bounds = ctx.objects.getBounds(this.editingIndex);
        const canvasRect = ctx.ctx.canvas.getBoundingClientRect();
        const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
        const scrollY = window.pageYOffset || document.documentElement.scrollTop;

        const screenX = (bounds.x * ctx.zoom) + ctx.panX + canvasRect.left + scrollX;
        const screenY = (bounds.y * ctx.zoom) + ctx.panY + canvasRect.top + scrollY;

        // Use actual bounds size (respects manual resizing)
        const screenWidth = bounds.width * ctx.zoom;
        const screenHeight = bounds.height * ctx.zoom;

        this.textInput.style.left = `${screenX}px`;
        this.textInput.style.top = `${screenY}px`;
        this.textInput.style.width = `${screenWidth}px`;
        this.textInput.style.height = `${screenHeight}px`;

    }

    finishEditing(ctx) {
        if (!this.isEditing || this.editingIndex === -1) return;

        const index = this.editingIndex;
        const extra = ctx.objects.extra[index];

        if (extra && this.textInput) {
            const newText = this.textInput.textContent.trim();

            if (newText) {
                                // Only create command if text actually changed
                if (newText !== this.originalText) {
                    const objectId = ctx.objects.getIdByIndex(index);                    
                    // Create old data with original text
                    const oldExtra = JSON.parse(JSON.stringify(extra));
                    oldExtra.text = this.originalText;
                    const oldData = { extra: oldExtra };
                    
                    // Create new data with edited text
                    const newExtra = JSON.parse(JSON.stringify(extra));
                    newExtra.text = newText;
                    const newData = { extra: newExtra };
                    
                    const cmd = new ctx.createCommands.UpdateObjectCmd(
                        ctx.objects, objectId, oldData, newData
                    );
                    ctx.history.exec(cmd);
                }
            
                // Final bounds update on finish editing
                this.updateTextBounds(index, ctx, newText);

            } else {
                // Delete empty text
                if (this.isNewText) {
                    // Delete empty new text (no command needed)
                    const objectId = ctx.objects.getIdByIndex(index);
                    const bounds = ctx.objects.getBounds(index);
                    ctx.spatialGrid.removeObject(objectId, bounds.x, bounds.y, bounds.width, bounds.height);
                    ctx.objects.removeObject(index);
                } else {
                    // Delete existing text
                    ctx.deleteObject(index);
                }
            }
        }

        this.removeTextInput();
        this.isEditing = false;
        this.editingIndex = -1;
        this.tempText = '';
        this.originalText = '';
        this.isNewText = false;

        // Auto switch back to select tool if was switched from double-click
        if (this.wasAutoSwitched) {
            this.wasAutoSwitched = false;
            ctx.useTool('select');
        }


        ctx.render();
        ctx.updateInspector();
        ctx.updateHistoryButtons?.();

    }

    cancelEditing(ctx) {
        if (!this.isEditing) return;

        this.removeTextInput();
        this.isEditing = false;
        this.editingIndex = -1;
        this.tempText = '';

        ctx.render();
    }

    removeTextInput() {
        if (this.textInput && this.textInput.parentNode) {
            this.textInput.parentNode.removeChild(this.textInput);
        }
        this.textInput = null;

        // Clean up event listeners
        if (this.repositionHandler) {
            window.removeEventListener('resize', this.repositionHandler);
            window.removeEventListener('scroll', this.repositionHandler);
            this.repositionHandler = null;
        }

        // Clear timeout
        if (this.updateTimeout) {
            clearTimeout(this.updateTimeout);
            this.updateTimeout = null;
        }
    }

    // Shared calculation function to ensure consistency
    calculateTextBounds(text, extra) {
        // Create temporary canvas for text measurement
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');

        // Set font for measurement
        context.font = `${extra.fontStyle} ${extra.fontWeight} ${extra.fontSize}px ${extra.fontFamily}`;

        // Measure text
        const lines = text.split('\n');
        const lineHeight = extra.fontSize * extra.lineHeight;
        let maxWidth = 0;

        for (const line of lines) {
            const metrics = context.measureText(line || ' ');
            maxWidth = Math.max(maxWidth, metrics.width);
        }

       // Height calculation - only add extra spacing for multi-line text
        const totalHeight = lines.length > 1 
            ? (lines.length * lineHeight) + (lineHeight * 0.2)  // Small extra for multi-line
            : lineHeight; // No extra for single line
        
        // Consistent padding
        const horizontalPadding = extra.padding * 4;
        const verticalPadding = extra.padding * 2; 

        // Calculate final dimensions
        const width = Math.max(maxWidth + horizontalPadding + 20, 120);
        const height = Math.max(totalHeight + verticalPadding, extra.fontSize * 1.4 + verticalPadding); 

        return { width, height };
    }

    updateTextBounds(index, ctx, text = null) {
        const extra = ctx.objects.extra[index];
        if (!extra) return;

        const textToMeasure = text || extra.text || '';

        if (!textToMeasure.trim()) {
            // Fallback size for empty text
            const bounds = ctx.objects.getBounds(index);
            const minWidth = 120;
            const minHeight = extra.fontSize * 1.4 + (extra.padding * 2); 


            if (bounds.width < minWidth || bounds.height < minHeight) {
                const newBounds = {
                    x: bounds.x,
                    y: bounds.y,
                    width: Math.max(bounds.width, minWidth),
                    height: Math.max(bounds.height, minHeight)
                };

                const id = ctx.objects.getIdByIndex(index);
                ctx.spatialGrid.removeObject(id, bounds.x, bounds.y, bounds.width, bounds.height);
                ctx.objects.setBounds(index, newBounds);
                ctx.spatialGrid.addObject(id, newBounds.x, newBounds.y, newBounds.width, newBounds.height);
                ctx.addDirtyRect(newBounds);
            }
            return;
        }

        const { width: newWidth, height: newHeight } = this.calculateTextBounds(textToMeasure, extra);

        const bounds = ctx.objects.getBounds(index);
        const newBounds = {
            x: bounds.x,
            y: bounds.y,
            width: newWidth,
            height: newHeight
        };

        // Remove from spatial grid
        const id = ctx.objects.getIdByIndex(index);
        ctx.spatialGrid.removeObject(id, bounds.x, bounds.y, bounds.width, bounds.height);

        // Update bounds
        ctx.objects.setBounds(index, newBounds);

        // Add back to spatial grid
        ctx.spatialGrid.addObject(id, newBounds.x, newBounds.y, newBounds.width, newBounds.height);

        ctx.addDirtyRect(newBounds);

        // Update input position if editing
        if (this.isEditing && this.editingIndex === index) {
            this.updateInputPosition(ctx);
        }
    }

    // Check if text object was manually resized
    wasManuallyResized(index, ctx) {
        const extra = ctx.objects.extra[index];
        if (!extra || !extra.text) return false;

        // Use shared calculation function
        const { width: autoWidth, height: autoHeight } = this.calculateTextBounds(extra.text, extra);

        const bounds = ctx.objects.getBounds(index);
        const tolerance = 5; // Allow small differences

        return Math.abs(bounds.width - autoWidth) > tolerance || Math.abs(bounds.height - autoHeight) > tolerance;
    }

    // Update bounds but only allow growing, not shrinking
    updateTextBoundsOnlyGrow(index, ctx, text = null) {
        const extra = ctx.objects.extra[index];
        if (!extra) return;

        const textToMeasure = text || extra.text || '';
        if (!textToMeasure.trim()) return;

         // Use shared calculation function
        const { width: calculatedWidth, height: calculatedHeight } = this.calculateTextBounds(textToMeasure, extra);

        const bounds = ctx.objects.getBounds(index);

        // Only grow, never shrink
        const newWidth = Math.max(bounds.width, calculatedWidth);
        const newHeight = Math.max(bounds.height, calculatedHeight);

        // Only update if size actually changed
        if (newWidth !== bounds.width || newHeight !== bounds.height) {
            const newBounds = {
                x: bounds.x,
                y: bounds.y,
                width: newWidth,
                height: newHeight
            };

            // Remove from spatial grid
            const id = ctx.objects.getIdByIndex(index);
            ctx.spatialGrid.removeObject(id, bounds.x, bounds.y, bounds.width, bounds.height);

            // Update bounds
            ctx.objects.setBounds(index, newBounds);

            // Add back to spatial grid
            ctx.spatialGrid.addObject(id, newBounds.x, newBounds.y, newBounds.width, newBounds.height);

            ctx.addDirtyRect(newBounds);

            // Update input size immediately for better UX
            if (this.isEditing && this.editingIndex === index) {
                this.updateInputPosition(ctx);
            }
        }
    }


    // Method to auto-fit text bounds (can be called explicitly)
    autoFitTextBounds(index, ctx) {
        this.updateTextBounds(index, ctx);
    }

    // Handle canvas pan/zoom during editing
    onPointerMove(e, pos, ctx) {
        if (this.isEditing && this.editingIndex !== -1) {
            // Update input position when canvas moves
            this.updateInputPosition(ctx);
        }
    }

    onKeyDown(e, ctx) {

        // Don't handle global shortcuts while editing
        if (this.isEditing) {
            if (e.key === 'Escape') {
                this.cancelEditing(ctx);
                return true;
            }
            // Let other keys pass through to the text input
            return false;
        }

        if (e.key === 'Escape' && this.isEditing) {
            this.cancelEditing(ctx);
            return true;
        }
        return false;
    }

    drawOverlay(ctx) {
        // Show editing indicator
        if (this.isEditing && this.editingIndex !== -1) {
            const bounds = ctx.objects.getBounds(this.editingIndex);

            ctx.ctx.strokeStyle = 'rgba(0, 102, 204, 0.5)';
            ctx.ctx.lineWidth = 2 / ctx.zoom;
            ctx.ctx.setLineDash([10 / ctx.zoom, 5 / ctx.zoom]);
            ctx.ctx.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);
            ctx.ctx.setLineDash([]);

            const cornerSize = 6 / ctx.zoom;
            ctx.ctx.fillStyle = '#0066cc';
            ctx.ctx.fillRect(bounds.x - cornerSize / 2, bounds.y - cornerSize / 2, cornerSize, cornerSize);
            ctx.ctx.fillRect(bounds.x + bounds.width - cornerSize / 2, bounds.y - cornerSize / 2, cornerSize, cornerSize);
            ctx.ctx.fillRect(bounds.x - cornerSize / 2, bounds.y + bounds.height - cornerSize / 2, cornerSize, cornerSize);
            ctx.ctx.fillRect(bounds.x + bounds.width - cornerSize / 2, bounds.y + bounds.height - cornerSize / 2, cornerSize, cornerSize);
        }
    }
}
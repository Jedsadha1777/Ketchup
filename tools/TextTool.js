import { ITool } from '../types/ITool.js';
import { TextUtils } from '../utils/TextUtils.js';

export class TextTool extends ITool {
    constructor() {
        super('text', 'Text', {
             icon: '📝',
            cursor: 'text'
        });
        this.isEditing = false;
        this.editingIndex = -1;
        this.editingText = '';
        this.cursorPosition = 0;
        this.cursorVisible = true;
        this.cursorBlinkInterval = null;
        this.isManuallyResized = false;
        this.originalBounds = null;
        
        this.keydownHandler = this.handleKeydown.bind(this);
    }

    activate(ctx) {
        ctx.updateCursor(this.cursor);
    }

    deactivate(ctx) {
        this.finishEditing(ctx);
    }

    onPointerDown(e, pos, ctx) {
        // If currently editing, finish editing first
        if (this.isEditing) {
            this.finishEditing(ctx);
            return;
        }

        const clickedIndex = ctx.getObjectAt(pos.x, pos.y);

        if (clickedIndex !== -1 && ctx.objects.types[clickedIndex] === 'text') {
            this.startEditing(clickedIndex, ctx);

            // Calculate cursor position from click
            const extra = ctx.objects.extra[clickedIndex];
            if (extra && extra.text) {
                const cursorPos = this.getCursorPositionFromClick(pos, clickedIndex, ctx);
                if (cursorPos !== -1) {
                    this.cursorPosition = cursorPos;
                    this.resetCursorBlink();
                    ctx.render();
                }
            }
        } else {
            if (this.wasAutoSwitched) {
                ctx.useTool('select');
                return;
            } else {
                this.createNewText(pos, ctx);
            }
        }
    }

    getCursorPositionFromClick(clickPos, index, ctx) {
        const bounds = ctx.objects.getBounds(index);
        const extra = ctx.objects.extra[index];
        if (!extra || !extra.text) return -1;
        
        const padding = extra.padding || 4;
        const lineHeight = (extra.fontSize || 16) * (extra.lineHeight || 1.2);
        
        // Calculate which line was clicked
        const relativeY = clickPos.y - (bounds.y + padding);
        const clickedLineIndex = Math.floor(relativeY / lineHeight);
        
        // Get wrapped lines
        const maxWidth = Math.max(bounds.width - (padding * 2), 20);
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        context.font = `${extra.fontStyle || 'normal'} ${extra.fontWeight || 'normal'} ${extra.fontSize || 16}px ${extra.fontFamily || 'Arial'}`;
        
        const wrappedText = TextUtils.wrapText(extra.text, maxWidth, context);
        const lines = wrappedText.split('\n');
        
        if (clickedLineIndex < 0 || clickedLineIndex >= lines.length) {
            // Click outside text area - position at end
            return extra.text.length;
        }
        
        const clickedLine = lines[clickedLineIndex];
        const relativeX = clickPos.x - (bounds.x + padding);
        
        // Find closest character position in the line
        let bestDistance = Infinity;
        let bestPosition = 0;
        
        for (let i = 0; i <= clickedLine.length; i++) {
            const substring = clickedLine.substring(0, i);
            const metrics = context.measureText(substring);
            const charX = metrics.width;
            const distance = Math.abs(charX - relativeX);
            
            if (distance < bestDistance) {
                bestDistance = distance;
                bestPosition = i;
            }
        }
        
        // Convert line position to absolute text position
        const linesBeforeCurrent = lines.slice(0, clickedLineIndex);
        const charsBeforeLine = linesBeforeCurrent.join('\n').length + (clickedLineIndex > 0 ? 1 : 0);
        
        return charsBeforeLine + bestPosition;
    }

    // Helper method to maintain cursor position across text wrapping
    maintainCursorPositionAfterWrap(originalText, wrappedText, originalCursorPos) {
        if (originalText === wrappedText) {
            return Math.min(originalCursorPos, wrappedText.length);
        }
        
        // Count characters up to cursor position in original text
        const beforeCursor = originalText.substring(0, originalCursorPos);
        
        // Find corresponding position in wrapped text
        let wrappedPos = 0;
        let originalPos = 0;
        
        for (let i = 0; i < wrappedText.length && originalPos < beforeCursor.length; i++) {
            const wrappedChar = wrappedText[i];
            const originalChar = beforeCursor[originalPos];
            
            if (wrappedChar === originalChar) {
                // Characters match, advance both
                originalPos++;
                wrappedPos = i + 1;
            } else if (wrappedChar === '\n' && originalChar !== '\n') {
                // Wrapped text has a line break that wasn't in original
                // This is an auto-inserted line break, skip it
                wrappedPos = i + 1;
            } else if (wrappedChar !== '\n' && originalChar === '\n') {
                // Original had a line break that's still there
                originalPos++;
                wrappedPos = i + 1;
            }
        }
        
        return Math.min(wrappedPos, wrappedText.length);
    }  

    createNewText(pos, ctx) {
        const snapped = ctx.snapPosition(pos.x, pos.y);

        const defaultText = 'Text';
        const defaultFontSize = 16;
        const defaultPadding = 8;

        const tempExtra = {
            fontSize: defaultFontSize,
            fontFamily: 'Arial',
            fontWeight: 'normal',
            fontStyle: 'normal',
            lineHeight: 1.2,
            padding: defaultPadding,
            isManuallyResized: false

        };
        const { width: estimatedWidth, height: estimatedHeight } = this.calculateTextBounds(defaultText, tempExtra);

        const cmd = new ctx.createCommands.CreateObjectCmd(
            ctx.objects, ctx.spatialGrid, 'text',
            snapped.x, snapped.y, estimatedWidth, estimatedHeight,
            '#000000', 'text'
        );
        const { id, index } = ctx.history.exec(cmd);

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

        this.updateTextBounds(index, ctx);

        ctx.objects.selectObject(index);
        ctx.updateInfo();
        ctx.updateInspector();
        ctx.updateHistoryButtons?.();

        ctx.render();

        this.startEditing(index, ctx);
        this.isNewText = true;
    }

    startEditing(index, ctx) {
        if (this.isEditing) {
            this.finishEditing(ctx);
        }

        this.isEditing = true;
        this.editingIndex = index;
        this.isManuallyResized = this.wasManuallyResized(index, ctx);
        this.originalBounds = { ...ctx.objects.getBounds(index) };

        const extra = ctx.objects.extra[index];
        if (!extra) return;

        this.originalText = extra.text || '';
        this.editingText = extra.text || '';
        this.cursorPosition = this.editingText.length;

        this.startCursorBlink();
        document.addEventListener('keydown', this.keydownHandler);

        ctx.render();
    }

    startCursorBlink() {
        this.cursorVisible = true;
        if (this.cursorBlinkInterval) {
            clearInterval(this.cursorBlinkInterval);
        }
        this.cursorBlinkInterval = setInterval(() => {
            this.cursorVisible = !this.cursorVisible;
            if (this.isEditing && window.editor) {
                window.editor.render();
            }
        }, 500);
    }

    stopCursorBlink() {
        if (this.cursorBlinkInterval) {
            clearInterval(this.cursorBlinkInterval);
            this.cursorBlinkInterval = null;
        }
        this.cursorVisible = false;
    }

    handleKeydown(e) {
        if (!this.isEditing) return;

        e.preventDefault();
        e.stopPropagation();

        const ctx = window.editor?.api || window.editor;

        switch (e.key) {
            case 'Escape':
                this.cancelEditing(ctx);
                break;
            case 'Enter':
                 if (e.shiftKey) {
                     this.insertText('\n', ctx);
                } else {
                    this.finishEditing(ctx);
                }
                break;
            case 'Backspace':
                this.handleBackspace(ctx);
                break;
            case 'Delete':
                this.handleDelete(ctx);
                break;
            case 'ArrowLeft':
                this.cursorPosition = Math.max(0, this.cursorPosition - 1);
                this.resetCursorBlink();
                ctx.render();
                break;
            case 'ArrowRight':
                this.cursorPosition = Math.min(this.editingText.length, this.cursorPosition + 1);
                this.resetCursorBlink();
                ctx.render();
                break;
            case 'Home':
                this.cursorPosition = 0;
                this.resetCursorBlink();
                ctx.render();
                break;
            case 'End':
                this.cursorPosition = this.editingText.length;
                this.resetCursorBlink();
                ctx.render();
                break;
            default:
                if (e.key.length === 1) {
                    this.insertText(e.key, ctx);
                }
                break;
        }
    }

    insertText(text, ctx) {
        this.editingText = this.editingText.slice(0, this.cursorPosition) + text + this.editingText.slice(this.cursorPosition);
        this.cursorPosition += text.length;
        const originalCursorPos = this.cursorPosition;
        this.resetCursorBlink();
        
        if (this.editingIndex !== -1) {
            const extra = ctx.objects.extra[this.editingIndex];
           if (extra) {
                // Only wrap if manually resized 
                if (this.isManuallyResized) {
                    extra.isManuallyResized = true;
                    const originalText = this.editingText;
                    const wrappedText = this.wrapTextToContainer(this.editingText, this.editingIndex, ctx);
                    extra.text = wrappedText;
                    this.editingText = wrappedText;
                    this.cursorPosition = this.maintainCursorPositionAfterWrap(originalText, wrappedText, originalCursorPos);
                } else {
                    // Auto-fit mode - don't wrap, just update text
                    extra.isManuallyResized = false;
                    extra.text = this.editingText;
                    if (!this.isManuallyResized) {
                        this.updateTextBounds(this.editingIndex, ctx, this.editingText);
                    }
                }
            }
        }
        
        ctx.render();
    }

    handleBackspace(ctx) {
        if (this.cursorPosition > 0) {
            this.editingText = this.editingText.slice(0, this.cursorPosition - 1) + this.editingText.slice(this.cursorPosition);
            this.cursorPosition--;
            const originalCursorPos = this.cursorPosition;
            this.resetCursorBlink();
            
            if (this.editingIndex !== -1) {
                const extra = ctx.objects.extra[this.editingIndex];
                if (extra) {
                    
                    if (this.isManuallyResized) {
                        extra.isManuallyResized = true;
                        const originalText = this.editingText;
                        const wrappedText = this.wrapTextToContainer(this.editingText, this.editingIndex, ctx);
                        extra.text = wrappedText;
                        this.editingText = wrappedText;
                        
                        this.cursorPosition = this.maintainCursorPositionAfterWrap(originalText, wrappedText, originalCursorPos);
                    } else {
                        extra.isManuallyResized = false;
                        extra.text = this.editingText;
                        if (!this.isManuallyResized) {
                            this.updateTextBounds(this.editingIndex, ctx, this.editingText);
                        }
                    }
                }
            }
            
            ctx.render();
        }
    }

    handleDelete(ctx) {
        if (this.cursorPosition < this.editingText.length) {
            this.editingText = this.editingText.slice(0, this.cursorPosition) + this.editingText.slice(this.cursorPosition + 1);
            this.resetCursorBlink();
            
            if (this.editingIndex !== -1) {
                const extra = ctx.objects.extra[this.editingIndex];
                if (extra) {
                    if (this.isManuallyResized) {
                        extra.isManuallyResized = true;
                        const wrappedText = this.wrapTextToContainer(this.editingText, this.editingIndex, ctx);
                        extra.text = wrappedText;
                        this.editingText = wrappedText;
                        this.cursorPosition = Math.min(this.cursorPosition, this.editingText.length);
                    } else {
                        extra.isManuallyResized = false;
                        extra.text = this.editingText;
                        if (!this.isManuallyResized) {
                            this.updateTextBounds(this.editingIndex, ctx, this.editingText);
                        }
                    }
                }
            }
            
            ctx.render();
        }
    }

    resetCursorBlink() {
        this.cursorVisible = true;
        this.startCursorBlink();
    }

    wrapTextToContainer(text, index, ctx) {
        const bounds = ctx.objects.getBounds(index);
        const extra = ctx.objects.extra[index];
        if (!extra) return text;
        
        const maxWidth = bounds.width - (extra.padding * 2);
        
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        context.font = `${extra.fontStyle || 'normal'} ${extra.fontWeight || 'normal'} ${extra.fontSize || 16}px ${extra.fontFamily || 'Arial'}`;
        
        return TextUtils.wrapText(text, maxWidth, context);
    }

    finishEditing(ctx) {
        if (!this.isEditing || this.editingIndex === -1) return;

        const index = this.editingIndex;
        const extra = ctx.objects.extra[index];

        if (extra) {
            const newText = this.editingText.trim();

            if (newText) {
                if (newText !== this.originalText) {
                    const objectId = ctx.objects.getIdByIndex(index);
                    
                    const oldExtra = JSON.parse(JSON.stringify(extra));
                    oldExtra.text = this.originalText;
                    const oldData = { extra: oldExtra };
                    
                    const newExtra = JSON.parse(JSON.stringify(extra));
                    newExtra.text = newText;
                    const newData = { extra: newExtra };
                    
                    const cmd = new ctx.createCommands.UpdateObjectCmd(
                        ctx.objects, objectId, oldData, newData
                    );
                    ctx.history.exec(cmd);
                }
                
                if (!this.isManuallyResized) {
                    this.updateTextBounds(index, ctx, newText);
                }
            } else {
                if (this.isNewText) {
                    const objectId = ctx.objects.getIdByIndex(index);
                    const bounds = ctx.objects.getBounds(index);
                    ctx.spatialGrid.removeObject(objectId, bounds.x, bounds.y, bounds.width, bounds.height);
                    ctx.objects.removeObject(index);
                } else {
                    ctx.deleteObject(index);
                }
            }
        }

        this.cleanupEditing();

        if (this.wasAutoSwitched) {
            this.wasAutoSwitched = false;
            ctx.useTool('select');
        } else {
            ctx.useTool('select');
        }

        ctx.render();
        ctx.updateInspector();
        ctx.updateHistoryButtons?.();
    }

    cancelEditing(ctx) {
        if (!this.isEditing) return;

        if (this.editingIndex !== -1) {
            const extra = ctx.objects.extra[this.editingIndex];
            if (extra) {
                extra.text = this.originalText;
                if (!this.isManuallyResized && this.originalBounds) {
                    ctx.objects.setBounds(this.editingIndex, this.originalBounds);
                }
            }
        }

        this.cleanupEditing();
        ctx.render();
    }

    cleanupEditing() {
        this.stopCursorBlink();
        document.removeEventListener('keydown', this.keydownHandler);
        
        this.isEditing = false;
        this.editingIndex = -1;
        this.editingText = '';
        this.cursorPosition = 0;
        this.originalText = '';
        this.isNewText = false;
        this.isManuallyResized = false;
        this.originalBounds = null;
    }

    calculateTextBounds(text, extra) {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');

        context.font = `${extra.fontStyle} ${extra.fontWeight} ${extra.fontSize}px ${extra.fontFamily}`;

        const lines = text.split('\n');
        const lineHeight = extra.fontSize * extra.lineHeight;
        let maxWidth = 0;

        for (const line of lines) {
            const metrics = context.measureText(line || ' ');
            maxWidth = Math.max(maxWidth, metrics.width);
        }

        const totalHeight = lines.length > 1 
            ? (lines.length * lineHeight) + (lineHeight * 0.2)
            : lineHeight;
        
        const horizontalPadding = extra.padding * 4;
        const verticalPadding = extra.padding * 2; 

        const width = Math.max(maxWidth + horizontalPadding + 20, 60);
        const height = Math.max(totalHeight + verticalPadding, extra.fontSize * 1.4 + verticalPadding); 

        return { width, height };
    }

    updateTextBounds(index, ctx, text = null) {
        const extra = ctx.objects.extra[index];
        if (!extra) return;

        const textToMeasure = text || extra.text || '';

        if (!textToMeasure.trim()) {
            const bounds = ctx.objects.getBounds(index);
            const minWidth = 60;
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

        const id = ctx.objects.getIdByIndex(index);
        ctx.spatialGrid.removeObject(id, bounds.x, bounds.y, bounds.width, bounds.height);

        ctx.objects.setBounds(index, newBounds);

        ctx.spatialGrid.addObject(id, newBounds.x, newBounds.y, newBounds.width, newBounds.height);

        ctx.addDirtyRect(newBounds);
    }

    wasManuallyResized(index, ctx) {
        const extra = ctx.objects.extra[index];
        if (!extra || !extra.text) return false;

        const { width: autoWidth, height: autoHeight } = this.calculateTextBounds(extra.text, extra);

        const bounds = ctx.objects.getBounds(index);
        const tolerance = 5;

        return Math.abs(bounds.width - autoWidth) > tolerance || Math.abs(bounds.height - autoHeight) > tolerance;
    }

    wrapTextDuringEdit(text, maxWidth, ctx) {
        // Split by manual line breaks first
        const manualLines = text.split('\n');
        const wrappedLines = [];
        
        for (const line of manualLines) {
            const wrappedLine = this.wrapSingleLine(line, maxWidth, ctx);
            wrappedLines.push(wrappedLine);
        }
        
        return wrappedLines.join('\n');
    }
    
    autoFitTextBounds(index, ctx) {
        this.updateTextBounds(index, ctx);
    }

    onKeyDown(e, ctx) {
        if (this.isEditing) {
            return true;
        }

        if (e.key === 'Escape' && this.isEditing) {
            this.cancelEditing(ctx);
            return true;
        }
        return false;
    }

    drawOverlay(ctx) {
        if (this.isEditing && this.editingIndex !== -1) {
            const bounds = ctx.objects.getBounds(this.editingIndex);
            const extra = ctx.objects.extra[this.editingIndex];

            ctx.ctx.strokeStyle = 'rgba(0, 102, 204, 0.8)';
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

            if (this.cursorVisible && extra) {
                this.drawCursor(ctx, bounds, extra);
            }
        }
    }

    drawCursor(ctx, bounds, extra) {
        ctx.ctx.font = `${extra.fontStyle || 'normal'} ${extra.fontWeight || 'normal'} ${extra.fontSize || 16}px ${extra.fontFamily || 'Arial'}`;
        
        const padding = extra.padding || 4;
        let textX = bounds.x + padding;
        const textY = bounds.y + padding;
        
        if (extra.textAlign === 'center') {
            textX = bounds.x + bounds.width / 2;
        } else if (extra.textAlign === 'right') {
            textX = bounds.x + bounds.width - padding;
        }

        const textBeforeCursor = this.editingText.substring(0, this.cursorPosition);
        const lines = textBeforeCursor.split('\n');
        const currentLine = lines[lines.length - 1];
        const lineHeight = (extra.fontSize || 16) * (extra.lineHeight || 1.2);
        
        const textMetrics = ctx.ctx.measureText(currentLine);
        let cursorX = textX;
        
        if (extra.textAlign === 'center') {
            cursorX = textX + textMetrics.width - ctx.ctx.measureText(lines[lines.length - 1]).width / 2;
        } else if (extra.textAlign === 'right') {
            cursorX = textX - textMetrics.width;
        } else {
            cursorX = textX + textMetrics.width;
        }
        
        const cursorY = textY + ((lines.length - 1) * lineHeight);
        
        ctx.ctx.strokeStyle = '#000000';
        ctx.ctx.lineWidth = 1 / ctx.zoom;
        ctx.ctx.beginPath();
        ctx.ctx.moveTo(cursorX, cursorY);
        ctx.ctx.lineTo(cursorX, cursorY + lineHeight);
        ctx.ctx.stroke();
    }

    // Method to be called when text box is resized during editing
    onTextBoxResized(ctx) {
        if (this.isEditing && this.editingIndex !== -1) {
            const extra = ctx.objects.extra[this.editingIndex];
            if (!extra || !extra.text) return;
            
            this.isManuallyResized = true; // Mark as manually resized
            // Re-wrap the current text
            extra.isManuallyResized = true;
            const originalText = this.editingText;
            const wrappedText = this.wrapTextToContainer(this.editingText, this.editingIndex, ctx);
            extra.text = wrappedText;
            this.editingText = wrappedText;
            this.cursorPosition = this.maintainCursorPositionAfterWrap(originalText, wrappedText, this.cursorPosition);
            
            ctx.render();
        }
    }
}
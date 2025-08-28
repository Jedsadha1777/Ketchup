import { ITool } from '../types/ITool.js';
import { TextUtils } from '../utils/TextUtils.js';

export class TextTool extends ITool {
    constructor() {
        super('text', 'Text', {
            icon: '📝',
            cursor: 'text'
        });

        // Edit state
        this.isEditing = false;
        this.editingIndex = -1;
        this.editingText = '';
        this.originalText = '';
        this.cursorPosition = 0;

        // Visual state
        this.cursorVisible = true;
        this.cursorBlinkInterval = null;

        // Resize state
        this.isManuallyResized = false;
        this.originalBounds = null;

        // Misc state
        this.isNewText = false;
        this.wasAutoSwitched = false;

        // Bind handler
        this.handleKeydown = this.handleKeydown.bind(this);
    }

    calculateUnifiedTextLayout(text, bounds, extra) {
        const padding = extra.padding || 8;
        const fontSize = extra.fontSize || 16;
        const fontFamily = extra.fontFamily || 'Arial';
        const lineHeight = fontSize * (extra.lineHeight || 1.2);
        const maxWidth = bounds.width - (padding * 2);

        // สร้าง shared canvas context
        if (!this._sharedCanvas) {
            this._sharedCanvas = document.createElement('canvas');
            this._sharedContext = this._sharedCanvas.getContext('2d');
        }

        const ctx = this._sharedContext;
        ctx.font = `${fontSize}px ${fontFamily}`;

        const lines = [];
        let totalPos = 0;

        // Split text by existing newlines
        const paragraphs = text.split('\n');

        for (let pIndex = 0; pIndex < paragraphs.length; pIndex++) {
            const paragraph = paragraphs[pIndex];

            if (paragraph.trim() === '') {
                lines.push({
                    text: '',
                    startPos: totalPos,
                    endPos: totalPos,
                    originalLength: 0
                });
                if (pIndex < paragraphs.length - 1) totalPos++;
                continue;
            }

            const words = paragraph.split(' ');
            let currentLine = '';
            let lineStartPos = totalPos;

            for (let wIndex = 0; wIndex < words.length; wIndex++) {
                const word = words[wIndex];
                const testLine = currentLine + (currentLine ? ' ' : '') + word;
                const testWidth = ctx.measureText(testLine).width;

                if (testWidth > maxWidth && currentLine !== '') {
                    lines.push({
                        text: currentLine,
                        startPos: lineStartPos,
                        endPos: lineStartPos + currentLine.length,
                        originalLength: currentLine.length
                    });

                    const charsProcessed = currentLine.length;
                    totalPos += charsProcessed + (currentLine.includes(' ') ? 0 : 1);
                    lineStartPos = totalPos;
                    currentLine = word;
                } else {
                    currentLine = testLine;
                }
            }

            if (currentLine !== '') {
                lines.push({
                    text: currentLine,
                    startPos: lineStartPos,
                    endPos: lineStartPos + currentLine.length,
                    originalLength: currentLine.length
                });
                totalPos += currentLine.length;
            }

            if (pIndex < paragraphs.length - 1) {
                totalPos++;
            }
        }

        return {
            lines,
            lineHeight,
            totalLength: text.length,
            maxWidth
        };
    }

    // ============= Main Tool Interface =============
    activate(ctx) {
        ctx.updateCursor(this.cursor);
    }

    deactivate(ctx) {
        if (this.isEditing) {
            this.finishEditing(ctx);
        }
    }

    onPointerDown(e, pos, ctx) {
        if (this.isEditing) {
            const clickedIndex = ctx.getObjectAt(pos.x, pos.y);

            if (clickedIndex === this.editingIndex) {
                // คลิกที่ text ที่กำลัง edit - หา cursor position
                const cursorPos = this.getCursorPositionFromClick(pos, ctx);
                if (cursorPos !== -1) {
                    this.cursorPosition = cursorPos;
                    this.resetCursorBlink();
                    ctx.render();
                }
                return;
            } else {
                // คลิกที่อื่น - จบการ edit
                this.finishEditing(ctx);
                if (clickedIndex === -1 || ctx.objects.types[clickedIndex] !== 'text') {
                    return;
                }
            }
        }

        const clickedIndex = ctx.getObjectAt(pos.x, pos.y);

        if (clickedIndex !== -1 && ctx.objects.types[clickedIndex] === 'text') {
            this.startEditing(clickedIndex, ctx);

            // หา cursor position จากตำแหน่งคลิก
            const cursorPos = this.getCursorPositionFromClick(pos, ctx);
            if (cursorPos !== -1) {
                this.cursorPosition = cursorPos;
                this.resetCursorBlink();
                ctx.render();
            }
        } else {
            if (this.wasAutoSwitched) {
                ctx.useTool('select');
                return;
            }
            this.createNewText(pos, ctx);
        }
    }

    getCursorPositionFromClick(pos, ctx) {
        const index = this.editingIndex !== -1 ? this.editingIndex : ctx.getObjectAt(pos.x, pos.y);
        if (index === -1) return -1;

        const bounds = ctx.objects.getBounds(index);
        const extra = ctx.objects.extra[index];
        if (!extra || !bounds) return -1;

        const padding = extra.padding || 8;
        const layout = this.calculateUnifiedTextLayout(this.editingText, bounds, extra);

        const relativeY = pos.y - (bounds.y + padding);
        const clickedLineIndex = Math.floor(relativeY / layout.lineHeight);

        if (clickedLineIndex < 0) return 0;
        if (clickedLineIndex >= layout.lines.length) return this.editingText.length;

        const relativeX = pos.x - (bounds.x + padding);
        const clickedLine = layout.lines[clickedLineIndex];

        if (!clickedLine) return this.editingText.length;

        const ctx2d = this._sharedContext;
        let bestPos = 0;
        let minDist = Math.abs(relativeX);

        for (let i = 0; i <= clickedLine.text.length; i++) {
            const textWidth = ctx2d.measureText(clickedLine.text.substring(0, i)).width;
            const dist = Math.abs(textWidth - relativeX);
            if (dist < minDist) {
                minDist = dist;
                bestPos = i;
            }
        }

        return clickedLine.startPos + Math.min(bestPos, clickedLine.originalLength);
    }

    // ตรวจสอบว่า screenToCanvas ทำงานถูกต้อง
    // ถ้าไม่ถูก อาจต้องคำนวณเอง:
    getWorldPosition(screenX, screenY, ctx) {
        // แปลง screen coordinates เป็น world coordinates
        const worldX = (screenX - ctx.panX) / ctx.zoom;
        const worldY = (screenY - ctx.panY) / ctx.zoom;
        return { x: worldX, y: worldY };
    }

    onPointerMove(e, pos, ctx) {
        // ไม่ทำอะไร - ไม่มี drag selection
    }

    onPointerUp(e, pos, ctx) {
        // ไม่ทำอะไร - ไม่มี drag selection
    }

    // ============= Edit Lifecycle =============
    startEditing(index, ctx) {
        if (this.isEditing) {
            this.finishEditing(ctx);
        }

        const extra = ctx.objects.extra[index];
        if (!extra) return;

        this.isEditing = true;
        this.editingIndex = index;
        this.originalText = extra.text || '';
        this.editingText = extra.text || '';
        this.cursorPosition = this.editingText.length;

        this.originalBounds = { ...ctx.objects.getBounds(index) };
        this.isManuallyResized = this.checkIfManuallyResized(index, ctx);

        this.startCursorBlink();
        document.addEventListener('keydown', this.handleKeydown);

        ctx.render();
    }

    finishEditing(ctx) {
        if (!this.isEditing || this.editingIndex === -1) return;

        const index = this.editingIndex;
        const extra = ctx.objects.extra[index];
        if (!extra) return;

        const newText = this.editingText.trim();

        if (newText) {
            if (newText !== this.originalText) {
                // Save changes via command
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
        } else if (this.isNewText) {
            // Delete empty new text
            const objectId = ctx.objects.getIdByIndex(index);
            const bounds = ctx.objects.getBounds(index);
            ctx.spatialGrid.removeObject(objectId, bounds.x, bounds.y, bounds.width, bounds.height);
            ctx.objects.removeObject(index);
        }

        this.cleanup();

        if (this.wasAutoSwitched) {
            this.wasAutoSwitched = false;
        }
        ctx.useTool('select');

        ctx.render();
        ctx.updateInspector();
        ctx.updateHistoryButtons?.();
    }

    cancelEditing(ctx) {
        if (!this.isEditing) return;

        const extra = ctx.objects.extra[this.editingIndex];
        if (extra) {
            extra.text = this.originalText;
            if (!this.isManuallyResized && this.originalBounds) {
                ctx.objects.setBounds(this.editingIndex, this.originalBounds);
            }
        }

        this.cleanup();
        ctx.render();
    }

    cleanup() {
        this.stopCursorBlink();
        document.removeEventListener('keydown', this.handleKeydown);

        this.isEditing = false;
        this.editingIndex = -1;
        this.editingText = '';
        this.originalText = '';
        this.cursorPosition = 0;
        this.isNewText = false;
        this.isManuallyResized = false;
        this.originalBounds = null;

        this._sharedCanvas = null;
        this._sharedContext = null;
    }

    // ============= Text Manipulation =============
    insertText(text, ctx) {
        const before = this.editingText.slice(0, this.cursorPosition);
        const after = this.editingText.slice(this.cursorPosition);
        this.editingText = before + text + after;
        this.cursorPosition += text.length;

        this.updateTextObject(ctx);
        this.resetCursorBlink();
        ctx.render();
    }

    deleteCharacter(direction, ctx) {
        if (direction === 'backward' && this.cursorPosition > 0) {
            this.editingText =
                this.editingText.slice(0, this.cursorPosition - 1) +
                this.editingText.slice(this.cursorPosition);
            this.cursorPosition--;
        } else if (direction === 'forward' && this.cursorPosition < this.editingText.length) {
            this.editingText =
                this.editingText.slice(0, this.cursorPosition) +
                this.editingText.slice(this.cursorPosition + 1);
        } else {
            return;
        }

        this.updateTextObject(ctx);
        this.resetCursorBlink();
        ctx.render();
    }

    updateTextObject(ctx) {
        if (this.editingIndex === -1) return;

        const extra = ctx.objects.extra[this.editingIndex];
        if (!extra) return;

        extra.text = this.editingText;

        if (!this.isManuallyResized) {
            this.updateTextBounds(this.editingIndex, ctx, this.editingText);
        }
    }

    // ============= Cursor Movement =============
    moveCursor(direction, ctx) {
        switch (direction) {
            case 'left':
                this.cursorPosition = Math.max(0, this.cursorPosition - 1);
                break;
            case 'right':
                this.cursorPosition = Math.min(this.editingText.length, this.cursorPosition + 1);
                break;
            case 'up':
                this.moveCursorVertical(-1);
                break;
            case 'down':
                this.moveCursorVertical(1);
                break;
            case 'home':
                this.cursorPosition = this.getCursorPositionStartOfLine();
                break;
            case 'end':
                this.cursorPosition = this.getCursorPositionEndOfLine();
                break;
        }

        this.resetCursorBlink();
        ctx.render();
    }

    moveCursorVertical(direction) {
        if (!this.isEditing) return;

        const bounds = window.editor?.api?.objects?.getBounds(this.editingIndex);
        const extra = window.editor?.api?.objects?.extra[this.editingIndex];

        if (!bounds || !extra) return;

        const layout = this.calculateUnifiedTextLayout(this.editingText, bounds, extra);

        let currentLine = 0;
        let posInLine = 0;

        for (let i = 0; i < layout.lines.length; i++) {
            const line = layout.lines[i];
            if (this.cursorPosition >= line.startPos && this.cursorPosition <= line.endPos) {
                currentLine = i;
                posInLine = Math.min(
                    this.cursorPosition - line.startPos,
                    line.text.length
                );
                break;
            }
        }

        const targetLine = currentLine + direction;
        if (targetLine < 0 || targetLine >= layout.lines.length) return;

        const targetLineData = layout.lines[targetLine];
        const newPosInLine = Math.min(posInLine, targetLineData.text.length);
        this.cursorPosition = targetLineData.startPos + newPosInLine;
    }

    getCursorPositionStartOfLine() {
        const textBefore = this.editingText.substring(0, this.cursorPosition);
        const lastNewline = textBefore.lastIndexOf('\n');
        return lastNewline + 1;
    }

    getCursorPositionEndOfLine() {
        const nextNewline = this.editingText.indexOf('\n', this.cursorPosition);
        return nextNewline === -1 ? this.editingText.length : nextNewline;
    }

    // ============= Input Handlers =============
    handleKeydown(e) {
        if (!this.isEditing) return;

        e.preventDefault();
        e.stopPropagation();

        const ctx = window.editor?.api || window.editor;

        switch (e.key) {
            case 'Enter':
                if (e.shiftKey) {
                    this.insertText('\n', ctx);
                } else {
                    this.finishEditing(ctx);
                }
                break;

            case 'Escape':
                this.cancelEditing(ctx);
                break;

            case 'Backspace':
                this.deleteCharacter('backward', ctx);
                break;

            case 'Delete':
                this.deleteCharacter('forward', ctx);
                break;

            case 'ArrowLeft':
                this.moveCursor('left', ctx);
                break;

            case 'ArrowRight':
                this.moveCursor('right', ctx);
                break;

            case 'ArrowUp':
                this.moveCursor('up', ctx);
                break;

            case 'ArrowDown':
                this.moveCursor('down', ctx);
                break;

            case 'Home':
                this.moveCursor('home', ctx);
                break;

            case 'End':
                this.moveCursor('end', ctx);
                break;

            default:
                if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
                    this.insertText(e.key, ctx);
                }
                break;
        }
    }

    // ============= Drawing =============
    drawOverlay(ctx) {
        if (!this.isEditing || this.editingIndex === -1) return;

        const bounds = ctx.objects.getBounds(this.editingIndex);
        const extra = ctx.objects.extra[this.editingIndex];
        if (!bounds || !extra) return;

        ctx.ctx.save();

        // Draw editing frame
        ctx.ctx.strokeStyle = 'rgba(0, 102, 204, 0.8)';
        ctx.ctx.lineWidth = 2 / ctx.zoom;
        ctx.ctx.setLineDash([10 / ctx.zoom, 5 / ctx.zoom]);
        ctx.ctx.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);
        ctx.ctx.setLineDash([]);

        // Draw resize handles
        const cornerSize = 6 / ctx.zoom;
        ctx.ctx.fillStyle = '#0066cc';
        const corners = [
            [bounds.x, bounds.y],
            [bounds.x + bounds.width, bounds.y],
            [bounds.x, bounds.y + bounds.height],
            [bounds.x + bounds.width, bounds.y + bounds.height]
        ];

        corners.forEach(([x, y]) => {
            ctx.ctx.fillRect(x - cornerSize / 2, y - cornerSize / 2, cornerSize, cornerSize);
        });

        // Draw cursor
        if (this.cursorVisible) {
            this.drawCursor(ctx, bounds, extra);
        }

        ctx.ctx.restore();
    }

    drawCursor(ctx, bounds, extra) {
        const padding = extra.padding || 8;

        ctx.ctx.save();

        const layout = this.calculateUnifiedTextLayout(this.editingText, bounds, extra);

        let cursorLine = 0;
        let cursorPosInLine = 0;

        for (let i = 0; i < layout.lines.length; i++) {
            const line = layout.lines[i];
            if (this.cursorPosition >= line.startPos && this.cursorPosition <= line.endPos) {
                cursorLine = i;
                cursorPosInLine = Math.min(
                    this.cursorPosition - line.startPos,
                    line.text.length
                );
                break;
            }
        }

        if (cursorLine >= layout.lines.length) {
            cursorLine = layout.lines.length - 1;
            cursorPosInLine = layout.lines[cursorLine]?.text.length || 0;
        }

        const line = layout.lines[cursorLine];
        if (!line) {
            ctx.ctx.restore();
            return;
        }

        const textBeforeCursor = line.text.substring(0, cursorPosInLine);
        const textWidth = this._sharedContext.measureText(textBeforeCursor).width;

        const cursorX = bounds.x + padding + textWidth;
        const cursorY = bounds.y + padding + (cursorLine * layout.lineHeight);
        const cursorHeight = layout.lineHeight * 0.9;

        ctx.ctx.strokeStyle = '#000000';
        ctx.ctx.lineWidth = 1 / ctx.zoom;
        ctx.ctx.beginPath();
        ctx.ctx.moveTo(cursorX, cursorY);
        ctx.ctx.lineTo(cursorX, cursorY + cursorHeight);
        ctx.ctx.stroke();

        ctx.ctx.restore();
    }

    // ============= Utility Methods =============
    createNewText(pos, ctx) {
        const snapped = ctx.snapPosition(pos.x, pos.y);

        const defaultText = 'Text';
        const defaultFontSize = 16;
        const defaultPadding = 8;

        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        context.font = `${defaultFontSize}px Arial`;
        const metrics = context.measureText(defaultText);

        const width = metrics.width + (defaultPadding * 4) + 20;
        const height = defaultFontSize * 1.4 + (defaultPadding * 2);

        const cmd = new ctx.createCommands.CreateObjectCmd(
            ctx.objects, ctx.spatialGrid, 'text',
            snapped.x, snapped.y, width, height,
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

        ctx.objects.selectObject(index);
        ctx.updateInfo();
        ctx.updateInspector();
        ctx.updateHistoryButtons?.();
        ctx.render();

        this.isNewText = true;
        this.startEditing(index, ctx);
    }

    checkIfManuallyResized(index, ctx) {
        const extra = ctx.objects.extra[index];
        if (!extra || !extra.text) return false;

        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        context.font = `${extra.fontSize || 16}px ${extra.fontFamily || 'Arial'}`;

        const lines = extra.text.split('\n');
        let maxWidth = 0;

        for (const line of lines) {
            const metrics = context.measureText(line);
            maxWidth = Math.max(maxWidth, metrics.width);
        }

        const padding = extra.padding || 8;
        const autoWidth = maxWidth + (padding * 4) + 20;
        const autoHeight = lines.length * (extra.fontSize || 16) * (extra.lineHeight || 1.2) + (padding * 2);

        const bounds = ctx.objects.getBounds(index);
        const tolerance = 5;

        return Math.abs(bounds.width - autoWidth) > tolerance ||
            Math.abs(bounds.height - autoHeight) > tolerance;
    }

    updateTextBounds(index, ctx, text) {
        const extra = ctx.objects.extra[index];
        if (!extra) return;

        const textToMeasure = text || extra.text || '';
        if (!textToMeasure.trim()) return;

        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        context.font = `${extra.fontSize || 16}px ${extra.fontFamily || 'Arial'}`;

        const lines = textToMeasure.split('\n');
        let maxWidth = 0;

        for (const line of lines) {
            const metrics = context.measureText(line);
            maxWidth = Math.max(maxWidth, metrics.width);
        }

        const padding = extra.padding || 8;
        const newWidth = Math.max(maxWidth + (padding * 4) + 20, 60);
        const lineHeight = (extra.fontSize || 16) * (extra.lineHeight || 1.2);
        const newHeight = Math.max(lines.length * lineHeight + (padding * 2), 30);

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

    onTextBoxResized(ctx) {
        if (this.isEditing && this.editingIndex !== -1) {
            this.isManuallyResized = true;
            ctx.render();
        }
    }

    // ============= Visual Effects =============
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

    resetCursorBlink() {
        this.cursorVisible = true;
        this.startCursorBlink();
    }

    // ============= Tool Events =============
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
}

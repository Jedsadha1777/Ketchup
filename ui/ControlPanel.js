export class ControlPanel {
    constructor(editor) {
        this.editor = editor;
        this.setupButtonHandlers();
    }

    setupButtonHandlers() {
        document.getElementById('undoBtn')?.addEventListener('click', () => {
            if (this.editor.history.undo()) {
                this.editor.rebuildSpatialGrid();
                this.editor.render();
                this.editor.updateInfo();
                this.updateHistoryButtons();
            }
        });
        
        document.getElementById('redoBtn')?.addEventListener('click', () => {
            if (this.editor.history.redo()) {
                this.editor.rebuildSpatialGrid();
                this.editor.render();
                this.editor.updateInfo();
                this.updateHistoryButtons();
            }
        });

        document.getElementById('copyBtn')?.addEventListener('click', () => {
            this.editor.clipboardOps.copy();
        });
        
        document.getElementById('pasteBtn')?.addEventListener('click', () => {
            this.editor.clipboardOps.paste();
        });
        
        document.getElementById('duplicateBtn')?.addEventListener('click', () => {
            this.editor.clipboardOps.duplicate();
        });
    }

    updateHistoryButtons() {
        const undoBtn = document.getElementById('undoBtn');
        const redoBtn = document.getElementById('redoBtn');
        if (undoBtn) undoBtn.disabled = !this.editor.history.canUndo();
        if (redoBtn) redoBtn.disabled = !this.editor.history.canRedo();
    }

    updateClipboardButtons() {
        const selectedIndices = this.editor.objects.getSelectedIndices();
        const hasSelection = selectedIndices.length > 0;
        const hasClipboard = this.editor.clipboardOps.hasContent();
        
        const copyBtn = document.getElementById('copyBtn');
        const pasteBtn = document.getElementById('pasteBtn');
        const duplicateBtn = document.getElementById('duplicateBtn');
        
        if (copyBtn) {
            copyBtn.disabled = !hasSelection;
            copyBtn.style.background = hasSelection ? '#6c757d' : '#444';
        }
        
        if (pasteBtn) {
            pasteBtn.disabled = !hasClipboard;
            pasteBtn.style.background = hasClipboard ? '#6c757d' : '#444';
        }
        
        if (duplicateBtn) {
            duplicateBtn.disabled = !hasSelection;
            duplicateBtn.style.background = hasSelection ? '#6c757d' : '#444';
        }
    }
}
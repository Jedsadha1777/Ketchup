import { CreateObjectCmd } from '../core/commands/CreateObjectCmd.js';

export class ClipboardOperations {
    constructor(editor) {
        this.editor = editor;
        this.clipboard = [];
    }

    copy() {
        const selectedIndices = this.editor.objects.getSelectedIndices();
        if (selectedIndices.length === 0) return;
        
        this.clipboard = [];
        
        for (const index of selectedIndices) {
            const objData = {
                type: this.editor.objects.types[index],
                mapType: this.editor.objects.mapTypes[index],
                x: this.editor.objects.x[index],
                y: this.editor.objects.y[index],
                width: this.editor.objects.width[index],
                height: this.editor.objects.height[index],
                color: this.editor.objects.colors[index],
                label: this.editor.objects.labels[index],
                extra: this.editor.objects.extra[index] ? { ...this.editor.objects.extra[index] } : null
            };
            this.clipboard.push(objData);
        }

        
        this.editor.controlPanel.updateClipboardButtons();
    }
    
    paste() {
        if (this.clipboard.length === 0) return;
        
        // Calculate paste offset
        const PASTE_OFFSET = 20;
        
        // Clear current selection
        this.editor.objects.clearSelection();
        
        // Create commands for each object
        const newIndices = [];
        
        for (const objData of this.clipboard) {
            const newX = objData.x + PASTE_OFFSET;
            const newY = objData.y + PASTE_OFFSET;
            
            const cmd = new CreateObjectCmd(
                this.editor.objects, this.editor.spatialGrid, objData.type, 
                newX, newY, objData.width, objData.height, 
                objData.color, objData.mapType
            );
            const { id, index } = this.editor.history.exec(cmd);
            
            // Restore additional properties
            this.editor.objects.labels[index] = objData.label || '';
            if (objData.extra) {
                this.editor.objects.extra[index] = { ...objData.extra };
            }
            
            // Select the new object
            this.editor.objects.addToSelection(index);
            newIndices.push(index);
        }
        
        this.editor.render();
        this.editor.updateInfo();
        this.editor.inspectorPanel.update();
        this.editor.controlPanel.updateHistoryButtons();
    }
    
    duplicate() {
        this.copy();
        this.paste();
    }

    hasContent() {
        return this.clipboard.length > 0;
    }
}
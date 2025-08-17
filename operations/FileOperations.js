export class FileOperations {
    constructor(editor) {
        this.editor = editor;
        this.exportBtn = document.getElementById('exportBtn');
        this.importBtn = document.getElementById('importBtn');
        this.fileInput = document.getElementById('fileInput');
        
        this.setupHandlers();
    }

    setupHandlers() {
        this.exportBtn?.addEventListener('click', () => {
            this.export();
        });

        this.importBtn?.addEventListener('click', () => {
            this.fileInput.click();
        });

        this.fileInput?.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    this.import(e.target.result);
                    alert('Map imported successfully!');
                } catch (error) {
                    alert('Import failed: ' + error.message);
                }
            };
            reader.readAsText(file);
            
            // Reset file input
            this.fileInput.value = '';
        });
    }

    export() {
        try {
            const jsonData = JSON.stringify(this.editor.objects.toJSON());
            const blob = new Blob([jsonData], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = `map_${new Date().toISOString().slice(0, 19).replace(/[:-]/g, '')}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (error) {
            alert('Export failed: ' + error.message);
        }
    }

    import(jsonData) {
        const data = JSON.parse(jsonData);

        // Clear everything first
        this.editor.history.clear();
        
        // Clear spatial grid
        this.editor.spatialGrid.clear();
        
        // Load objects from JSON
        this.editor.objects.fromJSON(data);

        // Clear any selections
        this.editor.objects.selectObject(-1);
        
        // Re-index spatial grid
        for (let i = 0; i < this.editor.objects.getObjectCount(); i++) {
            const b = this.editor.objects.getBounds(i);
            this.editor.spatialGrid.addObject(this.editor.objects.getIdByIndex(i), b.x, b.y, b.width, b.height);
        }
        
        this.editor.render();
        this.editor.updateInfo();
        this.editor.inspectorPanel.update();
        this.editor.controlPanel.updateHistoryButtons();
        this.editor.controlPanel.updateClipboardButtons();

        // Reload images from imported data
        for (let i = 0; i < this.editor.objects.getObjectCount(); i++) {
            const extra = this.editor.objects.extra[i];
            if (extra && extra.src) {
                this.editor.imageManager.loadImage(extra.src).then(() => {
                    this.editor.render(); // Re-render when images load
                });
            }
        }
    }
}
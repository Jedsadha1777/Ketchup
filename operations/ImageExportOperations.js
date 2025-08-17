export class ImageExportOperations {
    constructor(editor) {
        this.editor = editor;
        this.setupUI();
    }

    setupUI() {
        // Add export image button to control panel
        const exportBtn = document.createElement('button');
        exportBtn.textContent = '📸 Export Image';
        exportBtn.style.cssText = `
            background: #28a745; 
            color: white; 
            border: none; 
            padding: 4px 8px; 
            border-radius: 3px; 
            font-size: 11px; 
            cursor: pointer; 
            margin-left: 4px;
        `;
        
        exportBtn.addEventListener('click', () => {
            this.showExportDialog();
        });

        // Add to control panel
        const controlInfo = document.querySelector('.info');
        if (controlInfo) {
            // Add to the button row
            const buttonRow = controlInfo.children[1]; // Second div with buttons
            if (buttonRow) {
                buttonRow.appendChild(exportBtn);
            }
        }
    }

    showExportDialog() {
        // Create modal dialog
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
        `;

        const dialog = document.createElement('div');
        dialog.style.cssText = `
            background: white;
            padding: 20px;
            border-radius: 8px;
            min-width: 300px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        `;

        dialog.innerHTML = `
            <h3 style="margin: 0 0 15px 0; color: #333;">Export Image</h3>
            
            <div style="margin-bottom: 12px;">
                <label style="display: block; margin-bottom: 4px; font-size: 12px; color: #666;">Format:</label>
                <select id="export-format" style="width: 100%; padding: 4px;">
                    <option value="png">PNG (Transparent)</option>
                    <option value="jpeg">JPEG</option>
                    <option value="webp">WebP</option>
                </select>
            </div>

            <div style="margin-bottom: 12px;">
                <label style="display: block; margin-bottom: 4px; font-size: 12px; color: #666;">Quality (JPEG/WebP):</label>
                <input type="range" id="export-quality" min="0.1" max="1" step="0.1" value="0.9" style="width: 100%;">
                <span id="quality-value" style="font-size: 11px; color: #666;">90%</span>
            </div>

            <div style="margin-bottom: 12px;">
                <label style="display: block; margin-bottom: 4px; font-size: 12px; color: #666;">Scale:</label>
                <select id="export-scale" style="width: 100%; padding: 4px;">
                    <option value="1">1x (Current Size)</option>
                    <option value="2" selected>2x (High Resolution)</option>
                    <option value="3">3x (Very High Resolution)</option>
                    <option value="4">4x (Print Quality)</option>
                </select>
            </div>

            <div style="margin-bottom: 15px;">
                <label style="display: flex; align-items: center; font-size: 12px; color: #666;">
                    <input type="checkbox" id="export-selected" style="margin-right: 6px;">
                    Export selected objects only
                </label>
            </div>

            <div style="margin-bottom: 15px;">
                <label style="display: flex; align-items: center; font-size: 12px; color: #666;">
                    <input type="checkbox" id="export-grid">
                    Include grid
                </label>
            </div>

            <div style="display: flex; gap: 8px; justify-content: flex-end;">
                <button id="export-cancel" style="padding: 6px 12px; border: 1px solid #ccc; background: white; border-radius: 4px; cursor: pointer;">Cancel</button>
                <button id="export-confirm" style="padding: 6px 12px; border: none; background: #28a745; color: white; border-radius: 4px; cursor: pointer;">Export</button>
            </div>
        `;

        modal.appendChild(dialog);
        document.body.appendChild(modal);

        // Update quality display
        const qualitySlider = dialog.querySelector('#export-quality');
        const qualityValue = dialog.querySelector('#quality-value');
        qualitySlider.addEventListener('input', () => {
            qualityValue.textContent = Math.round(qualitySlider.value * 100) + '%';
        });

        // Handle buttons
        dialog.querySelector('#export-cancel').addEventListener('click', () => {
            document.body.removeChild(modal);
        });

        dialog.querySelector('#export-confirm').addEventListener('click', () => {
            const options = {
                format: dialog.querySelector('#export-format').value,
                quality: parseFloat(dialog.querySelector('#export-quality').value),
                scale: parseInt(dialog.querySelector('#export-scale').value),
                selectedOnly: dialog.querySelector('#export-selected').checked,
                showGrid: dialog.querySelector('#export-grid').checked
            };
            
            document.body.removeChild(modal);
            this.exportImage(options);
        });

        // Close on background click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                document.body.removeChild(modal);
            }
        });
    }

    async exportImage(options = {}) {
        const {
            format = 'png',
            quality = 0.9,
            scale = 2,
            selectedOnly = false,
            showGrid = false
        } = options;

        try {
            // Calculate canvas bounds
            const bounds = this.calculateExportBounds(selectedOnly);
            if (!bounds) {
                alert('No objects to export');
                return;
            }

            // Create offscreen canvas
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            // Set canvas size with scale
            canvas.width = bounds.width * scale;
            canvas.height = bounds.height * scale;

            // Scale context
            ctx.scale(scale, scale);

            // Set background
            if (format !== 'png') {
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, bounds.width, bounds.height);
            }

            // Translate to render from bounds origin
            ctx.translate(-bounds.x, -bounds.y);

            // Render content
            this.renderClean(ctx, bounds, showGrid, selectedOnly);

            // Convert to blob and download
            const blob = await this.canvasToBlob(canvas, format, quality);
            this.downloadBlob(blob, `map-export.${format}`);

            console.log(`Image exported: ${bounds.width}x${bounds.height} at ${scale}x scale`);

        } catch (error) {
            console.error('Export failed:', error);
            alert('Export failed: ' + error.message);
        }
    }

    calculateExportBounds(selectedOnly) {
        const objects = this.editor.objects;
        const indices = selectedOnly 
            ? objects.getSelectedIndices()
            : Array.from({ length: objects.getObjectCount() }, (_, i) => i);

        if (indices.length === 0) return null;

        let minX = Infinity, minY = Infinity;
        let maxX = -Infinity, maxY = -Infinity;

        for (const index of indices) {
            const bounds = objects.getBounds(index);
            minX = Math.min(minX, bounds.x);
            minY = Math.min(minY, bounds.y);
            maxX = Math.max(maxX, bounds.x + bounds.width);
            maxY = Math.max(maxY, bounds.y + bounds.height);
        }

        // Add padding
        const padding = 20;
        return {
            x: minX - padding,
            y: minY - padding,
            width: maxX - minX + padding * 2,
            height: maxY - minY + padding * 2
        };
    }

    renderClean(ctx, bounds, showGrid, selectedOnly) {
        ctx.save();

        // Draw grid if requested
        if (showGrid) {
            this.drawCleanGrid(ctx, bounds);
        }

        // Draw objects
        const objects = this.editor.objects;
        const indices = selectedOnly 
            ? objects.getSelectedIndices()
            : Array.from({ length: objects.getObjectCount() }, (_, i) => i);

        for (const index of indices) {
            this.drawCleanObject(ctx, index);
        }

        ctx.restore();
    }

    drawCleanGrid(ctx, bounds) {
        const gridSize = this.editor.gridSize;
        const startX = Math.floor(bounds.x / gridSize) * gridSize;
        const startY = Math.floor(bounds.y / gridSize) * gridSize;
        const endX = bounds.x + bounds.width;
        const endY = bounds.y + bounds.height;

        ctx.strokeStyle = '#e0e0e0';
        ctx.lineWidth = 0.5;
        ctx.beginPath();

        for (let x = startX; x <= endX; x += gridSize) {
            ctx.moveTo(x, bounds.y);
            ctx.lineTo(x, bounds.y + bounds.height);
        }

        for (let y = startY; y <= endY; y += gridSize) {
            ctx.moveTo(bounds.x, y);
            ctx.lineTo(bounds.x + bounds.width, y);
        }

        ctx.stroke();
    }

    drawCleanObject(ctx, index) {
        // Create clean object data (no selection state)
        const objects = this.editor.objects;
        const obj = {
            type: objects.types[index],
            mapType: objects.mapTypes[index],
            x: objects.x[index],
            y: objects.y[index],
            width: objects.width[index],
            height: objects.height[index],
            color: objects.colors[index],
            extra: objects.extra[index]
        };

        // Create clean view state (no selection)
        const view = {
            zoom: 1, // Always 1 for export
            selected: false, // Never selected in export
            hover: false
        };

        // Use existing renderer system
        this.editor.renderers.draw(obj, ctx, view);
    }

    canvasToBlob(canvas, format, quality) {
        return new Promise((resolve) => {
            canvas.toBlob(resolve, `image/${format}`, quality);
        });
    }

    downloadBlob(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
}
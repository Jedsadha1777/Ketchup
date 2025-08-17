import { ITool } from '../types/ITool.js';

export class ImageTool extends ITool {
    constructor() {
        super('image', 'Insert Image', { 
            icon: '🖼️',
            cursor: 'crosshair'
        });
        this.fileInput = null;
        this.setupFileInput();
    }

    setupFileInput() {
        // Create hidden file input
        this.fileInput = document.createElement('input');
        this.fileInput.type = 'file';
        this.fileInput.accept = 'image/*';
        this.fileInput.style.display = 'none';
        document.body.appendChild(this.fileInput);
    }

    activate(ctx) {
        ctx.updateCursor('crosshair');
        // Show file picker when tool is activated
        this.showFilePicker(ctx);
    }

    showFilePicker(ctx) {
        this.fileInput.onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
                this.handleImageFile(file, ctx);
            }
            // Reset input
            this.fileInput.value = '';
        };
        this.fileInput.click();
    }

    handleImageFile(file, ctx) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const dataURL = e.target.result;
            
            // Create image to get dimensions
            const img = new Image();
            img.onload = () => {
                // Calculate size (max 200px
                const maxSize = 200;
                let width = img.width;
                let height = img.height;
                
                if (width > maxSize || height > maxSize) {
                    const ratio = Math.min(maxSize / width, maxSize / height);
                    width *= ratio;
                    height *= ratio;
                }

                 // แก้: ใช้ getBoundingClientRect เพื่อให้ได้ขนาดจริงของ canvas
                const canvasRect = ctx.ctx.canvas.getBoundingClientRect();
                const screenCenterX = canvasRect.width / 2;
                const screenCenterY = canvasRect.height / 2;
                // แปลงจาก screen coordinates เป็น world coordinates
                const centerX = (screenCenterX - ctx.panX) / ctx.zoom - width / 2;
                const centerY = (screenCenterY - ctx.panY) / ctx.zoom - height / 2;

                // Snap to grid if enabled
                let x = centerX;
                let y = centerY;
                if (ctx.snapEnabled) {
                    const snapped = ctx.snapPosition(x, y);
                    x = snapped.x;
                    y = snapped.y;
                }

                // Create image object with command
                const cmd = new ctx.createCommands.CreateObjectCmd(
                    ctx.objects, ctx.spatialGrid, 'image', x, y, width, height, '#000000', 'image'
                );
                const { id, index } = ctx.history.exec(cmd);

                // Set image data in extra field
                ctx.objects.extra[index] = {
                    src: dataURL,
                    opacity: 1.0,
                    fit: 'contain'
                };

                // Load image into cache
                ctx.imageManager.loadImage(dataURL).then(() => {
                    ctx.render(); // Re-render when image loads
                });

                ctx.objects.selectObject(index);
                ctx.updateInfo();
                ctx.updateInspector();
                ctx.updateClipboardButtons?.(); 
                ctx.updateHistoryButtons?.();

                 // Switch to select tool after placing image
                ctx.useTool('select');
                ctx.render();
            };
            img.src = dataURL;
        };
        reader.readAsDataURL(file);
    }

    onPointerDown(e, pos, ctx) {
        // Show file picker when clicking on canvas
        this.showFilePicker(ctx);
    }
}
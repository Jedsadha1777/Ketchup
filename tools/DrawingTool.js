import { ITool } from '../types/ITool.js';

export class DrawingTool extends ITool {
    constructor(id, title, shapeType, color, mapType, options = {}) {
        super(id, title, { ...options, cursor: 'crosshair' });
        this.shapeType = shapeType;
        this.color = color;
        this.mapType = mapType;
        this.isDrawing = false;
        this.startX = 0;
        this.startY = 0;
        this.enableResizeMode = false;
        this.createdObjectIndex = -1;

        this.isResizing = false;
        this.isDragging = false;
        this.resizeHandle = null;
        this.dragOffset = { x: 0, y: 0 };
    }

    activate(ctx) {
        ctx.updateCursor(this.cursor);
    }

    onPointerDown(e, pos, ctx) {
       if (this.enableResizeMode && this.createdObjectIndex !== -1) {
           const hoveredIndex = ctx.getObjectAt(pos.x, pos.y);
           if (hoveredIndex === this.createdObjectIndex) {
               // Check if clicking on resize handle
               const bounds = ctx.objects.getBounds(hoveredIndex);
               const handle = ctx.getHandleAtPoint(bounds, pos.x, pos.y);
               
               if (handle) {
                   this.isResizing = true;
                   this.resizeHandle = handle;
               } else {
                   this.isDragging = true;
                   this.dragOffset.x = pos.x - ctx.objects.x[hoveredIndex];
                   this.dragOffset.y = pos.y - ctx.objects.y[hoveredIndex];
               }
               
               // Delegate to select tool
               const selectTool = ctx.tools?.get('select');
               if (selectTool) {
                   selectTool.onPointerDown(e, pos, ctx);
               }
               return;
           } else {
               // Clicked elsewhere, disable resize mode
               this.enableResizeMode = false;
               this.createdObjectIndex = -1;
           }
       }
       
       // Normal drawing behavior
       this.isDrawing = true;
       this.startX = pos.x;
       this.startY = pos.y;
   }

    onPointerMove(e, pos, ctx) {
        // Always set fallback cursor first
        let newCursor = this.cursor;

        if (this.isDrawing) {
            ctx.render();
            this.previewData = { x: this.startX, y: this.startY, width: pos.x - this.startX, height: pos.y - this.startY };
        
        } else if (this.isResizing && this.createdObjectIndex !== -1) {
            // Handle resize dragging
            const selectTool = ctx.tools?.get('select');
            if (selectTool) {
                selectTool.onPointerMove(e, pos, ctx);
            }
            
        } else if (this.isDragging && this.createdObjectIndex !== -1) {
            // Handle object dragging
            const selectTool = ctx.tools?.get('select');
            if (selectTool) {
                selectTool.onPointerMove(e, pos, ctx);
            }
        } else if (this.enableResizeMode && this.createdObjectIndex !== -1) {
            // Check if hovering over the newly created object
            const hoveredIndex = ctx.getObjectAt(pos.x, pos.y);
            if (hoveredIndex === this.createdObjectIndex && ctx.objects.canResize(hoveredIndex)) {
                const bounds = ctx.objects.getBounds(hoveredIndex);
                const handle = ctx.getHandleAtPoint(bounds, pos.x, pos.y);
                if (handle) {
                    newCursor = ctx.getCursorForHandle(handle);
                } else {
                    newCursor = 'move';
                }           
            }
            ctx.updateCursor(newCursor);

         }
    }

    onPointerUp(e, pos, ctx) {
        if (this.isDrawing) {
            this.createObject(ctx, pos);
            this.isDrawing = false;
            this.previewData = null;
            ctx.updateInfo();
        }
         else if (this.isResizing || this.isDragging) {
            // Handle resize/drag end
            const selectTool = ctx.tools?.get('select');
            if (selectTool) {
                selectTool.onPointerUp(e, pos, ctx);
            }
            this.isResizing = false;
            this.isDragging = false;
            this.resizeHandle = null;
         }
    }

    createObject(ctx, pos) {
        const width = pos.x - this.startX;
        const height = pos.y - this.startY;
        
        if (Math.abs(width) > 5 && Math.abs(height) > 5) {
            let x = Math.min(this.startX, pos.x);
            let y = Math.min(this.startY, pos.y);
            let w = Math.abs(width);
            let h = Math.abs(height);

            if (ctx.snapEnabled) {
                const snappedPos = ctx.snapPosition(x, y);
                const snappedEnd = ctx.snapPosition(x + w, y + h);
                x = snappedPos.x;
                y = snappedPos.y;
                w = snappedEnd.x - x;
                h = snappedEnd.y - y;
            }

            // Use command for create
            const cmd = new ctx.createCommands.CreateObjectCmd(
                ctx.objects, ctx.spatialGrid, this.shapeType, x, y, w, h, this.color, this.mapType
            );
            const { id, index } = ctx.history.exec(cmd);

            ctx.objects.selectObject(index);
            ctx.updateHistoryButtons?.();
            ctx.updateInspector();
            ctx.updateClipboardButtons?.();

            this.enableResizeMode = true;
            this.createdObjectIndex = index;
        }
    }

    drawOverlay(ctx) {
        // Draw preview during drawing
        if (this.isDrawing && this.previewData) {
            this.drawPreview(ctx, this.previewData.x, this.previewData.y, this.previewData.width, this.previewData.height);
        }

        // Draw resize handles for newly created object
        if (this.enableResizeMode && this.createdObjectIndex !== -1 && ctx.objects.canResize(this.createdObjectIndex)) {
            const bounds = ctx.objects.getBounds(this.createdObjectIndex);
            ctx.drawResizeHandles(bounds);
         }
    }

    drawPreview(ctx, x, y, width, height) {
        
        ctx.ctx.fillStyle = this.color.includes('rgba') ? this.color : this.color + '80';
        ctx.ctx.strokeStyle = this.color;
        ctx.ctx.lineWidth = 1 / ctx.zoom;

        if (this.shapeType === 'circle') {
            ctx.ctx.beginPath();
            ctx.ctx.arc(x + width/2, y + height/2, Math.min(Math.abs(width), Math.abs(height))/2, 0, Math.PI * 2);
            ctx.ctx.fill();
            ctx.ctx.stroke();
        } else {
            ctx.ctx.fillRect(x, y, width, height);
            ctx.ctx.strokeRect(x, y, width, height);
        }
    }

     onKeyDown(e, ctx) {
        if (e.key === 'Escape') {
            // Exit resize mode
            this.enableResizeMode = false;
            this.createdObjectIndex = -1;
            this.isResizing = false;
            this.isDragging = false;
            ctx.updateCursor(this.cursor);
            ctx.render();
            return true; // Event handled, don't let global handler process
        }
        return false; // Event not handled
     }
}
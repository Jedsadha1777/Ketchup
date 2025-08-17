import { ITool } from '../types/ITool.js';

export class SelectTool extends ITool {
    constructor() {
        super('select', 'Select', { 
            icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" fill="#e3e3e3" width="16" height="16"><path d="m320-410 79-110h170L320-716v306ZM551-80 406-392 240-160v-720l560 440H516l144 309-109 51ZM399-520Z"></path></svg>',
            cursor: 'default'
        });
        this.isDragging = false;
        this.isResizing = false;
        this.resizeHandle = null;
        this.resizeStartBounds = null;
        this.dragOffsetX = 0;
        this.dragOffsetY = 0;
        this.startMovePos = null;
        this.startResizeBounds = null;
        this.resizeObjectId = null;

        this.multiDragCommands = new Map(); // objectId -> {startPos, currentPos}
        this.primaryDragObjectId = null;


        // Selection box
        this.isSelectionBoxing = false;
        this.selectionBoxStart = { x: 0, y: 0 };
        this.selectionBoxEnd = { x: 0, y: 0 };
        this.multiDragStartPositions = new Map();
        this.snapDeltaX = undefined;
        this.snapDeltaY = undefined;
    }

    activate(ctx) {
        ctx.updateCursor('default');
    }

    onPointerDown(e, pos, ctx) {
        const selectedIndex = ctx.objects.getSelected();
        const isCtrlClick = e.ctrlKey || e.metaKey;
        const isDoubleClick = e.detail === 2;

        // Check if clicking on any selected object first
        const clickedIndex = ctx.getObjectAt(pos.x, pos.y);
        const selectedIndices = ctx.objects.getSelectedIndices();

        // Handle double-click for text editing
        if (isDoubleClick && clickedIndex !== -1 && ctx.objects.types[clickedIndex] === 'text') {
            const textTool = ctx.tools.get('text');
            if (textTool) {
                ctx.objects.selectObject(clickedIndex);
                
                // Switch to text tool and start editing
                ctx.useTool('text');
                const currentTextTool = ctx.tools.get('text');
                currentTextTool.wasAutoSwitched = true; // ตั้ง flag
               currentTextTool.startEditing(clickedIndex, ctx);

                return;
            }
        }

        // Commit any pending resize operation before changing selection
        if (this.isResizing && this.resizeObjectId && this.resizeStartBounds) {
            const currentSelectedIndex = ctx.objects.getSelected();
            if (currentSelectedIndex !== -1) {
                const finalBounds = ctx.objects.getBounds(currentSelectedIndex);
                const cmd = new ctx.createCommands.ResizeObjectCmd(
                    ctx.objects, ctx.spatialGrid, this.resizeObjectId,
                    this.resizeStartBounds, finalBounds
                );
                ctx.history.exec(cmd);
                ctx.updateHistoryButtons?.();
            }
            
            // Reset resize state
            this.isResizing = false;
            this.resizeHandle = null;
            this.resizeStartBounds = null;
            this.resizeObjectId = null;
        }
                

         // 1) Check resize handles first
        if (selectedIndex !== -1 && ctx.objects.canResize(selectedIndex) && !ctx.objects.hasMultipleSelected()) {
            const bounds = ctx.objects.getBounds(selectedIndex);
            const handle = ctx.getHandleAtPoint(bounds, pos.x, pos.y);
            if (handle) {
                this.isResizing = true;
                this.resizeHandle = handle;
                this.resizeStartBounds = { ...bounds };
                this.resizeObjectId = ctx.objects.getIdByIndex(selectedIndex);

                ctx.updateCursor(ctx.getCursorForHandle(handle));
                ctx.render();
                return;
            }
        }

        // 2) Check object selection/drag        
        if (clickedIndex !== -1) {     
            
            // Handle selection logic
            if (isCtrlClick) {
                ctx.objects.toggleSelection(clickedIndex);
            } else if (!selectedIndices.includes(clickedIndex)) {
            // Only change selection if clicked object is not already selected
                ctx.objects.selectObject(clickedIndex);
            }
            // If clicked object is already in selection and not Ctrl+Click, keep current selection
            
            ctx.updateClipboardButtons?.();
           // Start dragging
           this.isDragging = true;
            ctx.updateInspector();

            // Clear previous multi-drag data
            this.multiDragCommands.clear();

            // Store original positions for multi-drag (get updated selectedIndices)
            const updatedSelectedIndices = ctx.objects.getSelectedIndices();
            this.multiDragStartPositions.clear();
            for (const index of updatedSelectedIndices) {

                const objId = ctx.objects.getIdByIndex(index);
                const startPos = { x: ctx.objects.x[index], y: ctx.objects.y[index] };
                this.multiDragStartPositions.set(index, startPos);
                // Store command data for each object
                this.multiDragCommands.set(objId, {
                    startPos: { ...startPos },
                    currentPos: { ...startPos }
                });

            }

            this.dragOffsetX = pos.x - ctx.objects.x[clickedIndex];
            this.dragOffsetY = pos.y - ctx.objects.y[clickedIndex];
            ctx.updateCursor('move');
            this.primaryDragObjectId = ctx.objects.getIdByIndex(clickedIndex);


            // Reset snap delta (no snapping for multi-drag to maintain relative positions)
           this.snapDeltaX = 0;
           this.snapDeltaY = 0;

            ctx.render();
            return;
        } else if (!isCtrlClick) {
            // Start selection box
            this.isSelectionBoxing = true;
            this.selectionBoxStart = { x: pos.x, y: pos.y };
            this.selectionBoxEnd = { x: pos.x, y: pos.y };
        }

        // 3) Clear selection
        ctx.objects.selectObject(-1);
        ctx.updateCursor('default');
        ctx.updateInspector();
        ctx.updateClipboardButtons?.();
        ctx.render();
    }

    onPointerMove(e, pos, ctx) {
        if (!this.isDragging && !this.isResizing) {

            if (this.isSelectionBoxing) {
                // Update selection box
                this.selectionBoxEnd = { x: pos.x, y: pos.y };
                ctx.render();
                return;
            }

            const selectedIndex = ctx.objects.getSelected();
            let newCursor = 'default';

            // Don't show resize handles for multi-selection
            if (ctx.objects.hasMultipleSelected()) {
                const hoveredIndex = ctx.getObjectAt(pos.x, pos.y);
                const selectedIndices = ctx.objects.getSelectedIndices();
                if (hoveredIndex !== -1 && selectedIndices.includes(hoveredIndex)) {
                    newCursor = 'move';
                }
                ctx.updateCursor(newCursor);
                return;
            }

            // Check resize handles
            if (selectedIndex !== -1 && ctx.objects.canResize(selectedIndex)) {
                const bounds = ctx.objects.getBounds(selectedIndex);
                const handle = ctx.getHandleAtPoint(bounds, pos.x, pos.y);
                if (handle) {

                    newCursor = ctx.getCursorForHandle(handle);
                } else {

                    // Use renderer system for hit testing
                    const obj = {
                        type: ctx.objects.types[selectedIndex],
                        mapType: ctx.objects.mapTypes[selectedIndex],
                        x: ctx.objects.x[selectedIndex],
                        y: ctx.objects.y[selectedIndex],
                        width: ctx.objects.width[selectedIndex],
                        height: ctx.objects.height[selectedIndex],
                        extra: ctx.objects.extra[selectedIndex]
                    };
                    if (ctx.renderers.contains(obj, pos.x, pos.y)) {
                       newCursor = 'move';
                    }
                }
            } else {
                const hoveredIndex = ctx.getObjectAt(pos.x, pos.y);
                if (hoveredIndex !== -1) {
                    newCursor = 'move';
                }
            }


            ctx.updateCursor(newCursor);
        }

        if (this.isDragging) {
            // Handle multi-object drag
            this.handleMultiDrag(pos, ctx);
            
        } else if (this.isResizing) {
            // แค่อัปเดตตำแหน่งโดยตรง ไม่ใช้ command ระหว่าง drag
            const selectedIndex = ctx.objects.getSelected();
            if (selectedIndex !== -1) {

                const id = ctx.objects.getIdByIndex(selectedIndex);

                // Remove from spatial grid at old bounds
                const oldBounds = ctx.objects.getBounds(selectedIndex);
                ctx.spatialGrid.removeObject(id, oldBounds.x, oldBounds.y, oldBounds.width, oldBounds.height);
                

                const newBounds = ctx.calculateResize(this.resizeHandle, this.resizeStartBounds, pos);   
                ctx.objects.setBounds(selectedIndex, newBounds);

                 // Add to spatial grid at new bounds
                ctx.spatialGrid.addObject(id, newBounds.x, newBounds.y, newBounds.width, newBounds.height);
         
                ctx.addDirtyRect(newBounds);
                ctx.render();
                ctx.updateInspector();
            }
        }
    }

    onPointerUp(e, pos, ctx) {

         if (this.isSelectionBoxing) {
            // Finish selection box
            this.finishSelectionBox(ctx);
            this.isSelectionBoxing = false;
            ctx.render();
            return;
        }

        if (this.isResizing || this.isDragging) {

            // Handle multi-object move command
            if (this.isDragging) {
                this.finishMultiDrag(ctx);
            }

            const selectedIndex = ctx.objects.getSelected();
            if (selectedIndex !== -1) {
                // Use renderer system for hit testing
                const obj = {
                    type: ctx.objects.types[selectedIndex],
                    mapType: ctx.objects.mapTypes[selectedIndex],
                    x: ctx.objects.x[selectedIndex],
                    y: ctx.objects.y[selectedIndex],
                    width: ctx.objects.width[selectedIndex],
                    height: ctx.objects.height[selectedIndex],
                    extra: ctx.objects.extra[selectedIndex]
                };
                if (ctx.renderers.contains(obj, pos.x, pos.y)) {
                   ctx.updateCursor('move');
                } else {
                    ctx.updateCursor('default');
                 }
            } else {
                ctx.updateCursor('default');
            }
        }

        
         // Handle resize command
        if (this.isResizing && this.resizeObjectId && this.resizeStartBounds) {
            const selectedIndex = ctx.objects.getSelected();
            if (selectedIndex !== -1) {
                const finalBounds = ctx.objects.getBounds(selectedIndex);
                const cmd = new ctx.createCommands.ResizeObjectCmd(
                    ctx.objects, ctx.spatialGrid, this.resizeObjectId,
                    this.resizeStartBounds, finalBounds
                );
                ctx.history.exec(cmd);
                ctx.updateHistoryButtons?.();
            }
        }


        this.isDragging = false;
        this.isResizing = false;
        this.resizeHandle = null;
        this.resizeStartBounds = null;
      
        this.resizeObjectId = null;
        this.primaryDragObjectId = null;
        this.multiDragStartPositions.clear();
        this.multiDragCommands.clear();


    }

    handleMultiDrag(pos, ctx) {
        const selectedIndices = ctx.objects.getSelectedIndices();
        if (selectedIndices.length === 0) return;
        
        const primaryIndex = ctx.objects.getIndexById(this.primaryDragObjectId);
       const newX = pos.x - this.dragOffsetX;
        const newY = pos.y - this.dragOffsetY;        
        
        // Calculate offset from original position (without snapping first)
        const primaryStartPos = this.multiDragStartPositions.get(primaryIndex);
        if (!primaryStartPos) return;
       
        const deltaX = newX - primaryStartPos.x;
        const deltaY = newY - primaryStartPos.y;
        // Apply snapping to primary object, then move all others by the same delta
        let finalDeltaX = deltaX;
        let finalDeltaY = deltaY;
        
        if (ctx.snapEnabled) {
            const snappedPos = ctx.snapPosition(newX, newY);
            finalDeltaX = snappedPos.x - primaryStartPos.x;
            finalDeltaY = snappedPos.y - primaryStartPos.y;
        }
        
        // Move all selected objects
        for (const index of selectedIndices) {
            const id = ctx.objects.getIdByIndex(index);
            const oldBounds = ctx.objects.getBounds(index);
            const originalPos = this.multiDragStartPositions.get(index);

            if (!originalPos) continue;

            // Calculate new position based on original position + delta            
            let newPos = {
                x: originalPos.x + finalDeltaX,
                y: originalPos.y + finalDeltaY
            };

            // Remove from spatial grid
            ctx.spatialGrid.removeObject(id, oldBounds.x, oldBounds.y, oldBounds.width, oldBounds.height);
            
           
            ctx.objects.updateObject(index, newPos);

            // Update command data
            if (this.multiDragCommands.has(id)) {
                this.multiDragCommands.get(id).currentPos = { ...newPos };
            }
            
            // Add back to spatial grid
            ctx.spatialGrid.addObject(id, newPos.x, newPos.y, oldBounds.width, oldBounds.height);
            
            ctx.addDirtyRect(ctx.objects.getBounds(index));
        }
        
        ctx.render();
        ctx.updateInspector();
    }
    
    finishMultiDrag(ctx) {
        // Create move commands for all moved objects
        for (const [objectId, commandData] of this.multiDragCommands) {
            const { startPos, currentPos } = commandData;
            // Only create command if object actually moved
            if (startPos.x !== currentPos.x || startPos.y !== currentPos.y) {
                const cmd = new ctx.createCommands.MoveObjectCmd(
                    ctx.objects, ctx.spatialGrid, objectId, startPos, currentPos
                );
                ctx.history.exec(cmd);
            }
        }
        ctx.updateHistoryButtons?.();
    }
    
    finishSelectionBox(ctx) {
        const startX = Math.min(this.selectionBoxStart.x, this.selectionBoxEnd.x);
        const startY = Math.min(this.selectionBoxStart.y, this.selectionBoxEnd.y);
        const endX = Math.max(this.selectionBoxStart.x, this.selectionBoxEnd.x);
        const endY = Math.max(this.selectionBoxStart.y, this.selectionBoxEnd.y);
        
        const width = endX - startX;
        const height = endY - startY;
        
        // Only process if selection box is big enough
        if (width > 5 && height > 5) {
            ctx.objects.clearSelection();
            
            // Check which objects intersect with selection box
            for (let i = 0; i < ctx.objects.getObjectCount(); i++) {
                const bounds = ctx.objects.getBounds(i);
                
                // Check if object intersects with selection box
                if (bounds.x < endX && bounds.x + bounds.width > startX &&
                    bounds.y < endY && bounds.y + bounds.height > startY) {
                    ctx.objects.addToSelection(i);
                }
            }
            
            ctx.updateInspector();
            ctx.updateClipboardButtons?.();
        } else {
            
            ctx.objects.clearSelection();
            ctx.updateInspector();
            ctx.updateClipboardButtons?.();
        }
    }

    onKeyDown(e, ctx) {
        if (e.key === 'Delete') {
            const selectedIndices = ctx.objects.getSelectedIndices();
            if (selectedIndices.length > 0) {
                // Delete from highest index to lowest to maintain indices
                selectedIndices.sort((a, b) => b - a);
                for (const index of selectedIndices) {
                    ctx.deleteObject(index);
                }
                ctx.updateInspector();
                return true; // Event handled
             }
        }
        return false; // Event not handled

    }

    drawOverlay(ctx) {

        // Draw selection box
        if (this.isSelectionBoxing) {
            const startX = Math.min(this.selectionBoxStart.x, this.selectionBoxEnd.x);
            const startY = Math.min(this.selectionBoxStart.y, this.selectionBoxEnd.y);
            const width = Math.abs(this.selectionBoxEnd.x - this.selectionBoxStart.x);
            const height = Math.abs(this.selectionBoxEnd.y - this.selectionBoxStart.y);
            
            ctx.ctx.strokeStyle = '#0066cc';
            ctx.ctx.fillStyle = 'rgba(0, 102, 204, 0.1)';
            ctx.ctx.lineWidth = 1 / ctx.zoom;
            ctx.ctx.setLineDash([5 / ctx.zoom, 5 / ctx.zoom]);
            
            ctx.ctx.fillRect(startX, startY, width, height);
            ctx.ctx.strokeRect(startX, startY, width, height);
            ctx.ctx.setLineDash([]);
        }

        // Draw resize handles for selected object
        const selectedIndex = ctx.objects.getSelected();
        if (selectedIndex !== -1 && ctx.objects.canResize(selectedIndex) && !ctx.objects.hasMultipleSelected()) {
            const bounds = ctx.objects.getBounds(selectedIndex);
            ctx.drawResizeHandles(bounds);
        }

        // Draw selection indicators for multi-select
        if (ctx.objects.hasMultipleSelected()) {
            const selectedIndices = ctx.objects.getSelectedIndices();
            ctx.ctx.strokeStyle = '#0066cc';
            ctx.ctx.lineWidth = 2 / ctx.zoom;
            ctx.ctx.setLineDash([5 / ctx.zoom, 5 / ctx.zoom]);
            
            for (const index of selectedIndices) {
                const bounds = ctx.objects.getBounds(index);
                ctx.ctx.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);
            }
            
            ctx.ctx.setLineDash([]);
        }
    }
}

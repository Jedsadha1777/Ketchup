export class CanvasEngine {
    constructor(canvas, options = {}) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.handleSizePx = options.handleSizePx ?? 12;
        
        // Core properties
        this.zoom = 1;
        this.panX = 0;
        this.panY = 0;
        this.dpr = window.devicePixelRatio || 1;
        
        // Grid snapping
        this.gridSize = options.gridSize || 20;
        this.snapEnabled = options.snapEnabled !== false;
        
        // Interaction states
        this.isDragging = false;
        this.isDrawing = false;
        this.isPanning = false;
        this.isResizing = false;
        this.resizeHandle = null;
        this.resizeStartBounds = null;
        
        this.startX = 0;
        this.startY = 0;
        this.dragOffsetX = 0;
        this.dragOffsetY = 0;

         // Event system for plugins
        this.eventListeners = new Map();

        this.setupCoreEventListeners();
        this.setCanvasSize();
    }

    // Simple event system
    emit(eventName, data) {
        const listeners = this.eventListeners.get(eventName) || [];
        listeners.forEach(listener => {
            try {
                listener(data);
            } catch (error) {
                console.error(`Error in event listener for ${eventName}:`, error);
            }
        });
    }

    on(eventName, listener) {
        if (!this.eventListeners.has(eventName)) {
            this.eventListeners.set(eventName, []);
        }
        this.eventListeners.get(eventName).push(listener);
    }

    off(eventName, listener) {
        const listeners = this.eventListeners.get(eventName);
        if (listeners) {
            const index = listeners.indexOf(listener);
            if (index > -1) {
                listeners.splice(index, 1);
            }
        }
    }

    init() {
        this.render();
    }

    setCanvasSize() {
        const container = this.canvas.parentElement;
        const rect = container.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        
        // Set actual size in memory (scaled up for DPR)
        this.canvas.width = Math.floor(rect.width * dpr);
        this.canvas.height = Math.floor(rect.height * dpr);
        
        // Set display size (CSS pixels)
        this.canvas.style.width = rect.width + 'px';
        this.canvas.style.height = rect.height + 'px';
        
        // Scale context to match device pixel ratio
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        
        // Store DPR for use in other methods
        this.dpr = dpr;
    }

    resizeCanvas() {
        this.setCanvasSize();
        this.render();
    }

    setupCoreEventListeners() {
        this.canvas.addEventListener('mousedown', this.onMouseDown.bind(this));
        this.canvas.addEventListener('mousemove', this.onMouseMove.bind(this));
        this.canvas.addEventListener('mouseup', this.onMouseUp.bind(this));
        this.canvas.addEventListener('wheel', this.onWheel.bind(this));

        this.canvas.addEventListener('dragstart', (e) => e.preventDefault());
        this.canvas.addEventListener('selectstart', (e) => e.preventDefault());

        document.addEventListener('keydown', (e) => {
            if (e.key === 'g' || e.key === 'G') {
                this.snapEnabled = !this.snapEnabled;
                this.onSnapToggle?.();
            }
        });

        document.addEventListener('mouseup', () => {
            if (this.isDragging || this.isDrawing || this.isPanning || this.isResizing) {
                this.resetAllStates();
            }
        });

        window.addEventListener('resize', this.resizeCanvas.bind(this));
    }

    resetAllStates() {
        this.isDragging = false;
        this.isDrawing = false;
        this.isPanning = false;
        this.isResizing = false;
        this.resizeHandle = null;
        this.resizeStartBounds = null;
        this.render();
    }

    snapPosition(x, y) {
        if (!this.snapEnabled) return { x, y };
        return {
            x: Math.round(x / this.gridSize) * this.gridSize,
            y: Math.round(y / this.gridSize) * this.gridSize
        };
    }

    screenToCanvas(screenX, screenY) {
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: (screenX - rect.left - this.panX) / this.zoom,
            y: (screenY - rect.top - this.panY) / this.zoom
        };
    }

    onMouseDown(e) {
        if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) {
            e.preventDefault();
            e.stopPropagation();
            return;
        }
        
        const pos = this.screenToCanvas(e.clientX, e.clientY);
        this.startX = pos.x;
        this.startY = pos.y;

        this.handleMouseDown?.(e, pos);
    }

    onMouseMove(e) {
        if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) {
            this.resetAllStates();
            return;
        }

        if ((this.isDragging || this.isResizing) && e.buttons === 0) {
            this.resetAllStates();
            return;
        }
        
        const pos = this.screenToCanvas(e.clientX, e.clientY);
        this.handleMouseMove?.(e, pos);
    }

    onMouseUp(e) {
        const pos = this.screenToCanvas(e.clientX, e.clientY);
        this.handleMouseUp?.(e, pos);
        this.resetAllStates();
    }

    onWheel(e) {
        e.preventDefault();
        const rect = this.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
        const newZoom = Math.max(0.1, Math.min(5, this.zoom * zoomFactor));

        this.panX = mouseX - (mouseX - this.panX) * (newZoom / this.zoom);
        this.panY = mouseY - (mouseY - this.panY) * (newZoom / this.zoom);
        this.zoom = newZoom;

        this.onZoomChange?.();
        this.render();
    }

    // Resize utilities
    getResizeHandles(bounds) {
        const { x, y, width, height } = bounds;        
        const handleSize = this.handleSizePx / this.zoom;
        
        return {
            nw: { x: x - handleSize/2, y: y - handleSize/2, width: handleSize, height: handleSize },
            ne: { x: x + width - handleSize/2, y: y - handleSize/2, width: handleSize, height: handleSize },
            sw: { x: x - handleSize/2, y: y + height - handleSize/2, width: handleSize, height: handleSize },
            se: { x: x + width - handleSize/2, y: y + height - handleSize/2, width: handleSize, height: handleSize },
            n:  { x: x + width/2 - handleSize/2, y: y - handleSize/2, width: handleSize, height: handleSize },
            s:  { x: x + width/2 - handleSize/2, y: y + height - handleSize/2, width: handleSize, height: handleSize },
            e:  { x: x + width - handleSize/2, y: y + height/2 - handleSize/2, width: handleSize, height: handleSize },
            w:  { x: x - handleSize/2, y: y + height/2 - handleSize/2, width: handleSize, height: handleSize }
        };
    }

    getHandleAtPoint(bounds, px, py) {
        const handles = this.getResizeHandles(bounds);
        
        for (const [handleName, handle] of Object.entries(handles)) {
            if (px >= handle.x && px <= handle.x + handle.width &&
                py >= handle.y && py <= handle.y + handle.height) {
                return handleName;
            }
        }
        return null;
    }

    calculateResize(handle, startBounds, currentPos) {
        const { x: startX, y: startY, width: startW, height: startH } = startBounds;
        const snappedPos = this.snapPosition(currentPos.x, currentPos.y);
        const snappedX = snappedPos.x;
        const snappedY = snappedPos.y;
        
        let newBounds = { ...startBounds };
        
        switch (handle) {
            case 'nw':
                newBounds.x = Math.min(snappedX, startX + startW - 10);
                newBounds.y = Math.min(snappedY, startY + startH - 10);
                newBounds.width = startX + startW - newBounds.x;
                newBounds.height = startY + startH - newBounds.y;
                break;
            case 'ne':
                newBounds.y = Math.min(snappedY, startY + startH - 10);
                newBounds.width = Math.max(snappedX - startX, 10);
                newBounds.height = startY + startH - newBounds.y;
                break;
            case 'sw':
                newBounds.x = Math.min(snappedX, startX + startW - 10);
                newBounds.width = startX + startW - newBounds.x;
                newBounds.height = Math.max(snappedY - startY, 10);
                break;
            case 'se':
                newBounds.width = Math.max(snappedX - startX, 10);
                newBounds.height = Math.max(snappedY - startY, 10);
                break;
            case 'n':
                newBounds.y = Math.min(snappedY, startY + startH - 10);
                newBounds.height = startY + startH - newBounds.y;
                break;
            case 's':
                newBounds.height = Math.max(snappedY - startY, 10);
                break;
            case 'e':
                newBounds.width = Math.max(snappedX - startX, 10);
                break;
            case 'w':
                newBounds.x = Math.min(snappedX, startX + startW - 10);
                newBounds.width = startX + startW - newBounds.x;
                break;
        }
        
        return newBounds;
    }

    drawResizeHandles(bounds) {
        const handles = this.getResizeHandles(bounds);
        
        // Draw in world space (using current transform)
        this.ctx.fillStyle = '#ffffff';
        this.ctx.strokeStyle = '#0066cc';
        this.ctx.lineWidth = 2 / this.zoom;
        
        // Add shadow effect
        this.ctx.save();
        this.ctx.shadowColor = 'rgba(0, 0, 0, 0.15)';
        this.ctx.shadowBlur = 4 / this.zoom;
        this.ctx.shadowOffsetX = 0;
        this.ctx.shadowOffsetY = 2 / this.zoom;
        
        for (const handle of Object.values(handles)) {
            // Draw white square with blue border
            this.ctx.fillRect(handle.x, handle.y, handle.width, handle.height);
            this.ctx.strokeRect(handle.x, handle.y, handle.width, handle.height);
        }
        
        // Reset shadow
        this.ctx.shadowColor = 'transparent';
        this.ctx.shadowBlur = 0;
        this.ctx.shadowOffsetX = 0;
        this.ctx.shadowOffsetY = 0;
        this.ctx.restore();
    }

    drawGrid() {
        const startX = Math.floor(-this.panX / this.zoom / this.gridSize) * this.gridSize;
        const startY = Math.floor(-this.panY / this.zoom / this.gridSize) * this.gridSize;
        const endX = startX + (this.canvas.width / this.zoom) + this.gridSize;
        const endY = startY + (this.canvas.height / this.zoom) + this.gridSize;

        this.ctx.strokeStyle = this.snapEnabled ? '#bbb' : '#eee';
        this.ctx.lineWidth = 0.5 / this.zoom;
        this.ctx.beginPath();

        for (let x = startX; x <= endX; x += this.gridSize) {
            this.ctx.moveTo(x, startY);
            this.ctx.lineTo(x, endY);
        }

        for (let y = startY; y <= endY; y += this.gridSize) {
            this.ctx.moveTo(startX, y);
            this.ctx.lineTo(endX, y);
        }

        this.ctx.stroke();

        if (this.zoom > 0.5) {
            const majorGridSize = this.gridSize * 5;
            const majorStartX = Math.floor(-this.panX / this.zoom / majorGridSize) * majorGridSize;
            const majorStartY = Math.floor(-this.panY / this.zoom / majorGridSize) * majorGridSize;
            const majorEndX = majorStartX + (this.canvas.width / this.zoom) + majorGridSize;
            const majorEndY = majorStartY + (this.canvas.height / this.zoom) + majorGridSize;

            this.ctx.strokeStyle = this.snapEnabled ? '#999' : '#ddd';
            this.ctx.lineWidth = 1 / this.zoom;
            this.ctx.beginPath();

            for (let x = majorStartX; x <= majorEndX; x += majorGridSize) {
                this.ctx.moveTo(x, majorStartY);
                this.ctx.lineTo(x, majorEndY);
            }

            for (let y = majorStartY; y <= majorEndY; y += majorGridSize) {
                this.ctx.moveTo(majorStartX, y);
                this.ctx.lineTo(majorEndX, y);
            }

            this.ctx.stroke();
        }
    }

    render() {
        // Clear with DPR consideration
        this.ctx.save();
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.restore();
        
        // Apply DPR scale first, then world transforms
        this.ctx.save();
        this.ctx.scale(this.zoom, this.zoom);
        this.ctx.translate(this.panX / this.zoom, this.panY / this.zoom);

        this.drawGrid();
        this.drawContent?.();

        this.ctx.restore();
    }
}
// runtime/RuntimeViewer.js
import { CanvasEngine } from '../core/CanvasEngine.js';
import { ObjectManager } from '../core/ObjectManager.js';
import { PropertyEventManager } from '../core/PropertyEventManager.js';
import { ObjectRendererRegistry } from '../core/ObjectRendererRegistry.js';
import { ImageManager } from '../core/ImageManager.js';
import { SpatialGrid } from '../core/SpatialGrid.js';
import { DirtyRectManager } from '../core/DirtyRectManager.js';

// Import renderers
import { RectangleRenderer } from '../renderers/RectangleRenderer.js';
import { CircleRenderer } from '../renderers/CircleRenderer.js';
import { MapObjectRenderer } from '../renderers/MapObjectRenderer.js';
import { WaypointRenderer } from '../renderers/WaypointRenderer.js';
import { WarpPointRenderer } from '../renderers/WarpPointRenderer.js';

import { ImageRenderer } from '../renderers/ImageRenderer.js';
import { TextRenderer } from '../renderers/TextRenderer.js';

export class RuntimeViewer extends CanvasEngine {
    constructor(canvas, options = {}) {
        super(canvas, {
            gridSize: options.gridSize || 20,
            snapEnabled: false // Disable snapping in runtime
        });
        
        // Runtime-specific options
        this.options = {
            showGrid: options.showGrid !== false,
            showUI: false, // Always false for runtime
            enableInteraction: options.enableInteraction !== false,
            enableEvents: options.enableEvents !== false,
            readOnly: options.readOnly !== false,
            backgroundColor: options.backgroundColor || '#f5f5f5',
            ...options
        };

        this.visibility = {
            corridors: true,
            walls: true,
            waypoints: true,
            warppoints: true,
            warp_points: true,
            images: true

        };
        
        // Core systems (optimized for runtime)
        this.objects = new ObjectManager();
        this.spatialGrid = new SpatialGrid(100);
        this.dirtyManager = new DirtyRectManager();
        this.imageManager = new ImageManager();
        this.renderers = new ObjectRendererRegistry();
        
        // Event system (if enabled)
        if (this.options.enableEvents) {
            this.propertyEvents = new PropertyEventManager(this.objects);
        }
        
        this.setupRenderers();
        this.setupRuntimeEventListeners();
        this.buildAPI();
        
        // Apply CSS fix for canvas display
        this.fixCanvasDisplay();
        
        this.init();
    }

    setupRenderers() {
        // Register core renderers
        this.renderers.register(new WaypointRenderer());
        this.renderers.register(new WarpPointRenderer());
        this.renderers.register(new MapObjectRenderer());
        this.renderers.register(new ImageRenderer(this.imageManager, () => this.render()));
        this.renderers.register(new TextRenderer());
        this.renderers.register(new CircleRenderer());
        this.renderers.register(new RectangleRenderer());
    }

    setupRuntimeEventListeners() {
        // Minimal event handling for runtime
        if (this.options.enableInteraction) {
            this.canvas.addEventListener('click', this.onRuntimeClick.bind(this));
            this.canvas.addEventListener('mousemove', this.onRuntimeMouseMove.bind(this));
        }
        
        // Disable default canvas events that aren't needed
        this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
        this.canvas.addEventListener('dragstart', (e) => e.preventDefault());
        
        // Handle window resize
        window.addEventListener('resize', this.resizeCanvas.bind(this));
    }

    onRuntimeClick(e) {
        if (this.options.readOnly) return;
        
        const pos = this.screenToCanvas(e.clientX, e.clientY);
        const clickedIndex = this.getObjectAt(pos.x, pos.y);
        
        if (clickedIndex !== -1) {
            this.emit('objectClick', {
                index: clickedIndex,
                objectId: this.objects.getObjectId(clickedIndex),
                position: pos
            });
        }
    }

    onRuntimeMouseMove(e) {
        const pos = this.screenToCanvas(e.clientX, e.clientY);
        const hoveredIndex = this.getObjectAt(pos.x, pos.y);
        
        if (hoveredIndex !== -1) {
            const objectId = this.objects.getObjectId(hoveredIndex);
            this.updateCursor('pointer');
            
            this.emit('objectHover', {
                index: hoveredIndex,
                objectId: objectId,
                position: pos
            });
        } else {
            this.updateCursor('default');
        }
    }

    buildAPI() {
        this.api = {
            // Object access
            objects: this.objects,
            getObjectAt: this.getObjectAt.bind(this),
            getObjectByID: (objectId) => {
                const index = this.objects.getIndexByObjectId(objectId);
                if (index === undefined) return null;
                return this.getObjectData(index);
            },

            setVisibility: this.setVisibility.bind(this),
            getVisibility: this.getVisibility.bind(this),

            
            // Property access (optimized)
            getProperty: (objectId, property) => {
                return this.propertyEvents?.getProperty(objectId, property);
            },
            setProperty: (objectId, property, value) => {
                const result = this.propertyEvents?.setProperty(objectId, property, value);
                if (result) {
                    // Update spatial grid for position changes
                    const index = this.objects.getIndexByObjectId(objectId);
                    if (index !== undefined && ['x', 'y', 'width', 'height'].includes(property)) {
                        const id = this.objects.getIdByIndex(index);
                        const bounds = this.objects.getBounds(index);
                        
                        // Update spatial grid
                        this.spatialGrid.removeObject(id, bounds.x, bounds.y, bounds.width, bounds.height);
                        this.spatialGrid.addObject(id, bounds.x, bounds.y, bounds.width, bounds.height);
                        
                        // Add dirty rect for optimized rendering
                        this.addDirtyRect(bounds);
                    }
                    this.render();
                }
                return result;
            },
            
            // Event system
            onPropertyChange: this.propertyEvents?.onPropertyChange.bind(this.propertyEvents),
            onAnyPropertyChange: this.propertyEvents?.onAnyPropertyChange.bind(this.propertyEvents),
            
            // Rendering (optimized)
            render: this.render.bind(this),
            optimizedRender: this.optimizedRender.bind(this),
            addDirtyRect: this.addDirtyRect.bind(this),
            updateCursor: this.updateCursor.bind(this),
            
            // Canvas info
            get zoom() { return this.zoom; },
            get panX() { return this.panX; },
            get panY() { return this.panY; },
            
            // Utilities
            screenToCanvas: this.screenToCanvas.bind(this)
        };
    }

    getObjectData(index) {
        return {
            index,
            id: this.objects.getIdByIndex(index),
            objectId: this.objects.getObjectId(index),
            type: this.objects.types[index],
            mapType: this.objects.mapTypes[index],
            x: this.objects.x[index],
            y: this.objects.y[index],
            width: this.objects.width[index],
            height: this.objects.height[index],
            color: this.objects.colors[index],
            label: this.objects.labels[index],
            extra: this.objects.extra[index]
        };
    }

    // Load map data from JSON
    loadMapData(jsonData) {
        try {

            // Clear all existing objects first
            const oldCount = this.objects.getObjectCount();
            if (oldCount > 0) {
                 // Clear all arrays that exist
                const arrayProps = ['ids', 'types', 'x', 'y', 'width', 'height', 
                                  'colors', 'mapTypes', 'objectIds', 'labels', 
                                  'extra', 'rotations'];
                
                for (const prop of arrayProps) {
                    if (this.objects[prop] && Array.isArray(this.objects[prop])) {
                        this.objects[prop].length = 0;
                    }
                }

                 this.objects.idCounter = 1;
                 // Clear maps if they exist
                if (this.objects.idToIndex) this.objects.idToIndex.clear();
                if (this.objects.objectIdToIndex) this.objects.objectIdToIndex.clear();
            }
            
            // Clear spatial grid
            this.spatialGrid.clear();
            
            // Now load new data
            this.objects.fromJSON(jsonData);
            
            for (let i = 0; i < this.objects.getObjectCount(); i++) {
                const bounds = this.objects.getBounds(i);
                const id = this.objects.getIdByIndex(i);
                this.spatialGrid.addObject(id, bounds.x, bounds.y, bounds.width, bounds.height);
            }
            
            // Load images if any
            for (let i = 0; i < this.objects.getObjectCount(); i++) {
                const extra = this.objects.extra[i];
                if (extra && extra.src) {
                    this.imageManager.loadImage(extra.src).then(() => {
                        this.render(); // Re-render when images load
                    });
                }
            }
            
            this.render();
            this.emit('mapLoaded', { objectCount: this.objects.getObjectCount() });
            
            return true;
        } catch (error) {
            console.error('Failed to load map data:', error);
            this.emit('mapLoadError', error);
            return false;
        }
    }

    // Runtime-specific object finding (optimized)
    getObjectAt(x, y) {
        // Use spatial grid for fast hit testing
        const candidateIds = this.spatialGrid.getObjectsAt(x, y);
        
        if (candidateIds.size === 0) {
            return -1;
        }
        
        // Convert IDs to indices and sort by index (z-order)
        const indices = [];
        for (const id of candidateIds) {
            const index = this.objects.getIndexById(id);
            if (index !== undefined) {
                indices.push(index);
            }
        }
        
        // Sort by index descending (top objects first)
        indices.sort((a, b) => b - a);
        
        // Check from top to bottom
        for (const index of indices) {
            const obj = {
                type: this.objects.types[index],
                mapType: this.objects.mapTypes[index],
                x: this.objects.x[index],
                y: this.objects.y[index],
                width: this.objects.width[index],
                height: this.objects.height[index],
                extra: this.objects.extra[index]
            };
            
            if (this.renderers.contains(obj, x, y)) {
                return index;
            }
        }
        
        return -1;
    }

    setVisibility(type, visible) {
        if (this.visibility.hasOwnProperty(type)) {
            this.visibility[type] = visible;
            this.render();
        }
    }

    getVisibility(type) {
        return this.visibility[type] || false;
    }

    // Override drawContent for runtime
    drawContent() {
        for (let i = 0; i < this.objects.getObjectCount(); i++) {
            const mapType = this.objects.mapTypes[i];
            const objType = this.objects.types[i];
            
            // ตรวจสอบ visibility setting
            if (mapType === 'corridor' && !this.visibility.corridors) continue;
            if (mapType === 'wall' && !this.visibility.walls) continue;
            if (mapType === 'waypoint' && !this.visibility.waypoints) continue;
            if (mapType === 'warppoint' && !this.visibility.warppoints) continue;
            if ((objType === 'image' || objType === 'text') && !this.visibility.images) continue;

            
            this.drawObject(i);
        }
    }

    drawObject(index) {
        const obj = {
            type: this.objects.types[index],
            mapType: this.objects.mapTypes[index],
            x: this.objects.x[index],
            y: this.objects.y[index],
            width: this.objects.width[index],
            height: this.objects.height[index],
            color: this.objects.colors[index],
            extra: this.objects.extra[index]
        };
        
        const view = {
            zoom: this.zoom,
            selected: false // No selection in runtime
        };
        
        this.renderers.draw(obj, this.ctx, view);
    }

    // Override drawGrid for runtime options
    drawGrid() {
        if (!this.options.showGrid) return;
        super.drawGrid();
    }

    // Apply CSS fix to prevent canvas display issues
    fixCanvasDisplay() {
        const style = document.createElement('style');
        style.id = 'runtime-viewer-styles';
        style.textContent = `
            .runtime-canvas {
                position: absolute !important;
                top: 0 !important;
                left: 0 !important;
                z-index: 1 !important;
                background: ${this.options.backgroundColor} !important;
                width: 100% !important;
                height: 100% !important;
            }
            .runtime-container {
                position: relative !important;
                overflow: hidden !important;
                width: 100%;
                height: 100vh;
            }
        `;
        
        if (!document.getElementById('runtime-viewer-styles')) {
            document.head.appendChild(style);
        }
        
        // Apply classes
        this.canvas.classList.add('runtime-canvas');
        if (this.canvas.parentElement) {
            this.canvas.parentElement.classList.add('runtime-container');
        }
    }

    // Update cursor helper
    updateCursor(cursor) {
        if (this.currentCursor !== cursor) {
            this.currentCursor = cursor;
            this.canvas.style.cursor = cursor;
        }
    }

    // Add dirty rect for optimized rendering
    addDirtyRect(bounds) {
        const dpr = this.dpr || window.devicePixelRatio || 1;
        
        // world -> screen (CSS px)
        const sx_css = (bounds.x * this.zoom) + this.panX;
        const sy_css = (bounds.y * this.zoom) + this.panY;
        const sw_css = (bounds.width * this.zoom);
        const sh_css = (bounds.height * this.zoom);
        
        const PAD_CSS = 10;
        // Convert to device px
        const x_dp = Math.floor(dpr * (sx_css - PAD_CSS));
        const y_dp = Math.floor(dpr * (sy_css - PAD_CSS));
        const w_dp = Math.ceil(dpr * (sw_css + PAD_CSS * 2));
        const h_dp = Math.ceil(dpr * (sh_css + PAD_CSS * 2));
        
        this.dirtyManager.addDirtyRect(x_dp, y_dp, w_dp, h_dp);
    }

    // Optimized render for runtime
    optimizedRender() {
        const t0 = performance.now();
        const dirtyRects = this.dirtyManager.getDirtyRects();
        if (!dirtyRects.length) return;

        const PAD = Math.ceil(this.dpr);

        this.ctx.save();

        // Work in screen space
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);

        // Clear dirty rects
        for (const r of dirtyRects) {
            this.ctx.clearRect(r.x - PAD, r.y - PAD, r.width + PAD*2, r.height + PAD*2);
        }

        // Create combined clip region
        this.ctx.beginPath();
        for (const r of dirtyRects) {
            this.ctx.rect(r.x - PAD, r.y - PAD, r.width + PAD*2, r.height + PAD*2);
        }
        this.ctx.clip();

        // Set world transform
        this.ctx.setTransform(
            this.dpr * this.zoom, 0, 0, this.dpr * this.zoom,
            this.dpr * this.panX, this.dpr * this.panY
        );

        // Draw within clip region
        this.drawGrid();
        this.drawContent();
        
        this.ctx.restore();

        // Clear dirty state
        this.dirtyManager.clear();
        
        const dt = performance.now() - t0;
        // Optional: show render time in console for debugging
        // console.log(`Runtime render: ${dt.toFixed(1)}ms`);
    }
    destroy() {
        this.propertyEvents?.clearAllCallbacks();
        this.imageManager?.clear();
        
        // Remove event listeners
        window.removeEventListener('resize', this.resizeCanvas.bind(this));
        
        // Remove styles
        const styles = document.getElementById('runtime-viewer-styles');
        if (styles) {
            styles.remove();
        }
        
        this.emit('destroyed');
    }

    // Helper method to get runtime info
    getRuntimeInfo() {
        return {
            objectCount: this.objects.getObjectCount(),
            eventSystemEnabled: !!this.propertyEvents,
            options: this.options,
            canvasSize: {
                width: this.canvas.width,
                height: this.canvas.height
            }
        };
    }
}

// Usage example for testing
window.createRuntimeViewer = function(canvasId, jsonData = null) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) {
        console.error(`Canvas element '${canvasId}' not found`);
        return null;
    }
    
    const viewer = new RuntimeViewer(canvas, {
        showGrid: true,
        enableEvents: true,
        enableInteraction: true
    });
    
    if (jsonData) {
        viewer.loadMapData(jsonData);
    }
    
    return viewer;
};
import { CanvasEngine } from '../core/CanvasEngine.js';
import { History } from '../core/History.js';
import { PluginManager } from '../core/PluginManager.js';
import { MoveObjectCmd } from '../core/commands/MoveObjectCmd.js';
import { ResizeObjectCmd } from '../core/commands/ResizeObjectCmd.js';
import { CreateObjectCmd } from '../core/commands/CreateObjectCmd.js';
import { DeleteObjectCmd } from '../core/commands/DeleteObjectCmd.js';
import { MoveObjectOrderCmd } from '../core/commands/MoveObjectOrderCmd.js';
import { SwapObjectOrderCmd } from '../core/commands/SwapObjectOrderCmd.js';
import { UpdateObjectCmd } from '../core/commands/UpdateObjectCmd.js'

import { ToolRegistry } from '../core/ToolRegistry.js';

import { ObjectManager } from '../core/ObjectManager.js';
import { SpatialGrid } from '../core/SpatialGrid.js';
import { DirtyRectManager } from '../core/DirtyRectManager.js';
import { ObjectRendererRegistry } from '../core/ObjectRendererRegistry.js';
import { PropertyEventManager } from '../core/PropertyEventManager.js';

import { ImageManager } from '../core/ImageManager.js';

import { InspectorPanel } from '../ui/InspectorPanel.js';
import { ToolbarPanel } from '../ui/ToolbarPanel.js';
import { ControlPanel } from '../ui/ControlPanel.js';
import { FileOperations } from '../operations/FileOperations.js';
import { ClipboardOperations } from '../operations/ClipboardOperations.js';
import { ImageExportOperations } from '../operations/ImageExportOperations.js';
import { ObjectOrderOperations } from '../operations/ObjectOrderOperations.js';

//Default plugin
import CorePlugin from '../plugins/CorePlugin.js';
import TextPlugin from '../plugins/TextPlugin.js';


export class MapEditor extends CanvasEngine {
    constructor(canvas) {
        super(canvas, { gridSize: 20, snapEnabled: true });

        this.objects = new ObjectManager();
        this.spatialGrid = new SpatialGrid(100);
        this.propertyEvents = new PropertyEventManager(this.objects);
        this.dirtyManager = new DirtyRectManager();
        this.history = new History();
        this.currentTool = null;

        this.renderers = new ObjectRendererRegistry();
        this.imageManager = new ImageManager();
        this.pluginManager = new PluginManager(this);

        // cursor state tracking
        this.currentCursor = null;

        this.setupMapEventListeners();
        this.setupUI();
        this.tools = new ToolRegistry();
        this.api = this.buildEditorAPI();

        this.setupPlugins();
        this.setupPanels();

        this.init();
        this.updateInfo();

        this.inspectorPanel.update();
        this.controlPanel.updateHistoryButtons();

        this.controlPanel.updateClipboardButtons();
    }

    // Override history exec to set propertyEvents reference
    execCommand(command) {
        // Set propertyEvents reference for the command
        if (command.propertyEvents === null) {
            command.propertyEvents = this.propertyEvents;
        }

        return this.history.exec(command);
    }


    async setupPlugins() {
        try {
            // Load core plugin
            await this.pluginManager.loadPlugin('../plugins/CorePlugin.js');

            // Load text plugin
            +           await this.pluginManager.loadPlugin('../plugins/TextPlugin.js');


            // Set default tool after plugins are loaded
            if (this.tools.has('select')) {
                this.useTool('select');
            }

            // Update toolbar after plugins are loaded
            if (this.toolbarPanel) {
                this.toolbarPanel.render();
            }
        } catch (error) {
            console.error('Failed to load plugins:', error);
        }
    }


    setupPanels() {
        this.inspectorPanel = new InspectorPanel(this);
        this.toolbarPanel = new ToolbarPanel(this);
        this.controlPanel = new ControlPanel(this);
        this.fileOps = new FileOperations(this);
        this.clipboardOps = new ClipboardOperations(this);
        this.imageExportOps = new ImageExportOperations(this);
        this.objectOrderOps = new ObjectOrderOperations(this);
        this.toolbarPanel.render();
    }

    setupMapEventListeners() {

        document.addEventListener('keydown', (e) => {



            // Let current tool handle its own keys first
            const toolHandled = this.tools.get(this.currentTool)?.onKeyDown?.(e, this.api);
            if (toolHandled) return;

            // === GLOBAL SHORTCUTS ===
            // History operations

            if (e.ctrlKey && e.key === 'z' && !e.shiftKey) {
                e.preventDefault();
                if (this.history.undo()) {
                    this.rebuildSpatialGrid();
                    this.render();
                    this.updateInfo();
                    this.inspectorPanel.update();
                    this.controlPanel.updateHistoryButtons();
                    this.controlPanel.updateClipboardButtons();
                }
            } else if ((e.ctrlKey && e.shiftKey && e.key === 'Z') || (e.ctrlKey && e.key === 'y')) {
                e.preventDefault();
                if (this.history.redo()) {
                    this.rebuildSpatialGrid();
                    this.render();
                    this.updateInfo();
                    this.inspectorPanel.update();
                    this.controlPanel.updateHistoryButtons();
                    this.controlPanel.updateClipboardButtons();
                }
            }

            // Clipboard operations
            if (e.ctrlKey && e.key === 'c') {
                e.preventDefault();
                this.clipboardOps.copy();
            }

            if (e.ctrlKey && e.key === 'v') {
                e.preventDefault();
                this.clipboardOps.paste();
            }

            if (e.ctrlKey && e.key === 'd') {
                e.preventDefault();
                this.clipboardOps.duplicate();
            }

            // Arrow key movement for selected objects
            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
                e.preventDefault();
                const selectedIndices = this.objects.getSelectedIndices();
                if (selectedIndices.length === 0) return;

                // Calculate movement distance (with shift for larger steps)
                const step = e.shiftKey ? this.gridSize : 1;
                let deltaX = 0, deltaY = 0;

                switch (e.key) {
                    case 'ArrowUp': deltaY = -step; break;
                    case 'ArrowDown': deltaY = step; break;
                    case 'ArrowLeft': deltaX = -step; break;
                    case 'ArrowRight': deltaX = step; break;
                }

                // Create move commands for all selected objects
                for (const index of selectedIndices) {
                    const objectId = this.objects.getIdByIndex(index);
                    const currentPos = { x: this.objects.x[index], y: this.objects.y[index] };

                    let newPos;
                    if (this.snapEnabled) {
                        // Move to next grid position in the direction of movement
                        let newX = currentPos.x;
                        let newY = currentPos.y;

                        if (deltaX !== 0) {
                            const currentGridX = Math.round(currentPos.x / this.gridSize) * this.gridSize;
                            newX = deltaX > 0 ? currentGridX + this.gridSize : currentGridX - this.gridSize;
                        }

                        if (deltaY !== 0) {
                            const currentGridY = Math.round(currentPos.y / this.gridSize) * this.gridSize;
                            newY = deltaY > 0 ? currentGridY + this.gridSize : currentGridY - this.gridSize;
                        }

                        newPos = { x: newX, y: newY };
                    } else {
                        // Free movement
                        newPos = { x: currentPos.x + deltaX, y: currentPos.y + deltaY };
                    }

                    const cmd = new MoveObjectCmd(this.objects, this.spatialGrid, objectId, currentPos, newPos);
                    this.history.exec(cmd);
                }

                this.render();
                this.inspectorPanel.update();
                this.controlPanel.updateHistoryButtons();
                return;
            }

            // Global escape - return to safe state
            if (e.key === 'Escape') {
                e.preventDefault();
                this.resetAllStates();
                this.objects.clearSelection();
                this.useTool('select');
                this.inspectorPanel.update();
                this.controlPanel.updateClipboardButtons();
                this.render();
            }

        });
    }

    setupUI() {
        this.onSnapToggle = () => this.updateInfo();
        this.onZoomChange = () => this.updateInfo();
    }

    updateCursor(cursor) {

        if (this.currentCursor !== cursor) {

            this.currentCursor = cursor;
            this.canvas.style.cursor = cursor;


        }
    }

    getCursorForHandle(handle) {
        const cursorMap = {
            'nw': 'nwse-resize',
            'ne': 'nesw-resize',
            'sw': 'nesw-resize',
            'se': 'nwse-resize',
            'n': 'ns-resize',
            's': 'ns-resize',
            'e': 'ew-resize',
            'w': 'ew-resize'
        };
        return cursorMap[handle] || 'default';
    }

    handleMouseDown(e, pos) {
        this.tools.get(this.currentTool)?.onPointerDown?.(e, pos, this.api);
    }


    handleMouseMove(e, pos) {
        this.tools.get(this.currentTool)?.onPointerMove?.(e, pos, this.api);
    }

    handleMouseUp(e, pos) {
        this.tools.get(this.currentTool)?.onPointerUp?.(e, pos, this.api);
    }

    resetAllStates() {
        super.resetAllStates();

        // Reset cursor to current tool's cursor
        const tool = this.tools.get(this.currentTool);
        if (tool) {
            this.updateCursor(tool.cursor);
        }
    }


    buildEditorAPI() {
        const editor = this;

        return {
            // Object operations
            objects: this.objects,
            spatialGrid: this.spatialGrid,
            tools: this.tools,
            getObjectAt: this.getObjectAt.bind(this),
            deleteObject: this.deleteObject.bind(this),

            // History
            history: this.history,
            createCommands: {
                MoveObjectCmd,
                ResizeObjectCmd,
                CreateObjectCmd,
                DeleteObjectCmd,
                MoveObjectOrderCmd,
                SwapObjectOrderCmd,
                UpdateObjectCmd
            },

            // Canvas operations
            ctx: this.ctx,
            get zoom() { return editor.zoom; },
            get panX() { return editor.panX; },
            get panY() { return editor.panY; },
            set panX(value) { editor.panX = value; },
            set panY(value) { editor.panY = value; },
            snapEnabled: this.snapEnabled,
            snapPosition: this.snapPosition.bind(this),

            // Rendering
            render: this.render.bind(this),
            optimizedRender: this.optimizedRender.bind(this),
            addDirtyRect: this.addDirtyRect.bind(this),
            updateInfo: this.updateInfo.bind(this),
            propertyEvents: this.propertyEvents,
            updateCursor: this.updateCursor.bind(this),
            updateInspector: () => this.inspectorPanel.update(),
            updateHistoryButtons: () => this.controlPanel.updateHistoryButtons(),
            updateClipboardButtons: () => this.controlPanel.updateClipboardButtons(),
            // Add currentCursor getter to API
            get currentCursor() { return editor.currentCursor; },
            useTool: this.useTool.bind(this),
            imageManager: this.imageManager,
            renderers: this.renderers,
            pluginManager: this.pluginManager,

            // Event system methods
            onPropertyChange: this.propertyEvents.onPropertyChange.bind(this.propertyEvents),

            objectOrderOps: () => this.objectOrderOps,

            // Resize utilities
            getHandleAtPoint: this.getHandleAtPoint.bind(this),
            getCursorForHandle: this.getCursorForHandle.bind(this),
            calculateResize: this.calculateResize.bind(this),
            drawResizeHandles: this.drawResizeHandles.bind(this)
        };
    }

    useTool(id) {
        if (this.currentTool) {
            this.emit('toolChanged', { oldTool: this.currentTool, newTool: id });
            this.tools.get(this.currentTool)?.deactivate?.(this.api);
        }
        this.currentTool = id;
        this.tools.get(id)?.activate?.(this.api);


        if (this.toolbarPanel) {
            this.toolbarPanel.setActiveTool(id);
        }
    }

    drawContent() {
        for (let i = 0; i < this.objects.getObjectCount(); i++) {
            this.drawObject(i);
        }

        // Draw tool overlay
        this.tools.get(this.currentTool)?.drawOverlay?.(this.api);
    }

    drawObject(index) {
        // Create object snapshot
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

        // Create view state
        const view = {
            zoom: this.zoom,
            selected: this.objects.selected[index]
        };

        // Use renderer system
        this.renderers.draw(obj, this.ctx, view);
    }



    addDirtyRect(bounds) {
        const dpr = this.dpr || window.devicePixelRatio || 1;

        // world -> screen (CSS px)
        const sx_css = (bounds.x * this.zoom) + this.panX;
        const sy_css = (bounds.y * this.zoom) + this.panY;
        const sw_css = (bounds.width * this.zoom);
        const sh_css = (bounds.height * this.zoom);

        const PAD_CSS = 10;
        // แปลงเป็น device px
        const x_dp = Math.floor(dpr * (sx_css - PAD_CSS));
        const y_dp = Math.floor(dpr * (sy_css - PAD_CSS));
        const w_dp = Math.ceil(dpr * (sw_css + PAD_CSS * 2));
        const h_dp = Math.ceil(dpr * (sh_css + PAD_CSS * 2));

        this.dirtyManager.addDirtyRect(x_dp, y_dp, w_dp, h_dp);
    }

    optimizedRender() {
        const t0 = performance.now();
        const dirtyRects = this.dirtyManager.getDirtyRects();
        if (!dirtyRects.length) return;

        const PAD = Math.ceil(this.dpr);

        this.ctx.save();

        // 1) ทำงานใน screen space
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);

        // เคลียร์ทุก rect
        for (const r of dirtyRects) {
            this.ctx.clearRect(r.x - PAD, r.y - PAD, r.width + PAD * 2, r.height + PAD * 2);
        }

        // สร้าง clip รวม
        this.ctx.beginPath();
        for (const r of dirtyRects) {
            this.ctx.rect(r.x - PAD, r.y - PAD, r.width + PAD * 2, r.height + PAD * 2);
        }
        this.ctx.clip();

        // 2) ตั้ง world transform
        this.ctx.setTransform(
            this.dpr * this.zoom, 0, 0, this.dpr * this.zoom,
            this.dpr * this.panX, this.dpr * this.panY
        );

        // 3) วาดภายใต้ clip รวม
        this.drawGrid();
        this.drawContent();

        this.ctx.restore();

        // 4) ล้างสถานะ dirty
        this.dirtyManager.clear();

        // 5) อัปเดต UI
        const dt = performance.now() - t0;
        const elTime = document.getElementById('renderTime');
        const elRects = document.getElementById('dirtyRects');
        if (elTime) elTime.textContent = dt.toFixed(1) + 'ms';
        if (elRects) elRects.textContent = String(dirtyRects.length);
    }

    getObjectAt(x, y) {
        // Use spatial grid for efficient hit-testing
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
            // Use renderer system for hit testing
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

    deleteObject(index) {
        // Get bounds BEFORE deleting for dirty rect
        const bounds = this.objects.getBounds(index);
        this.addDirtyRect(bounds);

        // Use command pattern
        const cmd = new DeleteObjectCmd(this.objects, this.spatialGrid, index);
        this.history.exec(cmd);

        // Set propertyEvents reference for commands
        if (cmd.propertyEvents === null) {
            cmd.propertyEvents = this.propertyEvents;
        }

        this.updateInfo();
        this.optimizedRender();
        this.inspectorPanel.update();
        this.controlPanel.updateHistoryButtons();
        this.controlPanel.updateClipboardButtons();

    }

    updateInfo() {
        document.getElementById('objectCount').textContent = this.objects.getObjectCount();
        document.getElementById('zoomLevel').textContent = Math.round(this.zoom * 100) + '%';
        document.getElementById('gridCells').textContent = this.spatialGrid.getCellCount();
        document.getElementById('snapStatus').textContent = this.snapEnabled ? 'ON' : 'OFF';
    }


    rebuildSpatialGrid() {
        // Clear และ rebuild spatial grid เพื่อให้ sync กับ objects
        this.spatialGrid.clear();
        for (let i = 0; i < this.objects.getObjectCount(); i++) {
            const bounds = this.objects.getBounds(i);
            const id = this.objects.getIdByIndex(i);
            this.spatialGrid.addObject(id, bounds.x, bounds.y, bounds.width, bounds.height);
        }
    }

}
import { Config } from './config.js';
import { AppState } from './app-state.js';
import { RuntimeViewer } from '../runtime/RuntimeViewer.js';
import { OrthogonalPathfinder } from './pathfinder.js';
import { findNearestCorridorPosition, findPortalPath, createStraightLinePath } from './pathfinding-utils.js';
import * as RenderManager from './render-manager.js';

// =============================================================================
// MODULES
// =============================================================================

// UI Manager
const UIManager = {
    updateInfo,
    updateWaypointDropdowns,
    showContextMenu(x, y) {
        const menu = document.getElementById(Config.elements.contextMenu);
        menu.style.left = x + 'px';
        menu.style.top = y + 'px';
        menu.style.display = 'block';
        AppState.contextMenuVisible = true;
    },
    hideContextMenu,
    removeTemporaryOptions
};

// Data Manager
const DataManager = {
    extractCorridorsWallsAndWaypoints,
    clearAllData() {
        AppState.corridors = [];
        AppState.walls = [];
        AppState.waypoints = [];
        AppState.paths = [];
        AppState.showDebug = false;
        AppState.contextMenuVisible = false;
        AppState.isPanning = false;
        AppState.objectSize = Config.defaults.objectSize;

        // Clear temp waypoints
        AppState.tempFromPoint = null;
        AppState.tempToPoint = null;

        // Clear dropdowns
        document.getElementById(Config.elements.fromWaypoint).value = '';
        document.getElementById(Config.elements.toWaypoint).value = '';

        // Remove temp options
        UIManager.removeTemporaryOptions('temp_from_');
        UIManager.removeTemporaryOptions('temp_to_');

        // Clear cache
        if (AppState.viewer?.objects?.originalPositions) {
            delete AppState.viewer.objects.originalPositions;
        }

        document.getElementById(Config.elements.objectSizeSlider).value = Config.defaults.objectSize;
        document.getElementById(Config.elements.sizeValueDisplay).textContent = Config.defaults.objectSize + 'px';
    }
};

// Event Manager
const EventManager = {
    handlePanStart,
    handlePanMove,
    handlePanEnd,
    setupEventHandlers,
    setupContextMenu
};

// Path Manager
const PathManager = {
    findPaths,
    clearPaths
};

// File Manager
const FileManager = {
    loadFile,
    loadSample
};

// Context Menu Actions
const ContextMenuActions = {
    setFromHere() {
        // Clear existing paths
        AppState.paths = [];

        const fromSelect = document.getElementById('from-waypoint');
        const tempFromId = `temp_from_${Date.now()}`;

        // Remove existing temp from options
        UIManager.removeTemporaryOptions('temp_from_');

        // Add new temp option
        const option = document.createElement('option');
        option.value = tempFromId;
        option.textContent = `From here (${AppState.contextMenuX.toFixed(1)}, ${AppState.contextMenuY.toFixed(1)})`;
        fromSelect.appendChild(option);
        fromSelect.value = tempFromId;

        // Store coordinates
        AppState.tempFromPoint = { x: AppState.contextMenuX, y: AppState.contextMenuY };

        console.log(`Set FROM point: (${AppState.contextMenuX.toFixed(1)}, ${AppState.contextMenuY.toFixed(1)})`);
        UIManager.hideContextMenu();
        AppState.viewer.render();
        UIManager.updateInfo();
    },

    setToHere() {
        // Clear existing paths
        AppState.paths = [];

        const toSelect = document.getElementById('to-waypoint');
        const tempToId = `temp_to_${Date.now()}`;

        // Remove existing temp to options
        UIManager.removeTemporaryOptions('temp_to_');

        // Add new temp option
        const option = document.createElement('option');
        option.value = tempToId;
        option.textContent = `To here (${AppState.contextMenuX.toFixed(1)}, ${AppState.contextMenuY.toFixed(1)})`;
        toSelect.appendChild(option);
        toSelect.value = tempToId;

        // Store coordinates
        AppState.tempToPoint = { x: AppState.contextMenuX, y: AppState.contextMenuY };

        console.log(`Set TO point: (${AppState.contextMenuX.toFixed(1)}, ${AppState.contextMenuY.toFixed(1)})`);
        UIManager.hideContextMenu();
        AppState.viewer.render();
        UIManager.updateInfo();
    },

    clearSelection() {
        // Clear both dropdowns
        document.getElementById('from-waypoint').value = '';
        document.getElementById('to-waypoint').value = '';

        // Remove temp options
        UIManager.removeTemporaryOptions('temp_from_');
        UIManager.removeTemporaryOptions('temp_to_');

        // Clear temp points
        AppState.tempFromPoint = null;
        AppState.tempToPoint = null;

        // Clear paths
        AppState.paths = [];
        AppState.viewer.render();
        UIManager.updateInfo();

        console.log('Cleared selection');
        UIManager.hideContextMenu();
    }
};

// =============================================================================
// INITIALIZATION
// =============================================================================
document.addEventListener('DOMContentLoaded', () => {
    initViewer();
    EventManager.setupEventHandlers();
    EventManager.setupContextMenu();
    UIManager.updateInfo();

    // Auto-load sample if configured
    if (Config.defaults.loadSampleOnStartup) {
        FileManager.loadSample();

        // Apply visibility settings after loading
        AppState.viewer.setVisibility('corridors', Config.defaults.visibility.corridors);
        AppState.viewer.setVisibility('walls', Config.defaults.visibility.walls);
        AppState.viewer.setVisibility('waypoints', Config.defaults.visibility.waypoints);
        AppState.viewer.setVisibility('warppoints', Config.defaults.visibility.warppoints);
        AppState.viewer.setVisibility('images', Config.defaults.visibility.images);
    }
});

function initViewer() {
    const canvas = document.getElementById(Config.elements.canvas);
    AppState.viewer = new RuntimeViewer(canvas, {
        showGrid: false,
        enableEvents: true,
        enableInteraction: true
    });

    // Compatibility references
    window.AppState = AppState;
    window.viewer = AppState.viewer;

    // Store visibility checkbox
    AppState.viewer.visibilityState = { ...Config.defaults.visibility };

    AppState.viewer.setVisibility = function (type, visible) {
        this.visibilityState[type] = visible;

        const objects = this.objects;
        for (let i = 0; i < objects.getObjectCount(); i++) {
            const mapType = objects.mapTypes[i];
            const objType = objects.types[i];

            let shouldHide = false;
            if (mapType === 'corridor' && !this.visibilityState.corridors) shouldHide = true;
            if (mapType === 'wall' && !this.visibilityState.walls) shouldHide = true;
            if (mapType === 'waypoint' && !this.visibilityState.waypoints) shouldHide = true;
            if (mapType === 'warppoint' && !this.visibilityState.warppoints) shouldHide = true;
            if ((objType === 'image' || objType === 'text') && !this.visibilityState.images) shouldHide = true;

            // Hide by moving off screen
            if (shouldHide) {
                if (!objects.originalPositions) objects.originalPositions = {};
                if (!objects.originalPositions[i]) {
                    objects.originalPositions[i] = {
                        x: objects.x[i],
                        y: objects.y[i]
                    };
                }
                objects.x[i] = -99999;
                objects.y[i] = -99999;
            } else {
                // Restore original position
                if (objects.originalPositions && objects.originalPositions[i]) {
                    objects.x[i] = objects.originalPositions[i].x;
                    objects.y[i] = objects.originalPositions[i].y;
                }
            }
        }
        this.render();
    };

    const originalRender = AppState.viewer.render.bind(AppState.viewer);
    AppState.viewer.render = function () {
        originalRender();
        RenderManager.drawWarppoints(AppState, Config);
        if (AppState.showDebug) RenderManager.drawCorridorBuffers(AppState, Config);
        if (AppState.paths.length > 0) RenderManager.drawPaths(AppState, Config);
        RenderManager.drawTempWaypoints(AppState, Config);
        RenderManager.drawWaypointLabels(AppState, Config);
    };
}

function setupEventHandlers() {
    const canvas = document.getElementById(Config.elements.canvas);

    // Canvas events
    canvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        e.stopPropagation();

        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const zoomFactor = e.deltaY > 0 ? Config.defaults.zoomFactor : 1.1;
        const newZoom = Math.max(Config.defaults.minZoom, Math.min(Config.defaults.maxZoom, AppState.viewer.zoom * zoomFactor));

        AppState.viewer.panX += (mouseX - AppState.viewer.panX) * (1 - newZoom / AppState.viewer.zoom);
        AppState.viewer.panY += (mouseY - AppState.viewer.panY) * (1 - newZoom / AppState.viewer.zoom);
        AppState.viewer.zoom = newZoom;

        AppState.viewer.render();
        UIManager.updateInfo();
    });

    canvas.addEventListener('mousedown', handlePanStart);
    canvas.addEventListener('mousemove', handlePanMove);
    canvas.addEventListener('mouseup', handlePanEnd);
    canvas.addEventListener('mouseleave', handlePanEnd);
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    // Button events
    document.getElementById('load-btn').addEventListener('click', FileManager.loadFile);
    document.getElementById('find-btn').addEventListener('click', PathManager.findPaths);
    document.getElementById('clear-btn').addEventListener('click', PathManager.clearPaths);
    document.getElementById('debug-btn').addEventListener('click', toggleDebug);
    document.getElementById('sample-btn').addEventListener('click', FileManager.loadSample);

    // Size slider
    const sizeSlider = document.getElementById(Config.elements.objectSizeSlider);
    const sizeValue = document.getElementById(Config.elements.sizeValueDisplay);
    sizeSlider.addEventListener('input', () => {
        AppState.objectSize = parseInt(sizeSlider.value);
        sizeValue.textContent = AppState.objectSize + 'px';
        updateInfo();
        if (AppState.paths.length > 0) findPaths();
    });

    const redrawHandler = () => {
        AppState.viewer.render();
        UIManager.updateInfo();
    };

    // Visibility checkboxes
    AppState.showCorridors = Config.defaults.visibility.corridors;
    AppState.showWalls = Config.defaults.visibility.walls;
    AppState.showWaypoints = Config.defaults.visibility.waypoints;
    AppState.showWarppoints = Config.defaults.visibility.warppoints;

    // Set checkbox states from Config
    document.getElementById(Config.elements.showCorridors).checked = Config.defaults.visibility.corridors;
    document.getElementById(Config.elements.showWalls).checked = Config.defaults.visibility.walls;
    document.getElementById(Config.elements.showWaypoints).checked = Config.defaults.visibility.waypoints;
    document.getElementById(Config.elements.showWarppoints).checked = Config.defaults.visibility.warppoints;
    document.getElementById(Config.elements.showImages).checked = Config.defaults.visibility.images;

    let showImages = Config.defaults.visibility.images;

    document.getElementById(Config.elements.showCorridors).addEventListener('change', (e) => {
        AppState.showCorridors = e.target.checked;
        AppState.viewer.setVisibility('corridors', AppState.showCorridors);
        redrawHandler();
    });

    document.getElementById(Config.elements.showWalls).addEventListener('change', (e) => {
        AppState.showWalls = e.target.checked;
        AppState.viewer.setVisibility('walls', AppState.showWalls);
        redrawHandler();
    });

    document.getElementById(Config.elements.showWaypoints).addEventListener('change', (e) => {
        AppState.showWaypoints = e.target.checked;
        AppState.viewer.setVisibility('waypoints', AppState.showWaypoints);
        redrawHandler();
    });

    document.getElementById(Config.elements.showImages).addEventListener('change', (e) => {
        showImages = e.target.checked;
        AppState.viewer.setVisibility('images', showImages);
        redrawHandler();
    });

    document.getElementById(Config.elements.showWarppoints).addEventListener('change', (e) => {
        AppState.showWarppoints = e.target.checked;
        AppState.viewer.setVisibility('warppoints', AppState.showWarppoints);
        redrawHandler();
    });

    // Waypoint dropdowns
    document.getElementById(Config.elements.fromWaypoint).addEventListener('change', (e) => {
        const selectedValue = e.target.value;

        if (selectedValue) {
            // Clear paths when changing waypoint
            AppState.paths = [];

            if (selectedValue.startsWith('temp_from_')) {
                // Temp waypoint already has coordinates stored
            } else {
                // Regular waypoint - find coordinates and create temp marker
                const waypoint = AppState.waypoints.find(w => w.id === selectedValue);
                if (waypoint) {
                    AppState.tempFromPoint = { x: waypoint.x, y: waypoint.y };
                }
            }
        } else {
            // Clear FROM marker when dropdown is empty
            AppState.tempFromPoint = null;
        }

        AppState.viewer.render();
        UIManager.updateInfo();
    });

    document.getElementById(Config.elements.toWaypoint).addEventListener('change', (e) => {
        const selectedValue = e.target.value;

        if (selectedValue) {
            // Clear paths when changing waypoint
            AppState.paths = [];

            if (selectedValue.startsWith('temp_to_')) {
                // Temp waypoint already has coordinates stored
            } else {
                // Regular waypoint - find coordinates and create temp marker
                const waypoint = AppState.waypoints.find(w => w.id === selectedValue);
                if (waypoint) {
                    AppState.tempToPoint = { x: waypoint.x, y: waypoint.y };
                }
            }
        } else {
            // Clear TO marker when dropdown is empty
            AppState.tempToPoint = null;
        }

        AppState.viewer.render();
        updateInfo();
    });
}

// =============================================================================
// CONTEXT MENU HANDLING
// =============================================================================
function setupContextMenu() {
    const canvas = document.getElementById('runtime-canvas');
    const contextMenu = document.getElementById('context-menu');

    // Show context menu on right click
    canvas.addEventListener('contextmenu', (e) => {
        e.preventDefault();

        // Store world coordinates for menu actions
        const rect = e.target.getBoundingClientRect();
        AppState.contextMenuX = (e.clientX - rect.left - AppState.viewer.panX) / AppState.viewer.zoom;
        AppState.contextMenuY = (e.clientY - rect.top - AppState.viewer.panY) / AppState.viewer.zoom;

        // Show menu at mouse position
        contextMenu.style.left = e.clientX + 'px';
        contextMenu.style.top = e.clientY + 'px';
        contextMenu.style.display = 'block';
        AppState.contextMenuVisible = true;
    });

    // Handle menu item clicks using event delegation
    contextMenu.addEventListener('click', (e) => {
        const menuItem = e.target.closest('.context-menu-item');
        if (!menuItem) return;

        const action = menuItem.dataset.action;
        switch (action) {
            case 'from':
                ContextMenuActions.setFromHere();
                break;
            case 'to':
                ContextMenuActions.setToHere();
                break;
            case 'clear':
                ContextMenuActions.clearSelection();
                break;
        }
    });

    // Hide context menu on click elsewhere
    document.addEventListener('click', (e) => {
        if (AppState.contextMenuVisible && !contextMenu.contains(e.target)) {
            hideContextMenu();
        }
    });

    // Hide context menu on escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && AppState.contextMenuVisible) {
            hideContextMenu();
        }
    });
}

function hideContextMenu() {
    const contextMenu = document.getElementById('context-menu');
    contextMenu.style.display = 'none';
    AppState.contextMenuVisible = false;
}

function removeTemporaryOptions(prefix) {
    ['from-waypoint', 'to-waypoint'].forEach(selectId => {
        const select = document.getElementById(selectId);
        const optionsToRemove = Array.from(select.options).filter(opt =>
            opt.value.startsWith(prefix)
        );

        optionsToRemove.forEach(option => {
            select.removeChild(option);
        });
    });
}


// =============================================================================
// PAN HANDLING
// =============================================================================
function handlePanStart(e) {
    if (e.button === 0) { // Left-click only
        e.preventDefault();
        e.stopPropagation();
        AppState.isPanning = true;
        AppState.lastPanX = e.clientX;
        AppState.lastPanY = e.clientY;
        const canvas = document.getElementById('runtime-canvas');
        canvas.style.cursor = 'grabbing';
    }
}

function handlePanMove(e) {
    if (!AppState.isPanning) {
        const canvas = document.getElementById('runtime-canvas');
        canvas.style.cursor = 'grab';
        return;
    }

    e.preventDefault();
    e.stopPropagation();

    const deltaX = e.clientX - AppState.lastPanX;
    const deltaY = e.clientY - AppState.lastPanY;

    AppState.viewer.panX += deltaX;
    AppState.viewer.panY += deltaY;
    AppState.lastPanX = e.clientX;
    AppState.lastPanY = e.clientY;
    AppState.viewer.render();
}

function handlePanEnd(e) {
    if (AppState.isPanning) {
        e.preventDefault();
        AppState.isPanning = false;
        const canvas = document.getElementById('runtime-canvas');
        canvas.style.cursor = 'grab';
    }
}

// =============================================================================
// DATA EXTRACTION AND MANAGEMENT
// =============================================================================
function extractCorridorsWallsAndWaypoints() {
    AppState.corridors = [];
    AppState.walls = [];
    AppState.waypoints = [];

    for (let i = 0; i < AppState.viewer.objects.getObjectCount(); i++) {
        const mapType = AppState.viewer.objects.mapTypes[i];
        const bounds = AppState.viewer.objects.getBounds(i);
        const objectId = AppState.viewer.objects.getObjectId(i);
        const label = AppState.viewer.objects.labels[i];

        switch (mapType) {
            case 'corridor':
                AppState.corridors.push({ id: objectId, ...bounds, rotation: AppState.viewer.objects.extra[i]?.rotation || 0 });
                break;
            case 'wall':
                AppState.walls.push({ id: objectId, ...bounds, rotation: AppState.viewer.objects.extra[i]?.rotation || 0 });
                break;
            case 'waypoint':
            case 'warppoint':
                AppState.waypoints.push({
                    id: objectId,
                    label: label || '',
                    x: bounds.x + bounds.width / 2,
                    y: bounds.y + bounds.height / 2,
                    type: mapType,
                    portalId: AppState.viewer.objects.extra[i]?.portalId || null
                });
                break;
        }
    }

    console.log(`Found ${AppState.corridors.length} corridors, ${AppState.walls.length} walls, ${AppState.waypoints.length} waypoints`);
    updateWaypointDropdowns();
}

function updateWaypointDropdowns() {
    const fromSelect = document.getElementById('from-waypoint');
    const toSelect = document.getElementById('to-waypoint');

    fromSelect.innerHTML = '<option value="">Select waypoint...</option>';
    toSelect.innerHTML = '<option value="">Select waypoint...</option>';

    AppState.waypoints.forEach(waypoint => {
        ['from-waypoint', 'to-waypoint'].forEach(selectId => {
            const option = document.createElement('option');
            option.value = waypoint.id;

            option.textContent = waypoint.label
                ? `${waypoint.id} - ${waypoint.label}`
                : waypoint.id || 'Unnamed';

            document.getElementById(selectId).appendChild(option);
        });
    });
}

function updateInfo() {
    const updates = {
        [Config.elements.corridorCount]: AppState.corridors.length,
        [Config.elements.wallCount]: AppState.walls.length,
        [Config.elements.waypointCount]: AppState.waypoints.length,
        [Config.elements.pathCount]: AppState.paths.length,
        [Config.elements.currentSize]: AppState.objectSize
    };

    Object.entries(updates).forEach(([id, value]) => {
        document.getElementById(id).textContent = value;
    });

    if (AppState.corridors.length > 0) {
        const minDimension = Math.min(...AppState.corridors.map(c => Math.min(c.width, c.height)));
        document.getElementById(Config.elements.minCorridor).textContent = minDimension.toFixed(1);
    }

    const zoom = AppState.viewer ? Math.round(AppState.viewer.zoom * 100) : 100;
    document.getElementById(Config.elements.zoomLevel).textContent = zoom + '%';
}



// =============================================================================
// PUBLIC API FUNCTIONS
// =============================================================================
function loadFile() {
    const fileInput = document.getElementById('file-input');
    const file = fileInput.files[0];

    if (!file) {
        alert('Please select a JSON file');
        return;
    }

    const reader = new FileReader();
    reader.onload = function (e) {
        try {
            DataManager.clearAllData();
            UIManager.hideContextMenu();

            const mapData = JSON.parse(e.target.result);
            AppState.viewer.loadMapData(mapData);
            DataManager.extractCorridorsWallsAndWaypoints();

            // Set visibility to Config defaults
            AppState.viewer.setVisibility('corridors', Config.defaults.visibility.corridors);
            AppState.viewer.setVisibility('walls', Config.defaults.visibility.walls);
            AppState.viewer.setVisibility('waypoints', Config.defaults.visibility.waypoints);
            AppState.viewer.setVisibility('warppoints', Config.defaults.visibility.warppoints);
            AppState.viewer.setVisibility('images', Config.defaults.visibility.images);
            UIManager.updateInfo();
        } catch (error) {
            alert('Error loading JSON: ' + error.message);
        }
    };
    reader.readAsText(file);
}

function loadSample() {
    AppState.viewer.loadMapData(Config.sampleData);
    DataManager.extractCorridorsWallsAndWaypoints();
    UIManager.updateInfo();
}

function findPaths() {
    if (AppState.corridors.length === 0) {
        alert('Need corridors to find paths');
        return;
    }

    const fromWaypointId = document.getElementById('from-waypoint').value;
    const toWaypointId = document.getElementById('to-waypoint').value;

    if (!fromWaypointId || !toWaypointId) {
        alert('Please select both from and to waypoints');
        return;
    }

    if (fromWaypointId === toWaypointId) {
        alert('Please select different source and destination waypoints');
        return;
    }

    // Handle temp waypoints or regular waypoints
    let fromWaypoint, toWaypoint;

    if (fromWaypointId.startsWith('temp_from_')) {
        fromWaypoint = AppState.tempFromPoint;
    } else {
        fromWaypoint = AppState.waypoints.find(w => w.id === fromWaypointId);
    }

    if (toWaypointId.startsWith('temp_to_')) {
        toWaypoint = AppState.tempToPoint;
    } else {
        toWaypoint = AppState.waypoints.find(w => w.id === toWaypointId);
    }

    console.log(`Finding path with object size: ${AppState.objectSize}`);
    AppState.paths = [];
    AppState.viewer.render();

    // Adjust gridSize based on rotation
    const maxRotation = Math.max(...AppState.corridors.map(c =>
        Math.abs(c.rotation || 0)
    ));

    let adaptiveGridSize = AppState.gridSize;
    if (maxRotation > 40) adaptiveGridSize = 10;
    else if (maxRotation > 30) adaptiveGridSize = 8;
    else if (maxRotation > 15) adaptiveGridSize = 7;

    console.log(`Finding path with grid size: ${adaptiveGridSize}, object size: ${AppState.objectSize}`);

    const pathfinder = new OrthogonalPathfinder(AppState.corridors, AppState.walls, adaptiveGridSize, AppState.objectSize);

    if (!fromWaypoint || !toWaypoint) {
        alert('Selected waypoints not found');
        return;
    }

    const fromPos = pathfinder.canPlaceObjectAt(fromWaypoint.x, fromWaypoint.y)
        ? fromWaypoint
        : findNearestCorridorPosition(fromWaypoint, AppState.corridors, AppState.walls, adaptiveGridSize, AppState.objectSize);

    const toPos = pathfinder.canPlaceObjectAt(toWaypoint.x, toWaypoint.y)
        ? toWaypoint
        : findNearestCorridorPosition(toWaypoint, AppState.corridors, AppState.walls, adaptiveGridSize, AppState.objectSize);

    // เช็ค null ก่อนเรียก findPath
    if (fromPos && toPos) {
        // ทั้งสองตำแหน่งใช้ได้ ลองหา path ปกติ
        const path = pathfinder.findPath(fromPos, toPos);
        if (path) {
            AppState.paths.push({
                from: fromWaypointId,
                to: toWaypointId,
                points: path,
                fromOriginal: fromWaypoint,
                toOriginal: toWaypoint,
                fromAdjusted: fromPos,
                toAdjusted: toPos
            });
            console.log(`Found path from ${fromWaypointId} to ${toWaypointId}`);
            AppState.viewer.render();
            return;
        }
    }

    // ถ้าหา path ปกติไม่ได้ หรือ position เป็น null ลองใช้ portal
    const portalPath = findPortalPath(
        fromPos || fromWaypoint,  // ใช้ position ที่หาได้ หรือตำแหน่งเดิม
        toPos || toWaypoint,      // ใช้ position ที่หาได้ หรือตำแหน่งเดิม
        pathfinder,
        AppState.waypoints
    );

    if (portalPath) {
        AppState.paths.push({
            from: fromWaypointId,
            to: toWaypointId,
            points: portalPath,
            fromOriginal: fromWaypoint,
            toOriginal: toWaypoint,
            fromAdjusted: fromPos || fromWaypoint,
            toAdjusted: toPos || toWaypoint,
            usedPortal: true
        });
        console.log(`Found portal path from ${fromWaypointId} to ${toWaypointId}`);
    } else {
        alert(`No path found from ${fromWaypointId} to ${toWaypointId}`);
    }

    AppState.viewer.render();
}

function clearPaths() {
    AppState.paths = [];
    AppState.showDebug = false;
    document.getElementById('from-waypoint').value = '';
    document.getElementById('to-waypoint').value = '';

    // Remove temp options and clear temp points
    UIManager.removeTemporaryOptions('temp_from_');
    UIManager.removeTemporaryOptions('temp_to_');

    AppState.tempFromPoint = null;
    AppState.tempToPoint = null;

    AppState.viewer.render();
    UIManager.updateInfo();
}

function toggleDebug() {
    AppState.showDebug = !AppState.showDebug;
    AppState.viewer.render();
}

// Update zoom display periodically
setInterval(() => {
    if (AppState.viewer) {
        const zoom = Math.round(AppState.viewer.zoom * 100);
        const currentZoom = document.getElementById('zoom-level').textContent;
        if (currentZoom !== zoom + '%') {
            updateInfo();
        }
    }
}, 100);
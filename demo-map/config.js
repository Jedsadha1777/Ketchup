// Base configuration
const baseConfig = {
    // Element IDs
    elements: {
        canvas: 'runtime-canvas',
        contextMenu: 'context-menu',
        fileInput: 'file-input',
        fromWaypoint: 'from-waypoint',
        toWaypoint: 'to-waypoint',
        objectSizeSlider: 'object-size',
        sizeValueDisplay: 'size-value',

        // Checkboxes
        showCorridors: 'show-corridors',
        showWalls: 'show-walls',
        showWaypoints: 'show-waypoints',
        showImages: 'show-images',
        showWarppoints: 'show-warppoints',

        // Info panel
        corridorCount: 'corridor-count',
        wallCount: 'wall-count',
        waypointCount: 'waypoint-count',
        pathCount: 'path-count',
        currentSize: 'current-size',
        minCorridor: 'min-corridor',
        zoomLevel: 'zoom-level'
    },

    // Colors and Styles
    styles: {
        // Waypoint markers
        fromMarker: {
            fillColor: '#22c55e',
            strokeColor: '#16a34a',
            labelColor: '#16a34a'
        },
        toMarker: {
            fillColor: '#ef4444',
            strokeColor: '#dc2626',
            labelColor: '#dc2626'
        },

        // Warppoint styles
        warppoint: {
            fillColor: '#9333ea',
            strokeColor: '#7e22ce',
            innerFillColor: 'rgba(255, 255, 255, 0.8)'
        },

        // Debug view colors
        debug: {
            corridorFill: 'rgba(255, 255, 0, 0.2)',
            safeAreaFill: 'rgba(0, 255, 0, 0.4)',
            wallFill: 'rgba(255, 0, 0, 0.3)',
            gridPointFill: 'rgba(0, 0, 255, 1)',
            validWaypointFill: 'rgba(100, 255, 100, 0.6)',
            invalidWaypointFill: 'rgba(255, 100, 100, 0.8)',
            validWaypointStroke: 'rgba(0, 255, 0, 1)',
            invalidWaypointStroke: 'rgba(255, 0, 0, 1)',
            waypointCenterFill: 'rgba(255, 0, 0, 1)',
            labelColor: 'black'
        },

        // Path rendering
        path: {
            lineWidth: 3,
            lineCap: 'round',
            lineJoin: 'round'
        },

        // Font styles
        fonts: {
            markerLabel: 'bold 10px Arial',
            waypointLabel: '12px Arial'
        }
    },

    // Default values
    defaults: {
        gridSize: 5,
        objectSize: 5,
        minZoom: 0.8,
        maxZoom: 5,
        zoomFactor: 0.9,
        markerRadius: 8,
        warpointRadius: 8,
        loadSampleOnStartup: false,

        // Initial visibility states
        visibility: {
            corridors: true,
            walls: true,
            waypoints: true,
            warppoints: true,
            images: true
        }
    },

    // Sample data
    sampleData: {
        version: 1,
        objects: [
            {
                id: 1,
                type: "rectangle",
                mapType: "corridor",
                x: 200,
                y: 100,
                w: 400,
                h: 20,
                color: "#f39c12",
                label: "",
                objectId: "main_corridor",
                extra: null
            },
            {
                id: 2,
                type: "rectangle",
                mapType: "corridor",
                x: 200,
                y: 100,
                w: 20,
                h: 200,
                color: "#f39c12",
                label: "",
                objectId: "side_corridor",
                extra: null
            },
            {
                id: 3,
                type: "circle",
                mapType: "waypoint",
                x: 250,
                y: 100,
                w: 16,
                h: 16,
                color: "#e74c3c",
                label: "",
                objectId: "start",
                extra: null
            },
            {
                id: 4,
                type: "circle",
                mapType: "waypoint",
                x: 550,
                y: 100,
                w: 16,
                h: 16,
                color: "#e74c3c",
                label: "",
                objectId: "end",
                extra: null
            },
            {
                id: 5,
                type: "rectangle",
                mapType: "wall",
                x: 300,
                y: 80,
                w: 100,
                h: 20,
                color: "#2c3e50",
                label: "",
                objectId: "wall1",
                extra: null
            }
        ]
    }
};

// Deep merge function
function deepMerge(target, source) {
    const result = { ...target };
    
    for (const key in source) {
        if (source.hasOwnProperty(key)) {
            if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                result[key] = deepMerge(target[key] || {}, source[key]);
            } else {
                result[key] = source[key];
            }
        }
    }
    
    return result;
}

// Apply overrides from window.CONFIG_OVERRIDES if available
let Config = baseConfig;

if (typeof window !== 'undefined' && window.CONFIG_OVERRIDES) {
    Config = deepMerge(baseConfig, window.CONFIG_OVERRIDES);
}

export { Config };
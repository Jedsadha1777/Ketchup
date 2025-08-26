import { Config } from './config.js';

export const AppState = {
    // Core
    viewer: null,

    // Data
    corridors: [],
    walls: [],
    waypoints: [],
    paths: [],

    // Temp waypoints
    tempFromPoint: null,
    tempToPoint: null,

    // Settings
    gridSize: Config.defaults.gridSize,
    objectSize: Config.defaults.objectSize,
    showDebug: false,
    showCorridors: Config.defaults.visibility.corridors,
    showWalls: Config.defaults.visibility.walls,
    showWaypoints: Config.defaults.visibility.waypoints,
    showWarppoints: Config.defaults.visibility.warppoints,

    // Interaction
    isPanning: false,
    lastPanX: 0,
    lastPanY: 0,

    // Context menu
    contextMenuVisible: false,
    contextMenuX: 0,
    contextMenuY: 0
};
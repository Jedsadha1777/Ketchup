import { IPlugin } from '../types/IPlugin.js';
import { SelectTool } from '../tools/SelectTool.js';
import { PanTool } from '../tools/PanTool.js';
import { WaypointTool } from '../tools/WaypointTool.js';
import { ImageTool } from '../tools/ImageTool.js';
import { DrawingTool } from '../tools/DrawingTool.js';

import { RectangleRenderer } from '../renderers/RectangleRenderer.js';
import { CircleRenderer } from '../renderers/CircleRenderer.js';
import { MapObjectRenderer } from '../renderers/MapObjectRenderer.js';
import { WaypointRenderer } from '../renderers/WaypointRenderer.js';
import { ImageRenderer } from '../renderers/ImageRenderer.js';

import { MAP_OBJECT_STYLES } from '../map-editor/MapObjects.js';

export default class CorePlugin extends IPlugin {
    constructor(editor, options = {}) {
        super(editor, options);
        
        this.id = 'core';
        this.name = 'Core Tools & Renderers';
        this.version = '1.0.0';
        this.description = 'Essential tools and renderers for the map editor';
        this.author = 'Map Editor Team';

        this.setupToolsAndRenderers();
    }

    setupToolsAndRenderers() {
        // Core tools
        this.tools = [
            new SelectTool(),
            new PanTool(),
            new WaypointTool(),
            new ImageTool(),
            new DrawingTool('wall', 'Wall', 'rectangle', MAP_OBJECT_STYLES.wall.color, 'wall', { icon: '🧱' }),
            new DrawingTool('corridor', 'Corridor', 'rectangle', MAP_OBJECT_STYLES.corridor.color, 'corridor', { icon: '🚶' }),
            new DrawingTool('room', 'Room', 'rectangle', MAP_OBJECT_STYLES.room.color, 'room', { icon: '🏠' })
        ];

        // Core renderers (order matters - most specific first)
        this.renderers = [
            new WaypointRenderer(),
            new MapObjectRenderer(),
            new ImageRenderer(this.editor.imageManager, () => this.editor.render()),
            new CircleRenderer(),
            new RectangleRenderer()
        ];
    }

    async init() {
        this.log('Core plugin initialized');
        
        // Set default tool
        if (this.editor.tools.has('select')) {
            this.editor.useTool('select');
        }
    }

    async cleanup() {
        this.log('Core plugin cleaned up');
    }
}
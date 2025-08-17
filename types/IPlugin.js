export class IPlugin {
    constructor(editor, options = {}) {
        this.editor = editor;
        this.options = options;
        
        // Required properties (must be overridden)
        this.id = '';
        this.name = '';
        this.version = '1.0.0';
        this.description = '';
        this.author = '';
        
        // Optional properties
        this.dependencies = [];
        this.tools = [];
        this.renderers = [];
        this.components = {};
    }

    async init() {
        // Override in subclass for initialization logic
    }

    async cleanup() {
        // Override in subclass for cleanup logic
    }

    // Event handlers
    onToolChange(toolId) {
        // Override in subclass
    }

    onObjectCreate(object) {
        // Override in subclass
    }

    onObjectUpdate(object) {
        // Override in subclass
    }

    onObjectDelete(object) {
        // Override in subclass
    }

    // Utility methods
    log(message, ...args) {
        console.log(`[${this.name}]`, message, ...args);
    }

    warn(message, ...args) {
        console.warn(`[${this.name}]`, message, ...args);
    }

    error(message, ...args) {
        console.error(`[${this.name}]`, message, ...args);
    }
}
import { IPlugin } from '../types/IPlugin.js';
import { TextTool } from '../tools/TextTool.js';
import { TextRenderer } from '../renderers/TextRenderer.js';

export default class TextPlugin extends IPlugin {
    constructor(editor, options = {}) {
        super(editor, options);
        
        this.id = 'text';
        this.name = 'Text Component';
        this.version = '1.0.0';
        this.description = 'Add and edit text objects on the map';
        this.author = 'Map Editor Team';

        this.setupComponents();
    }

    setupComponents() {
        this.tools = [
            new TextTool()
        ];

        this.renderers = [
            new TextRenderer()
        ];
    }

    async init() {
        this.log('Text plugin initialized');
        
        // Listen for tool changes to cleanup text editing
        this.editor.on('toolChanged', (data) => {
            const textTool = this.tools.find(tool => tool.id === 'text');
            if (textTool && data.newTool !== 'text') {
                textTool.finishEditing(this.editor.api);
            }
        });
    }

    async cleanup() {
        this.log('Text plugin cleaned up');
        
        // Cleanup any active text editing
        const textTool = this.tools.find(tool => tool.id === 'text');
        if (textTool) {
            textTool.finishEditing(this.editor.api);
        }
    }

    onToolChange(toolId) {
        // Cleanup text editing when switching tools
        if (toolId !== 'text') {
            const textTool = this.tools.find(tool => tool.id === 'text');
            if (textTool) {
                textTool.finishEditing(this.editor.api);
            }
        }
    }
}
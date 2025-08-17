export class ToolbarPanel {
    constructor(editor) {
        this.editor = editor;
        this.toolbarElement = document.querySelector('.toolbar');
    }

    render() {
        this.toolbarElement.innerHTML = '';
        
        for (const tool of this.editor.tools.list()) {
            const btn = document.createElement('button');
            btn.className = 'tool-btn';
            btn.dataset.tool = tool.id;
            btn.title = tool.title;
            btn.innerHTML = tool.icon || tool.title;
            
            if (tool.id === 'select') btn.classList.add('active');
            
            btn.addEventListener('click', () => this.editor.useTool(tool.id));
            this.toolbarElement.appendChild(btn);
            
            // Add separator after select tool
            if (tool.id === 'select') {
                this.addSeparator();
            }
        }
    }

    addSeparator() {
        const sep = document.createElement('div');
        sep.className = 'tool-separator';
        this.toolbarElement.appendChild(sep);
    }

    setActiveTool(toolId) {
        document.querySelectorAll('.tool-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tool === toolId);
        });
    }
}
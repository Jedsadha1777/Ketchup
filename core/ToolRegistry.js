export class ToolRegistry {
    constructor() {
        this.tools = new Map();
    }

    add(tool) {
        this.tools.set(tool.id, tool);
    }

     remove(toolId) {
        return this.tools.delete(toolId);
    }

    get(id) {
        return this.tools.get(id);
    }

    list() {
        return [...this.tools.values()];
    }

    has(id) {
        return this.tools.has(id);
    }
}

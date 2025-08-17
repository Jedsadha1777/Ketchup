export class ObjectRendererRegistry {
    constructor() {
        this.renderers = [];
    }
    
    register(renderer) {
        this.renderers.push(renderer);
    }

    unregister(renderer) {
        const index = this.renderers.indexOf(renderer);
        if (index > -1) {
            this.renderers.splice(index, 1);
            return true;
        }
        return false;
    }    
    
    getRenderer(obj) {
        // Find first renderer that can handle this object
        for (const renderer of this.renderers) {
            if (renderer.canRender(obj)) {
                return renderer;
            }
        }
        return null;
    }
    
    draw(obj, ctx, view) {
        const renderer = this.getRenderer(obj);
        if (renderer) {
            renderer.draw(obj, ctx, view);
        }
    }
    
    contains(obj, px, py) {
        const renderer = this.getRenderer(obj);
        if (renderer && renderer.contains) {
            return renderer.contains(obj, px, py);
        }
        // Fallback to default rectangle test
        return px >= obj.x && px <= obj.x + obj.width &&
               py >= obj.y && py <= obj.y + obj.height;
    }
}
export class ObjectRenderer {
    canRender(obj) {
        return false;
    }
    
    draw(obj, ctx, view) {
        // obj = { type, mapType, x, y, width, height, color, ... }
        // view = { zoom, selected }
    }
    
    contains(obj, px, py) {
        // Default rectangle hit test
        return px >= obj.x && px <= obj.x + obj.width &&
               py >= obj.y && py <= obj.y + obj.height;
    }
}

export class ITool {
    constructor(id, title, options = {}) {
        this.id = id;
        this.title = title;
        this.icon = options.icon;
        this.cursor = options.cursor || 'default';
    }

    activate(ctx) {}
    deactivate(ctx) {}
    onPointerDown(e, pos, ctx) {}
    onPointerMove(e, pos, ctx) {}
    onPointerUp(e, pos, ctx) {}
    onKeyDown(e, ctx) {}
    drawOverlay(ctx) {}
}

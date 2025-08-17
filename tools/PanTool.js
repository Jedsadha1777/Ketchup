import { ITool } from '../types/ITool.js';

export class PanTool extends ITool {
    constructor() {
        super('pan', 'Pan', { 
            icon: '✋',
            cursor: 'grab'
        });
        this.isPanning = false;
        this.lastPanX = 0;
        this.lastPanY = 0;
    }

    activate(ctx) {
        ctx.updateCursor('grab');
    }

    onPointerDown(e, pos, ctx) {
        this.isPanning = true;
        this.lastPanX = e.clientX;
        this.lastPanY = e.clientY;
        ctx.updateCursor('grabbing');
    }

    onPointerMove(e, pos, ctx) {
        if (!this.isPanning) {
            ctx.updateCursor('grab');
            return;
        }

        // Access through the editor instance
        const newPanX = ctx.panX + (e.clientX - this.lastPanX);
        const newPanY = ctx.panY + (e.clientY - this.lastPanY);
       
        ctx.panX = newPanX;
        ctx.panY = newPanY;

        this.lastPanX = e.clientX;
        this.lastPanY = e.clientY;
        ctx.render();
    }

    onPointerUp(e, pos, ctx) {
        this.isPanning = false;
        ctx.updateCursor('grab');
    }
}

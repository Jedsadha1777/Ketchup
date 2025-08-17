import { Command } from '../Command.js';

export class ResizeObjectCmd extends Command {
    constructor(objectManager, spatialGrid, objectId, fromBounds, toBounds) {
        super();
        this.om = objectManager;
        this.sg = spatialGrid;
        this.objectId = objectId;
        this.from = fromBounds;
        this.to = toBounds;
    }

    do() {
        const index = this.om.getIndexById(this.objectId);
        if (index === undefined) return;
        
        // Remove from spatial grid at old bounds
        this.sg.removeObject(this.objectId, this.from.x, this.from.y, this.from.width, this.from.height);

        
        // Update object bounds
        this.om.setBounds(index, this.to);
        
        // Add to spatial grid at new bounds
        this.sg.addObject(this.objectId, this.to.x, this.to.y, this.to.width, this.to.height);

    }

    undo() {
        const index = this.om.getIndexById(this.objectId);
        if (index === undefined) return;
        
        // Remove from spatial grid at current bounds
        this.sg.removeObject(this.objectId, this.to.x, this.to.y, this.to.width, this.to.height);
        
        // Restore object bounds
        this.om.setBounds(index, this.from);

        
        // Add to spatial grid at old bounds
        this.sg.addObject(this.objectId, this.from.x, this.from.y, this.from.width, this.from.height);
    }

    merge(next) {
        // Merge consecutive resizes of the same object
        if (next instanceof ResizeObjectCmd && next.objectId === this.objectId) {
            this.to = next.to;
            return true;
        }
        return false;
    }
}

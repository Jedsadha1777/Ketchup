import { Command } from '../Command.js';

export class ResizeObjectCmd extends Command {
    constructor(objectManager, spatialGrid, objectId, fromBounds, toBounds) {
        super();
        this.om = objectManager;
        this.sg = spatialGrid;
        this.objectId = objectId;
        this.from = fromBounds;
        this.to = toBounds;
        this.propertyEvents = null; // Will be set by editor

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

        // Trigger property change events
        if (this.propertyEvents) {
            if (this.to.x !== this.from.x) {
                this.propertyEvents.triggerPropertyChange(index, 'x', this.from.x, this.to.x);
            }
            if (this.to.y !== this.from.y) {
                this.propertyEvents.triggerPropertyChange(index, 'y', this.from.y, this.to.y);
            }
            if (this.to.width !== this.from.width) {
                this.propertyEvents.triggerPropertyChange(index, 'width', this.from.width, this.to.width);
            }
            if (this.to.height !== this.from.height) {
                this.propertyEvents.triggerPropertyChange(index, 'height', this.from.height, this.to.height);
            }
        }

        
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

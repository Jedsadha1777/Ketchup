import { Command } from '../Command.js';

export class MoveObjectCmd extends Command {
    constructor(objectManager, spatialGrid, objectId, from, to) {
        super();
        this.om = objectManager;
        this.sg = spatialGrid;
        this.objectId = objectId;
        this.from = from;
        this.to = to;
        this.propertyEvents = null; // Will be set by editor

    }

    do() {
        const index = this.om.getIndexById(this.objectId);
        if (index === undefined) return;
        
        // Remove from spatial grid at old position
        const oldBounds = this.om.getBounds(index);
        this.sg.removeObject(this.objectId, oldBounds.x, oldBounds.y, oldBounds.width, oldBounds.height);
        
        // Update object position
        this.om.updateObject(index, this.to);

        // Trigger property change events
        if (this.propertyEvents && this.from.x !== this.to.x) {
            this.propertyEvents.triggerPropertyChange(index, 'x', this.to.x, this.from.x);
        }
        if (this.propertyEvents && this.from.y !== this.to.y) {
            this.propertyEvents.triggerPropertyChange(index, 'y', this.to.y, this.from.y);
        }
        
        // Add to spatial grid at new position
        this.sg.addObject(this.objectId, this.to.x, this.to.y,
            this.om.width[index], this.om.height[index]);
    }

    undo() {
        const index = this.om.getIndexById(this.objectId);
        if (index === undefined) return;

        // Remove from spatial grid at current position
        const currentBounds = this.om.getBounds(index);
        this.sg.removeObject(this.objectId, currentBounds.x, currentBounds.y, currentBounds.width, currentBounds.height);
        
        // Restore object position
        this.om.updateObject(index, this.from);

         // Trigger property change events
        if (this.propertyEvents && this.to.x !== this.from.x) {
            this.propertyEvents.triggerPropertyChange(index, 'x', this.from.x, this.to.x);
        }
        if (this.propertyEvents && this.to.y !== this.from.y) {
            this.propertyEvents.triggerPropertyChange(index, 'y', this.from.y, this.to.y);
        }
        
        // Add to spatial grid at old position
        this.sg.addObject(this.objectId, this.from.x, this.from.y,
            this.om.width[index], this.om.height[index]);
    }

    merge(next) {
        // Merge consecutive moves of the same object
        if (next instanceof MoveObjectCmd && next.objectId === this.objectId) {
            this.to = next.to;
            return true;
        }
        return false;
    }
}
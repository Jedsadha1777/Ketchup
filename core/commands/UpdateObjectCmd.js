import { Command } from '../Command.js';

export class UpdateObjectCmd extends Command {
    constructor(objectManager, objectId, oldData, newData) {
        super();
        this.om = objectManager;
        this.objectId = objectId;
        this.oldData = JSON.parse(JSON.stringify(oldData));
        this.newData = JSON.parse(JSON.stringify(newData));
    }

    do() {
        const index = this.om.getIndexById(this.objectId);
        if (index === undefined) return;

        // Apply new data
        if (this.newData.label !== undefined) this.om.labels[index] = this.newData.label;
        if (this.newData.extra !== undefined) {
            this.om.extra[index] = this.newData.extra ? JSON.parse(JSON.stringify(this.newData.extra)) : null;
        }

        return true;
    }

    undo() {
        const index = this.om.getIndexById(this.objectId);
        if (index === undefined) return;

        // Restore old data
        if (this.oldData.label !== undefined) this.om.labels[index] = this.oldData.label;
        if (this.oldData.extra !== undefined) {
            this.om.extra[index] = this.oldData.extra ? JSON.parse(JSON.stringify(this.oldData.extra)) : null;
        }

        return true;
    }

    merge(next) {
        // Merge consecutive text updates
        if (next instanceof UpdateObjectCmd && next.objectId === this.objectId) {
            this.newData = JSON.parse(JSON.stringify(next.newData));
            return true;
        }
        return false;
    }
}
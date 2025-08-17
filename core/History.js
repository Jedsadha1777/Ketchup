export class History {
    constructor() {
        this.undoStack = [];
        this.redoStack = [];
        this.maxSize = 100;
    }

    exec(command) {
        // Execute the command
        const result = command.do();
        
        // Try to merge with previous command
        if (this.undoStack.length > 0) {
            const lastCmd = this.undoStack[this.undoStack.length - 1];
            if (lastCmd.merge && lastCmd.merge(command)) {
                // Command was merged, don't add to stack
                this.redoStack.length = 0; // Clear redo stack
                return result;
            }
        }
        
        // Add to undo stack
        this.undoStack.push(command);
        
        // Limit stack size
        if (this.undoStack.length > this.maxSize) {
            this.undoStack.shift();
        }
        
        // Clear redo stack when new command is executed
        this.redoStack.length = 0;
        
        return result;
    }

    undo() {
        if (this.undoStack.length === 0) return false;
        
        const command = this.undoStack.pop();
        command.undo();
        this.redoStack.push(command);
        
        return true;
    }

    redo() {
        if (this.redoStack.length === 0) return false;
        
        const command = this.redoStack.pop();
        command.do();
        this.undoStack.push(command);
        
        return true;
    }

    canUndo() {
        return this.undoStack.length > 0;
    }

    canRedo() {
        return this.redoStack.length > 0;
    }

    clear() {
        this.undoStack.length = 0;
        this.redoStack.length = 0;
    }
}
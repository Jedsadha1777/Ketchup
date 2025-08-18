export class TextUtils {
    static wrapText(text, maxWidth, ctx) {
        if (!text || maxWidth <= 0) return text;
        
        // Split by existing line breaks first
        const paragraphs = text.split('\n');
        const lines = [];
        
        for (const paragraph of paragraphs) {
            if (paragraph.trim() === '') {
                lines.push('');
                continue;
            }
            
            const words = paragraph.split(' ');
            let currentLine = '';
            
            for (const word of words) {
                const testLine = currentLine + (currentLine ? ' ' : '') + word;
                const testWidth = ctx.measureText(testLine).width;
                
                if (testWidth > maxWidth) {
                    // If current line is not empty, finish it and start a new line
                     if (currentLine) {
                         lines.push(currentLine);

                        currentLine = word;
                    } else {
                        // Current line is empty but word is too long, need to break the word
                        if (ctx.measureText(word).width > maxWidth) {
                            lines.push(...this.breakLongWord(word, maxWidth, ctx));
                            currentLine = '';
                        } else {
                            currentLine = word;
                        }
                     }

                 } else {
                    // Word fits on current line
                     currentLine = testLine;
                 }
             }
            
            if (currentLine) lines.push(currentLine);
        }
       
        return lines.join('\n');
    }
    
    static wrapTextToLines(text, maxWidth, ctx) {
        const wrappedText = this.wrapText(text, maxWidth, ctx);
        return wrappedText.split('\n');
    }
    
     static breakLongWord(word, maxWidth, ctx) {
       if (ctx.measureText(word).width <= maxWidth) {
            return [word];
        }
        
        const chars = word.split('');
        const lines = [];
        let currentLine = '';
        
        for (const char of chars) {
            const testLine = currentLine + char;
            const testWidth = ctx.measureText(testLine).width;
            
            if (testWidth > maxWidth && currentLine) {
                lines.push(currentLine);
                currentLine = char;
            } else {
                currentLine = testLine;
            }
        }
        
        if (currentLine) lines.push(currentLine);
        return lines;
    }
}
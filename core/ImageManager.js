export class ImageManager {
    constructor() {
        this.cache = new Map(); // src -> HTMLImageElement
        this.loading = new Map(); // src -> Promise
    }

    async loadImage(src) {
        // Return cached image if available
        if (this.cache.has(src)) {
            return this.cache.get(src);
        }

        // Return existing promise if already loading
        if (this.loading.has(src)) {
            return this.loading.get(src);
        }

        // Start loading
        const promise = new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                this.cache.set(src, img);
                this.loading.delete(src);
                resolve(img);
            };
            img.onerror = () => {
                this.loading.delete(src);
                reject(new Error(`Failed to load image: ${src}`));
            };
            img.src = src;
        });

        this.loading.set(src, promise);
        return promise;
    }

    isLoaded(src) {
        return this.cache.has(src);
    }

    getImage(src) {
        return this.cache.get(src);
    }

    clear() {
        this.cache.clear();
        this.loading.clear();
    }
}
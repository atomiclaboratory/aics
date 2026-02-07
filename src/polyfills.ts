// Polyfills for pdf-parse (pdf.js dependency) which crashes in Node 18+ without these
if (typeof global.DOMMatrix === 'undefined') {
    (global as any).DOMMatrix = class DOMMatrix {};
}
if (typeof global.ImageData === 'undefined') {
    (global as any).ImageData = class ImageData {};
}
if (typeof global.Path2D === 'undefined') {
    (global as any).Path2D = class Path2D {};
}
export {};

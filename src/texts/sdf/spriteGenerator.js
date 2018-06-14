'use strict';


var INF = 1e20;
// function getEl(id) {
//     return document.getElementById(id);
// }


// Stores the x- and y- position of glyphs in the sprite sheet so formed 
// format: sdfs['a'].x or sdfs['a'].y
let SDFS = {};

// list of all characters to be included in the sprite sheet
const CHARS = "abcdefghijklmnopqrstuvwxyzH";

export default class SpriteGenerator {

    constructor() {
        // Member variables for configurations for font-style and box of the font
        this.fontSize = 24;
        this.buffer = this.fontSize / 8;
        this.radius = this.fontSize / 3;
        this.cutoff = 0.25;
        this.fontFamily = 'sans-serif';
        this.fontWeight = 'normal';
        // Size of one box of character
        let size = this.size = this.fontSize + this.buffer * 2;

        // Member varaibles for single canvas element on which single character is to be drawn
        this.canvas = document.createElement('canvas');
        this.canvas.width = this.canvas.height = size;
        this.ctx = this.canvas.getContext('2d');
        this.ctx.font = this.fontWeight + ' ' + this.fontSize + 'px ' + this.fontFamily;
        this.ctx.textBaseline = 'middle';
        this.ctx.fillStyle = 'black';
        // Work-around: https://bugzilla.mozilla.org/show_bug.cgi?id=737852
        this.middle = Math.round((size / 2) * (navigator.userAgent.indexOf('Gecko/') >= 0 ? 1.2 : 1));
        

        // Member variables for temp arrays required for the distance transform
        this.gridOuter = new Float64Array(size * size);
        this.gridInner = new Float64Array(size * size);
        this.f = new Float64Array(size);
        this.d = new Float64Array(size);
        this.z = new Float64Array(size + 1);
        this.v = new Int16Array(size);       
    }

    // Returns the alpha channel for a single character
    draw(char) {
        // Clear the area and draw the glyph
        this.ctx.clearRect(0, 0, this.size, this.size);
        this.ctx.fillText(char, this.buffer, this.middle);
        let imgData = this.ctx.getImageData(0, 0, this.size, this.size);
        let alphaChannel = new Uint8ClampedArray(this.size * this.size);

        for (let i = 0; i < this.size * this.size; i++) {
            let a = imgData.data[i * 4 + 3] / 255; // alpha value
            this.gridOuter[i] = a === 1 ? 0 : a === 0 ? INF : Math.pow(Math.max(0, 0.5 - a), 2);
            this.gridInner[i] = a === 1 ? INF : a === 0 ? 0 : Math.pow(Math.max(0, a - 0.5), 2);
        }

        this._edt(this.gridOuter, this.size, this.size, this.f, this.d, this.v, this.z);
        this._edt(this.gridInner, this.size, this.size, this.f, this.d, this.v, this.z);

        for (let i = 0; i < this.size * this.size; i++) {
            let d = this.gridOuter[i] - this.gridInner[i];
            alphaChannel[i] = Math.max(0, Math.min(255, Math.round(255 - 255 * (d / this.radius + this.cutoff))));
        }
        return alphaChannel;
    }

    // 2D Euclidean distance transform by Felzenszwalb & Huttenlocher https://cs.brown.edu/~pff/papers/dt-final.pdf
    _edt(data, width, height, f, d, v, z) {
        for (let x = 0; x < width; x++) {
            for (let y = 0; y < height; y++) {
                f[y] = data[y * width + x];
            }
            this._edt1d(f, d, v, z, height);
            for (let y = 0; y < height; y++) {
                data[y * width + x] = d[y];
            }
        }
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                f[x] = data[y * width + x];
            }
            this._edt1d(f, d, v, z, width);
            for (let x = 0; x < width; x++) {
                data[y * width + x] = Math.sqrt(d[x]);
            }
        }
    }

    // 1D squared distance transform
    _edt1d(f, d, v, z, n) {
        v[0] = 0;
        z[0] = -INF;
        z[1] = +INF;

        for (let q = 1, k = 0; q < n; q++) {
            var s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
            while (s <= z[k]) {
                k--;
                s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
            }
            k++;
            v[k] = q;
            z[k] = s;
            z[k + 1] = +INF;
        }

        for (let q = 0, k = 0; q < n; q++) {
            while (z[k + 1] < q) k++;
            d[q] = (q - v[k]) * (q - v[k]) + f[v[k]];
        }
    }

    // Convert alpha-only to RGBA so we can use convenient
    // `putImageData` for building the composite bitmap
    _makeRGBAImageData(alphaChannel, size) {
        let imageData = this.ctx.createImageData(size, size);
        let data = imageData.data;
        for (let i = 0; i < alphaChannel.length; i++) {
            data[4 * i + 0] = alphaChannel[i];
            data[4 * i + 1] = alphaChannel[i];
            data[4 * i + 2] = alphaChannel[i];
            data[4 * i + 3] = 255;
        }
        return imageData;
    }

    // returns the complete spritesheet for the characters provided in the global variables
    makeSpriteSheet() {
        // Some initial configurations
        let canvas = document.createElement('canvas');

        // TODO: will have to do something about the harcoded values
        this.canvas.width = 1000;
        this.canvas.height = 200;
        
        let ctx = canvas.getContext('2d');
        let h = 0,
            w = 0;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        let ret2 = [];

        // Drawing all Characters in a single canvas object
        for (let y = 0, i = 0; y + this.size <= canvas.height && i < CHARS.length; y += this.size) {
            for (let x = 0; x + this.size <= canvas.width && i < CHARS.length; x += this.size) {
                let imgData = this._makeRGBAImageData(this.draw(CHARS[i]), this.size);
                ctx.putImageData(imgData, x, y);
                SDFS[CHARS[i]] = { x: x, y: y };

                ret2.push({
                    id: CHARS[i].charCodeAt(0),
                    bitmap: this.draw(CHARS[i]),
                    left: y,
                    top: y,
                    width: this.size,
                    height: this.size,
                    advance: 0,
                });

                i++;
                w += this.size;
            }
            h += this.size;
        }
        let ret = ctx.getImageData(0, 0, w, h);
        let return_values = {
            ret: ret,
            ret2: ret2
        };

        console.log("return_values", return_values);
        return return_values;
    }

}
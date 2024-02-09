"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaneRendererCandlesticks = void 0;
const canvas_helpers_1 = require("../helpers/canvas-helpers");
const bitmap_coordinates_pane_renderer_1 = require("./bitmap-coordinates-pane-renderer");
const optimal_bar_width_1 = require("./optimal-bar-width");
var Constants;
(function (Constants) {
    Constants[Constants["BarBorderWidth"] = 1] = "BarBorderWidth";
})(Constants || (Constants = {}));
class PaneRendererCandlesticks extends bitmap_coordinates_pane_renderer_1.BitmapCoordinatesPaneRenderer {
    constructor() {
        super(...arguments);
        this._data = null;
        // scaled with pixelRatio
        this._barWidth = 0;
    }
    setData(data) {
        this._data = data;
    }
    _drawImpl(renderingScope) {
        if (this._data === null || this._data.bars.length === 0 || this._data.visibleRange === null) {
            return;
        }
        const { horizontalPixelRatio } = renderingScope;
        // now we know pixelRatio and we could calculate barWidth effectively
        this._barWidth = (0, optimal_bar_width_1.optimalCandlestickWidth)(this._data.barSpacing, horizontalPixelRatio);
        // grid and crosshair have line width = Math.floor(pixelRatio)
        // if this value is odd, we have to make candlesticks' width odd
        // if this value is even, we have to make candlesticks' width even
        // in order of keeping crosshair-over-candlesticks drawing symmetric
        if (this._barWidth >= 2) {
            const wickWidth = Math.floor(horizontalPixelRatio);
            if ((wickWidth % 2) !== (this._barWidth % 2)) {
                this._barWidth--;
            }
        }
        const bars = this._data.bars;
        if (this._data.wickVisible) {
            this._drawWicks(renderingScope, bars, this._data.visibleRange);
        }
        if (this._data.borderVisible) {
            this._drawBorder(renderingScope, bars, this._data.visibleRange);
        }
        const borderWidth = this._calculateBorderWidth(horizontalPixelRatio);
        if (!this._data.borderVisible || this._barWidth > borderWidth * 2) {
            this._drawCandles(renderingScope, bars, this._data.visibleRange);
        }
    }
    _drawWicks(renderingScope, bars, visibleRange) {
        if (this._data === null) {
            return;
        }
        const { context: ctx, horizontalPixelRatio, verticalPixelRatio } = renderingScope;
        let prevWickColor = '';
        let wickWidth = Math.min(Math.floor(horizontalPixelRatio), Math.floor(this._data.barSpacing * horizontalPixelRatio));
        wickWidth = Math.max(Math.floor(horizontalPixelRatio), Math.min(wickWidth, this._barWidth));
        const wickOffset = Math.floor(wickWidth * 0.5);
        let prevEdge = null;
        for (let i = visibleRange.from; i < visibleRange.to; i++) {
            const bar = bars[i];
            if (bar.barWickColor !== prevWickColor) {
                ctx.fillStyle = bar.barWickColor;
                prevWickColor = bar.barWickColor;
            }
            const top = Math.round(Math.min(bar.openY, bar.closeY) * verticalPixelRatio);
            const bottom = Math.round(Math.max(bar.openY, bar.closeY) * verticalPixelRatio);
            const high = Math.round(bar.highY * verticalPixelRatio);
            const low = Math.round(bar.lowY * verticalPixelRatio);
            const scaledX = Math.round(horizontalPixelRatio * bar.x);
            let left = scaledX - wickOffset;
            const right = left + wickWidth - 1;
            if (prevEdge !== null) {
                left = Math.max(prevEdge + 1, left);
                left = Math.min(left, right);
            }
            const width = right - left + 1;
            ctx.fillRect(left, high, width, top - high);
            ctx.fillRect(left, bottom + 1, width, low - bottom);
            prevEdge = right;
        }
    }
    _calculateBorderWidth(pixelRatio) {
        let borderWidth = Math.floor(1 /* Constants.BarBorderWidth */ * pixelRatio);
        if (this._barWidth <= 2 * borderWidth) {
            borderWidth = Math.floor((this._barWidth - 1) * 0.5);
        }
        const res = Math.max(Math.floor(pixelRatio), borderWidth);
        if (this._barWidth <= res * 2) {
            // do not draw bodies, restore original value
            return Math.max(Math.floor(pixelRatio), Math.floor(1 /* Constants.BarBorderWidth */ * pixelRatio));
        }
        return res;
    }
    _drawBorder(renderingScope, bars, visibleRange) {
        if (this._data === null) {
            return;
        }
        const { context: ctx, horizontalPixelRatio, verticalPixelRatio } = renderingScope;
        let prevBorderColor = '';
        const borderWidth = this._calculateBorderWidth(horizontalPixelRatio);
        let prevEdge = null;
        for (let i = visibleRange.from; i < visibleRange.to; i++) {
            const bar = bars[i];
            if (bar.barBorderColor !== prevBorderColor) {
                ctx.fillStyle = bar.barBorderColor;
                prevBorderColor = bar.barBorderColor;
            }
            let left = Math.round(bar.x * horizontalPixelRatio) - Math.floor(this._barWidth * 0.5);
            // this is important to calculate right before patching left
            const right = left + this._barWidth - 1;
            const top = Math.round(Math.min(bar.openY, bar.closeY) * verticalPixelRatio);
            const bottom = Math.round(Math.max(bar.openY, bar.closeY) * verticalPixelRatio);
            if (prevEdge !== null) {
                left = Math.max(prevEdge + 1, left);
                left = Math.min(left, right);
            }
            if (this._data.barSpacing * horizontalPixelRatio > 2 * borderWidth) {
                (0, canvas_helpers_1.fillRectInnerBorder)(ctx, left, top, right - left + 1, bottom - top + 1, borderWidth);
            }
            else {
                const width = right - left + 1;
                ctx.fillRect(left, top, width, bottom - top + 1);
            }
            prevEdge = right;
        }
    }
    _drawCandles(renderingScope, bars, visibleRange) {
        if (this._data === null) {
            return;
        }
        const { context: ctx, horizontalPixelRatio, verticalPixelRatio } = renderingScope;
        let prevBarColor = '';
        const borderWidth = this._calculateBorderWidth(horizontalPixelRatio);
        for (let i = visibleRange.from; i < visibleRange.to; i++) {
            const bar = bars[i];
            let top = Math.round(Math.min(bar.openY, bar.closeY) * verticalPixelRatio);
            let bottom = Math.round(Math.max(bar.openY, bar.closeY) * verticalPixelRatio);
            let left = Math.round(bar.x * horizontalPixelRatio) - Math.floor(this._barWidth * 0.5);
            let right = left + this._barWidth - 1;
            if (bar.barColor !== prevBarColor) {
                const barColor = bar.barColor;
                ctx.fillStyle = barColor;
                prevBarColor = barColor;
            }
            if (this._data.borderVisible) {
                left += borderWidth;
                top += borderWidth;
                right -= borderWidth;
                bottom -= borderWidth;
            }
            if (top > bottom) {
                continue;
            }
            ctx.fillRect(left, top, right - left + 1, bottom - top + 1);
        }
    }
}
exports.PaneRendererCandlesticks = PaneRendererCandlesticks;

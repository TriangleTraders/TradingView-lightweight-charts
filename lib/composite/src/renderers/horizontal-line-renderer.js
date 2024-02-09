"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HorizontalLineRenderer = void 0;
const bitmap_coordinates_pane_renderer_1 = require("./bitmap-coordinates-pane-renderer");
const draw_line_1 = require("./draw-line");
var Constants;
(function (Constants) {
    Constants[Constants["HitTestThreshold"] = 7] = "HitTestThreshold";
})(Constants || (Constants = {}));
class HorizontalLineRenderer extends bitmap_coordinates_pane_renderer_1.BitmapCoordinatesPaneRenderer {
    constructor() {
        super(...arguments);
        this._data = null;
    }
    setData(data) {
        this._data = data;
    }
    hitTest(x, y) {
        var _a;
        if (!((_a = this._data) === null || _a === void 0 ? void 0 : _a.visible)) {
            return null;
        }
        const { y: itemY, lineWidth, externalId } = this._data;
        // add a fixed area threshold around line (Y + width) for hit test
        if (y >= itemY - lineWidth - 7 /* Constants.HitTestThreshold */ && y <= itemY + lineWidth + 7 /* Constants.HitTestThreshold */) {
            return {
                hitTestData: this._data,
                externalId: externalId,
            };
        }
        return null;
    }
    _drawImpl({ context: ctx, bitmapSize, horizontalPixelRatio, verticalPixelRatio }) {
        if (this._data === null) {
            return;
        }
        if (this._data.visible === false) {
            return;
        }
        const y = Math.round(this._data.y * verticalPixelRatio);
        if (y < 0 || y > bitmapSize.height) {
            return;
        }
        ctx.lineCap = 'butt';
        ctx.strokeStyle = this._data.color;
        ctx.lineWidth = Math.floor(this._data.lineWidth * horizontalPixelRatio);
        (0, draw_line_1.setLineStyle)(ctx, this._data.lineStyle);
        (0, draw_line_1.drawHorizontalLine)(ctx, y, 0, bitmapSize.width);
    }
}
exports.HorizontalLineRenderer = HorizontalLineRenderer;

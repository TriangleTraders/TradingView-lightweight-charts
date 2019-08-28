import { Coordinate } from '../model/coordinate';
import { SeriesItemsIndexesRange } from '../model/time-data';

import { LineStyle, LineType, LineWidth, setLineStyle } from './draw-line';
import { IPaneRenderer } from './ipane-renderer';
import { LineItem } from './line-renderer';
import { walkLine } from './walk-line';

export interface PaneRendererAreaData {
	items: LineItem[];
	lineType: LineType;
	lineColor: string;
	lineWidth: LineWidth;
	lineStyle: LineStyle;

	topColor: string;
	bottomColor: string;
	bottom: Coordinate;
	zeroLine: Coordinate;

	visibleRange: SeriesItemsIndexesRange | null;
}

export class PaneRendererArea implements IPaneRenderer {
	protected _data: PaneRendererAreaData | null = null;

	public setData(data: PaneRendererAreaData): void {
		this._data = data;
	}

	public draw(ctx: CanvasRenderingContext2D): void {
		if (this._data === null || this._data.items.length === 0 || this._data.visibleRange === null) {
			return;
		}

		const baseline = Math.min(this._data.bottom, this._data.zeroLine);

		ctx.save();

		ctx.lineCap = 'square';
		ctx.strokeStyle = this._data.lineColor;
		ctx.lineWidth = this._data.lineWidth;
		setLineStyle(ctx, this._data.lineStyle);

		// walk lines with width=1 to have more accurate gradient's filling
		ctx.lineWidth = 1;

		ctx.beginPath();
		ctx.moveTo(this._data.items[this._data.visibleRange.from].x, baseline);
		ctx.lineTo(this._data.items[this._data.visibleRange.from].x, this._data.items[this._data.visibleRange.from].y);

		walkLine(ctx, this._data.items, this._data.lineType, this._data.visibleRange);

		ctx.lineTo(this._data.items[this._data.visibleRange.to - 1].x, baseline);
		ctx.lineTo(this._data.items[this._data.visibleRange.from].x, baseline);
		ctx.closePath();

		const gradient = ctx.createLinearGradient(0, 0, 0, baseline);
		gradient.addColorStop(0, this._data.topColor);
		gradient.addColorStop(1, this._data.bottomColor);

		ctx.fillStyle = gradient;
		ctx.fill();

		ctx.restore();
	}
}

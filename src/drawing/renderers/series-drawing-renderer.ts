import { MediaCoordinatesRenderingScope } from 'fancy-canvas';
import { Coordinate } from '../../model/coordinate';
import { SeriesItemsIndexesRange, TimedValue } from '../../model/time-data';
import { MediaCoordinatesPaneRenderer } from '../../renderers/media-coordinates-pane-renderer';
import { TextWidthCache } from '../../model/text-width-cache';
import { makeFont } from '../../helpers/make-font';
import { HoveredObject } from '../../model/chart-model';
import { drawText, hitTestText } from '../../renderers/series-markers-text';
import { drawArrow, hitTestArrow } from '../../renderers/series-markers-arrow';
import { drawCircle, hitTestCircle } from '../../renderers/series-markers-circle';
import { drawSquare, hitTestSquare } from '../../renderers/series-markers-square';
import { ensureNever } from '../../helpers/assertions';
import { SeriesDrawingShape } from '../model/series-drawing';

export interface SeriesDrawingText {
	content: string;
	x: Coordinate;
	y: Coordinate;
	width: number;
	height: number;
}

export interface SeriesDrawingRendererDataItem extends TimedValue {
	y: Coordinate;
	size: number;
	shape: SeriesDrawingShape;
	color: string;
	internalId: number;
	externalId?: string;
	text?: SeriesDrawingText;
}

export interface SeriesDrawingRendererData {
	items: SeriesDrawingRendererDataItem[];
	visibleRange: SeriesItemsIndexesRange | null;
}

export class SeriesDrawingRenderer extends MediaCoordinatesPaneRenderer {
	private _data: SeriesDrawingRendererData | null = null;
	private _textWidthCache: TextWidthCache = new TextWidthCache();
	private _fontSize: number = -1;
	private _fontFamily: string = '';
	private _font: string = '';

	public setData(data: SeriesDrawingRendererData): void {
		this._data = data;
	}

	public setParams(fontSize: number, fontFamily: string): void {
		if (this._fontSize !== fontSize || this._fontFamily !== fontFamily) {
			this._fontSize = fontSize;
			this._fontFamily = fontFamily;
			this._font = makeFont(fontSize, fontFamily);
			this._textWidthCache.reset();
		}
	}

	public hitTest(x: Coordinate, y: Coordinate): HoveredObject | null {
		if (this._data === null || this._data.visibleRange === null) {
			return null;
		}

		for (let i = this._data.visibleRange.from; i < this._data.visibleRange.to; i++) {
			const item = this._data.items[i];
			if (hitTestItem(item, x, y)) {
				return {
					hitTestData: item.internalId,
					externalId: item.externalId,
				};
			}
		}

		return null;
	}

	protected _drawImpl({ context: ctx }: MediaCoordinatesRenderingScope, isHovered: boolean, hitTestData?: unknown): void {
		if (this._data === null || this._data.visibleRange === null) {
			return;
		}

		ctx.textBaseline = 'middle';
		ctx.font = this._font;

		for (let i = this._data.visibleRange.from; i < this._data.visibleRange.to; i++) {
			const item = this._data.items[i];
			if (item.text !== undefined) {
				item.text.width = this._textWidthCache.measureText(ctx, item.text.content);
				item.text.height = this._fontSize;
				item.text.x = item.x - item.text.width / 2 as Coordinate;
			}
			drawItem(item, ctx);
		}
	}
}

function drawItem(item: SeriesDrawingRendererDataItem, ctx: CanvasRenderingContext2D): void {
	ctx.fillStyle = item.color;

	if (item.text !== undefined) {
		drawText(ctx, item.text.content, item.text.x, item.text.y);
	}

	drawShape(item, ctx);
}

function drawShape(item: SeriesDrawingRendererDataItem, ctx: CanvasRenderingContext2D): void {
	if (item.size === 0) {
		return;
	}

	switch (item.shape) {
		case 'arrowDown':
			drawArrow(false, ctx, item.x, item.y, item.size);
			return;
		case 'arrowUp':
			drawArrow(true, ctx, item.x, item.y, item.size);
			return;
		case 'circle':
			drawCircle(ctx, item.x, item.y, item.size);
			return;
		case 'square':
			drawSquare(ctx, item.x, item.y, item.size);
			return;
	}

	ensureNever(item.shape);
}

function hitTestItem(item: SeriesDrawingRendererDataItem, x: Coordinate, y: Coordinate): boolean {
	if (item.text !== undefined && hitTestText(item.text.x, item.text.y, item.text.width, item.text.height, x, y)) {
		return true;
	}

	return hitTestShape(item, x, y);
}

function hitTestShape(item: SeriesDrawingRendererDataItem, x: Coordinate, y: Coordinate): boolean {
	if (item.size === 0) {
		return false;
	}

	switch (item.shape) {
		case 'arrowDown':
			return hitTestArrow(true, item.x, item.y, item.size, x, y);
		case 'arrowUp':
			return hitTestArrow(false, item.x, item.y, item.size, x, y);
		case 'circle':
			return hitTestCircle(item.x, item.y, item.size, x, y);
		case 'square':
			return hitTestSquare(item.x, item.y, item.size, x, y);
	}
}

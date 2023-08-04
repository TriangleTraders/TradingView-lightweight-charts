import {
	ChartWidget,
	CustomPriceLineClickedEventParamsImpl,
	CustomPriceLineClickedEventParamsImplSupplier,
	CustomPriceLineDraggedEventParamsImpl,
	CustomPriceLineDraggedEventParamsImplSupplier,
	MouseEventParamsImpl,
	MouseEventParamsImplSupplier,
} from '../gui/chart-widget';

import { assert, ensure, ensureDefined } from '../helpers/assertions';
import { Delegate } from '../helpers/delegate';
import { warn } from '../helpers/logger';
import {
	clone,
	DeepPartial,
	isBoolean,
	merge,
} from '../helpers/strict-type-checks';

import { ChartOptions, ChartOptionsInternal } from '../model/chart-model';
import { CustomData, ICustomSeriesPaneView } from '../model/icustom-series';
import { Series } from '../model/series';
import { SeriesPlotRow } from '../model/series-data';
import {
	AreaSeriesPartialOptions,
	BarSeriesPartialOptions,
	BaselineSeriesPartialOptions,
	CandlestickSeriesPartialOptions,
	CustomSeriesOptions,
	CustomSeriesPartialOptions,
	fillUpDownCandlesticksColors,
	HistogramSeriesPartialOptions,
	LineSeriesPartialOptions,
	precisionByMinMove,
	PriceFormat,
	PriceFormatBuiltIn,
	SeriesOptionsMap,
	SeriesPartialOptions,
	SeriesPartialOptionsMap,
	SeriesStyleOptionsMap,
	SeriesType,
} from '../model/series-options';
import { Logical, Time } from '../model/time-data';

import {
	DataUpdatesConsumer,
	isFulfilledData,
	SeriesDataItemTypeMap,
	WhitespaceData,
} from './data-consumer';
import { DataLayer, DataUpdateResponse, SeriesChanges } from './data-layer';
import { getSeriesDataCreator } from './get-series-data-creator';
import {
	CustomPriceLineClickedEventHandler,
	CustomPriceLineClickedEventParams,
	CustomPriceLineDraggedEventHandler,
	CustomPriceLineDraggedEventParams,
	IChartApi,
	MouseEventHandler,
	MouseEventParams,
} from './ichart-api';
import { IPriceScaleApi } from './iprice-scale-api';
import { ISeriesApi } from './iseries-api';
import { ITimeScaleApi } from './itime-scale-api';
import { chartOptionsDefaults } from './options/chart-options-defaults';
import {
	areaStyleDefaults,
	barStyleDefaults,
	baselineStyleDefaults,
	candlestickStyleDefaults,
	customStyleDefaults,
	histogramStyleDefaults,
	lineStyleDefaults,
	seriesOptionsDefaults,
} from './options/series-options-defaults';
import { PriceScaleApi } from './price-scale-api';
import { SeriesApi } from './series-api';
import { TimeScaleApi } from './time-scale-api';

function patchPriceFormat(priceFormat?: DeepPartial<PriceFormat>): void {
	if (priceFormat === undefined || priceFormat.type === 'custom') {
		return;
	}
	const priceFormatBuiltIn = priceFormat as DeepPartial<PriceFormatBuiltIn>;
	if (
		priceFormatBuiltIn.minMove !== undefined &&
		priceFormatBuiltIn.precision === undefined
	) {
		priceFormatBuiltIn.precision = precisionByMinMove(
			priceFormatBuiltIn.minMove
		);
	}
}

function migrateHandleScaleScrollOptions(
	options: DeepPartial<ChartOptions>
): void {
	if (isBoolean(options.handleScale)) {
		const handleScale = options.handleScale;
		options.handleScale = {
			axisDoubleClickReset: {
				time: handleScale,
				price: handleScale,
			},
			axisPressedMouseMove: {
				time: handleScale,
				price: handleScale,
			},
			mouseWheel: handleScale,
			pinch: handleScale,
		};
	} else if (options.handleScale !== undefined) {
		const { axisPressedMouseMove, axisDoubleClickReset } = options.handleScale;
		if (isBoolean(axisPressedMouseMove)) {
			options.handleScale.axisPressedMouseMove = {
				time: axisPressedMouseMove,
				price: axisPressedMouseMove,
			};
		}
		if (isBoolean(axisDoubleClickReset)) {
			options.handleScale.axisDoubleClickReset = {
				time: axisDoubleClickReset,
				price: axisDoubleClickReset,
			};
		}
	}

	const handleScroll = options.handleScroll;
	if (isBoolean(handleScroll)) {
		options.handleScroll = {
			horzTouchDrag: handleScroll,
			vertTouchDrag: handleScroll,
			mouseWheel: handleScroll,
			pressedMouseMove: handleScroll,
		};
	}
}

function toInternalOptions(
	options: DeepPartial<ChartOptions>
): DeepPartial<ChartOptionsInternal> {
	migrateHandleScaleScrollOptions(options);

	return options as DeepPartial<ChartOptionsInternal>;
}

export type IPriceScaleApiProvider = Pick<IChartApi, 'priceScale'>;

export class ChartApi implements IChartApi, DataUpdatesConsumer<SeriesType> {
	private _chartWidget: ChartWidget;
	private _dataLayer: DataLayer = new DataLayer();
	private readonly _seriesMap: Map<SeriesApi<SeriesType>, Series> = new Map();
	private readonly _seriesMapReversed: Map<Series, SeriesApi<SeriesType>> =
		new Map();

	private readonly _clickedDelegate: Delegate<MouseEventParams> =
		new Delegate();
	private readonly _crosshairMovedDelegate: Delegate<MouseEventParams> =
		new Delegate();
	private readonly _customPriceLineDraggedDelegate: Delegate<CustomPriceLineDraggedEventParams> =
		new Delegate();
	private readonly _customPriceLineClickedDelegate: Delegate<CustomPriceLineClickedEventParams> =
		new Delegate();
	private readonly _addButtonClickedDelegate: Delegate<MouseEventParams> =
		new Delegate();

	private readonly _timeScaleApi: TimeScaleApi;

	public constructor(
		container: HTMLElement,
		options?: DeepPartial<ChartOptions>
	) {
		const internalOptions =
			options === undefined
				? clone(chartOptionsDefaults)
				: (merge(
						clone(chartOptionsDefaults),
						toInternalOptions(options)
			) as ChartOptionsInternal);

		this._chartWidget = new ChartWidget(container, internalOptions);

		this._chartWidget
			.clicked()
			.subscribe((paramSupplier: MouseEventParamsImplSupplier) => {
				if (this._clickedDelegate.hasListeners()) {
					this._clickedDelegate.fire(this._convertMouseParams(paramSupplier()));
				}
			}, this);
		this._chartWidget
			.crosshairMoved()
			.subscribe((paramSupplier: MouseEventParamsImplSupplier) => {
				if (this._crosshairMovedDelegate.hasListeners()) {
					this._crosshairMovedDelegate.fire(
						this._convertMouseParams(paramSupplier())
					);
				}
			}, this);
		this._chartWidget
			.customPriceLineDragged()
			.subscribe(
				(paramSupplier: CustomPriceLineDraggedEventParamsImplSupplier) => {
					if (this._customPriceLineDraggedDelegate.hasListeners()) {
						this._customPriceLineDraggedDelegate.fire(
							this._convertCustomPriceLineDraggedParams(paramSupplier())
						);
					}
				},
				this
			);

		this._chartWidget
			.customPriceLineClicked()
			.subscribe(
				(paramSupplier: CustomPriceLineClickedEventParamsImplSupplier) => {
					if (this._customPriceLineClickedDelegate.hasListeners()) {
						this._customPriceLineClickedDelegate.fire(
							this._convertCustomPriceLineClickedParams(paramSupplier())
						);
					}
				},
				this
			);

		this._chartWidget
			.addButtonClicked()
			.subscribe(
				(paramSupplier: MouseEventParamsImplSupplier) => {
					if (this._addButtonClickedDelegate.hasListeners()) {
						this._addButtonClickedDelegate.fire(
							this._convertMouseParams(paramSupplier())
						);
					}
				},
				this
			);

		const model = this._chartWidget.model();
		this._timeScaleApi = new TimeScaleApi(
			model,
			this._chartWidget.timeAxisWidget()
		);
	}

	public remove(): void {
		this._chartWidget.clicked().unsubscribeAll(this);
		this._chartWidget.crosshairMoved().unsubscribeAll(this);
		this._chartWidget.customPriceLineDragged().unsubscribeAll(this);
		this._chartWidget.customPriceLineClicked().unsubscribeAll(this);
		this._chartWidget.addButtonClicked().unsubscribeAll(this);

		this._timeScaleApi.destroy();
		this._chartWidget.destroy();

		this._seriesMap.clear();
		this._seriesMapReversed.clear();

		this._clickedDelegate.destroy();
		this._crosshairMovedDelegate.destroy();
		this._customPriceLineDraggedDelegate.destroy();
		this._customPriceLineClickedDelegate.destroy();
		this._addButtonClickedDelegate.destroy();
		this._dataLayer.destroy();
	}

	public resize(width: number, height: number, forceRepaint?: boolean): void {
		if (this.autoSizeActive()) {
			// We return early here instead of checking this within the actual _chartWidget.resize method
			// because this should only apply to external resize requests.
			warn(
				`Height and width values ignored because 'autoSize' option is enabled.`
			);
			return;
		}
		this._chartWidget.resize(width, height, forceRepaint);
	}

	public addCustomSeries<
		TData extends CustomData,
		TOptions extends CustomSeriesOptions,
		TPartialOptions extends CustomSeriesPartialOptions = SeriesPartialOptions<TOptions>
	>(
		customPaneView: ICustomSeriesPaneView<TData, TOptions>,
		options?: SeriesPartialOptions<TOptions>
	): ISeriesApi<'Custom', TData, TOptions, TPartialOptions> {
		const paneView = ensure(customPaneView);
		const defaults = {
			...customStyleDefaults,
			...paneView.defaultOptions(),
		};
		return this._addSeriesImpl<'Custom', TData, TOptions, TPartialOptions>(
			'Custom',
			defaults,
			options,
			paneView
		);
	}

	public addAreaSeries(options?: AreaSeriesPartialOptions): ISeriesApi<'Area'> {
		return this._addSeriesImpl('Area', areaStyleDefaults, options);
	}

	public addBaselineSeries(
		options?: BaselineSeriesPartialOptions
	): ISeriesApi<'Baseline'> {
		return this._addSeriesImpl('Baseline', baselineStyleDefaults, options);
	}

	public addBarSeries(options?: BarSeriesPartialOptions): ISeriesApi<'Bar'> {
		return this._addSeriesImpl('Bar', barStyleDefaults, options);
	}

	public addCandlestickSeries(
		options: CandlestickSeriesPartialOptions = {}
	): ISeriesApi<'Candlestick'> {
		fillUpDownCandlesticksColors(options);

		return this._addSeriesImpl(
			'Candlestick',
			candlestickStyleDefaults,
			options
		);
	}

	public addHistogramSeries(
		options?: HistogramSeriesPartialOptions
	): ISeriesApi<'Histogram'> {
		return this._addSeriesImpl('Histogram', histogramStyleDefaults, options);
	}

	public addLineSeries(options?: LineSeriesPartialOptions): ISeriesApi<'Line'> {
		return this._addSeriesImpl('Line', lineStyleDefaults, options);
	}

	public removeSeries(seriesApi: SeriesApi<SeriesType>): void {
		const series = ensureDefined(this._seriesMap.get(seriesApi));

		const update = this._dataLayer.removeSeries(series);
		const model = this._chartWidget.model();
		model.removeSeries(series);

		this._sendUpdateToChart(update);

		this._seriesMap.delete(seriesApi);
		this._seriesMapReversed.delete(series);
	}

	public applyNewData<TSeriesType extends SeriesType>(
		series: Series<TSeriesType>,
		data: SeriesDataItemTypeMap[TSeriesType][]
	): void {
		this._sendUpdateToChart(this._dataLayer.setSeriesData(series, data));
	}

	public updateData<TSeriesType extends SeriesType>(
		series: Series<TSeriesType>,
		data: SeriesDataItemTypeMap[TSeriesType]
	): void {
		this._sendUpdateToChart(this._dataLayer.updateSeriesData(series, data));
	}

	public subscribeClick(handler: MouseEventHandler): void {
		this._clickedDelegate.subscribe(handler);
	}

	public unsubscribeClick(handler: MouseEventHandler): void {
		this._clickedDelegate.unsubscribe(handler);
	}

	public subscribeCrosshairMove(handler: MouseEventHandler): void {
		this._crosshairMovedDelegate.subscribe(handler);
	}

	public unsubscribeCrosshairMove(handler: MouseEventHandler): void {
		this._crosshairMovedDelegate.unsubscribe(handler);
	}

	public subscribeCustomPriceLineDragged(
		handler: CustomPriceLineDraggedEventHandler
	): void {
		this._customPriceLineDraggedDelegate.subscribe(handler);
	}

	public unsubscribeCustomPriceLineDragged(
		handler: CustomPriceLineDraggedEventHandler
	): void {
		this._customPriceLineDraggedDelegate.unsubscribe(handler);
	}

	public subscribeCustomPriceLineCloseClicked(
		handler: CustomPriceLineClickedEventHandler
	): void {
		this._customPriceLineClickedDelegate.subscribe(handler);
	}

	public unsubscribeCustomPriceLineCloseClicked(
		handler: CustomPriceLineClickedEventHandler
	): void {
		this._customPriceLineClickedDelegate.unsubscribe(handler);
	}

	public subscribeAddButtonClicked(
		handler: MouseEventHandler
	): void {
		this._addButtonClickedDelegate.subscribe(handler);
	}

	public unsubscribeAddButtonClicked(
		handler: MouseEventHandler
	): void {
		this._addButtonClickedDelegate.unsubscribe(handler);
	}

	public priceScale(priceScaleId: string): IPriceScaleApi {
		return new PriceScaleApi(this._chartWidget, priceScaleId);
	}

	public timeScale(): ITimeScaleApi {
		return this._timeScaleApi;
	}

	public applyOptions(options: DeepPartial<ChartOptions>): void {
		this._chartWidget.applyOptions(toInternalOptions(options));
	}

	public options(): Readonly<ChartOptions> {
		return this._chartWidget.options() as Readonly<ChartOptions>;
	}

	public takeScreenshot(): HTMLCanvasElement {
		return this._chartWidget.takeScreenshot();
	}

	public autoSizeActive(): boolean {
		return this._chartWidget.autoSizeActive();
	}

	public chartElement(): HTMLDivElement {
		return this._chartWidget.element();
	}

	private _addSeriesImpl<
		TSeries extends SeriesType,
		TData extends WhitespaceData = SeriesDataItemTypeMap[TSeries],
		TOptions extends SeriesOptionsMap[TSeries] = SeriesOptionsMap[TSeries],
		TPartialOptions extends SeriesPartialOptionsMap[TSeries] = SeriesPartialOptionsMap[TSeries]
	>(
		type: TSeries,
		styleDefaults: SeriesStyleOptionsMap[TSeries],
		options: SeriesPartialOptionsMap[TSeries] = {},
		customPaneView?: ICustomSeriesPaneView
	): ISeriesApi<TSeries, TData, TOptions, TPartialOptions> {
		patchPriceFormat(options.priceFormat);

		const strictOptions = merge(
			clone(seriesOptionsDefaults),
			clone(styleDefaults),
			options
		) as SeriesOptionsMap[TSeries];
		const series = this._chartWidget
			.model()
			.createSeries(type, strictOptions, customPaneView);

		const res = new SeriesApi<TSeries, TData, TOptions, TPartialOptions>(series, this, this, this);
		this._seriesMap.set(res, series);
		this._seriesMapReversed.set(series, res);

		return res;
	}

	private _sendUpdateToChart(update: DataUpdateResponse): void {
		const model = this._chartWidget.model();

		model.updateTimeScale(
			update.timeScale.baseIndex,
			update.timeScale.points,
			update.timeScale.firstChangedPointIndex
		);
		update.series.forEach((value: SeriesChanges, series: Series) =>
			series.setData(value.data, value.info)
		);

		model.recalculateAllPanes();
	}

	private _mapSeriesToApi(series: Series): ISeriesApi<SeriesType> {
		return ensureDefined(this._seriesMapReversed.get(series));
	}

	private _convertMouseParams(param: MouseEventParamsImpl): MouseEventParams {
		const seriesData: MouseEventParams['seriesData'] = new Map();
		param.seriesData.forEach((plotRow: SeriesPlotRow, series: Series) => {
			const seriesType = series.seriesType();
			const data = getSeriesDataCreator(seriesType)(plotRow);
			if (seriesType !== 'Custom') {
				assert(isFulfilledData(data));
			} else {
				const customWhitespaceChecker = series.customSeriesWhitespaceCheck();
				assert(
					!customWhitespaceChecker || customWhitespaceChecker(data) === false
				);
			}
			seriesData.set(this._mapSeriesToApi(series), data);
		});

		const hoveredSeries =
			param.hoveredSeries === undefined
				? undefined
				: this._mapSeriesToApi(param.hoveredSeries);

		return {
			time: param.time as Time | undefined,
			logical: param.index as Logical | undefined,
			point: param.point,
			hoveredSeries,
			hoveredObjectId: param.hoveredObject,
			seriesData,
			sourceEvent: param.touchMouseEventData,
		};
	}

	private _convertCustomPriceLineDraggedParams(
		param: CustomPriceLineDraggedEventParamsImpl
	): CustomPriceLineDraggedEventParams {
		return {
			customPriceLine: param.customPriceLine,
			fromPriceString: param.fromPriceString,
		};
	}

	private _convertCustomPriceLineClickedParams(
		param: CustomPriceLineClickedEventParamsImpl
	): CustomPriceLineClickedEventParams {
		return {
			customPriceLine: param.customPriceLine,
		};
	}
}

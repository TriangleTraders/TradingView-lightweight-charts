import { Coordinate } from './coordinate';
import { PriceRangeImpl } from './price-range-impl';
import { AutoscaleInfo } from './series-options';

export interface AutoScaleMargins {
	below: Coordinate;
	above: Coordinate;
}

export class AutoscaleInfoImpl {
	private readonly _priceRange: PriceRangeImpl | null;
	private readonly _margins: AutoScaleMargins | null;

	public constructor(priceRange: PriceRangeImpl | null, margins: AutoScaleMargins | null) {
		this._priceRange = priceRange;
		this._margins = margins;
	}

	public priceRange(): PriceRangeImpl | null {
		return this._priceRange;
	}

	public margins(): AutoScaleMargins | null {
		return this._margins;
	}

	public toRaw(): AutoscaleInfo {
		return {
			priceRange: (this._priceRange === null) ? null : this._priceRange.toRaw(),
			margins: this._margins,
		};
	}

	public static fromRaw(raw: AutoscaleInfo | null): AutoscaleInfoImpl | null {
		return (raw === null) ? null : new AutoscaleInfoImpl(PriceRangeImpl.fromRaw(raw.priceRange), raw.margins);
	}
}

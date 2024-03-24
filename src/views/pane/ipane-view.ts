import { Pane } from '../../model/pane';
import { IPaneRenderer } from '../../renderers/ipane-renderer';

export interface IPaneView {
	renderer(pane: Pane, addAnchors?: boolean): IPaneRenderer | null;
	// renderer(height: number, width: number, pane: Pane, addAnchors?: boolean): IPaneRenderer | null;
}

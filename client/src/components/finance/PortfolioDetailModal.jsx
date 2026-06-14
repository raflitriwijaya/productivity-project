// client/src/components/finance/PortfolioDetailModal.jsx
// Read-only holding detail (mirrors BookDetailModal pattern): meta, price grid,
// derived gain/loss, and the LinkedItems section so a holding can connect to
// other modules (Universal Links, Wave 1). Market value / cost basis / gain come
// derived from the API (§6.0 numeric strings) with a local fallback.

import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { LinkedItems } from '../shared/LinkedItems';
import { formatIdr } from '../../lib/formatIdr';

/**
 * @param {{ isOpen: boolean, onClose: () => void, holding: object, onEdit: () => void }} props
 */
export function PortfolioDetailModal({ isOpen, onClose, holding, onEdit }) {
  if (!holding) return null;

  const marketValue = Number(holding.market_value ?? holding.quantity * holding.current_price);
  const costBasis = Number(holding.cost_basis ?? holding.quantity * holding.avg_price);
  const gain = Number(holding.gain ?? marketValue - costBasis);
  const gainPercent = costBasis > 0 ? (gain / costBasis) * 100 : 0;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={holding.name}
      size="md"
      footer={
        <>
          <Button variant="secondary" size="md" onClick={onClose}>Close</Button>
          <Button variant="primary" size="md" onClick={onEdit}>Edit</Button>
        </>
      }
    >
      {/* Meta */}
      <div className="flex flex-wrap items-center gap-3">
        {holding.symbol && <Badge variant="ember">{holding.symbol}</Badge>}
        <span className="text-sm text-stone-500 dark:text-gray-400 tabular-nums">
          {Number(holding.quantity).toLocaleString('id-ID', { maximumFractionDigits: 4 })} units
        </span>
      </div>

      {/* Price details */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="text-xs text-stone-400 dark:text-gray-500 mb-1">Average Buy Price</div>
          <div className="text-sm font-medium text-stone-900 dark:text-gray-50 tabular-nums">{formatIdr(holding.avg_price)}</div>
        </div>
        <div>
          <div className="text-xs text-stone-400 dark:text-gray-500 mb-1">Current Price</div>
          <div className="text-sm font-medium text-stone-900 dark:text-gray-50 tabular-nums">{formatIdr(holding.current_price)}</div>
        </div>
        <div>
          <div className="text-xs text-stone-400 dark:text-gray-500 mb-1">Market Value</div>
          <div className="text-sm font-semibold text-stone-900 dark:text-gray-50 tabular-nums">{formatIdr(marketValue)}</div>
        </div>
        <div>
          <div className="text-xs text-stone-400 dark:text-gray-500 mb-1">Cost Basis</div>
          <div className="text-sm text-stone-700 dark:text-gray-300 tabular-nums">{formatIdr(costBasis)}</div>
        </div>
      </div>

      {/* Gain / loss */}
      <div className={`p-3 rounded-lg ${gain >= 0 ? 'bg-moss-50 dark:bg-moss-950/30' : 'bg-red-50 dark:bg-red-950/30'}`}>
        <div className="flex items-center justify-between">
          <span className="text-sm text-stone-600 dark:text-gray-400">Gain/Loss</span>
          <span className={`text-sm font-bold tabular-nums ${gain >= 0 ? 'text-moss-600 dark:text-moss-400' : 'text-red-600 dark:text-red-400'}`}>
            {gain >= 0 ? '+' : '-'}{formatIdr(Math.abs(gain))} ({gainPercent >= 0 ? '+' : ''}{gainPercent.toFixed(2)}%)
          </span>
        </div>
      </div>

      {/* Linked Items — cross-module connections (Universal Links, Wave 1) */}
      <div className="border-t border-stone-200 dark:border-gray-700 pt-4">
        <LinkedItems entityType="portfolio" entityId={holding.id} />
      </div>
    </Modal>
  );
}

export default PortfolioDetailModal;

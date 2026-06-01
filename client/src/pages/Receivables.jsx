// client/src/pages/Receivables.jsx  → route /finance/receivables
// Money owed TO the user. All behaviour lives in the shared LedgerPage.

import { LedgerPage } from '../components/finance/LedgerPage';

export default function Receivables() {
  return (
    <LedgerPage
      kind="receivable"
      endpoint="receivables"
      title="Receivables"
      description="Money owed to you — settle to post it as income."
    />
  );
}

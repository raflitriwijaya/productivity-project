// client/src/pages/Payables.jsx  → route /finance/payables
// Money the user OWES. All behaviour lives in the shared LedgerPage.

import { LedgerPage } from '../components/finance/LedgerPage';
import useDocumentTitle from '../hooks/useDocumentTitle';

export default function Payables() {
  useDocumentTitle('Finance — Payables');
  return (
    <LedgerPage
      kind="payable"
      endpoint="payables"
      title="Payables"
      description="Money you owe — settle to post it as an expense."
    />
  );
}

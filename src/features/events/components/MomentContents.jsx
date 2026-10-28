import { Link } from 'react-router-dom';
import { ChevronRight, Images, ListChecks, Receipt, SlidersHorizontal } from 'lucide-react';
import { activityStatus, isAttachmentImage } from '../../../utils/activityDetail';
import { formatTransactionMoney as momentMoney } from '../../../components/financials/TransactionHistory';

export default function MomentContents({ moment, finance }) {
  const activities = moment.activities || [];
  const counts = { 'in-progress': 0, completed: 0, cancelled: 0 };
  activities.forEach((item) => { counts[activityStatus(item)] += 1; });
  const attachments = moment.attachments || [];
  const imageCount = attachments.filter((item) => isAttachmentImage(item.type)).length;
  const base = `/events/${encodeURIComponent(moment.id || moment.firestoreId)}`;
  const rows = [
    { section: 'activities', title: 'Activities', icon: ListChecks,
      description: `${activities.length} total · ${counts['in-progress']} in progress · ${counts.completed} completed${counts.cancelled ? ` · ${counts.cancelled} cancelled` : ''}` },
    { section: 'transactions', title: 'Transactions', icon: Receipt,
      description: finance.error ? 'Transactions couldn’t be loaded. Open to retry.' : !finance.ready ? 'Loading transactions…'
        : `${momentMoney(finance.summary.income)} income · ${momentMoney(finance.summary.expense)} expense · ${momentMoney(finance.summary.balance)} balance · ${finance.transactions.length} transactions` },
    { section: 'gallery', title: 'Gallery', icon: Images,
      description: attachments.length ? `${attachments.length} attachments${imageCount ? ` · ${imageCount} images` : ''}` : 'No attachments added yet' },
    { section: 'pdf', title: 'PDF Studio', icon: SlidersHorizontal,
      description: 'Customize, preview and download your Moment' },
  ];
  return <nav className="moment-contents" aria-label="Moment contents">{rows.map(({ section, title, icon: Icon, description }) =>
    <Link key={section} className="moment-contents-row" to={`${base}/${section}`}><Icon size={19} aria-hidden="true" />
      <span><strong>{title}</strong><small>{description}</small></span><ChevronRight size={16} aria-hidden="true" /></Link>)}</nav>;
}

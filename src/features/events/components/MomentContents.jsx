import { Link } from 'react-router-dom';
import { BookHeart, ChevronRight, Images, ListChecks, Receipt } from 'lucide-react';
import { activityDateLabel, activityStatus, isAttachmentImage } from '../../../utils/activityDetail';
import { formatTransactionMoney as momentMoney } from '../../../components/financials/TransactionHistory';
import { parseMomentDate } from '../../../utils/momentDates';

export default function MomentContents({ moment, finance }) {
  const activities = moment.activities || [];
  const counts = { 'in-progress': 0, completed: 0, cancelled: 0 };
  activities.forEach((item) => { counts[activityStatus(item)] += 1; });
  const memories = moment.memories || [];
  const latestMemory = memories.reduce((latest, item) => {
    let date;
    try { date = parseMomentDate(item.createdAt); } catch { /* Invalid legacy date. */ }
    return date && (!latest || date > latest.date) ? { date, item } : latest;
  }, null);
  const attachments = moment.attachments || [];
  const imageCount = attachments.filter((item) => isAttachmentImage(item.type)).length;
  const base = `/events/${encodeURIComponent(moment.id || moment.firestoreId)}`;
  const rows = [
    { section: 'activities', title: 'Activities', icon: ListChecks,
      description: `${activities.length} total · ${counts['in-progress']} in progress · ${counts.completed} completed${counts.cancelled ? ` · ${counts.cancelled} cancelled` : ''}` },
    { section: 'transactions', title: 'Transactions', icon: Receipt,
      description: finance.error ? 'Transactions couldn’t be loaded. Open to retry.' : !finance.ready ? 'Loading transactions…'
        : `${momentMoney(finance.summary.income)} income · ${momentMoney(finance.summary.expense)} expense · ${momentMoney(finance.summary.balance)} balance · ${finance.transactions.length} transactions` },
    { section: 'memories', title: 'Memories', icon: BookHeart,
      description: memories.length ? `${memories.length} saved${latestMemory ? ` · Latest ${activityDateLabel(latestMemory.date)}` : ''}` : 'No memories saved yet' },
    { section: 'attachments', title: 'Attachments', icon: Images,
      description: attachments.length ? `${attachments.length} attachments${imageCount ? ` · ${imageCount} images` : ''}` : 'No attachments added yet' },
  ];
  return <nav className="moment-contents" aria-label="Moment contents">{rows.map(({ section, title, icon: Icon, description }) =>
    <Link key={section} className="moment-contents-row" to={`${base}/${section}`}><Icon size={19} aria-hidden="true" />
      <span><strong>{title}</strong><small>{description}</small></span><ChevronRight size={16} aria-hidden="true" /></Link>)}</nav>;
}

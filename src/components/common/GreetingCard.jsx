import { Sparkles } from 'lucide-react';
import RichText from './RichText';
import { plainRichText } from '../../utils/richText';
import { createGreetingCardHtml, greetingToneFromType } from '../../utils/greetingCard';
import greetingCardStyles from './GreetingCard.css?raw';
import './GreetingCard.css';

export const buildGreetingCardHtml = (details) => createGreetingCardHtml(details, greetingCardStyles);

export default function GreetingCard({ title, body, momentName = '', momentType = '', dateLabel = '', className = '' }) {
  return (
    <article className={`dn-greeting-card dn-greeting-card--${greetingToneFromType(momentType)} ${className}`.trim()} aria-label="Greeting card preview">
      <div className="dn-greeting-card-frame">
        <span className="dn-greeting-card-kicker"><Sparkles size={15} aria-hidden="true" /> A moment to celebrate</span>
        <div className="dn-greeting-card-message">
          <h2>{plainRichText(title) || 'Your greeting title'}</h2>
          <RichText value={body || 'Your message will appear here.'} className="dn-greeting-card-body" />
        </div>
        <footer className="dn-greeting-card-footer">
          <div><strong>{momentName || 'A special moment'}</strong><span>{[momentType, dateLabel].filter(Boolean).join(' · ')}</span></div>
          <span className="dn-greeting-card-signature" aria-label="Created with DN">DN</span>
        </footer>
      </div>
    </article>
  );
}

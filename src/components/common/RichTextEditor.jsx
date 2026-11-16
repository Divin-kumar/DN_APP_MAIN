import { lazy, Suspense } from 'react';
import './DocumentTextEditor.css';

const DocumentTextEditor = lazy(() => import('./DocumentTextEditor'));

// One visual editor keeps selection and undo across phone rotation/window resize.
// Stored notes remain strings in the existing note vocabulary.
export default function RichTextEditor(props) {
  const fallback = <div className={`dn-document-editor ${props.className || ''}`} aria-busy="true">
    <span className="dn-document-label">{props.label}</span>
    <div className="dn-document-surface">
      <div className="dn-document-loading" />
      <div className="dn-document-footer" role="status">Preparing editor…</div>
    </div>
  </div>;
  return <Suspense fallback={fallback}>
    <DocumentTextEditor {...props} />
  </Suspense>;
}

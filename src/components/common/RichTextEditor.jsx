import { lazy, Suspense } from 'react';

const DocumentTextEditor = lazy(() => import('./DocumentTextEditor'));

// One visual editor keeps selection and undo across phone rotation/window resize.
// Stored notes remain strings in the existing note vocabulary.
export default function RichTextEditor(props) {
  return <Suspense fallback={<div role="status">Preparing editor…</div>}>
    <DocumentTextEditor {...props} />
  </Suspense>;
}

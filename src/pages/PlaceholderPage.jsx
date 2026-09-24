export default function PlaceholderPage({ title }) {
  return (
    <div
      className="placeholder-card"
      style={{
        background: '#ffffff',
        borderRadius: '18px',
        padding: '24px',
        boxShadow: '0 10px 30px rgba(47, 70, 58, 0.06)',
      }}
    >
      <h2 style={{ marginTop: 0, marginBottom: 8, fontSize: '1.5rem' }}>{title}</h2>
      <p style={{ margin: 0, color: '#536a5d', lineHeight: 1.6 }}>
        This route is reserved for the next migration phase.
      </p>
    </div>
  );
}

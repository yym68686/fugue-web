import AppLayout from '@/components/AppLayout';

/**
 * Lightweight loading placeholder shown instantly on navigation while a
 * server component fetches live backend data. Keeps the shell (nav rail,
 * header) in place so the transition feels immediate.
 */
export default function PageSkeleton({
  title,
  eyebrow,
  variant = 'list',
}: {
  title: string;
  eyebrow?: string;
  variant?: 'list' | 'cards';
}) {
  return (
    <AppLayout>
      <div className="page">
        <div className="phead">
          <div>
            {eyebrow && <div className="eyebrow">{eyebrow}</div>}
            <h1>{title}</h1>
            <div className="meta">
              <span className="sk sk-line" style={{ width: 80 }}></span>
            </div>
          </div>
        </div>

        {variant === 'cards' ? (
          <div className="proj-grid">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="proj-card sk-card">
                <div className="sk sk-line" style={{ width: '60%' }}></div>
                <div className="sk sk-block" style={{ height: 56 }}></div>
                <div className="sk sk-line" style={{ width: '40%' }}></div>
              </div>
            ))}
          </div>
        ) : (
          <div className="panel">
            <div className="panel-h">
              <span className="sk sk-line" style={{ width: 100 }}></span>
            </div>
            <div className="list">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="row-item">
                  <span className="dot idle dot-lead"></span>
                  <div className="main-col">
                    <div className="sk sk-line" style={{ width: '30%' }}></div>
                    <div
                      className="sk sk-line"
                      style={{ width: '50%', marginTop: 6 }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}

import AppLayout from '@/components/AppLayout';

/**
 * Lightweight loading placeholder shown instantly on navigation while a
 * server component fetches live backend data. Keeps the shell (nav rail,
 * header) in place so the transition feels immediate.
 */
export default function PageSkeleton({
  title,
  variant = 'list',
}: {
  title: string;
  eyebrow?: string;
  variant?: 'list' | 'cards';
}) {
  return (
    <AppLayout>
      <div className="page page-skeleton" aria-busy="true">
        <div className="phead">
          <div>
            <h1>{title}</h1>
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
            <div className="list">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="row-item">
                  <div className="main-col">
                    <div className="sk sk-line" style={{ width: '30%' }}></div>
                    <div
                      className="sk sk-line"
                      style={{ width: '50%', marginTop: 8 }}
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

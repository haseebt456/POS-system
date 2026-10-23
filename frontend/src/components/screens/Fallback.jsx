import { useNavigate } from 'react-router-dom';
import { Button, Panel } from '../ui';

// The two dead ends: a path that does not exist, and a path that exists but is not this
// role's. They are one component because they differ only in wording, and keeping them
// together is what stops the second one drifting into sounding like the first.
//
// Telling them apart matters. An operator who types the Settings URL has made no mistake —
// the page is real, they are simply not allowed in. Reporting that as "Page not found"
// sends them hunting for a typo in a URL that is perfectly correct.
function Fallback({ title, children, homePath, homeLabel }) {
  const navigate = useNavigate();

  return (
    <div className="page stack">
      <Panel
        title={title}
        actions={
          <Button variant="primary" onClick={() => navigate(homePath)}>
            {homeLabel}
          </Button>
        }
      >
        <p className="muted">{children}</p>
      </Panel>
    </div>
  );
}

export default Fallback;

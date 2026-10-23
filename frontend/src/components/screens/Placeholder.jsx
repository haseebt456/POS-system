import { Banner, Panel } from '../ui';

// A routed destination that has no screen yet.
//
// The alternative — leaving the route out until its screen exists — would mean the sidebar
// and the router disagree about what the app contains, which is the exact failure the
// single nav definition exists to prevent. Naming the milestone is the honest version of
// "not built yet": it says the route is real and why it is empty, rather than looking like
// a bug.
function Placeholder({ title, milestone }) {
  return (
    <div className="page stack">
      <Panel title={title}>
        <Banner tone="info" title="Not built yet">
          This screen is scheduled for {milestone}. The navigation, the route and its
          role guard are in place; the content follows.
        </Banner>
      </Panel>
    </div>
  );
}

export default Placeholder;

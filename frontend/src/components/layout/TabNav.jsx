const tabStyles = {
  nav: {
    display: 'flex',
    gap: 4,
    padding: '12px 20px 0',
    background: '#ffffff',
    borderBottom: '1px solid #e5e7eb',
  },
  tab: (active) => ({
    padding: '10px 18px',
    fontSize: 15,
    fontWeight: 600,
    color: active ? '#2563eb' : '#6b7280',
    background: 'none',
    border: 'none',
    borderBottom: active ? '2px solid #2563eb' : '2px solid transparent',
    cursor: 'pointer',
    marginBottom: -1,
  }),
};

function TabNav({ tabs, activeTab, onChange }) {
  return (
    <nav style={tabStyles.nav}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          style={tabStyles.tab(activeTab === tab.id)}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  );
}

export default TabNav;

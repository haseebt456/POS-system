const styles = {
  table: {
    width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: 15,
    background: '#ffffff', borderRadius: 12, overflow: 'hidden',
    border: '1px solid #e5e7eb', boxShadow: '0 1px 2px rgba(16, 24, 40, 0.04)',
  },
  th: {
    textAlign: 'left', padding: '12px 16px', borderBottom: '1px solid #e5e7eb',
    color: '#6b7280', fontWeight: 600, fontSize: 12, textTransform: 'uppercase',
    letterSpacing: '0.04em', background: '#fafbfc',
  },
  td: { padding: '13px 16px', borderBottom: '1px solid #f0f1f3', verticalAlign: 'top' },
  actionsCell: { textAlign: 'right', whiteSpace: 'nowrap' },
  muted: { color: '#8a8a8a', fontSize: 14, padding: '8px 4px' },
  linkButton: { background: 'none', border: 'none', color: '#2563eb', fontSize: 14, fontWeight: 600, cursor: 'pointer', padding: '4px 8px' },
  linkButtonDanger: { background: 'none', border: 'none', color: '#dc2626', fontSize: 14, fontWeight: 600, cursor: 'pointer', padding: '4px 8px' },
  linkButtonDisabled: { color: '#a8c5f5', cursor: 'not-allowed' },
  badge: { marginLeft: 8, fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999 },
  badgeKitchen: { color: '#1e40af', background: '#dbeafe' },
  badgeReceipt: { color: '#92400e', background: '#fef3c7' },
  notConfigured: { fontSize: 12, color: '#9a6b00', marginTop: 4 },
  okLine: { fontSize: 12, color: '#15803d', marginTop: 4 },
  failLine: { fontSize: 12, color: '#a32b1f', marginTop: 4, wordBreak: 'break-word' },
};

function StationList({ stations, onEdit, onDeactivate, onTestPrint, testingId, testResults }) {
  if (stations.length === 0) {
    return <p style={styles.muted}>No printer stations yet. Add one above — menu items need a station to route to.</p>;
  }

  return (
    <table style={styles.table}>
      <thead>
        <tr>
          <th style={styles.th}>Station</th>
          <th style={styles.th}>Role</th>
          <th style={styles.th}>Address</th>
          <th style={styles.th}></th>
        </tr>
      </thead>
      <tbody>
        {stations.map((station) => {
          const configured = station.connection_type === 'lan' && !!station.ip_address;
          const result = testResults[station.id];
          const isTesting = testingId === station.id;

          return (
            <tr key={station.id}>
              <td style={styles.td}>{station.name}</td>
              <td style={styles.td}>
                <span style={{ ...styles.badge, ...(station.printer_type === 'receipt' ? styles.badgeReceipt : styles.badgeKitchen) }}>
                  {station.printer_type === 'receipt' ? 'RECEIPT' : 'KITCHEN'}
                </span>
              </td>
              <td style={styles.td}>
                {configured
                  ? `${station.ip_address}:${station.port ?? 9100} · ${station.paper_width ?? 32} chars`
                  : <span style={styles.notConfigured}>Not configured — tickets are simulated</span>}

                {result && (
                  result.ok
                    ? <div style={styles.okLine}>
                        {result.transport === 'dry-run'
                          ? 'Simulated — no printer at this address, nothing was physically printed.'
                          : 'Test ticket sent successfully.'}
                      </div>
                    : <div style={styles.failLine}>Failed: {result.error}</div>
                )}
              </td>
              <td style={{ ...styles.td, ...styles.actionsCell }}>
                <button
                  style={{ ...styles.linkButton, ...(isTesting ? styles.linkButtonDisabled : {}) }}
                  disabled={isTesting}
                  onClick={() => onTestPrint(station.id)}
                >
                  {isTesting ? 'Testing…' : 'Test print'}
                </button>
                <button style={styles.linkButton} onClick={() => onEdit(station)}>Edit</button>
                <button style={styles.linkButtonDanger} onClick={() => onDeactivate(station.id, station.name)}>Remove</button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export default StationList;

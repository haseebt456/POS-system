import { Table, Th, Td, Badge, Button } from '../ui';
import styles from './StationList.module.css';

function StationList({ stations, onEdit, onDeactivate, onTestPrint, testingId, testResults }) {
  if (stations.length === 0) {
    return (
      <p className="empty">
        No printer stations yet. Add one above — menu items need a station to route to.
      </p>
    );
  }

  return (
    <Table>
      <thead>
        <tr>
          <Th>Station</Th>
          <Th>Role</Th>
          <Th>Address</Th>
          <Th align="right" />
        </tr>
      </thead>
      <tbody>
        {stations.map((station) => {
          const configured = station.connection_type === 'lan' && !!station.ip_address;
          const result = testResults[station.id];
          const isTesting = testingId === station.id;
          const isReceipt = station.printer_type === 'receipt';

          return (
            <tr key={station.id}>
              <Td>{station.name}</Td>
              <Td>
                <Badge tone={isReceipt ? 'warn' : 'info'} shape="square">
                  {isReceipt ? 'Receipt' : 'Kitchen'}
                </Badge>
              </Td>
              <Td>
                {configured ? (
                  <span className={styles.address}>
                    {station.ip_address}:{station.port ?? 9100} · {station.paper_width ?? 32} chars
                  </span>
                ) : (
                  <span className={styles.notConfigured}>
                    Not configured — tickets are simulated
                  </span>
                )}

                {result &&
                  (result.ok ? (
                    <div className={styles.okLine}>
                      {result.transport === 'dry-run'
                        ? 'Simulated — no printer at this address, nothing was physically printed.'
                        : 'Test ticket sent successfully.'}
                    </div>
                  ) : (
                    <div className={styles.failLine}>Failed: {result.error}</div>
                  ))}
              </Td>
              <Td align="right">
                <div className={styles.actions}>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={isTesting}
                    onClick={() => onTestPrint(station.id)}
                  >
                    {isTesting ? 'Testing…' : 'Test print'}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => onEdit(station)}>
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="dangerGhost"
                    onClick={() => onDeactivate(station.id, station.name)}
                  >
                    Remove
                  </Button>
                </div>
              </Td>
            </tr>
          );
        })}
      </tbody>
    </Table>
  );
}

export default StationList;

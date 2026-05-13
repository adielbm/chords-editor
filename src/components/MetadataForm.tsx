export interface MetadataEntry {
  key: string;
  value: string;
}

interface MetadataFormProps {
  entries: MetadataEntry[];
  onChange: (entries: MetadataEntry[]) => void;
}

export function MetadataForm({ entries, onChange }: MetadataFormProps) {
  const knownOrder = ['title', 'artist', 'capo', 'comments'];
  const knownEntries = knownOrder.map((key) => entries.find((entry) => entry.key === key) ?? { key, value: '' });

  function handleKnownChange(index: number, value: string) {
    onChange(
      knownEntries.map((entry, currentIndex) => (currentIndex === index ? { ...entry, value } : entry)),
    );
  }

  return (
    <section className="panel metadata-panel">
      <div className="panel-title-row">
        <h2>Metadata</h2>
        <span className="chip">4 fields</span>
      </div>

      <div className="metadata-grid">
        {knownEntries.map((entry, index) => (
          <label key={entry.key} className="field">
            <span>{entry.key}</span>
            <input value={entry.value} onChange={(event) => handleKnownChange(index, event.target.value)} dir="auto" />
          </label>
        ))}
      </div>
    </section>
  );
}

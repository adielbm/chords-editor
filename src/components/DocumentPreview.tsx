import type { ParsedDocument, ParsedLine } from '../chords/types';

interface DocumentPreviewProps {
  parsed: ParsedDocument;
}

function renderLineContent(line: ParsedLine) {
  if (line.kind !== 'lyrics') {
    return <span>{line.text || ' '}</span>;
  }

  const segments: Array<{ type: 'text' | 'chord'; text: string; valid?: boolean }> = [];
  let cursor = 0;

  for (const span of line.chordSpans) {
    if (span.from > cursor) {
      segments.push({ type: 'text', text: line.text.slice(cursor, span.from) });
    }
    segments.push({ type: 'chord', text: line.text.slice(span.from, span.to), valid: span.valid });
    cursor = span.to;
  }

  if (cursor < line.text.length) {
    segments.push({ type: 'text', text: line.text.slice(cursor) });
  }

  return (
    <>
      {segments.map((segment, index) =>
        segment.type === 'chord' ? (
          <span
            key={`${segment.type}-${index}`}
            className={segment.valid ? 'preview-chord preview-chord--valid' : 'preview-chord preview-chord--invalid'}
          >
            {segment.text}
          </span>
        ) : (
          <span key={`${segment.type}-${index}`}>{segment.text}</span>
        ),
      )}
    </>
  );
}

export function DocumentPreview({ parsed }: DocumentPreviewProps) {
  return (
    <section className="panel preview-panel">
      <div className="panel-title-row">
        <h2>Live preview</h2>
        <span className="chip">{parsed.lines.filter((line) => line.kind === 'lyrics').length} lyric lines</span>
      </div>

      <div className="preview-list" aria-label="Rendered chord chart preview">
        {parsed.lines.map((line) => {
          const lineSeverity = line.diagnostics.some((diagnostic) => diagnostic.severity === 'error')
            ? 'error'
            : line.diagnostics.some((diagnostic) => diagnostic.severity === 'warning')
              ? 'warning'
              : 'none';

          return (
            <div
              key={`${line.lineNumber}-${line.kind}`}
              className={`preview-line preview-line--${line.kind} preview-line--${lineSeverity}`}
              dir={line.direction ?? 'auto'}
            >
              <span className="preview-line-number">{line.lineNumber}</span>
              <span className="preview-line-content">{renderLineContent(line)}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

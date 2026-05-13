import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { ChordsEditor } from './components/ChordsEditor';
import { MetadataForm, type MetadataEntry } from './components/MetadataForm';
import { clearDraft, loadDraft, saveDraft } from './chords/storage';
import { validateChordsDocument } from './chords/parser';
import type { ParsedDocument } from './chords/types';

const emptyDocument = `{title:Untitled}
{artist:Unknown}

{verse}
[C]Sample [G]line`;

function serializeMetadata(entries: MetadataEntry[]): string[] {
  const allowedKeys = new Set(['title', 'artist', 'capo', 'comments']);
  return entries
    .filter((entry) => allowedKeys.has(entry.key.trim()) && entry.value.trim() !== '')
    .map((entry) => `{${entry.key.trim()}:${entry.value}}`);
}

function normalizeFileName(fileName: string): string {
  return fileName.trim().replace(/\s+/g, '-');
}

function replaceMetadataHeader(text: string, metadataLines: string[]): string {
  const lines = text.split(/\r?\n/);
  let cursor = 0;
  while (cursor < lines.length && /^\{[A-Za-z_][A-Za-z0-9_-]*(?::\s*.*)?\}$/.test(lines[cursor])) {
    cursor += 1;
  }
  return [...metadataLines, ...lines.slice(cursor)].join('\n');
}

function deriveMetadataEntries(parsed: ParsedDocument): MetadataEntry[] {
  const knownOrder = ['title', 'artist', 'capo', 'comments'];
  return knownOrder.map((key) => ({ key, value: parsed.metadata[key] ?? '' }));
}

function downloadText(fileName: string, text: string) {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName.endsWith('.chords') ? fileName : `${fileName}.chords`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function App() {
  const draft = loadDraft();
  const [fileName, setFileName] = useState(normalizeFileName(draft?.fileName ?? 'untitled.chords'));
  const [text, setText] = useState(draft?.text ?? emptyDocument);
  const [metadataEntries, setMetadataEntries] = useState<MetadataEntry[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const parsed = useMemo(() => validateChordsDocument(text), [text]);

  useEffect(() => {
    setMetadataEntries(deriveMetadataEntries(parsed));
  }, [parsed]);

  useEffect(() => {
    const savedAt = new Date().toISOString();
    saveDraft({ fileName, text, savedAt });
  }, [fileName, text]);

  function handleMetadataChange(entries: MetadataEntry[]) {
    setMetadataEntries(entries);
    setText((currentText) => replaceMetadataHeader(currentText, serializeMetadata(entries)));
  }

  function handleOpenFile() {
    fileInputRef.current?.click();
  }

  async function handleFileSelected(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    // Confirm discard of current changes before importing
    if (text.trim() !== '' && !window.confirm('Import will replace the current document. Discard changes?')) {
      event.target.value = '';
      return;
    }

    const content = await file.text();
    setFileName(normalizeFileName(file.name));
    setText(content);
    event.target.value = '';
  }

  function handleNewDocument() {
    if (text.trim() !== '' && !window.confirm('Create new document and discard current content?')) {
      return;
    }
    setFileName('untitled.chords');
    setText(emptyDocument);
    clearDraft();
  }

  function handleSave() {
    // Prevent exporting if there are validation errors
    const hasErrors = parsed.diagnostics.some((d) => d.severity === 'error');
    if (hasErrors) {
      window.alert('Cannot export: please fix validation errors first.');
      return;
    }

    // Ensure title metadata matches the file name (hyphenated, without extension)
    const hyphenated = normalizeFileName(fileName).replace(/\.chords$/i, '');
    const entriesForExport = metadataEntries.map((e) => ({ ...e }));
    const titleIndex = entriesForExport.findIndex((e) => e.key === 'title');
    if (titleIndex >= 0) {
      entriesForExport[titleIndex].value = hyphenated;
    } else {
      entriesForExport.unshift({ key: 'title', value: hyphenated });
    }

    const metadataLines = serializeMetadata(entriesForExport);
    const withMetadata = replaceMetadataHeader(text, metadataLines);

    // Remove empty lines from export
    const exportText = withMetadata
      .split(/\r?\n/)
      .filter((line) => line.trim() !== '')
      .join('\n');

    downloadText(normalizeFileName(fileName), exportText);
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="toolbar">
          <button type="button" className="primary-button" onClick={handleOpenFile}>
            Import
          </button>
          <button type="button" className="secondary-button" onClick={handleSave}>
            Export
          </button>
          <button type="button" className="ghost-button" onClick={handleNewDocument}>
            New
          </button>
          <input ref={fileInputRef} type="file" accept=".chords,text/plain" hidden onChange={handleFileSelected} />
        </div>
      </header>

      <main className="workspace">
        <MetadataForm entries={metadataEntries} onChange={handleMetadataChange} />

        <section className="panel editor-panel">
          <ChordsEditor value={text} onChange={setText} parsed={parsed} />
        </section>
      </main>
    </div>
  );
}

import { useEffect, useMemo, useRef } from 'react';
import { EditorState, StateEffect, StateField, type Extension } from '@codemirror/state';
import { bidiIsolates } from '@codemirror/language';
import { Decoration, EditorView, type DecorationSet, Direction } from '@codemirror/view';
import type { ParsedDocument } from '../chords/types';

interface ChordsEditorProps {
  value: string;
  onChange: (value: string) => void;
  parsed: ParsedDocument;
}

const setDecorations = StateEffect.define<DecorationSet>();

type DecorationRange = {
  from: number;
  to: number;
  decoration: Decoration;
  priority: number;
};

const decorationField = StateField.define<DecorationSet>({
  create() {
    return Decoration.none;
  },
  update(value, transaction) {
    for (const effect of transaction.effects) {
      if (effect.is(setDecorations)) {
        return effect.value;
      }
    }
    return value.map(transaction.changes);
  },
  provide: (field) => EditorView.decorations.from(field),
});

function buildDecorations(parsed: ParsedDocument, state: EditorState): DecorationSet {
  const ranges: DecorationRange[] = [];

  for (const line of parsed.lines) {
    const docLine = state.doc.line(line.lineNumber);
    const classNames = ['cm-chords-line', `cm-chords-line--${line.kind}`];
    if (line.direction) {
      classNames.push(`cm-chords-line--${line.direction}`);
    }
    if (line.diagnostics.some((diagnostic) => diagnostic.severity === 'error')) {
      classNames.push('cm-chords-line--error');
    } else if (line.diagnostics.some((diagnostic) => diagnostic.severity === 'warning')) {
      classNames.push('cm-chords-line--warning');
    }

    if (line.kind !== 'blank') {
      ranges.push({
        from: docLine.from,
        to: docLine.from,
        decoration: Decoration.line({
          class: classNames.join(' '),
          attributes: line.direction ? { dir: line.direction } : undefined,
          bidiIsolate: line.direction === 'rtl' ? Direction.RTL : line.direction === 'ltr' ? Direction.LTR : null,
        }),
        priority: 0,
      });
    }

    if (line.kind === 'label') {
      ranges.push({
        from: docLine.from,
        to: docLine.to,
        decoration: Decoration.mark({ class: 'cm-chords-label' }),
        priority: 1,
      });
      continue;
    }

    if (line.kind === 'lyrics') {
      let cursor = 0;
      for (const span of line.chordSpans) {
        if (span.from > cursor) {
          ranges.push({
            from: docLine.from + cursor,
            to: docLine.from + span.from,
            decoration: Decoration.mark({ class: 'cm-chords-lyrics' }),
            priority: 1,
          });
        }
        cursor = span.to;
      }
      if (cursor < line.text.length) {
        ranges.push({
          from: docLine.from + cursor,
          to: docLine.from + line.text.length,
          decoration: Decoration.mark({ class: 'cm-chords-lyrics' }),
          priority: 1,
        });
      }
    }

    for (const span of line.chordSpans) {
      ranges.push({
        from: docLine.from + span.from,
        to: docLine.from + span.to,
        decoration: Decoration.mark({
          class: span.valid ? 'cm-chords-chord' : 'cm-chords-chord cm-chords-chord--invalid',
          attributes: { dir: 'ltr' },
          bidiIsolate: Direction.LTR,
        }),
        priority: 2,
      });
    }
  }

  ranges.sort((left, right) => left.from - right.from || left.priority - right.priority || left.to - right.to);
  return Decoration.set(ranges.map((range) => ({ from: range.from, to: range.to, value: range.decoration })));
}

function buildTheme(): Extension {
  return EditorView.theme({
    '&': {
      height: '100%',
      fontFamily: 'Miriam Libre, serif',
      fontSize: '16px',
      color: '#111827',
      backgroundColor: '#ffffff',
      borderRadius: '0',
    },
    '.cm-scroller': {
      fontFamily: 'inherit',
      lineHeight: '1.6',
    },
    '.cm-content': {
      padding: '16px 0',
    },
    '.cm-line': {
      padding: '0 16px',
      whiteSpace: 'pre-wrap',
    },
    '.cm-focused .cm-cursor': {
      borderLeftColor: '#111827',
    },
    '.cm-focused': {
      outline: 'none',
    },
    '.cm-chords-line--rtl': {
      textAlign: 'right',
    },
    '.cm-chords-line--ltr': {
      textAlign: 'left',
    },
    '.cm-chords-line--label': {
      color: '#374151',
      fontWeight: '500',
      backgroundColor: '#e9f6ff',
    },
    '.cm-chords-label': {
      color: '#006fb9',
      fontWeight: '600',
    },
    '.cm-chords-lyrics': {
      color: '#111827',
    },
    '.cm-chords-line--metadata': {
      color: '#f175c1',
      fontWeight: 'bold',
    },
    '.cm-chords-line--lyrics': {
      color: '#111827',
    },
    '.cm-chords-line--chord-only': {
      color: '#00aa6d',
    fontWeight: 'bold'
    },
    '.cm-chords-line--error': {
      backgroundColor: 'rgba(254, 242, 242, 0.9)',
    },
    '.cm-chords-line--warning': {
      backgroundColor: 'rgba(255, 251, 235, 0.9)',
    },
    '.cm-chords-line--blank': {
      backgroundColor: 'transparent',
    },
    '.cm-chords-chord': {
      color: '#3c65d3',
      fontWeight: '700',
    },
    '.cm-chords-chord--invalid': {
      color: '#b91c1c',
      backgroundColor: 'rgba(220, 38, 38, 0.1)',
    },
  });
}

export function ChordsEditor({ value, onChange, parsed }: ChordsEditorProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const extensions = useMemo<Extension[]>(
    () => [
      EditorView.lineWrapping,
      bidiIsolates({ alwaysIsolate: true }),
      decorationField,
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          onChangeRef.current(update.state.doc.toString());
        }
      }),
      buildTheme(),
    ],
    [],
  );

  useEffect(() => {
    if (!hostRef.current || viewRef.current) {
      return;
    }

    const view = new EditorView({
      state: EditorState.create({
        doc: value,
        extensions,
      }),
      parent: hostRef.current,
    });

    viewRef.current = view;
  }, [extensions]);

  useEffect(() => {
    return () => {
      viewRef.current?.destroy();
      viewRef.current = null;
    };
  }, []);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) {
      return;
    }

    const currentValue = view.state.doc.toString();
    if (currentValue !== value) {
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: value } });
    }
  }, [value]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) {
      return;
    }

    view.dispatch({ effects: setDecorations.of(buildDecorations(parsed, view.state)) });
  }, [parsed]);

  return <div ref={hostRef} className="editor-host" />;
}

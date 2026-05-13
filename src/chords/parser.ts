import spec from './spec.json';
import type { ChordsSpec, ChordSpan, Diagnostic, ParsedDocument, ParsedLine } from './types';

export const chordsSpec = spec as ChordsSpec;

const metadataPattern = new RegExp(chordsSpec.lineTypes.metadata.pattern);
const labelPattern = new RegExp(chordsSpec.lineTypes.label.pattern);
const chordOnlyPattern = new RegExp(chordsSpec.lineTypes.chordOnly.linePattern);
const chordTokenPattern = new RegExp(chordsSpec.lineTypes.chordOnly.tokenPattern);
const hebrewPattern = /\p{Script=Hebrew}/u;
const latinPattern = /[A-Za-z]/;
const validMetadataKeys = new Set(chordsSpec.metadata.validKeys);

function diagnostic(line: number, from: number, to: number, severity: Diagnostic['severity'], code: string, message: string): Diagnostic {
  return { line, from, to, severity, code, message };
}

function stripLeadingChordMarkers(text: string): string {
  return text.replace(/^\s*(?:\[[^\]]+\]\s*)+/, '').replace(/^\s+/, '');
}

function firstStrongCharacter(text: string): 'hebrew' | 'latin' | undefined {
  for (const character of text) {
    if (hebrewPattern.test(character)) {
      return 'hebrew';
    }
    if (latinPattern.test(character)) {
      return 'latin';
    }
  }
  return undefined;
}

function classifyScript(text: string): 'hebrew' | 'latin' | 'mixed' | 'none' {
  const hasHebrew = hebrewPattern.test(text);
  const hasLatin = latinPattern.test(text);
  if (hasHebrew && hasLatin) {
    return 'mixed';
  }
  if (hasHebrew) {
    return 'hebrew';
  }
  if (hasLatin) {
    return 'latin';
  }
  return 'none';
}

function directionForPlainText(text: string): 'ltr' | 'rtl' | undefined {
  const strong = firstStrongCharacter(text);
  if (strong === 'hebrew') {
    return 'rtl';
  }
  if (strong === 'latin') {
    return 'ltr';
  }
  return undefined;
}

function scanChordSpans(lineText: string, lineNumber: number): { spans: ChordSpan[]; diagnostics: Diagnostic[]; lyricText: string } {
  const spans: ChordSpan[] = [];
  const diagnostics: Diagnostic[] = [];
  const lyricSegments: string[] = [];

  let index = 0;
  while (index < lineText.length) {
    const openIndex = lineText.indexOf('[', index);
    if (openIndex === -1) {
      lyricSegments.push(lineText.slice(index));
      break;
    }

    lyricSegments.push(lineText.slice(index, openIndex));
    const closeIndex = lineText.indexOf(']', openIndex + 1);
    if (closeIndex === -1) {
      diagnostics.push(diagnostic(lineNumber, openIndex, lineText.length, 'error', 'unclosed-bracket', 'Chord marker is missing a closing bracket.'));
      lyricSegments.push(lineText.slice(openIndex));
      break;
    }

    const chord = lineText.slice(openIndex + 1, closeIndex).trim();
    const valid = chordTokenPattern.test(chord);
    spans.push({ from: openIndex, to: closeIndex + 1, chord, valid });
    if (!valid) {
      diagnostics.push(diagnostic(lineNumber, openIndex, closeIndex + 1, 'error', 'invalid-chord', `Invalid chord token: ${chord || '(empty)'}.`));
    }
    index = closeIndex + 1;
  }

  return { spans, diagnostics, lyricText: lyricSegments.join('') };
}

export function isValidChordToken(token: string): boolean {
  return chordTokenPattern.test(token.trim());
}

export function detectDirectionForLyricLine(text: string): 'ltr' | 'rtl' | undefined {
  const strong = firstStrongCharacter(stripLeadingChordMarkers(text));
  if (strong === 'hebrew') {
    return 'rtl';
  }
  if (strong === 'latin') {
    return 'ltr';
  }
  return undefined;
}

export function validateChordsDocument(text: string): ParsedDocument {
  const rawLines = text.split(/\r?\n/);
  const lines: ParsedLine[] = [];
  const diagnostics: Diagnostic[] = [];
  const metadata: Record<string, string> = {};
  const metadataOrder: string[] = [];

  for (let index = 0; index < rawLines.length; index += 1) {
    const lineText = rawLines[index];
    const lineNumber = index + 1;
    const lineDiagnostics: Diagnostic[] = [];
    let kind: ParsedLine['kind'] = 'unknown';
    let direction: ParsedLine['direction'];
    let chordSpans: ChordSpan[] = [];
    let metadataKey: string | undefined;
    let metadataValue: string | undefined;
    let sectionName: string | undefined;

    if (lineText.trim() === '') {
      kind = 'blank';
    } else {
      const metadataMatch = metadataPattern.exec(lineText);
      if (metadataMatch) {
        kind = 'metadata';
        metadataKey = metadataMatch[1].trim();
          // Preserve the raw metadata value (do not trim) so live editing
          // doesn't remove user-typed spaces while they type.
          metadataValue = metadataMatch[2] ?? '';
        metadata[metadataKey] = metadataValue;
        metadataOrder.push(metadataKey);
          // Consider empty if the trimmed value is empty, but keep the raw
          // value stored so we don't strip spaces during editing.
          if ((metadataMatch[2] ?? '').trim() === '') {
          lineDiagnostics.push(diagnostic(lineNumber, 0, lineText.length, 'error', 'empty-metadata-value', `Metadata value is empty for ${metadataKey}.`));
        }
        if (!validMetadataKeys.has(metadataKey)) {
          const severity = chordsSpec.validation.unknownMetadataKeysAreErrors ? 'error' : 'warning';
          lineDiagnostics.push(diagnostic(lineNumber, 0, lineText.length, severity, 'unknown-metadata', `Unknown metadata key: ${metadataKey}.`));
        }
      } else if (labelPattern.test(lineText)) {
        kind = 'label';
        sectionName = lineText.slice(1, -1);
        direction = directionForPlainText(sectionName);
      } else if (chordOnlyPattern.test(lineText)) {
        kind = 'chord-only';
        const chordParts = lineText.split('|').map((part) => part.trim()).filter(Boolean);
        for (const part of chordParts) {
          const chord = part.replace(/\s*(?:\((?:\d+|\d+x)\)|x\d+)\s*$/, '').trim();
          if (!isValidChordToken(chord)) {
            const from = Math.max(0, lineText.indexOf(part));
            lineDiagnostics.push(diagnostic(lineNumber, from, from + part.length, 'error', 'invalid-chord-line', `Invalid chord in chord-only line: ${part}.`));
          }
        }
        direction = 'ltr';
      } else {
        kind = 'lyrics';
        const scanResult = scanChordSpans(lineText, lineNumber);
        chordSpans = scanResult.spans;
        lineDiagnostics.push(...scanResult.diagnostics);
        const lyricText = scanResult.lyricText;
        if (classifyScript(lyricText) === 'mixed') {
          lineDiagnostics.push(diagnostic(lineNumber, 0, lineText.length, 'error', 'mixed-script', 'Lyrics line must be either Hebrew or English, not both.'));
        }
        if (chordsSpec.validation.unbalancedBracketsAreErrors) {
          const openCount = (lineText.match(/\[/g) ?? []).length;
          const closeCount = (lineText.match(/\]/g) ?? []).length;
          if (openCount !== closeCount) {
            lineDiagnostics.push(diagnostic(lineNumber, 0, lineText.length, 'error', 'unbalanced-brackets', 'Chord brackets are unbalanced.'));
          }
        }
        direction = detectDirectionForLyricLine(lineText);
      }
    }

    diagnostics.push(...lineDiagnostics);
    lines.push({
      lineNumber,
      text: lineText,
      kind,
      direction,
      metadataKey,
      metadataValue,
      sectionName,
      chordSpans,
      diagnostics: lineDiagnostics,
    });
  }

  return { text, lines, metadata, metadataOrder, diagnostics };
}

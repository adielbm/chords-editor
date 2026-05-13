export type Severity = 'error' | 'warning';
export type Direction = 'ltr' | 'rtl';

export interface Diagnostic {
  line: number;
  from: number;
  to: number;
  severity: Severity;
  code: string;
  message: string;
}

export interface ChordSpan {
  from: number;
  to: number;
  chord: string;
  valid: boolean;
}

export interface ParsedLine {
  lineNumber: number;
  text: string;
  kind: 'blank' | 'metadata' | 'label' | 'chord-only' | 'lyrics' | 'unknown';
  direction?: Direction;
  metadataKey?: string;
  metadataValue?: string;
  sectionName?: string;
  chordSpans: ChordSpan[];
  diagnostics: Diagnostic[];
}

export interface ParsedDocument {
  text: string;
  lines: ParsedLine[];
  metadata: Record<string, string>;
  metadataOrder: string[];
  diagnostics: Diagnostic[];
}

export interface ChordsSpec {
  version: number;
  metadata: {
    required: string[];
    optional: string[];
    validKeys: string[];
    customKeysAllowed: boolean;
  };
  lineTypes: {
    metadata: { pattern: string };
    label: { pattern: string };
    chordOnly: { tokenPattern: string; linePattern: string };
  };
  validation: {
    strictness: 'strict' | 'hybrid' | 'warning';
    unbalancedBracketsAreErrors: boolean;
    mixedHebrewAndEnglishAreErrors: boolean;
    invalidChordInsideBracketsAreErrors: boolean;
    unknownMetadataKeysAreWarnings: boolean;
    unknownMetadataKeysAreErrors: boolean;
  };
  direction: {
    rtlScripts: string[];
    ltrScripts: string[];
    skipPrefixes: string[];
    useFirstStrongCharacter: boolean;
  };
  export: {
    newline: 'lf' | 'crlf';
    preserveUnknownMetadata: boolean;
  };
}

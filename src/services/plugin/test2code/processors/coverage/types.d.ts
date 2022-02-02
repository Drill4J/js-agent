/*
 * Copyright 2020 EPAM Systems
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
/* eslint-disable import/no-unresolved */
import * as Test2Code from '@drill4j/test2code-types';

export interface AstEntity extends Test2Code.AstEntity {
  filePath: string;
  suffix: string;
  methods: AstMethod[];
}

export interface AstMethod extends Test2Code.AstMethod {
  probes: Probe[];
  location: MethodLocation;
  range: [number, number];
}

export type MethodLocation = {
  start: Location;
  end: Location;
};

type Probe = Location;

export type Location = {
  line: number;
  column: number;
};

export type RawSourceCoverage = {
  startOffset: number;
  endOffset: number;
  count: number;
};

export type OriginalSourceCoverage = {
  count?: number;
  startLine?: number;
  relStartCol?: number;
  endLine?: number;
  relEndCol?: number;
  // absStartCol?: number;
  // absEndCol?: number;
  source?: string;
};

export type RawSourceString = Opaque<'SourceString', string>;
export type ScriptName = Opaque<'ScriptName', string>;
export type ScriptUrl = Opaque<'ScriptUrl', string>;

export type V8ScriptParsedEventData = {
  url: string;
  hash: string;
};

export interface V8ScriptCoverageData {
  timestamp: number;
  result: V8ScriptCoverage[];
}

export interface V8ScriptCoverage {
  functions: V8FunctionCoverage[];
  url: ScriptUrl;
  scriptId: string;
  source?: RawSourceString;
  sourceHash?: string;
}

export interface V8FunctionCoverage {
  functionName: string;
  ranges: V8CoverageRange[];
  isBlockCoverage: boolean;
}

export interface V8CoverageRange {
  startOffset: number;
  endOffset: number;
  count: number;
}

// TODO fix interface (BundleMeta instead of BundleHash)
interface BundleHash {
  file: string;
  hash: string;
}

export type BundleHashes = BundleHash[];

export type BundleScriptNames = ScriptName[];

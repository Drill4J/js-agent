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
import { ExecClassData } from '@drill4j/test2code-types';
import normalizeScriptPath from '../../../../../../util/normalize-script-path';
import { AstEntity, OriginalSourceCoverage, TestName } from '../types';

export default function toExecClass(
  originalSourceCoverage: OriginalSourceCoverage[],
  astEntity: AstEntity,
  testName: TestName,
): ExecClassData {
  const entityCoverage = originalSourceCoverage.filter(x => isCoverageSourceMatchesFilepath(x.source, astEntity.filePath));
  const className = normalizeScriptPath(astEntity.filePath) + (astEntity.suffix ? `.${astEntity.suffix}` : '');
  const probes = mapCoverageToEntityProbes(astEntity, entityCoverage);

  return {
    id: undefined,
    className,
    probes,
    testName,
  };
}

function isCoverageSourceMatchesFilepath(rawSource, filePath) {
  let source = rawSource;
  if (process.env.COVERAGE_SOURCE_OMIT_PREFIX) {
    source = rawSource.replace(process.env.COVERAGE_SOURCE_OMIT_PREFIX, '');
  }
  if (process.env.COVERAGE_SOURCE_APPEND_PREFIX) {
    source = `${process.env.COVERAGE_SOURCE_APPEND_PREFIX}${source}`;
  }
  return source === filePath;
}

function mapCoverageToEntityProbes(file: AstEntity, fileCoverage: OriginalSourceCoverage[]) {
  return file.methods.reduce((result, method) => {
    return method.probes.reduce((acc, probe) => {
      acc.push(fileCoverage.findIndex(sourceRange => sourceRange.startLine <= probe && probe <= sourceRange.endLine) > -1);
      return acc;
    }, result);
  }, []);
}

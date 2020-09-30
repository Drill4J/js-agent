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
import each from 'jest-each';
import { checkSameBundle } from '../../../../src/services/plugin/test2code/processors/coverage/checks';
import { BundleHashes, RawSource, ScriptSources, ScriptUrl } from '../../../../src/services/plugin/test2code/processors/coverage/types';

describe('same bundle check ran on script', () => {
  it('with not-modified source & matching url must return true', () => {
    const url = 'http://localhost:8081/js/Application.js' as ScriptUrl;
    const bundleHashes: BundleHashes = [
      {
        file: 'js/Application.js',
        hash: '4ecd0c44e0481749f3ddf65e5779cf75d61da1852cc56e9acfeed8e6652e81c3',
      },
    ];
    const originalSources: ScriptSources = {
      'http://localhost:8081/js/Application.js': {
        source: `function helloWorld() { console.log('hello world') }` as RawSource,
      },
    };
    const result = checkSameBundle(url, originalSources, bundleHashes);
    expect(result).toEqual(true);
  });

  it('with modified source must return false', () => {
    const url = 'http://localhost:8081/js/Application.js' as ScriptUrl;
    const bundleHashes: BundleHashes = [
      {
        file: 'js/Application.js',
        hash: '4ecd0c44e0481749f3ddf65e5779cf75d61da1852cc56e9acfeed8e6652e81c3',
      },
    ];
    const modifiedSources: ScriptSources = {
      'http://localhost:8081/js/Application.js': {
        source: "function bye() { console.log('bye') }" as RawSource,
      },
    };
    const result = checkSameBundle(url, modifiedSources, bundleHashes);
    expect(result).toEqual(false);
  });

  it('with not-matching url must return false', () => {
    const notMatchingUrl = 'http://localhost:8081/node_modules/angular/angular.js' as ScriptUrl;
    const bundleHashes: BundleHashes = [
      {
        file: 'js/Application.js',
        hash: '4ecd0c44e0481749f3ddf65e5779cf75d61da1852cc56e9acfeed8e6652e81c3',
      },
    ];
    const scriptSources: ScriptSources = {
      'http://localhost:8081/js/Application.js': {
        source: `function helloWorld() { console.log('hello world') }` as RawSource,
      },
    };
    const result = checkSameBundle(notMatchingUrl, scriptSources, bundleHashes);
    expect(result).toEqual(false);
  });

  describe('with LF line-endings replaced by', () => {
    const url = 'http://localhost:8081/js/Application.js' as ScriptUrl;
    const bundleHashes: BundleHashes = [
      {
        file: 'js/Application.js',
        hash: '4f6d37bd2e14e078e2928646196a8235901826c648a41f421c97ff176a25c4bf',
      },
    ];
    const LF = '\u000A';
    const CRLF = '\u000D\u000A';
    const LS = '\u2028';
    const PS = '\u2029';
    each([
      ['CRLF', CRLF],
      ['LS', LS],
      ['PS', PS],
    ]).it('%s must return true', (_, lineEnding) => {
      const replaced = `function helloWorld() {
          console.log("hello world")
        }
        `
        .split(LF)
        .join(lineEnding) as RawSource;
      const sourceWithDifferentLineEndings: ScriptSources = {
        'http://localhost:8081/js/Application.js': {
          source: replaced,
        },
      };
      const result = checkSameBundle(url, sourceWithDifferentLineEndings, bundleHashes);
      expect(result).toEqual(true);
    });
  });
});

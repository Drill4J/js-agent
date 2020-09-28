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
// TODO would be much better to stringify JSON only ONCE, instead of multiple netsted levels. Suggest backend API enhancement
export default function parseJsonRecursive(rawMessage: string, l = 0): unknown {
  if (l > 3) {
    // magic number due to unknown number of nested messages
    throw new Error(`Max recursive parse depth reached.\n   Not-parsed content: ${rawMessage}`);
  }
  const result = JSON.parse(rawMessage);
  // check both fields due to naming inconsistency on different message levels
  const content = result.text || result.message;
  const isContentJSON = content && (content[0] === '{' || content[0] === '[');
  if (isContentJSON) {
    // note that parsed data either from .text or .message gets assigned to "message" field
    result.message = parseJsonRecursive(content, l + 1);
    delete result.text;
  }
  return result;
}

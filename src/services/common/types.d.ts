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
export interface Connection {
  on(event: string, handler: Handler): unknown;
  _on?(event: string, handler: Handler): unknown;
  send(data: string): unknown; // TODO set data type to Package
  close(): void;
  readyState: number;
}

export interface ConnectionProvider {
  new (url: string, options: any): Connection; // TODO describe options
}

type Handler = (...args: unknown[]) => unknown;

interface Package {
  type: string; // TODO describe type enum
}

export interface ConfirmationPackage extends Package {
  destination: string;
}

export interface DataPackage extends Package {
  text: string;
}

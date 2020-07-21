import { ILoggerProvider } from '../../util/logger';

export interface AgentHubConfig {
  loggerProvider: ILoggerProvider,
  connection: {
    protocol: string,
    host: string
  }
}

export interface Connection {
  on(event: string, handler: Handler): unknown;
  _on?(event: string, handler: Handler): unknown;
  send(data: string): unknown; // TODO set data type to Package
  close(): void;
  readyState: number
}

export interface ConnectionProvider {
  new(url: string, options: any): Connection; // TODO describe options
}

type Handler = (...args: unknown[]) => unknown;

interface Package {
  type: string, // TODO describe type enum
}

export interface ConfirmationPackage extends Package {
  destination: string,
}

export interface DataPackage extends Package {
  text: string,
}

import { ILoggerProvider } from '../../util/logger';
import { PluginConstructor } from '../plugin';

export interface AgentData {
  id: string,
  agentType: 'NODEJS',
  instanceId: string, // TODO what is that for and how it should be configured
  buildVersion: string, // TODO what is that for and how it should be configured
  serviceGroupId: string, // TODO what is that for and how it should be configured
}

export interface AgentConfig {
  loggerProvider: ILoggerProvider,
  connection: {
    protocol: string,
    host: string,
  },
  messageParseFunction: MessageParseFunction,
  availablePlugins: {
    [pluginId: string]: PluginConstructor
  },
}

type MessageParseFunction = (rawMessage, ...args: unknown[]) => Message | void;

export interface Message {
  destination: string,
  type: string,
  message: any, // TODO type it
}

export interface AgentInfo {
  id: string,
  agentType: string,
  buildVersion: string,
  instanceIds: string[],
  plugins: PluginInfo[],
}

export interface PluginInfo {
  id: string
}

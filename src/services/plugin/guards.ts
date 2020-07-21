import { Plugin } from './index';
import { Test2CodePlugin } from './test2code';

export function isTest2CodePlugin(plugin: Plugin): plugin is Test2CodePlugin {
  return plugin.hasMatchingId('test2code');
}

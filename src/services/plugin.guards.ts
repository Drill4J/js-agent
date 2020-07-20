import { Plugin } from './plugin';
import { Test2CodePlugin } from './plugins/test2code';

export function isTest2CodePlugin(plugin: Plugin): plugin is Test2CodePlugin {
  return plugin.hasMatchingId('test2code');
}

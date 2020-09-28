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
import debug from 'debug';
import chalk from 'chalk';

// TODO type it all!
export interface ILogger {
  [key: string]: LogFunction;
}
type LogFunction = (...args) => void;

export interface ILoggerProvider {
  getLogger(...args): ILogger;
}

export default class LoggerProvider {
  public static getLogger(
    prefix: string,
    name: string,
    levels = {
      0: { name: 'error', format: chalk.whiteBright, prefixFormat: chalk.whiteBright.bgRedBright },
      1: { name: 'warning', format: chalk.whiteBright, prefixFormat: chalk.black.bgYellowBright },
      2: { name: 'info', format: chalk.white },
      3: { name: 'debug', format: chalk.blueBright },
      4: { name: 'silly', format: chalk.yellow },
    },
  ): ILogger {
    // TODO this is a terrible spaghetti, refactor it
    const logFn = debug(`${prefix}:${name}`);
    const logger = {};
    const loggingLevel = parseInt(process.env.DEBUG_LOG_LEVEL, 10) || 1;
    Object.keys(levels).forEach(levelIndex => {
      const params = levels[levelIndex];
      logger[params.name] = (...args) => {
        if (parseInt(levelIndex, 10) <= loggingLevel) {
          const formattedArgs = args.map(arg => {
            if (typeof arg === 'object') {
              return arg;
            }
            return params.format(arg);
          });

          if (params.prefixFormat) {
            logFn(params.prefixFormat(`${(params.name as string).toUpperCase()}`), ...formattedArgs);
          } else {
            logFn(...formattedArgs);
          }
        }
      };
    });
    return logger;
  }
}

import { color } from '../../common';

type BufferMessage = { data: string; type: 'initialization' | 'regular' | 'error' };

const initializationLines = {
  initializing: 'Azure Functions Core Tools',
  toolsVersion: 'Core Tools Version:       4.0.5198 Commit hash: N/A  (64-bit)',
  runtimeVersion: 'Function Runtime Version: 4.21.1.20667',
  functionsHeader: 'Functions:',
  initialized: 'For detailed output, run func with --verbose flag.',
};

const ENDPOINT_REGEX = /^.*: \[.*\] https?:\/\/.*$/;
const TIMESTAMP_REGEX = /^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\]/;
const FAILED_EXECUTION_REGEX = /^Executed '.*' \(Failed, Id=.*, Duration=.*\)/;

const splitTimestampFromMessage = (line: string) => ({
  timestamp: line.substring(0, 26),
  message: line.substring(27),
});

export class FuncLogger {
  private buffer: BufferMessage[] = [];
  private isInitializing = false;
  private isPrintingFunctions = false;
  private isReportingError = false;
  private colorFunction = color.info;

  constructor(private readonly projectName: string) {
    setInterval(() => this.logBuffer(), 500);
  }

  logData(data: string) {
    if (data.includes(initializationLines.initializing)) this.isInitializing = true;
    this.buffer.push({ data, type: this.isInitializing ? 'initialization' : 'regular' });

    if (data.includes(initializationLines.initialized)) this.isInitializing = false;
  }

  logError(data: string) {
    console.log(JSON.stringify(data));
    this.buffer.push({ data, type: 'error' });
    this.isInitializing = false;
  }

  private printProjectLine(...args: string[]) {
    console.log(color.fade(`[${this.projectName}]`), ...args);
  }

  private printInitializationLine(line: string) {
    switch (line) {
      case initializationLines.initializing:
        this.printProjectLine(line);
        break;
      case initializationLines.initialized:
        this.printProjectLine();
        this.printProjectLine(color.info(line));
        this.isPrintingFunctions = false;
        break;
      case initializationLines.toolsVersion:
      case initializationLines.runtimeVersion:
        this.printProjectLine(color.fade(line));
        break;
      case initializationLines.functionsHeader:
        this.printProjectLine();
        this.printProjectLine(color.data(line));
        this.printProjectLine();
        this.isPrintingFunctions = true;
        break;
      case ENDPOINT_REGEX.test(line) ? line : '': {
        const endOfFuncNameIndex = line.indexOf(':');

        const name = line.substring(0, endOfFuncNameIndex + 1);
        const endpoint = line.substring(endOfFuncNameIndex + 2);
        this.printProjectLine(color.data(name), color.endpoint(endpoint));
        break;
      }
      case this.isPrintingFunctions ? line : '': {
        const [name, type] = line.split(':');
        this.printProjectLine(`${color.dataLight(name)}: ${type}`);
        break;
      }
      case TIMESTAMP_REGEX.test(line) ? line : '': {
        const { timestamp, message } = splitTimestampFromMessage(line);
        this.printProjectLine(color.fade(timestamp), color.info(message));
        break;
      }
      default:
        this.printProjectLine(color.info(line));
    }
  }

  private getBufferLines(type: BufferMessage['type']) {
    return this.buffer
      .filter(message => message.type === type)
      .reduce((acc, curr) => acc + curr.data, '')
      .split('\r\n')
      .filter(line => line !== '')
      .reduce<string[]>((acc, curr) => [...acc, ...curr.split('\n')], []);
  }

  private logBuffer() {
    if (this.isInitializing) return; // If we run multiple functions we want the initialization to be printed for the same app in a one batch
    if (this.buffer.length === 0) return;

    this.getBufferLines('initialization').forEach(line => this.printInitializationLine(line));
    this.getBufferLines('error').forEach(line => console.log(color.error(`[${this.projectName}] ${line}`)));
    this.getBufferLines('regular').forEach(line => {
      if (TIMESTAMP_REGEX.test(line)) {
        const { timestamp, message } = splitTimestampFromMessage(line);
        if (FAILED_EXECUTION_REGEX.test(message)) {
          // Initial error message
          this.colorFunction = color.error;
          this.isReportingError = true;
        } else if (this.isReportingError) {
          // Error message details comes as the second message
          this.colorFunction = color.error;
          this.isReportingError = false;
        } else this.colorFunction = color.info;

        this.printProjectLine(color.fade(timestamp), this.colorFunction(message));
      } else this.printProjectLine(this.colorFunction(line));
    });

    this.buffer = [];
  }
}

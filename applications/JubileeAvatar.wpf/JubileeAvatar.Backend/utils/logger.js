/**
 * Logger Utility for Jubilee Avatar Backend
 */

export class Logger {
    constructor() {
        this.colors = {
            reset: '\x1b[0m',
            red: '\x1b[31m',
            green: '\x1b[32m',
            yellow: '\x1b[33m',
            blue: '\x1b[34m',
            magenta: '\x1b[35m',
            cyan: '\x1b[36m',
            gray: '\x1b[90m'
        };
    }

    timestamp() {
        return new Date().toISOString().replace('T', ' ').substring(0, 23);
    }

    info(message) {
        console.log(`${this.colors.gray}[${this.timestamp()}]${this.colors.reset} ${this.colors.cyan}INFO${this.colors.reset}  ${message}`);
    }

    warn(message) {
        console.log(`${this.colors.gray}[${this.timestamp()}]${this.colors.reset} ${this.colors.yellow}WARN${this.colors.reset}  ${message}`);
    }

    error(message) {
        console.log(`${this.colors.gray}[${this.timestamp()}]${this.colors.reset} ${this.colors.red}ERROR${this.colors.reset} ${message}`);
    }

    debug(message) {
        if (process.env.NODE_ENV === 'development') {
            console.log(`${this.colors.gray}[${this.timestamp()}]${this.colors.reset} ${this.colors.magenta}DEBUG${this.colors.reset} ${message}`);
        }
    }

    success(message) {
        console.log(`${this.colors.gray}[${this.timestamp()}]${this.colors.reset} ${this.colors.green}OK${this.colors.reset}    ${message}`);
    }
}

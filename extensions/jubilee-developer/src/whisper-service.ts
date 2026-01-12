import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';

export class WhisperService {
    private openaiApiKey: string;

    constructor(openaiApiKey: string) {
        this.openaiApiKey = openaiApiKey;
    }

    async transcribeFile(filePath: string): Promise<string> {
        if (!this.openaiApiKey) {
            throw new Error('OpenAI API key not configured for Whisper transcription');
        }

        if (!fs.existsSync(filePath)) {
            throw new Error('Audio file not found');
        }

        return this.callWhisperAPI(filePath);
    }

    private async callWhisperAPI(filePath: string): Promise<string> {
        return new Promise((resolve, reject) => {
            const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
            const fileContent = fs.readFileSync(filePath);
            const fileName = path.basename(filePath);

            // Build multipart form data
            const parts: Buffer[] = [];

            // Add file part
            parts.push(Buffer.from(
                `--${boundary}\r\n` +
                `Content-Disposition: form-data; name="file"; filename="${fileName}"\r\n` +
                `Content-Type: audio/wav\r\n\r\n`
            ));
            parts.push(fileContent);
            parts.push(Buffer.from('\r\n'));

            // Add model part
            parts.push(Buffer.from(
                `--${boundary}\r\n` +
                `Content-Disposition: form-data; name="model"\r\n\r\n` +
                `whisper-1\r\n`
            ));

            // Add language part
            parts.push(Buffer.from(
                `--${boundary}\r\n` +
                `Content-Disposition: form-data; name="language"\r\n\r\n` +
                `en\r\n`
            ));

            // End boundary
            parts.push(Buffer.from(`--${boundary}--\r\n`));

            const body = Buffer.concat(parts);

            const options = {
                hostname: 'api.openai.com',
                port: 443,
                path: '/v1/audio/transcriptions',
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.openaiApiKey}`,
                    'Content-Type': `multipart/form-data; boundary=${boundary}`,
                    'Content-Length': body.length
                }
            };

            const req = https.request(options, (res) => {
                let data = '';
                res.on('data', (chunk) => {
                    data += chunk;
                });
                res.on('end', () => {
                    try {
                        const response = JSON.parse(data);
                        if (response.text) {
                            resolve(response.text);
                        } else if (response.error) {
                            reject(new Error(response.error.message || 'Whisper API error'));
                        } else {
                            reject(new Error('Unknown response format'));
                        }
                    } catch {
                        reject(new Error('Failed to parse Whisper API response'));
                    }
                });
            });

            req.on('error', (e) => {
                reject(new Error(`Request failed: ${e.message}`));
            });

            req.write(body);
            req.end();
        });
    }
}

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { spawn, ChildProcess } from 'child_process';

export class AudioRecorder {
    private recordingProcess: ChildProcess | null = null;
    private outputPath: string = '';
    private isRecording: boolean = false;
    private ffmpegPath: string = '';
    private audioDevice: string = '';

    constructor() {
        this.ffmpegPath = this.findFfmpeg();
        console.log('AudioRecorder: ffmpeg path =', this.ffmpegPath);
    }

    private findFfmpeg(): string {
        const homeDir = os.homedir();

        // Check WinGet packages location first (where we installed it)
        const wingetPackages = path.join(homeDir, 'AppData', 'Local', 'Microsoft', 'WinGet', 'Packages');
        if (fs.existsSync(wingetPackages)) {
            try {
                const packages = fs.readdirSync(wingetPackages);
                for (const pkg of packages) {
                    if (pkg.toLowerCase().includes('ffmpeg')) {
                        const binPath = path.join(wingetPackages, pkg);
                        const ffmpegExe = this.findFileRecursive(binPath, 'ffmpeg.exe', 4);
                        if (ffmpegExe) {
                            console.log('AudioRecorder: Found ffmpeg at', ffmpegExe);
                            return ffmpegExe;
                        }
                    }
                }
            } catch (e) {
                console.error('AudioRecorder: Error searching WinGet packages:', e);
            }
        }

        // Fallback paths
        const fallbacks = [
            'C:\\ffmpeg\\bin\\ffmpeg.exe',
            'C:\\Program Files\\ffmpeg\\bin\\ffmpeg.exe',
            path.join(homeDir, 'AppData', 'Local', 'Microsoft', 'WinGet', 'Links', 'ffmpeg.exe'),
        ];

        for (const p of fallbacks) {
            if (fs.existsSync(p)) {
                return p;
            }
        }

        return 'ffmpeg'; // Hope it's in PATH
    }

    private findFileRecursive(dir: string, filename: string, depth: number): string | null {
        if (depth <= 0) return null;
        try {
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);
                if (entry.isFile() && entry.name.toLowerCase() === filename.toLowerCase()) {
                    return fullPath;
                }
                if (entry.isDirectory()) {
                    const found = this.findFileRecursive(fullPath, filename, depth - 1);
                    if (found) return found;
                }
            }
        } catch { /* ignore */ }
        return null;
    }

    private async getAudioDevice(): Promise<string> {
        if (this.audioDevice) {
            return this.audioDevice;
        }

        return new Promise((resolve, reject) => {
            console.log('AudioRecorder: Getting audio devices...');

            const proc = spawn(this.ffmpegPath, [
                '-list_devices', 'true',
                '-f', 'dshow',
                '-i', 'dummy'
            ], {
                stdio: ['pipe', 'pipe', 'pipe']
            });

            let output = '';
            proc.stderr?.on('data', (data) => {
                output += data.toString();
            });

            proc.on('close', () => {
                // Look for audio device: "DeviceName" (audio)
                const match = output.match(/"([^"]+)"\s*\(audio\)/);
                if (match) {
                    this.audioDevice = match[1];
                    console.log('AudioRecorder: Found audio device:', this.audioDevice);
                    resolve(this.audioDevice);
                } else {
                    console.error('AudioRecorder: No audio device found. Output:', output.substring(0, 500));
                    reject(new Error('No audio device found'));
                }
            });

            proc.on('error', (err) => {
                reject(new Error('Failed to list devices: ' + err.message));
            });
        });
    }

    async startRecording(): Promise<void> {
        if (this.isRecording) {
            throw new Error('Already recording');
        }

        const tempDir = os.tmpdir();
        this.outputPath = path.join(tempDir, `jubilee-recording-${Date.now()}.wav`);
        console.log('AudioRecorder: Output path:', this.outputPath);

        // Get audio device
        const device = await this.getAudioDevice();
        console.log('AudioRecorder: Using device:', device);

        return new Promise((resolve, reject) => {
            this.recordingProcess = spawn(this.ffmpegPath, [
                '-y',
                '-f', 'dshow',
                '-i', `audio=${device}`,
                '-ar', '16000',
                '-ac', '1',
                '-acodec', 'pcm_s16le',
                this.outputPath
            ], {
                stdio: ['pipe', 'pipe', 'pipe']
            });

            let started = false;
            let errorOutput = '';

            this.recordingProcess.stderr?.on('data', (data) => {
                const str = data.toString();
                errorOutput += str;
                // FFmpeg outputs progress info to stderr
                if ((str.includes('size=') || str.includes('time=')) && !started) {
                    started = true;
                    this.isRecording = true;
                    console.log('AudioRecorder: Recording started successfully');
                    resolve();
                }
            });

            this.recordingProcess.on('error', (err) => {
                console.error('AudioRecorder: Process error:', err);
                reject(new Error('Failed to start recording: ' + err.message));
            });

            this.recordingProcess.on('close', (code) => {
                if (!started) {
                    console.error('AudioRecorder: FFmpeg closed before starting. Code:', code);
                    console.error('AudioRecorder: Stderr:', errorOutput);
                }
            });

            // Timeout - if we haven't started after 3s, assume something went wrong
            setTimeout(() => {
                if (!started) {
                    if (this.recordingProcess) {
                        // Check if process is still running
                        if (!this.recordingProcess.killed) {
                            this.isRecording = true;
                            console.log('AudioRecorder: Assuming recording started (timeout)');
                            resolve();
                        } else {
                            reject(new Error('Recording failed to start. Check microphone permissions.'));
                        }
                    }
                }
            }, 3000);
        });
    }

    async stopRecording(): Promise<string> {
        console.log('AudioRecorder: Stopping recording...');

        if (!this.isRecording || !this.recordingProcess) {
            throw new Error('Not recording');
        }

        return new Promise((resolve, reject) => {
            const outputPath = this.outputPath;
            const proc = this.recordingProcess!;

            // Send 'q' to ffmpeg to stop gracefully
            proc.stdin?.write('q');

            const timeout = setTimeout(() => {
                console.log('AudioRecorder: Timeout, killing process');
                proc.kill('SIGTERM');
            }, 5000);

            proc.on('close', (code) => {
                clearTimeout(timeout);
                console.log('AudioRecorder: FFmpeg exited with code:', code);
                this.isRecording = false;
                this.recordingProcess = null;

                // Wait a moment for file to be fully written
                setTimeout(() => {
                    if (fs.existsSync(outputPath)) {
                        const stats = fs.statSync(outputPath);
                        console.log('AudioRecorder: File size:', stats.size);
                        if (stats.size > 1000) { // At least 1KB
                            resolve(outputPath);
                        } else {
                            reject(new Error('Recording file too small: ' + stats.size + ' bytes'));
                        }
                    } else {
                        reject(new Error('Recording file not created: ' + outputPath));
                    }
                }, 300);
            });
        });
    }

    isCurrentlyRecording(): boolean {
        return this.isRecording;
    }

    getOutputPath(): string {
        return this.outputPath;
    }

    cleanup(): void {
        if (this.outputPath && fs.existsSync(this.outputPath)) {
            try {
                fs.unlinkSync(this.outputPath);
                console.log('AudioRecorder: Cleaned up temp file');
            } catch { /* ignore */ }
        }
    }
}
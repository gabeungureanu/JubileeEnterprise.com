import { spawn, ChildProcess } from 'child_process';

export class SpeechRecognizer {
    private recognitionProcess: ChildProcess | null = null;
    private isListening: boolean = false;

    constructor() {
        console.log('SpeechRecognizer: Initialized');
    }

    async startListening(): Promise<string> {
        if (this.isListening) {
            throw new Error('Already listening');
        }

        this.isListening = true;

        return new Promise((resolve, reject) => {
            // PowerShell script using Windows Speech Recognition
            const psScript = `
Add-Type -AssemblyName System.Speech

$recognizer = New-Object System.Speech.Recognition.SpeechRecognitionEngine
$recognizer.SetInputToDefaultAudioDevice()

# Create a grammar that accepts any dictation
$dictationGrammar = New-Object System.Speech.Recognition.DictationGrammar
$recognizer.LoadGrammar($dictationGrammar)

Write-Host "LISTENING"

try {
    # Recognize with timeout (15 seconds max)
    $result = $recognizer.Recognize([System.TimeSpan]::FromSeconds(15))

    if ($result -ne $null -and $result.Text -ne $null -and $result.Text.Length -gt 0) {
        Write-Host "RESULT:$($result.Text)"
    } else {
        Write-Host "NO_SPEECH"
    }
} catch {
    Write-Host "ERROR:$($_.Exception.Message)"
} finally {
    $recognizer.Dispose()
}
`;

            this.recognitionProcess = spawn('powershell.exe', [
                '-NoProfile',
                '-ExecutionPolicy', 'Bypass',
                '-Command', psScript
            ], {
                stdio: ['pipe', 'pipe', 'pipe'],
                windowsHide: true
            });

            let output = '';
            let errorOutput = '';

            this.recognitionProcess.stdout?.on('data', (data) => {
                const str = data.toString();
                output += str;
                console.log('SpeechRecognizer stdout:', str.trim());

                if (str.includes('RESULT:')) {
                    const match = str.match(/RESULT:(.+)/);
                    if (match) {
                        this.isListening = false;
                        resolve(match[1].trim());
                    }
                } else if (str.includes('NO_SPEECH')) {
                    this.isListening = false;
                    reject(new Error('No speech detected. Please try again.'));
                } else if (str.includes('ERROR:')) {
                    const match = str.match(/ERROR:(.+)/);
                    this.isListening = false;
                    reject(new Error(match ? match[1].trim() : 'Recognition error'));
                }
            });

            this.recognitionProcess.stderr?.on('data', (data) => {
                errorOutput += data.toString();
                console.error('SpeechRecognizer stderr:', data.toString());
            });

            this.recognitionProcess.on('close', (code) => {
                console.log('SpeechRecognizer: Process closed with code', code);
                this.isListening = false;

                if (!output.includes('RESULT:') && !output.includes('NO_SPEECH') && !output.includes('ERROR:')) {
                    if (errorOutput) {
                        reject(new Error('Speech recognition failed: ' + errorOutput.substring(0, 200)));
                    } else {
                        reject(new Error('Speech recognition ended unexpectedly'));
                    }
                }
            });

            this.recognitionProcess.on('error', (err) => {
                console.error('SpeechRecognizer: Process error:', err);
                this.isListening = false;
                reject(new Error('Failed to start speech recognition: ' + err.message));
            });

            // Timeout after 20 seconds
            setTimeout(() => {
                if (this.isListening) {
                    this.stopListening();
                    reject(new Error('Speech recognition timed out'));
                }
            }, 20000);
        });
    }

    stopListening(): void {
        if (this.recognitionProcess) {
            this.recognitionProcess.kill();
            this.recognitionProcess = null;
        }
        this.isListening = false;
    }

    isCurrentlyListening(): boolean {
        return this.isListening;
    }
}
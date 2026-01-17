/**
 * D-ID Service - Real-Time Avatar Animation
 */

import fetch from 'node-fetch';
import FormData from 'form-data';

export class DIDService {
    constructor() {
        this.apiKey = process.env.DID_API_KEY;
        this.avatarId = process.env.DID_AVATAR_ID;
        this.baseUrl = 'https://api.d-id.com';

        // Default presenter configuration
        this.presenterConfig = {
            stitch: true,
            fluent: true,
            pad_audio: 0.5
        };
    }

    isConfigured() {
        return !!this.apiKey;
    }

    async animate(text, audioBuffer) {
        if (!this.apiKey) {
            console.log('D-ID API key not configured - skipping avatar animation');
            return null;
        }

        try {
            // Option 1: Create talk with text (D-ID generates audio)
            // Option 2: Create talk with audio (use ElevenLabs audio)

            // Using audio from ElevenLabs for lip-sync
            const response = await this.createTalkWithAudio(text, audioBuffer);
            return response;
        } catch (error) {
            console.error('D-ID animation error:', error.message);
            // Don't throw - avatar is optional
            return null;
        }
    }

    async createTalkWithAudio(text, audioBuffer) {
        try {
            // First, upload the audio
            const audioUrl = await this.uploadAudio(audioBuffer);

            // Create the talk
            const response = await fetch(`${this.baseUrl}/talks`, {
                method: 'POST',
                headers: {
                    'Authorization': `Basic ${this.apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    source_url: this.avatarId || 'https://create-images-results.d-id.com/DefaultPresenters/Noelle_f/image.jpeg',
                    script: {
                        type: 'audio',
                        audio_url: audioUrl
                    },
                    config: this.presenterConfig
                })
            });

            if (!response.ok) {
                const error = await response.text();
                throw new Error(`D-ID API error: ${response.status} - ${error}`);
            }

            const data = await response.json();
            return await this.waitForTalk(data.id);
        } catch (error) {
            console.error('Error creating talk with audio:', error.message);
            throw error;
        }
    }

    async createTalkWithText(text) {
        try {
            const response = await fetch(`${this.baseUrl}/talks`, {
                method: 'POST',
                headers: {
                    'Authorization': `Basic ${this.apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    source_url: this.avatarId || 'https://create-images-results.d-id.com/DefaultPresenters/Noelle_f/image.jpeg',
                    script: {
                        type: 'text',
                        input: text,
                        provider: {
                            type: 'microsoft',
                            voice_id: 'en-US-JennyNeural'
                        }
                    },
                    config: this.presenterConfig
                })
            });

            if (!response.ok) {
                const error = await response.text();
                throw new Error(`D-ID API error: ${response.status} - ${error}`);
            }

            const data = await response.json();
            return await this.waitForTalk(data.id);
        } catch (error) {
            console.error('Error creating talk with text:', error.message);
            throw error;
        }
    }

    async uploadAudio(audioBuffer) {
        try {
            const formData = new FormData();
            formData.append('audio', audioBuffer, {
                filename: 'audio.mp3',
                contentType: 'audio/mpeg'
            });

            const response = await fetch(`${this.baseUrl}/audios`, {
                method: 'POST',
                headers: {
                    'Authorization': `Basic ${this.apiKey}`,
                    ...formData.getHeaders()
                },
                body: formData
            });

            if (!response.ok) {
                const error = await response.text();
                throw new Error(`Audio upload error: ${response.status} - ${error}`);
            }

            const data = await response.json();
            return data.url;
        } catch (error) {
            console.error('Error uploading audio:', error.message);
            throw error;
        }
    }

    async waitForTalk(talkId, maxAttempts = 30) {
        for (let i = 0; i < maxAttempts; i++) {
            try {
                const response = await fetch(`${this.baseUrl}/talks/${talkId}`, {
                    headers: {
                        'Authorization': `Basic ${this.apiKey}`
                    }
                });

                if (!response.ok) {
                    throw new Error(`Failed to get talk status: ${response.status}`);
                }

                const data = await response.json();

                if (data.status === 'done') {
                    return data.result_url;
                } else if (data.status === 'error') {
                    throw new Error(`Talk generation failed: ${data.error?.description || 'Unknown error'}`);
                }

                // Wait 500ms before next check
                await new Promise(resolve => setTimeout(resolve, 500));
            } catch (error) {
                console.error('Error checking talk status:', error.message);
                throw error;
            }
        }

        throw new Error('Talk generation timed out');
    }

    setAvatarId(avatarId) {
        this.avatarId = avatarId;
    }

    async getAvatars() {
        if (!this.apiKey) {
            throw new Error('D-ID API key not configured');
        }

        try {
            const response = await fetch(`${this.baseUrl}/presenters`, {
                headers: {
                    'Authorization': `Basic ${this.apiKey}`
                }
            });

            if (!response.ok) {
                throw new Error(`Failed to get avatars: ${response.status}`);
            }

            const data = await response.json();
            return data.presenters;
        } catch (error) {
            console.error('Error getting avatars:', error.message);
            throw error;
        }
    }
}

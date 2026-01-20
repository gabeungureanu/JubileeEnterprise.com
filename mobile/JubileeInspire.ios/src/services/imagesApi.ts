/**
 * Jubilee Inspire - Images API Service
 *
 * Handles image generation, analysis, and editing operations.
 * Includes demo mode for testing when backend is not available.
 */

import HttpClient from './httpClient';
import { config, isDevelopment } from '../config';
import { ApiResponse, ImageGenerateRequest, ImageAnalyzeRequest, ImageEditRequest } from '../types';

// Initialize HTTP client with Inspire API URL (images will be part of Inspire service)
const client = new HttpClient(config.inspireApiUrl);

// Demo mode flag - enables mock responses when backend is unavailable
const DEMO_MODE = true; // Set to false when backend is ready

// Demo placeholder images (using placeholder.com for reliable demonstration)
const DEMO_IMAGES = [
  'https://placehold.co/1024x1024/4a9eff/ffffff?text=Generated+Image+1',
  'https://placehold.co/1024x1024/ff6b6b/ffffff?text=Generated+Image+2',
  'https://placehold.co/1024x1024/51cf66/ffffff?text=Generated+Image+3',
  'https://placehold.co/1024x1024/ffd43b/333333?text=Generated+Image+4',
  'https://placehold.co/1024x1024/cc5de8/ffffff?text=Generated+Image+5',
];

// Simulated delay for demo mode (ms)
const DEMO_DELAY = 1000;

// Response types
interface ImageGenerateResponse {
  imageUrl: string;
  thumbnailUrl?: string;
  prompt: string;
  style: string;
  size: string;
}

interface ImageAnalyzeResponse {
  analysis: string;
  confidence?: number;
  tags?: string[];
}

interface ImageEditResponse {
  imageUrl: string;
  thumbnailUrl?: string;
  originalUrl: string;
  instruction: string;
}

/**
 * Helper to simulate API delay in demo mode
 */
const demoDelay = () => new Promise(resolve => setTimeout(resolve, DEMO_DELAY));

/**
 * Get a random demo image with optional custom text
 */
const getRandomDemoImage = (text?: string): string => {
  const colors = ['4a9eff', 'ff6b6b', '51cf66', 'ffd43b', 'cc5de8', '20c997', 'fab005'];
  const bgColor = colors[Math.floor(Math.random() * colors.length)];
  const textColor = ['ffd43b', 'fab005'].includes(bgColor) ? '333333' : 'ffffff';
  const displayText = text ? encodeURIComponent(text.substring(0, 30)) : 'Generated+Image';
  return `https://placehold.co/1024x1024/${bgColor}/${textColor}?text=${displayText}`;
};

/**
 * Generate demo analysis based on prompt
 */
const generateDemoAnalysis = (question: string): string => {
  const analyses = [
    `Based on my analysis of this image, I can see several interesting elements. ${question ? `Regarding your question about "${question}": ` : ''}The composition shows balanced visual elements with good use of color contrast. The lighting appears natural, creating depth and dimension in the scene.`,
    `This image presents a fascinating visual narrative. ${question ? `To address "${question}": ` : ''}I observe careful attention to detail in the composition. The color palette creates a harmonious mood, while the subject matter engages the viewer's attention effectively.`,
    `Examining this image closely reveals thoughtful artistic choices. ${question ? `Concerning "${question}": ` : ''}The framing draws the eye to key elements, and the overall aesthetic demonstrates skilled visual storytelling. The interplay of light and shadow adds emotional depth.`,
  ];
  return analyses[Math.floor(Math.random() * analyses.length)];
};

/**
 * Images API Service
 */
export const imagesApi = {
  /**
   * Generate an image from a text prompt
   */
  async generate(request: ImageGenerateRequest): Promise<ApiResponse<ImageGenerateResponse>> {
    console.log('[imagesApi] generate called with:', request);

    if (DEMO_MODE) {
      console.log('[imagesApi] Running in DEMO_MODE');
      await demoDelay();

      // Generate a demo image with prompt as seed for consistency
      const imageUrl = getRandomDemoImage(request.prompt);
      console.log('[imagesApi] Generated demo image URL:', imageUrl);

      const response = {
        success: true,
        data: {
          imageUrl,
          thumbnailUrl: imageUrl,
          prompt: request.prompt,
          style: request.style || 'natural',
          size: request.size || '1024x1024',
        },
        message: 'Image generated successfully (Demo Mode)',
      };

      console.log('[imagesApi] Returning response:', response);
      return response;
    }

    // Real API call
    return client.post<ImageGenerateResponse>('/images/generate', request);
  },

  /**
   * Analyze an image and answer questions about it
   */
  async analyze(request: ImageAnalyzeRequest): Promise<ApiResponse<ImageAnalyzeResponse>> {
    if (DEMO_MODE) {
      await demoDelay();

      return {
        success: true,
        data: {
          analysis: generateDemoAnalysis(request.question),
          confidence: 0.92,
          tags: ['artistic', 'colorful', 'detailed', 'composition'],
        },
        message: 'Image analyzed successfully (Demo Mode)',
      };
    }

    // Real API call
    return client.post<ImageAnalyzeResponse>('/images/analyze', request);
  },

  /**
   * Edit an image based on instructions
   */
  async edit(request: ImageEditRequest): Promise<ApiResponse<ImageEditResponse>> {
    if (DEMO_MODE) {
      await demoDelay();

      // Generate a new "edited" demo image
      const imageUrl = getRandomDemoImage(`edited-${request.instruction}`);

      return {
        success: true,
        data: {
          imageUrl,
          thumbnailUrl: imageUrl,
          originalUrl: request.imageUrl || '',
          instruction: request.instruction,
        },
        message: 'Image edited successfully (Demo Mode)',
      };
    }

    // Real API call
    return client.post<ImageEditResponse>('/images/edit', request);
  },

  /**
   * Check if running in demo mode
   */
  isDemoMode(): boolean {
    return DEMO_MODE;
  },

  /**
   * Set the auth token (forwarded from Codex)
   */
  setAuthToken(token: string | null): void {
    client.setAuthToken(token);
  },
};

export default imagesApi;

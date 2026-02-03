/**
 * Image Processing Worker - Message Definitions
 *
 * Shared message types for the image processing example.
 */

import type { DefineMessages } from 'isolated-workers';

// #region messages
export type Messages = DefineMessages<{
  // Process an image and return metadata
  processImage: {
    payload: {
      imagePath: string;
      options: { grayscale: boolean; quality: number };
    };
    result: {
      width: number;
      height: number;
      format: string;
      size: number;
    };
  };

  // Batch process multiple images
  batchProcess: {
    payload: {
      paths: string[];
      options: { grayscale: boolean; quality: number };
    };
    result: {
      successful: number;
      failed: number;
      results: Array<{ path: string; success: boolean }>;
    };
  };

  // Get current worker status
  getStatus: {
    payload: Record<string, never>;
    result: {
      active: boolean;
      processedCount: number;
    };
  };
}>;
// #endregion messages

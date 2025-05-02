// src/actions/youtube-actions.ts
'use server';

import { searchYoutubeVideos } from '@/services/youtube';
import type { YoutubeSearchResult } from '@/lib/types'; // Use type from shared location

/**
 * Server action to search YouTube videos using the placeholder service.
 * @param query The search query string.
 * @returns A promise resolving to an array of search results or throws an error.
 */
export async function searchYoutubeAction(query: string): Promise<YoutubeSearchResult[]> {
  if (!query || query.trim().length === 0) {
    return []; // Return empty if query is empty
  }
  try {
    const results = await searchYoutubeVideos(query.trim());
    // In a real scenario, map API response to YoutubeSearchResult type here if necessary.
    return results;
  } catch (error) {
    console.error('Error searching YouTube:', error);
    // Rethrow or return a specific error structure for the client to handle
    throw new Error('Failed to search YouTube. Please try again.');
  }
}

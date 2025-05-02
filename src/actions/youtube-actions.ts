// src/actions/youtube-actions.ts
'use server';

import { searchYoutubeVideos } from '@/services/youtube';
import type { YoutubeSearchResult } from '@/lib/types'; // Use type from shared location

/**
 * Server action to search YouTube videos using the actual YouTube API service.
 * @param query The search query string.
 * @returns A promise resolving to an array of search results or throws an error.
 */
export async function searchYoutubeAction(query: string): Promise<YoutubeSearchResult[]> {
  if (!query || query.trim().length === 0) {
    return []; // Return empty if query is empty
  }
  try {
    console.log(`[Action] Initiating YouTube search for query: "${query.trim()}"`);
    const results = await searchYoutubeVideos(query.trim());
    console.log(`[Action] YouTube search completed. Found ${results.length} results.`);
    return results;
  } catch (error) {
    console.error('[Action] Error during YouTube search:', error);
    // Provide a more user-friendly error message, hiding internal details
    if (error instanceof Error && error.message.includes('API key is missing')) {
         throw new Error('Search functionality is currently unavailable due to server configuration issues.');
    }
     if (error instanceof Error && error.message.includes('YouTube API Error')) {
         // You might want to log the specific API error internally but show a generic message
         throw new Error('Failed to search YouTube due to an API issue. Please try again later.');
     }
    // Generic fallback
    throw new Error('Failed to search YouTube. Please try again.');
  }
}

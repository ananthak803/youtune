// src/actions/youtube-actions.ts
'use server';

import { searchYoutubeVideos, getYoutubeVideoMetadata } from '@/services/youtube';
import type { YoutubeSearchResult, YoutubeVideoMetadata } from '@/lib/types'; // Use type from shared location

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
    // This requires the API key, handled by the service
    const results = await searchYoutubeVideos(query.trim());
    console.log(`[Action] YouTube search completed. Found ${results.length} results.`);
    return results;
  } catch (error) {
    console.error('[Action] Error during YouTube search:', error);
    // Provide a more user-friendly error message, hiding internal details
    if (error instanceof Error && error.message.includes('Server configuration error: YouTube API key is missing')) {
         throw new Error('Search functionality is currently unavailable due to server configuration.');
    }
     if (error instanceof Error && error.message.includes('YouTube API Error')) {
         // You might want to log the specific API error internally but show a generic message
         throw new Error('Failed to search YouTube due to an API issue. Please try again later.');
     }
    // Generic fallback
    throw new Error('Failed to search YouTube. Please try again.');
  }
}

/**
 * Server action to get YouTube video metadata using the actual YouTube API service.
 * @param videoId The YouTube video ID.
 * @returns A promise resolving to the video metadata or throws an error.
 */
export async function getYoutubeMetadataAction(videoId: string): Promise<YoutubeVideoMetadata> {
  if (!videoId) {
      throw new Error('Video ID is required.');
  }
  try {
    console.log(`[Action] Initiating YouTube metadata fetch for video ID: "${videoId}"`);
    // This requires the API key, handled by the service
    const metadata = await getYoutubeVideoMetadata(videoId);
    console.log(`[Action] YouTube metadata fetch completed for ${videoId}.`);
    return metadata;
  } catch (error) {
    console.error('[Action] Error during YouTube metadata fetch:', error);
    // Provide a more user-friendly error message, hiding internal details
    if (error instanceof Error && error.message.includes('Server configuration error: YouTube API key is missing')) {
         throw new Error('Metadata fetch unavailable due to server configuration.');
    }
     if (error instanceof Error && error.message.includes('YouTube API Error')) {
         throw new Error('Failed to fetch metadata due to an API issue. Please try again later.');
     }
     if (error instanceof Error && error.message.includes(`Video with ID ${videoId} not found`)) {
        throw new Error('Video not found.');
     }
    // Generic fallback
    throw new Error('Failed to fetch YouTube video metadata. Please try again.');
  }
}

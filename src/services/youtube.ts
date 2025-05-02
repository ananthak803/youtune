/**
 * Represents metadata for a YouTube video.
 */
export interface YoutubeVideoMetadata {
  /**
   * The title of the video.
   */
  title: string;
  /**
   * The URL of the video's thumbnail image.
   */
  thumbnailUrl: string;
  /**
   * The author or channel name of the video.
   */
  author: string;
}

/**
 * Represents a single search result from YouTube.
 */
export interface YoutubeSearchResult {
    videoId: string;
    title: string;
    author: string; // Channel name
    thumbnailUrl: string;
}


/**
 * Asynchronously retrieves *placeholder* metadata for a given YouTube video ID.
 *
 * **Note:** This is a placeholder function. In a real application, this would
 * involve calling the YouTube Data API v3 (or using a backend service that does)
 * to fetch actual video details. This requires setting up API keys, handling quotas,
 * and potentially server-side logic to avoid exposing keys on the client.
 *
 * This placeholder generates predictable data based on the video ID for demonstration.
 *
 * @param videoId The ID of the YouTube video.
 * @returns A promise that resolves to a YoutubeVideoMetadata object containing placeholder metadata.
 */
export async function getYoutubeVideoMetadata(videoId: string): Promise<YoutubeVideoMetadata> {
  console.warn("Using placeholder function for getYoutubeVideoMetadata. Implement actual API call for production.");

  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 150));

  // Generate placeholder data based on videoId for some variety
  const placeholderTitle = `Video Title for ID: ${videoId.substring(0, 5)}...`;
  const placeholderAuthor = `Channel ${videoId.substring(videoId.length - 3)}`;
  // Use a placeholder image service or a default YouTube thumbnail URL format
  // Note: Accessing default thumbnails might have restrictions or change.
  const thumbnailUrl = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`; // Standard thumbnail URL

  return {
    title: placeholderTitle,
    thumbnailUrl: thumbnailUrl,
    author: placeholderAuthor,
  };
}

/**
 * Asynchronously searches YouTube for videos based on a query (placeholder).
 *
 * **Note:** This is a placeholder function. A real implementation would use the
 * YouTube Data API v3 search endpoint.
 *
 * @param query The search term.
 * @param maxResults The maximum number of results to return (default 5).
 * @returns A promise that resolves to an array of YoutubeSearchResult objects.
 */
export async function searchYoutubeVideos(query: string, maxResults = 5): Promise<YoutubeSearchResult[]> {
    console.warn("Using placeholder function for searchYoutubeVideos. Implement actual API call for production.");

    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 300));

    // Generate mock results based on the query
    const results: YoutubeSearchResult[] = [];
    for (let i = 0; i < maxResults; i++) {
        const videoId = `${query.replace(/\s+/g, '_').substring(0, 5)}_${i}${Math.random().toString(36).substring(2, 7)}`;
        results.push({
            videoId: videoId,
            title: `${query} - Result ${i + 1}`,
            author: `Search Channel ${i}`,
            thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/default.jpg`, // Use default thumbnail, might 404
        });
    }

    return results;
}

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
  // Use a standard YouTube thumbnail URL format. This URL points to a real image IF the videoId is valid.
  const thumbnailUrl = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

  return {
    title: placeholderTitle,
    thumbnailUrl: thumbnailUrl,
    author: placeholderAuthor,
  };
}

// A list of known valid YouTube video IDs to make placeholder search results more realistic
const placeholderVideoIds = [
    'dQw4w9WgXcQ', // Rick Astley - Never Gonna Give You Up
    'kJQP7kiw5Fk', // Luis Fonsi - Despacito
    '3tmd-ClpJxA', // Mark Ronson - Uptown Funk
    'JGwWNGJdvx8', // Ed Sheeran - Shape of You
    'C0DPdy98e4c', // PSY - GANGNAM STYLE
    'fregObNcHC8', // Billie Eilish - bad guy
    '9bZkp7q19f0', // Tones and I - Dance Monkey
    'RgKAFK5djSk', // Wiz Khalifa - See You Again
    'hT_nvWreIhg', // Justin Bieber - Sorry
    '09R8_2nJtjg', // Katy Perry - Roar
];


/**
 * Asynchronously searches YouTube for videos based on a query (placeholder).
 *
 * **Note:** This is a placeholder function. A real implementation would use the
 * YouTube Data API v3 search endpoint. This version uses a fixed list of video IDs
 * to provide results with loadable thumbnails.
 *
 * @param query The search term (used to generate titles).
 * @param maxResults The maximum number of results to return (default 5).
 * @returns A promise that resolves to an array of YoutubeSearchResult objects.
 */
export async function searchYoutubeVideos(query: string, maxResults = 5): Promise<YoutubeSearchResult[]> {
    console.warn("Using placeholder function for searchYoutubeVideos. Implement actual API call for production.");

    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 300));

    // Use the predefined list of valid video IDs
    const results: YoutubeSearchResult[] = [];
    const numIdsToUse = Math.min(maxResults, placeholderVideoIds.length);

    for (let i = 0; i < numIdsToUse; i++) {
        const videoId = placeholderVideoIds[i];
        results.push({
            videoId: videoId,
            // Generate a title based on the query for relevance, but use a real ID
            title: `${query} - Result ${i + 1}`,
            author: `Sample Channel ${i + 1}`,
            // Use the standard thumbnail URL format with the *real* video ID
            thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
        });
    }

    // If maxResults is greater than the number of placeholder IDs, pad with less specific placeholders
    for (let i = numIdsToUse; i < maxResults; i++) {
         const randomSuffix = Math.random().toString(36).substring(2, 7);
         // Use a generic ID known not to exist, forcing fallback in UI
         const fakeVideoId = `fake_${randomSuffix}`;
         results.push({
             videoId: fakeVideoId,
             title: `${query} - More Result ${i + 1}`,
             author: `Another Channel ${i + 1}`,
             thumbnailUrl: `https://i.ytimg.com/vi/${fakeVideoId}/hqdefault.jpg`, // This will likely 404
         });
     }


    return results.slice(0, maxResults); // Ensure we don't exceed maxResults
}

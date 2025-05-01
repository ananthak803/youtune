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

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

// --- Constants ---
const YOUTUBE_API_BASE_URL = 'https://www.googleapis.com/youtube/v3';

// --- Helper Functions ---

/**
 * Fetches data from the YouTube API.
 * @param endpoint The API endpoint (e.g., 'search', 'videos').
 * @param params URL parameters for the API call.
 * @returns A promise resolving to the JSON response.
 * @throws An error if the API key is missing or the fetch fails.
 */
async function fetchYoutubeAPI(endpoint: string, params: Record<string, string>): Promise<any> {
    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) {
        console.error('[YouTube Service] YouTube API key (YOUTUBE_API_KEY) is missing in environment variables.');
        // This specific error message is checked in the calling actions/components
        throw new Error('Server configuration error: YouTube API key is missing.');
    }

    const url = new URL(`${YOUTUBE_API_BASE_URL}/${endpoint}`);
    url.searchParams.set('key', apiKey);
    for (const key in params) {
        url.searchParams.set(key, params[key]);
    }

    try {
        const response = await fetch(url.toString(), {
             next: { revalidate: 3600 } // Revalidate data every hour
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: 'Unknown API error' }));
            console.error(`[YouTube Service] API Error (${response.status}):`, errorData);
            // Prefix the error for easier identification in actions
            throw new Error(`YouTube API Error: ${errorData?.error?.message || response.statusText}`);
        }

        const data = await response.json();
        return data;

    } catch (error) {
        // Log the detailed error server-side
        console.error(`[YouTube Service] Fetch failed for ${endpoint}:`, error);
        // Re-throw specific errors or a generic network error
        if (error instanceof Error && (error.message.startsWith('YouTube API Error:') || error.message.startsWith('Server configuration error:'))) {
            throw error;
        }
        throw new Error(`Network or unexpected error occurred while fetching from YouTube.`);
    }
}


// --- Core Service Functions ---

/**
 * Asynchronously retrieves actual metadata for a given YouTube video ID using the YouTube Data API.
 * Requires the YouTube API Key to be configured.
 *
 * @param videoId The ID of the YouTube video.
 * @returns A promise that resolves to a YoutubeVideoMetadata object containing actual metadata.
 * @throws An error if the API call fails or the video is not found.
 */
export async function getYoutubeVideoMetadata(videoId: string): Promise<YoutubeVideoMetadata> {
  const params = {
    part: 'snippet',
    id: videoId,
  };

  // fetchYoutubeAPI handles API key and potential errors
  const data = await fetchYoutubeAPI('videos', params);

  if (!data.items || data.items.length === 0) {
    // Specific error if video not found by API
    throw new Error(`Video with ID ${videoId} not found via API.`);
  }

  const snippet = data.items[0].snippet;
  // Provide a fallback thumbnail URL
  const thumbnailUrl = snippet.thumbnails?.high?.url || snippet.thumbnails?.medium?.url || snippet.thumbnails?.default?.url || '/placeholder-album.svg';

  const metadata: YoutubeVideoMetadata = {
    title: snippet.title || 'Unknown Title',
    author: snippet.channelTitle || 'Unknown Artist',
    thumbnailUrl: thumbnailUrl,
  };
  return metadata;
}


/**
 * Asynchronously searches YouTube for videos based on a query using the YouTube Data API.
 * Requires the YouTube API Key to be configured.
 *
 * @param query The search term.
 * @param maxResults The maximum number of results to return (default 10).
 * @returns A promise that resolves to an array of YoutubeSearchResult objects.
 */
export async function searchYoutubeVideos(query: string, maxResults = 10): Promise<YoutubeSearchResult[]> {
    const params = {
        part: 'snippet',
        q: query,
        type: 'video', // Ensure only videos
        maxResults: maxResults.toString(),
    };

    // fetchYoutubeAPI handles API key and potential errors
    const data = await fetchYoutubeAPI('search', params);

    if (!data.items) {
        return []; // Return empty array if no items found
    }

    const results: YoutubeSearchResult[] = data.items
        .map((item: any) => {
            // Basic validation for search result structure
            if (!item.id?.videoId || !item.snippet) {
                console.warn('[YouTube Service] Skipping invalid search result item:', item);
                return null;
            }
            const snippet = item.snippet;
            const thumbnailUrl = snippet.thumbnails?.high?.url || snippet.thumbnails?.medium?.url || snippet.thumbnails?.default?.url || '/placeholder-album.svg';

            return {
                videoId: item.id.videoId,
                title: snippet.title || 'Unknown Title',
                author: snippet.channelTitle || 'Unknown Channel',
                thumbnailUrl: thumbnailUrl,
            };
        })
        .filter((result: YoutubeSearchResult | null): result is YoutubeSearchResult => result !== null); // Ensure only valid results are returned

    return results;
}

/**
 * Extracts the YouTube video ID from various URL formats.
 * @param url The YouTube URL string.
 * @returns The video ID string or null if no valid ID is found.
 */
export function extractYoutubeVideoId(url: string): string | null {
    if (!url) return null;
    try {
        const urlObj = new URL(url);
        let videoId: string | null = null;

        // Standard youtube.com/watch?v= format
        if (urlObj.hostname.includes('youtube.com') && urlObj.pathname === '/watch') {
            videoId = urlObj.searchParams.get('v');
        }
        // Shortened youtu.be format
        else if (urlObj.hostname === 'youtu.be') {
            videoId = urlObj.pathname.substring(1); // Remove leading '/'
        }
        // Embed format youtube.com/embed/
        else if (urlObj.hostname.includes('youtube.com') && urlObj.pathname.startsWith('/embed/')) {
             videoId = urlObj.pathname.split('/')[2];
        }
        // Shorts format youtube.com/shorts/
        else if (urlObj.hostname.includes('youtube.com') && urlObj.pathname.startsWith('/shorts/')) {
             videoId = urlObj.pathname.split('/')[2];
        }

        // Validate the extracted ID format (11 characters, specific character set)
        if (videoId && /^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
            return videoId;
        }

    } catch (e) {
        // Ignore invalid URL formats
    }
    // If no valid ID found after checking formats
    console.warn(`[YouTube Service] Could not extract valid video ID from URL: ${url}`);
    return null;
}

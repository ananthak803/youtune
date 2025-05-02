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
        console.error('YouTube API key (YOUTUBE_API_KEY) is missing in environment variables.');
        throw new Error('Server configuration error: YouTube API key is missing.');
    }

    const url = new URL(`${YOUTUBE_API_BASE_URL}/${endpoint}`);
    url.searchParams.set('key', apiKey);
    for (const key in params) {
        url.searchParams.set(key, params[key]);
    }

    try {
        // console.log(`[YouTube Service] Fetching: ${url.toString()}`); // Debug log
        const response = await fetch(url.toString(), {
            // Consider adding caching headers if appropriate for your usage pattern
            // cache: 'force-cache', // Example: Aggressive caching
             next: { revalidate: 3600 } // Example: Revalidate data every hour
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: 'Unknown API error' }));
            console.error(`[YouTube Service] API Error (${response.status}):`, errorData);
            throw new Error(`YouTube API Error: ${errorData?.error?.message || response.statusText}`);
        }

        const data = await response.json();
        // console.log(`[YouTube Service] API Response for ${endpoint}:`, data); // Debug log
        return data;

    } catch (error) {
        console.error(`[YouTube Service] Fetch failed for ${endpoint}:`, error);
        if (error instanceof Error && error.message.startsWith('YouTube API Error:')) {
            throw error; // Re-throw specific API errors
        }
        throw new Error('Failed to fetch data from YouTube.');
    }
}


// --- Core Service Functions ---

/**
 * Asynchronously retrieves actual metadata for a given YouTube video ID using the YouTube Data API.
 *
 * @param videoId The ID of the YouTube video.
 * @returns A promise that resolves to a YoutubeVideoMetadata object containing actual metadata.
 * @throws An error if the API call fails or the video is not found.
 */
export async function getYoutubeVideoMetadata(videoId: string): Promise<YoutubeVideoMetadata> {
  console.log(`[YouTube Service] Fetching metadata for video ID: ${videoId}`);
  const params = {
    part: 'snippet',
    id: videoId,
  };

  const data = await fetchYoutubeAPI('videos', params);

  if (!data.items || data.items.length === 0) {
    throw new Error(`Video with ID ${videoId} not found.`);
  }

  const snippet = data.items[0].snippet;
  const thumbnailUrl = snippet.thumbnails?.high?.url || snippet.thumbnails?.medium?.url || snippet.thumbnails?.default?.url || '/placeholder-album.svg'; // Fallback

  return {
    title: snippet.title || 'Unknown Title',
    author: snippet.channelTitle || 'Unknown Artist',
    thumbnailUrl: thumbnailUrl,
  };
}


/**
 * Asynchronously searches YouTube for videos based on a query using the YouTube Data API.
 *
 * @param query The search term.
 * @param maxResults The maximum number of results to return (default 5).
 * @returns A promise that resolves to an array of YoutubeSearchResult objects.
 */
export async function searchYoutubeVideos(query: string, maxResults = 5): Promise<YoutubeSearchResult[]> {
    console.log(`[YouTube Service] Searching for query: "${query}", maxResults: ${maxResults}`);
    const params = {
        part: 'snippet',
        q: query,
        type: 'video', // Ensure we only get videos
        maxResults: maxResults.toString(),
    };

    const data = await fetchYoutubeAPI('search', params);

    if (!data.items) {
        console.log('[YouTube Service] No items found in search results.');
        return [];
    }

    const results: YoutubeSearchResult[] = data.items
        .map((item: any) => {
            if (!item.id?.videoId || !item.snippet) {
                // Skip items that don't look like valid video search results
                console.warn('[YouTube Service] Skipping invalid search result item:', item);
                return null;
            }
            const snippet = item.snippet;
            const thumbnailUrl = snippet.thumbnails?.high?.url || snippet.thumbnails?.medium?.url || snippet.thumbnails?.default?.url || '/placeholder-album.svg'; // Fallback

            return {
                videoId: item.id.videoId,
                title: snippet.title || 'Unknown Title',
                author: snippet.channelTitle || 'Unknown Channel',
                thumbnailUrl: thumbnailUrl,
            };
        })
        .filter((result: YoutubeSearchResult | null): result is YoutubeSearchResult => result !== null); // Filter out any nulls from invalid items

    console.log(`[YouTube Service] Found ${results.length} valid results for query "${query}".`);
    return results;
}

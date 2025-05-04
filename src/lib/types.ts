export interface Song {
  id: string; // Use YouTube video ID
  title: string;
  author: string;
  url: string; // YouTube URL
  thumbnailUrl: string;
}

export interface Playlist {
  id: string;
  name: string;
  songs: Song[];
}

// Added for YouTube search results
export interface YoutubeSearchResult {
    videoId: string;
    title: string;
    author: string; // Channel name
    thumbnailUrl: string;
}

// Added for YouTube video metadata (used by URL add feature)
export interface YoutubeVideoMetadata {
  title: string;
  thumbnailUrl: string;
  author: string;
}

// Represents a song within the playback queue
export interface QueueSong extends Song {
  queueId: string; // Unique identifier for this instance in the queue
  playlistContextId?: string; // Optional: ID of the playlist this song instance belongs to in the queue
}

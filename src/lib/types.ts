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

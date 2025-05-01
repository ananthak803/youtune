'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Playlist, Song } from '@/lib/types';
import { getYoutubeVideoMetadata } from '@/services/youtube'; // Import the service

interface PlaylistState {
  playlists: Playlist[];
  activePlaylistId: string | null;
  currentSong: Song | null;
  currentSongIndex: number; // Index within the *active* playlist's possibly shuffled order
  playHistory: number[]; // Stores indices of played songs for back navigation in shuffle mode
  isPlaying: boolean;
  isShuffling: boolean;
  isLooping: boolean; // Loop the current song
  isLoopingPlaylist: boolean; // Loop the entire playlist
  volume: number;
  isMuted: boolean;
  currentSongProgress: number;
  currentSongDuration: number;

  // Actions
  createPlaylist: (name: string) => void;
  deletePlaylist: (playlistId: string) => void;
  renamePlaylist: (playlistId: string, newName: string) => void;
  addSongToPlaylist: (playlistId: string, song: Song) => void;
  removeSongFromPlaylist: (playlistId: string, songId: string) => void;
  reorderSongInPlaylist: (playlistId: string, fromIndex: number, toIndex: number) => void;
  setActivePlaylistId: (playlistId: string | null) => void;
  playSong: (song: Song, playlistId: string) => void;
  playNextSong: () => void;
  playPreviousSong: () => void;
  togglePlayPause: () => void;
  toggleShuffle: () => void;
  toggleLoop: () => void; // Toggles single song loop
  toggleLoopPlaylist: () => void; // Toggles playlist loop
  setCurrentSongProgress: (progress: number) => void;
  setCurrentSongDuration: (duration: number) => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  // Internal helper (not directly exposed but used by actions)
  _getShuffledPlaylistOrder: (playlist: Playlist) => number[];
  _getActivePlaylist: () => Playlist | undefined;
}

const generateId = () => Math.random().toString(36).substring(2, 15);

// Helper function to shuffle an array
const shuffleArray = <T>(array: T[]): T[] => {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};


export const usePlaylistStore = create<PlaylistState>()(
  persist(
    (set, get) => ({
      playlists: [],
      activePlaylistId: null,
      currentSong: null,
      currentSongIndex: -1, // -1 indicates no song is actively selected within a playlist context
      playHistory: [],
      isPlaying: false,
      isShuffling: false,
      isLooping: false,
      isLoopingPlaylist: false,
      volume: 0.8, // Default volume
      isMuted: false,
      currentSongProgress: 0,
      currentSongDuration: 0,

      _getActivePlaylist: () => {
        const { playlists, activePlaylistId } = get();
        return playlists.find((p) => p.id === activePlaylistId);
      },

      _getShuffledPlaylistOrder: (playlist: Playlist): number[] => {
        // If shuffling is off, return original order indices
        if (!get().isShuffling) {
          return playlist.songs.map((_, index) => index);
        }
        // Simple shuffle: generate a shuffled list of indices
        // More robust implementations might store the shuffled order per playlist
        const indices = playlist.songs.map((_, index) => index);
        return shuffleArray(indices);
      },

      createPlaylist: (name) =>
        set((state) => {
          const newPlaylist: Playlist = {
            id: generateId(),
            name,
            songs: [],
          };
          const updatedPlaylists = [...state.playlists, newPlaylist];
          // Optionally set the new playlist as active
          const newStateUpdate: Partial<PlaylistState> = { playlists: updatedPlaylists };
          if (state.activePlaylistId === null && updatedPlaylists.length === 1) {
            newStateUpdate.activePlaylistId = newPlaylist.id;
          }
          return newStateUpdate;
        }),

      deletePlaylist: (playlistId) =>
        set((state) => {
          const updatedPlaylists = state.playlists.filter((p) => p.id !== playlistId);
          let newActivePlaylistId = state.activePlaylistId;
          let newCurrentSong = state.currentSong;
          let newCurrentSongIndex = state.currentSongIndex;

          // If the deleted playlist was active
          if (state.activePlaylistId === playlistId) {
            newActivePlaylistId = updatedPlaylists[0]?.id ?? null; // Select first or null
            newCurrentSong = null; // Stop playback
            newCurrentSongIndex = -1;
          }
          return {
             playlists: updatedPlaylists,
             activePlaylistId: newActivePlaylistId,
             currentSong: newCurrentSong,
             currentSongIndex: newCurrentSongIndex,
             isPlaying: false, // Stop playback
             playHistory: [], // Clear history
           };
        }),

      renamePlaylist: (playlistId, newName) =>
        set((state) => ({
          playlists: state.playlists.map((p) =>
            p.id === playlistId ? { ...p, name: newName } : p
          ),
        })),

      addSongToPlaylist: (playlistId, song) =>
        set((state) => ({
          playlists: state.playlists.map((p) =>
            p.id === playlistId ? { ...p, songs: [...p.songs, song] } : p
          ),
        })),

      removeSongFromPlaylist: (playlistId, songId) =>
        set((state) => {
          let wasPlayingRemovedSong = false;
          const updatedPlaylists = state.playlists.map((p) => {
            if (p.id === playlistId) {
               if (state.currentSong?.id === songId && state.activePlaylistId === playlistId) {
                 wasPlayingRemovedSong = true;
               }
               return { ...p, songs: p.songs.filter((s) => s.id !== songId) };
            }
            return p;
          });

          if (wasPlayingRemovedSong) {
             // Optionally play the next song, or just stop
             get().playNextSong(); // Attempt to play next
             if (get().currentSong?.id === songId) { // If playNextSong didn't change the song (e.g., last song)
                return { playlists: updatedPlaylists, currentSong: null, currentSongIndex: -1, isPlaying: false, playHistory: [] };
             }
          } else if (state.activePlaylistId === playlistId && state.currentSongIndex !== -1) {
             // Adjust currentSongIndex if a song before the current one was removed
             const removedSongIndexInOriginal = state.playlists.find(p => p.id === playlistId)?.songs.findIndex(s => s.id === songId) ?? -1;
             if (removedSongIndexInOriginal !== -1 && removedSongIndexInOriginal < state.currentSongIndex) {
                return { playlists: updatedPlaylists, currentSongIndex: state.currentSongIndex - 1 };
             }
          }

          return { playlists: updatedPlaylists };
        }),

        reorderSongInPlaylist: (playlistId, fromIndex, toIndex) =>
         set((state) => {
           const playlistIndex = state.playlists.findIndex((p) => p.id === playlistId);
           if (playlistIndex === -1) return {}; // Playlist not found

           const playlist = state.playlists[playlistIndex];
           const newSongs = Array.from(playlist.songs);
           const [movedItem] = newSongs.splice(fromIndex, 1);
           newSongs.splice(toIndex, 0, movedItem);

           const updatedPlaylists = [...state.playlists];
           updatedPlaylists[playlistIndex] = { ...playlist, songs: newSongs };

           // Adjust currentSongIndex if the active playlist was reordered
           let newCurrentSongIndex = state.currentSongIndex;
           if (state.activePlaylistId === playlistId && state.currentSongIndex !== -1) {
             const currentSongId = state.currentSong?.id;
             if (currentSongId) {
               newCurrentSongIndex = newSongs.findIndex(song => song.id === currentSongId);
               if (newCurrentSongIndex === -1) { // Should not happen if current song is in playlist
                  console.warn("Current song not found after reorder, resetting index.");
                  newCurrentSongIndex = -1; // Reset if something went wrong
               }
             }
           }


           return { playlists: updatedPlaylists, currentSongIndex: newCurrentSongIndex };
         }),


      setActivePlaylistId: (playlistId) =>
        set((state) => {
           // If changing playlist, reset playback state unless the song exists in the new playlist
           if (playlistId !== state.activePlaylistId) {
              const newPlaylist = state.playlists.find(p => p.id === playlistId);
              const currentSongInNewPlaylist = newPlaylist?.songs.find(s => s.id === state.currentSong?.id);
              if (currentSongInNewPlaylist) {
                 const newIndex = newPlaylist.songs.findIndex(s => s.id === state.currentSong?.id);
                 return { activePlaylistId: playlistId, currentSongIndex: newIndex, playHistory: [newIndex] }; // Keep playing, update index
              } else {
                 return { activePlaylistId: playlistId, currentSong: null, currentSongIndex: -1, isPlaying: false, playHistory: [] }; // Stop playback
              }
           }
           return { activePlaylistId: playlistId }; // No change if same ID
        }),

      playSong: (song, playlistId) =>
        set((state) => {
          const playlist = state.playlists.find((p) => p.id === playlistId);
          if (!playlist) return {}; // Playlist not found

          const songIndex = playlist.songs.findIndex((s) => s.id === song.id);
          if (songIndex === -1) return {}; // Song not found in this playlist

          // If the active playlist changes, or if shuffle is on, reset history starting with the new song
          const resetHistory = state.activePlaylistId !== playlistId || state.isShuffling;

          return {
            currentSong: song,
            currentSongIndex: songIndex,
            activePlaylistId: playlistId,
            isPlaying: true,
            currentSongProgress: 0, // Reset progress
            currentSongDuration: 0, // Reset duration until loaded
            playHistory: resetHistory ? [songIndex] : [...state.playHistory, songIndex],
          };
        }),

     playNextSong: () => set((state) => {
        const activePlaylist = state._getActivePlaylist();
        if (!activePlaylist || activePlaylist.songs.length === 0) {
            return { currentSong: null, currentSongIndex: -1, isPlaying: false, playHistory: [] };
        }

        const numSongs = activePlaylist.songs.length;
        let nextIndex = -1;

        if (state.isLooping) {
            // If looping current song, just restart it
            if (playerRef.current) playerRef.current.seekTo(0); // Seek to start using ref
             return { currentSongProgress: 0, isPlaying: true };
        }


        if (state.isShuffling) {
            // Find an index not recently played or just pick random if history is full
            const recentHistory = state.playHistory.slice(-Math.min(state.playHistory.length, Math.floor(numSongs / 2))); // Avoid repeating recent songs
            const availableIndices = activePlaylist.songs.map((_, i) => i).filter(i => !recentHistory.includes(i));

            if (availableIndices.length > 0) {
                nextIndex = availableIndices[Math.floor(Math.random() * availableIndices.length)];
            } else {
                // If all songs recently played, pick any random one (or the least recently played if tracking full history)
                nextIndex = Math.floor(Math.random() * numSongs);
            }
        } else {
            // Sequential playback
            nextIndex = state.currentSongIndex + 1;
        }

        // Handle end of playlist
        if (nextIndex >= numSongs) {
            if (state.isLoopingPlaylist) {
                nextIndex = 0; // Loop back to the start
            } else {
                // Stop playback if not looping playlist
                return { currentSong: null, currentSongIndex: -1, isPlaying: false, playHistory: [] };
            }
        } else if (nextIndex < 0) { // Should only happen if currentSongIndex was -1
             nextIndex = 0; // Start from the beginning
        }


        const nextSong = activePlaylist.songs[nextIndex];
        const newHistory = state.isShuffling ? [...state.playHistory, nextIndex] : state.playHistory; // Only add to history if shuffling

        return {
            currentSong: nextSong,
            currentSongIndex: nextIndex,
            isPlaying: true,
            currentSongProgress: 0,
            currentSongDuration: 0,
            playHistory: newHistory,
        };
    }),


    playPreviousSong: () => set((state) => {
        const activePlaylist = state._getActivePlaylist();
        if (!activePlaylist || activePlaylist.songs.length === 0) {
            return { currentSong: null, currentSongIndex: -1, isPlaying: false, playHistory: [] };
        }

        // If played more than a few seconds, restart current song instead
        if (state.currentSongProgress > 3) {
             if (playerRef.current) playerRef.current.seekTo(0);
             return { currentSongProgress: 0, isPlaying: true };
        }


        let prevIndex = -1;
        const numSongs = activePlaylist.songs.length;

        if (state.isShuffling && state.playHistory.length > 1) {
            // Pop current song and get the one before it
            const historyWithoutCurrent = state.playHistory.slice(0, -1);
            prevIndex = historyWithoutCurrent[historyWithoutCurrent.length - 1];
        } else if (!state.isShuffling) {
            prevIndex = state.currentSongIndex - 1;
        }

        // Handle beginning of playlist
        if (prevIndex < 0) {
            if (state.isLoopingPlaylist) {
                prevIndex = numSongs - 1; // Loop back to the end
            } else if (!state.isShuffling) {
                 // If not looping and at the start, just restart the first song or do nothing
                 if (playerRef.current) playerRef.current.seekTo(0);
                 return { currentSongProgress: 0, isPlaying: true }; // Restart first song
            } else {
                 // If shuffling and no history, do nothing or play random? Let's do nothing.
                 return {};
            }
        }

        const prevSong = activePlaylist.songs[prevIndex];
         // Adjust history only if shuffling and successfully went back
        const newHistory = state.isShuffling && state.playHistory.length > 1
                             ? state.playHistory.slice(0, -1)
                             : state.playHistory;

        return {
            currentSong: prevSong,
            currentSongIndex: prevIndex,
            isPlaying: true,
            currentSongProgress: 0,
            currentSongDuration: 0,
            playHistory: newHistory,
        };
    }),

      togglePlayPause: () => set((state) => ({ isPlaying: !state.isPlaying })),

      toggleShuffle: () => set((state) => ({ isShuffling: !state.isShuffling, playHistory: state.isShuffling ? state.playHistory : [state.currentSongIndex].filter(i => i !== -1) })), // Reset history when turning shuffle on

      toggleLoop: () => set((state) => ({ isLooping: !state.isLooping })),
      toggleLoopPlaylist: () => set((state) => ({ isLoopingPlaylist: !state.isLoopingPlaylist })),

      setCurrentSongProgress: (progress) => set({ currentSongProgress: progress }),
      setCurrentSongDuration: (duration) => set({ currentSongDuration: duration }),

      setVolume: (volume) => set({ volume: Math.max(0, Math.min(1, volume)), isMuted: volume === 0 ? true : false }),
      toggleMute: () => set((state) => ({ isMuted: !state.isMuted })),

    }),
    {
      name: 'youtune-playlist-storage', // Name for localStorage key
      storage: createJSONStorage(() => localStorage), // Use localStorage
      // Only persist parts of the state you want to save
      partialize: (state) => ({
        playlists: state.playlists,
        activePlaylistId: state.activePlaylistId,
        // Don't persist playback state like isPlaying, progress, current song index, history
        volume: state.volume,
        isMuted: state.isMuted,
        isShuffling: state.isShuffling, // Persist user preference
        isLooping: state.isLooping, // Persist user preference
        isLoopingPlaylist: state.isLoopingPlaylist, // Persist user preference
      }),
       // Rehydration logic (optional but good for complex state)
      onRehydrateStorage: (state) => {
        console.log("Hydration finished.");
        // You could add logic here to run after state is loaded, e.g., validation
        return (state, error) => {
          if (error) {
            console.error("An error occurred during hydration:", error);
          } else if (state) {
             // Ensure default values if hydration somehow fails partially
            state.isPlaying = false;
            state.currentSong = null;
            state.currentSongIndex = -1;
            state.playHistory = [];
            state.currentSongProgress = 0;
            state.currentSongDuration = 0;
            // Find active playlist on load, ensure it exists
             if (state.activePlaylistId && !state.playlists.find(p => p.id === state.activePlaylistId)) {
                state.activePlaylistId = state.playlists[0]?.id ?? null;
             } else if (!state.activePlaylistId && state.playlists.length > 0) {
                 state.activePlaylistId = state.playlists[0].id;
             }
            console.log("State rehydrated:", state);
          }
        };
      },
    }
  )
);

// Add a global reference for the player (outside Zustand)
// This is a bit hacky but necessary for seeking from the store actions.
// A better approach might involve event emitters or context.
let playerRef: React.RefObject<ReactPlayer> | null = null;

export const setPlayerRef = (ref: React.RefObject<ReactPlayer>) => {
    playerRef = ref;
};
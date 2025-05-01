
'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Playlist, Song } from '@/lib/types';
import { getYoutubeVideoMetadata } from '@/services/youtube'; // Import the service
import type ReactPlayer from 'react-player'; // Import type for playerRef

interface PlaylistState {
  playlists: Playlist[];
  activePlaylistId: string | null;
  currentSong: Song | null;
  currentSongIndex: number; // Index within the *active* playlist's possibly shuffled order. -1 if not part of a playlist context.
  playHistory: number[]; // Stores indices of played songs for back navigation in shuffle mode
  isPlaying: boolean;
  isShuffling: boolean;
  isLooping: boolean; // Loop the current song
  isLoopingPlaylist: boolean; // Loop the entire playlist
  volume: number;
  isMuted: boolean;
  currentSongProgress: number;
  currentSongDuration: number;
  isInSinglePlayMode: boolean; // Flag to indicate if playing a single song outside a playlist

  // Actions
  createPlaylist: (name: string) => void;
  deletePlaylist: (playlistId: string) => void;
  renamePlaylist: (playlistId: string, newName: string) => void;
  addSongToPlaylist: (playlistId: string, song: Song) => void;
  removeSongFromPlaylist: (playlistId: string, songId: string) => void;
  reorderSongInPlaylist: (playlistId: string, fromIndex: number, toIndex: number) => void;
  setActivePlaylistId: (playlistId: string | null) => void;
  playSong: (song: Song, playlistId: string) => void; // Plays song within playlist context
  playSingleSong: (song: Song) => void; // Plays song directly, outside playlist context
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
      currentSongIndex: -1,
      playHistory: [],
      isPlaying: false,
      isShuffling: false,
      isLooping: false,
      isLoopingPlaylist: false,
      volume: 0.8, // Default volume
      isMuted: false,
      currentSongProgress: 0,
      currentSongDuration: 0,
      isInSinglePlayMode: false,

      _getActivePlaylist: () => {
        const { playlists, activePlaylistId } = get();
        return playlists.find((p) => p.id === activePlaylistId);
      },

      _getShuffledPlaylistOrder: (playlist: Playlist): number[] => {
        if (!get().isShuffling) {
          return playlist.songs.map((_, index) => index);
        }
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
          let newIsInSinglePlayMode = state.isInSinglePlayMode;

          if (state.activePlaylistId === playlistId) {
            newActivePlaylistId = updatedPlaylists[0]?.id ?? null;
            newCurrentSong = null;
            newCurrentSongIndex = -1;
            newIsInSinglePlayMode = false; // Exit single play mode if active playlist deleted
          }
          return {
             playlists: updatedPlaylists,
             activePlaylistId: newActivePlaylistId,
             currentSong: newCurrentSong,
             currentSongIndex: newCurrentSongIndex,
             isPlaying: false,
             playHistory: [],
             isInSinglePlayMode: newIsInSinglePlayMode,
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
             get().playNextSong();
             if (get().currentSong?.id === songId) {
                return { playlists: updatedPlaylists, currentSong: null, currentSongIndex: -1, isPlaying: false, playHistory: [], isInSinglePlayMode: false };
             }
          } else if (state.activePlaylistId === playlistId && state.currentSongIndex !== -1) {
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
           if (playlistIndex === -1) return {};

           const playlist = state.playlists[playlistIndex];
           const newSongs = Array.from(playlist.songs);
           const [movedItem] = newSongs.splice(fromIndex, 1);
           newSongs.splice(toIndex, 0, movedItem);

           const updatedPlaylists = [...state.playlists];
           updatedPlaylists[playlistIndex] = { ...playlist, songs: newSongs };

           let newCurrentSongIndex = state.currentSongIndex;
           if (state.activePlaylistId === playlistId && state.currentSongIndex !== -1) {
             const currentSongId = state.currentSong?.id;
             if (currentSongId) {
               newCurrentSongIndex = newSongs.findIndex(song => song.id === currentSongId);
               if (newCurrentSongIndex === -1) {
                  console.warn("Current song not found after reorder, resetting index.");
                  newCurrentSongIndex = -1;
                  // Potentially stop playback if the current song is somehow lost
                  // return { playlists: updatedPlaylists, currentSongIndex: -1, currentSong: null, isPlaying: false };
               }
             }
           }


           return { playlists: updatedPlaylists, currentSongIndex: newCurrentSongIndex };
         }),


      setActivePlaylistId: (playlistId) =>
        set((state) => {
           if (playlistId !== state.activePlaylistId) {
              const newPlaylist = state.playlists.find(p => p.id === playlistId);
              const currentSongInNewPlaylist = newPlaylist?.songs.find(s => s.id === state.currentSong?.id);

              if (currentSongInNewPlaylist) {
                 const newIndex = newPlaylist.songs.findIndex(s => s.id === state.currentSong?.id);
                 return { activePlaylistId: playlistId, currentSongIndex: newIndex, playHistory: [newIndex], isInSinglePlayMode: false };
              } else {
                 return { activePlaylistId: playlistId, currentSong: null, currentSongIndex: -1, isPlaying: false, playHistory: [], isInSinglePlayMode: false };
              }
           }
           // If clicking the already active playlist, ensure single play mode is off
           return { activePlaylistId: playlistId, isInSinglePlayMode: false };
        }),

      playSong: (song, playlistId) =>
        set((state) => {
          const playlist = state.playlists.find((p) => p.id === playlistId);
          if (!playlist) return {};

          const songIndex = playlist.songs.findIndex((s) => s.id === song.id);
          if (songIndex === -1) return {};

          const resetHistory = state.activePlaylistId !== playlistId || state.isShuffling || state.isInSinglePlayMode;

          return {
            currentSong: song,
            currentSongIndex: songIndex,
            activePlaylistId: playlistId,
            isPlaying: true,
            currentSongProgress: 0,
            currentSongDuration: 0,
            playHistory: resetHistory ? [songIndex] : [...state.playHistory, songIndex],
            isInSinglePlayMode: false, // Explicitly set to false when playing from playlist
          };
        }),

      playSingleSong: (song) => set((state) => {
          // When playing a single song, we're not in a playlist context
          return {
            currentSong: song,
            currentSongIndex: -1, // Indicate no playlist context
            activePlaylistId: null, // No active playlist
            isPlaying: true,
            currentSongProgress: 0,
            currentSongDuration: 0,
            playHistory: [], // History doesn't apply here
            isShuffling: false, // Disable shuffle for single play
            isLoopingPlaylist: false, // Disable playlist loop
            isInSinglePlayMode: true, // Set the flag
          };
      }),

     playNextSong: () => set((state) => {
        // If in single play mode, stop playing after the song ends (unless looping song)
        if (state.isInSinglePlayMode) {
             if (state.isLooping) {
                // If looping current song, just restart it
                if (playerRef.current) playerRef.current.seekTo(0);
                 return { currentSongProgress: 0, isPlaying: true };
             } else {
                // Stop playback
                return { currentSong: null, currentSongIndex: -1, isPlaying: false, isInSinglePlayMode: false };
            }
        }

        // --- Playlist Mode Logic ---
        const activePlaylist = state._getActivePlaylist();
        if (!activePlaylist || activePlaylist.songs.length === 0) {
            return { currentSong: null, currentSongIndex: -1, isPlaying: false, playHistory: [] };
        }

        const numSongs = activePlaylist.songs.length;
        let nextIndex = -1;

        if (state.isLooping) {
            // If looping current song (in playlist mode), restart it
            if (playerRef.current) playerRef.current.seekTo(0);
             return { currentSongProgress: 0, isPlaying: true };
        }


        if (state.isShuffling) {
            const recentHistory = state.playHistory.slice(-Math.min(state.playHistory.length, Math.floor(numSongs / 2)));
            const availableIndices = activePlaylist.songs.map((_, i) => i).filter(i => !recentHistory.includes(i));

            if (availableIndices.length > 0) {
                nextIndex = availableIndices[Math.floor(Math.random() * availableIndices.length)];
            } else {
                nextIndex = Math.floor(Math.random() * numSongs);
            }
        } else {
            nextIndex = state.currentSongIndex + 1;
        }

        if (nextIndex >= numSongs) {
            if (state.isLoopingPlaylist) {
                nextIndex = 0;
            } else {
                return { currentSong: null, currentSongIndex: -1, isPlaying: false, playHistory: [] };
            }
        } else if (nextIndex < 0) {
             nextIndex = 0;
        }


        const nextSong = activePlaylist.songs[nextIndex];
        const newHistory = state.isShuffling ? [...state.playHistory, nextIndex] : state.playHistory;

        return {
            currentSong: nextSong,
            currentSongIndex: nextIndex,
            isPlaying: true,
            currentSongProgress: 0,
            currentSongDuration: 0,
            playHistory: newHistory,
            isInSinglePlayMode: false, // Ensure this is false
        };
    }),


    playPreviousSong: () => set((state) => {
        // Previous song logic doesn't make sense in single play mode, restart current or do nothing
        if (state.isInSinglePlayMode) {
            if (state.currentSongProgress > 3 && playerRef.current) {
                playerRef.current.seekTo(0);
                return { currentSongProgress: 0, isPlaying: true };
            }
            // Otherwise, do nothing or maybe just stop? Let's just restart.
             if (playerRef.current) playerRef.current.seekTo(0);
             return { currentSongProgress: 0, isPlaying: true };
        }

        // --- Playlist Mode Logic ---
        const activePlaylist = state._getActivePlaylist();
        if (!activePlaylist || activePlaylist.songs.length === 0) {
            return { currentSong: null, currentSongIndex: -1, isPlaying: false, playHistory: [] };
        }

        if (state.currentSongProgress > 3) {
             if (playerRef.current) playerRef.current.seekTo(0);
             return { currentSongProgress: 0, isPlaying: true };
        }


        let prevIndex = -1;
        const numSongs = activePlaylist.songs.length;

        if (state.isShuffling && state.playHistory.length > 1) {
            const historyWithoutCurrent = state.playHistory.slice(0, -1);
            prevIndex = historyWithoutCurrent[historyWithoutCurrent.length - 1];
        } else if (!state.isShuffling) {
            prevIndex = state.currentSongIndex - 1;
        }

        if (prevIndex < 0) {
            if (state.isLoopingPlaylist) {
                prevIndex = numSongs - 1;
            } else if (!state.isShuffling) {
                 if (playerRef.current) playerRef.current.seekTo(0);
                 return { currentSongProgress: 0, isPlaying: true };
            } else {
                 return {};
            }
        }

        const prevSong = activePlaylist.songs[prevIndex];
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
            isInSinglePlayMode: false, // Ensure this is false
        };
    }),

      togglePlayPause: () => set((state) => {
          // Prevent starting playback if there's no song
          if (!state.currentSong && !state.isPlaying) {
              return {};
          }
          return { isPlaying: !state.isPlaying };
      }),

      toggleShuffle: () => set((state) => {
          if (state.isInSinglePlayMode) return {}; // Cannot shuffle in single play mode
          return {
              isShuffling: !state.isShuffling,
              playHistory: !state.isShuffling ? [state.currentSongIndex].filter(i => i !== -1) : state.playHistory
          }
       }),

      toggleLoop: () => set((state) => ({ isLooping: !state.isLooping })), // Applies to both modes

      toggleLoopPlaylist: () => set((state) => {
          if (state.isInSinglePlayMode) return {}; // Cannot loop playlist in single play mode
          return { isLoopingPlaylist: !state.isLoopingPlaylist }
      }),

      setCurrentSongProgress: (progress) => set({ currentSongProgress: progress }),
      setCurrentSongDuration: (duration) => set({ currentSongDuration: duration }),

      setVolume: (volume) => set({ volume: Math.max(0, Math.min(1, volume)), isMuted: volume === 0 ? true : false }),
      toggleMute: () => set((state) => ({ isMuted: !state.isMuted })),

    }),
    {
      name: 'youtune-playlist-storage', // Name for localStorage key
      storage: createJSONStorage(() => localStorage), // Use localStorage
      partialize: (state) => ({
        playlists: state.playlists,
        activePlaylistId: state.activePlaylistId,
        volume: state.volume,
        isMuted: state.isMuted,
        isShuffling: state.isShuffling,
        isLooping: state.isLooping,
        isLoopingPlaylist: state.isLoopingPlaylist,
        // Don't persist isInSinglePlayMode, currentSong, index, progress, duration, history, isPlaying
      }),
      onRehydrateStorage: (state) => {
        console.log("Hydration finished.");
        return (state, error) => {
          if (error) {
            console.error("An error occurred during hydration:", error);
          } else if (state) {
            state.isPlaying = false;
            state.currentSong = null;
            state.currentSongIndex = -1;
            state.playHistory = [];
            state.currentSongProgress = 0;
            state.currentSongDuration = 0;
            state.isInSinglePlayMode = false; // Ensure this defaults to false
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

// Global reference for the player
let playerRef: React.RefObject<ReactPlayer> | null = null;

export const setPlayerRef = (ref: React.RefObject<ReactPlayer>) => {
    playerRef = ref;
};


'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Playlist, Song } from '@/lib/types';
import { getYoutubeVideoMetadata } from '@/services/youtube'; // Import the service
import type ReactPlayer from 'react-player'; // Import type for playerRef
import { toast } from '@/hooks/use-toast'; // Correct import for toast

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
  addSongToPlaylist: (playlistId: string, song: Song) => boolean; // Return true if added, false if duplicate
  removeSongFromPlaylist: (playlistId: string, songId: string) => void;
  reorderSongInPlaylist: (playlistId: string, fromIndex: number, toIndex: number) => void;
  setActivePlaylistId: (playlistId: string | null) => void;
  playPlaylist: (playlistId: string) => void; // Plays playlist from start (or shuffled)
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
        // Create a stable shuffled order for the duration of shuffling being active
        // This example shuffles every time, which might be okay, or you might store
        // the shuffled order in the state when shuffle is toggled on.
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
          // Select the first playlist if none is selected or if it's the only one
          if (state.activePlaylistId === null || updatedPlaylists.length === 1) {
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

      addSongToPlaylist: (playlistId, song) => {
        let songAdded = false;
        set((state) => {
          const playlistIndex = state.playlists.findIndex((p) => p.id === playlistId);
          if (playlistIndex === -1) {
            console.error(`[Store] Playlist with ID ${playlistId} not found for adding song ${song.id}.`);
            return state; // Return current state if playlist not found
          }

          const playlist = state.playlists[playlistIndex];

          // Check if song already exists using song ID
          const songExists = playlist.songs.some((s) => s.id === song.id);

          if (songExists) {
            toast({
              title: 'Song Already Exists',
              description: `"${song.title}" is already in the playlist "${playlist.name}".`,
              variant: 'default',
            });
            songAdded = false;
            console.warn(`[Store] Attempted to add duplicate song ID ${song.id} to playlist ${playlistId} ("${playlist.name}").`);
            return state; // Return current state if song exists
          }

          // Add the song
          const updatedSongs = [...playlist.songs, song];
          const updatedPlaylist = { ...playlist, songs: updatedSongs };
          const updatedPlaylists = [...state.playlists];
          updatedPlaylists[playlistIndex] = updatedPlaylist;
          songAdded = true;
          console.log(`[Store] Song ID ${song.id} ("${song.title}") added to playlist ${playlistId} ("${playlist.name}").`);

          return { playlists: updatedPlaylists };
        });
        return songAdded;
      },

      removeSongFromPlaylist: (playlistId, songId) =>
        set((state) => {
          let wasPlayingRemovedSong = false;
          let removedSongIndexInOriginal = -1; // Store the original index of the removed song
          const originalPlaylist = state.playlists.find(p => p.id === playlistId);


          const updatedPlaylists = state.playlists.map((p) => {
            if (p.id === playlistId) {
               removedSongIndexInOriginal = p.songs.findIndex((s) => s.id === songId);
               if (state.currentSong?.id === songId && state.activePlaylistId === playlistId) {
                 wasPlayingRemovedSong = true;
               }
               return { ...p, songs: p.songs.filter((s) => s.id !== songId) };
            }
            return p;
          });

           const updatedActivePlaylist = updatedPlaylists.find(p => p.id === state.activePlaylistId);

          if (wasPlayingRemovedSong) {
             // If the removed song was playing, play the next logical song
             // Use a timeout to allow the state update for removed song to potentially settle
             // before triggering the next song. This is a bit of a workaround for potential race conditions.
             setTimeout(() => get().playNextSong(), 50);
             // If playNextSong didn't change the song (e.g., end of playlist), clear playback
             if (get().currentSong?.id === songId) {
                return { playlists: updatedPlaylists, currentSong: null, currentSongIndex: -1, isPlaying: false, playHistory: [], isInSinglePlayMode: false };
             } else {
                // Get the latest state *after* the potential playNextSong and merge with updated playlists
                 const nextState = get();
                 return { playlists: updatedPlaylists, ...nextState };
             }

          } else if (state.activePlaylistId === playlistId && state.currentSongIndex !== -1 && removedSongIndexInOriginal !== -1) {
             // If removed song was BEFORE the current song in the original list, decrement the index
             let newCurrentSongIndex = state.currentSongIndex;
             if (removedSongIndexInOriginal < state.currentSongIndex) {
                  newCurrentSongIndex--;
             }

             let newPlayHistory = state.playHistory;
              // Need to potentially update play history if shuffle is on and the removed index was in history
              if (state.isShuffling) {
                  newPlayHistory = state.playHistory.map(histIndex => {
                      if (histIndex > removedSongIndexInOriginal) return histIndex - 1;
                      if (histIndex === removedSongIndexInOriginal) return -1; // Mark removed index
                      return histIndex;
                  }).filter(histIndex => histIndex !== -1); // Remove marked index
                   return { playlists: updatedPlaylists, playHistory: newPlayHistory, currentSongIndex: newCurrentSongIndex };
              }
               return { playlists: updatedPlaylists, currentSongIndex: newCurrentSongIndex };
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
           let newPlayHistory = state.playHistory;

           if (state.activePlaylistId === playlistId) {
             // Update current song index if it was affected by the reorder
             if (state.currentSong) {
               newCurrentSongIndex = newSongs.findIndex(song => song.id === state.currentSong!.id);
               if (newCurrentSongIndex === -1) {
                  console.warn("[Store] Current song not found after reorder, resetting index.");
                  newCurrentSongIndex = -1; // Should ideally not happen
               }
             }

              // Update play history indices if shuffling is NOT active
             if (!state.isShuffling) {
                 newPlayHistory = state.playHistory.map(histIndex => {
                     if (histIndex === fromIndex) return toIndex; // Moved item's new index
                     if (histIndex >= Math.min(fromIndex, toIndex) && histIndex <= Math.max(fromIndex, toIndex)) {
                         // Item was between the move points
                         if (fromIndex < toIndex) { // Moved down
                             if (histIndex > fromIndex) return histIndex - 1;
                         } else { // Moved up
                             if (histIndex < fromIndex) return histIndex + 1;
                         }
                     }
                     return histIndex; // Index outside the affected range
                 });
             } else {
               // If shuffling, history refers to original indices. A simple reorder might invalidate
               // this history. It's complex to map correctly. Maybe clear history on reorder when shuffling?
               // Or, keep it, knowing it might lead to unexpected 'previous' songs.
               // For now, let's keep it, but be aware of potential issues.
               // console.warn("[Store] Reordering while shuffling might affect 'previous song' behavior.");
             }
           }


           return { playlists: updatedPlaylists, currentSongIndex: newCurrentSongIndex, playHistory: newPlayHistory };
         }),


      setActivePlaylistId: (playlistId) =>
        set((state) => {
           if (playlistId !== state.activePlaylistId) {
              const newPlaylist = state.playlists.find(p => p.id === playlistId);
              // Stop playback when switching playlists unless the current song is in the new one
              const currentSongInNewPlaylist = newPlaylist?.songs.find(s => s.id === state.currentSong?.id);

              if (currentSongInNewPlaylist) {
                 const newIndex = newPlaylist.songs.findIndex(s => s.id === state.currentSong?.id);
                 return {
                     activePlaylistId: playlistId,
                     currentSongIndex: newIndex,
                     // Reset history when switching playlist even if song is the same
                     playHistory: state.isShuffling ? [newIndex] : [],
                     isInSinglePlayMode: false
                 };
              } else {
                 // Stop playback and clear related state
                 return { activePlaylistId: playlistId, currentSong: null, currentSongIndex: -1, isPlaying: false, playHistory: [], isInSinglePlayMode: false, currentSongProgress: 0, currentSongDuration: 0 };
              }
           }
           // If clicking the already active playlist, ensure single play mode is off
           return { activePlaylistId: playlistId, isInSinglePlayMode: false };
        }),


      playPlaylist: (playlistId) => set((state) => {
         const playlist = state.playlists.find((p) => p.id === playlistId);
         if (!playlist || playlist.songs.length === 0) return {};

         // Prevent rapid clicks: If already playing this playlist's first song, don't restart
         let startIndex = 0;
         if (state.isShuffling) {
             const shuffledIndices = state._getShuffledPlaylistOrder(playlist);
             startIndex = shuffledIndices[0] ?? 0;
         }
         const startSong = playlist.songs[startIndex];

         // If this song from this playlist is ALREADY the current song and playing, do nothing.
          if (state.currentSong?.id === startSong.id && state.activePlaylistId === playlistId && state.isPlaying) {
              console.log("[Store] Playlist already playing, ignoring click.");
              return {};
          }
          // If it's the same song but paused, just play it
          if (state.currentSong?.id === startSong.id && state.activePlaylistId === playlistId && !state.isPlaying) {
              console.log("[Store] Resuming playlist from start.");
              return { isPlaying: true };
          }


         // Otherwise, start the playlist
         console.log("[Store] Starting playlist playback.");
         return {
           currentSong: startSong,
           currentSongIndex: startIndex,
           activePlaylistId: playlistId,
           isPlaying: true,
           currentSongProgress: 0, // Reset progress
           currentSongDuration: 0, // Reset duration
           playHistory: [startIndex], // Start history
           isInSinglePlayMode: false,
         };
      }),


      playSong: (song, playlistId) =>
        set((state) => {
          const playlist = state.playlists.find((p) => p.id === playlistId);
          if (!playlist) return {};

          const songIndex = playlist.songs.findIndex((s) => s.id === song.id);
          if (songIndex === -1) return {};

           // Prevent rapid clicks: If this song is already playing, do nothing
           if (state.currentSong?.id === song.id && state.activePlaylistId === playlistId && state.isPlaying) {
             console.log("[Store] Song already playing, ignoring click.");
             return {};
           }
            // If same song but paused, just play it
           if (state.currentSong?.id === song.id && state.activePlaylistId === playlistId && !state.isPlaying) {
                console.log("[Store] Resuming song playback.");
                return { isPlaying: true };
            }

          // Determine if history should be reset
          const resetHistory = state.activePlaylistId !== playlistId || (!state.isShuffling && get().isShuffling) || state.isInSinglePlayMode;

          console.log("[Store] Playing new song from playlist.");
          return {
            currentSong: song,
            currentSongIndex: songIndex,
            activePlaylistId: playlistId,
            isPlaying: true,
            currentSongProgress: 0, // Reset progress
            currentSongDuration: 0, // Reset duration
            playHistory: resetHistory ? [songIndex] : [...state.playHistory, songIndex],
            isInSinglePlayMode: false, // Explicitly set to false when playing from playlist
          };
        }),

      playSingleSong: (song) => set((state) => {
          // Prevent rapid clicks: If this song is already playing in single mode, do nothing.
          if (state.currentSong?.id === song.id && state.isInSinglePlayMode && state.isPlaying) {
             console.log("[Store] Single song already playing, ignoring click.");
             return {};
          }
          // If same song but paused, just play it
           if (state.currentSong?.id === song.id && state.isInSinglePlayMode && !state.isPlaying) {
               console.log("[Store] Resuming single song playback.");
                return { isPlaying: true };
            }

          // When playing a single song, we're not in a playlist context
          console.log("[Store] Playing single song.");
          return {
            currentSong: song,
            currentSongIndex: -1, // Indicate no playlist context
            activePlaylistId: null, // No active playlist
            isPlaying: true,
            currentSongProgress: 0, // Reset progress
            currentSongDuration: 0, // Reset duration
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
                return { currentSong: null, currentSongIndex: -1, isPlaying: false, isInSinglePlayMode: false, currentSongProgress: 0, currentSongDuration: 0 };
            }
        }

        // --- Playlist Mode Logic ---
        const activePlaylist = state._getActivePlaylist();
        if (!activePlaylist || activePlaylist.songs.length === 0) {
            return { currentSong: null, currentSongIndex: -1, isPlaying: false, playHistory: [], currentSongProgress: 0, currentSongDuration: 0 };
        }

        const numSongs = activePlaylist.songs.length;
        let nextIndex = -1;

        if (state.isLooping) {
            // If looping current song (in playlist mode), restart it
            if (playerRef.current) playerRef.current.seekTo(0);
             return { currentSongProgress: 0, isPlaying: true };
        }


        if (state.isShuffling) {
            // Avoid playing the immediate last few songs if possible
            const recentHistory = state.playHistory.slice(-Math.min(state.playHistory.length, Math.floor(numSongs / 2) + 1));
            const availableIndices = activePlaylist.songs.map((_, i) => i).filter(i => !recentHistory.includes(i));

            if (availableIndices.length > 0) {
                nextIndex = availableIndices[Math.floor(Math.random() * availableIndices.length)];
            } else {
                 // If all songs recently played, pick a random one excluding the very last one (if possible)
                const possibleIndices = activePlaylist.songs.map((_, i) => i).filter(i => i !== state.currentSongIndex);
                if (possibleIndices.length > 0) {
                    nextIndex = possibleIndices[Math.floor(Math.random() * possibleIndices.length)];
                } else {
                    nextIndex = state.currentSongIndex; // Play the same song again if only one song
                }
            }
        } else {
            nextIndex = state.currentSongIndex + 1;
        }

        if (nextIndex >= numSongs) {
            if (state.isLoopingPlaylist) {
                nextIndex = 0;
            } else {
                // End of playlist, stop playing
                return { currentSong: null, currentSongIndex: -1, isPlaying: false, playHistory: [], currentSongProgress: 0, currentSongDuration: 0 };
            }
        } else if (nextIndex < 0 && !state.isShuffling) {
             // This case should ideally not be reached normally in non-shuffle mode unless index was -1
             nextIndex = 0;
        }


        const nextSong = activePlaylist.songs[nextIndex];
        // Add to history only if the song actually changed or shuffle is on
        const newHistory = (state.isShuffling || nextIndex !== state.currentSongIndex)
            ? [...state.playHistory, nextIndex]
            : state.playHistory;

        return {
            currentSong: nextSong,
            currentSongIndex: nextIndex,
            isPlaying: true,
            currentSongProgress: 0, // Reset progress
            currentSongDuration: 0, // Reset duration
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
            return { currentSong: null, currentSongIndex: -1, isPlaying: false, playHistory: [], currentSongProgress: 0, currentSongDuration: 0 };
        }

        // If played more than 3 seconds, restart current song
        if (state.currentSongProgress > 3 && playerRef.current) {
             playerRef.current.seekTo(0);
             return { currentSongProgress: 0, isPlaying: true };
        }


        let prevIndex = -1;
        const numSongs = activePlaylist.songs.length;
        let newHistory = state.playHistory;

        if (state.isShuffling && state.playHistory.length > 1) {
            // Pop the current song index, get the one before it
            newHistory = state.playHistory.slice(0, -1);
            prevIndex = newHistory[newHistory.length - 1];
        } else if (!state.isShuffling) {
            prevIndex = state.currentSongIndex - 1;
        }

        // Handle beginning of playlist cases
        if (prevIndex < 0) {
            if (state.isLoopingPlaylist && !state.isShuffling) {
                prevIndex = numSongs - 1; // Loop to end
            } else {
                 // If not looping or shuffling, restart current song (or do nothing if already at start)
                 if (playerRef.current) playerRef.current.seekTo(0);
                 return { currentSongProgress: 0, isPlaying: true };
                 // If shuffling and no history, can't go back, just restart
                 // return {};
            }
        }

         // Check if prevIndex is valid after potential history manipulation
         if (prevIndex < 0 || prevIndex >= numSongs) {
             console.warn("[Store] Invalid previous index calculated:", prevIndex);
             if (playerRef.current) playerRef.current.seekTo(0);
             return { currentSongProgress: 0, isPlaying: true }; // Fallback: restart current song
         }


        const prevSong = activePlaylist.songs[prevIndex];


        return {
            currentSong: prevSong,
            currentSongIndex: prevIndex,
            isPlaying: true,
            currentSongProgress: 0, // Reset progress
            currentSongDuration: 0, // Reset duration
            playHistory: newHistory, // Use the potentially shortened history for shuffle
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
          const turningShuffleOn = !state.isShuffling;
          return {
              isShuffling: turningShuffleOn,
              // Reset history only if turning shuffle ON and there's a current song context
              playHistory: turningShuffleOn && state.currentSongIndex !== -1
                           ? [state.currentSongIndex]
                           : state.playHistory
          }
       }),

      toggleLoop: () => set((state) => ({ isLooping: !state.isLooping })), // Applies to both modes

      toggleLoopPlaylist: () => set((state) => {
          if (state.isInSinglePlayMode) return {}; // Cannot loop playlist in single play mode
          return { isLoopingPlaylist: !state.isLoopingPlaylist }
      }),

      // Only update progress if the song hasn't changed since the update was triggered
      setCurrentSongProgress: (progress) => set((state) => {
        if (state.isPlaying || (progress === 0 && !state.isPlaying) ) { // Allow setting to 0 when paused
             return { currentSongProgress: progress };
        }
        return {};
      }),
       // Only update duration if the song hasn't changed
      setCurrentSongDuration: (duration) => set((state) => {
         // We might get duration updates slightly after the song changes.
         // A simple check: if current song exists, update its duration.
         if (state.currentSong) {
             return { currentSongDuration: duration };
         }
         return {};
      }),

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
        console.log("[Store] Hydration started...");
        return (persistedState, error) => {
          if (error) {
            console.error("[Store] An error occurred during hydration:", error);
          } else if (persistedState) {
            console.log("[Store] Hydration successful. Applying persisted state and resetting transient state.");

            // De-duplicate songs within each playlist from persisted state
             const dedupedPlaylists = persistedState.playlists.map(playlist => {
               const uniqueSongs = new Map<string, Song>();
               playlist.songs.forEach(song => {
                 if (!uniqueSongs.has(song.id)) {
                   uniqueSongs.set(song.id, song);
                 } else {
                   console.warn(`[Store Rehydrate] Duplicate song ID ${song.id} ("${song.title}") found and removed from playlist ${playlist.id} ("${playlist.name}").`);
                 }
               });
               return { ...playlist, songs: Array.from(uniqueSongs.values()) };
             });


            // Reset transient state
            persistedState.isPlaying = false;
            persistedState.currentSong = null;
            persistedState.currentSongIndex = -1;
            persistedState.playHistory = [];
            persistedState.currentSongProgress = 0;
            persistedState.currentSongDuration = 0;
            persistedState.isInSinglePlayMode = false;
            persistedState.playlists = dedupedPlaylists; // Apply de-duplicated playlists

            // Ensure activePlaylistId is valid
             if (persistedState.activePlaylistId && !persistedState.playlists.find(p => p.id === persistedState.activePlaylistId)) {
                persistedState.activePlaylistId = persistedState.playlists[0]?.id ?? null;
                console.log(`[Store Rehydrate] Active playlist ID was invalid, reset to: ${persistedState.activePlaylistId}`);
             } else if (!persistedState.activePlaylistId && persistedState.playlists.length > 0) {
                 persistedState.activePlaylistId = persistedState.playlists[0].id;
                 console.log(`[Store Rehydrate] Active playlist ID was null, set to first playlist: ${persistedState.activePlaylistId}`);
             }
            console.log("[Store] State rehydrated and transient state reset complete.");
          } else {
             console.log("[Store] No persisted state found.");
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


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
          let newIsPlaying = state.isPlaying;

          if (state.activePlaylistId === playlistId) {
            newActivePlaylistId = updatedPlaylists[0]?.id ?? null;
            // Stop playing if the active playlist is deleted
            newCurrentSong = null;
            newCurrentSongIndex = -1;
            newIsPlaying = false;
            newIsInSinglePlayMode = false; // Exit single play mode if active playlist deleted
          }
          return {
             playlists: updatedPlaylists,
             activePlaylistId: newActivePlaylistId,
             currentSong: newCurrentSong,
             currentSongIndex: newCurrentSongIndex,
             isPlaying: newIsPlaying, // Use updated playing state
             playHistory: [], // Clear history when playlist deleted
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
          let nextSongToPlay: Song | null = null;
          let nextSongIndex = -1;
          let playNext = false;

          const updatedPlaylists = state.playlists.map((p) => {
            if (p.id === playlistId) {
               const originalSongs = [...p.songs]; // Copy original songs before filtering
               removedSongIndexInOriginal = originalSongs.findIndex((s) => s.id === songId);
               const updatedSongs = originalSongs.filter((s) => s.id !== songId);

               if (state.currentSong?.id === songId && state.activePlaylistId === playlistId) {
                   wasPlayingRemovedSong = true;
                   // Determine the next song to play IF the removed song was playing
                   const activePlaylist = get()._getActivePlaylist(); // Get current state playlist
                   if (activePlaylist && activePlaylist.songs.length > 0) {
                       const numSongs = activePlaylist.songs.length; // Length before removal
                       let potentialNextIndex = -1;

                       if(state.isShuffling){
                          // In shuffle, pick a random *different* song from the remaining ones
                          const remainingIndices = updatedSongs.map((s, i) => i).filter(i => i !== state.currentSongIndex); // indices in the *new* list
                          if(remainingIndices.length > 0){
                             potentialNextIndex = remainingIndices[Math.floor(Math.random() * remainingIndices.length)];
                          } else if (updatedSongs.length > 0) {
                             potentialNextIndex = 0; // Only one song left, play that
                          }
                       } else {
                          // In normal mode, try to play the song at the same original index, if it exists
                          if (removedSongIndexInOriginal < updatedSongs.length) {
                             potentialNextIndex = removedSongIndexInOriginal;
                          } else if (updatedSongs.length > 0) {
                             // If removed was last, play the new last song
                             potentialNextIndex = updatedSongs.length - 1;
                          }
                       }


                       if (potentialNextIndex !== -1 && potentialNextIndex < updatedSongs.length) {
                         nextSongToPlay = updatedSongs[potentialNextIndex];
                         nextSongIndex = potentialNextIndex;
                         playNext = true;
                       }
                   }
               }
               return { ...p, songs: updatedSongs };
            }
            return p;
          });

          // --- State Update Logic ---
          if (wasPlayingRemovedSong) {
             if (playNext && nextSongToPlay) {
                // Play the determined next song
                return {
                  playlists: updatedPlaylists,
                  currentSong: nextSongToPlay,
                  currentSongIndex: nextSongIndex,
                  isPlaying: true, // Keep playing
                  currentSongProgress: 0,
                  currentSongDuration: 0,
                  playHistory: state.isShuffling ? [nextSongIndex] : [], // Reset history for next song
                  isInSinglePlayMode: false,
                };
             } else {
                 // No next song found (playlist became empty), stop playback
                return {
                  playlists: updatedPlaylists,
                  currentSong: null,
                  currentSongIndex: -1,
                  isPlaying: false,
                  playHistory: [],
                  currentSongProgress: 0,
                  currentSongDuration: 0,
                  isInSinglePlayMode: false
                };
             }
          } else if (state.activePlaylistId === playlistId && state.currentSongIndex !== -1 && removedSongIndexInOriginal !== -1) {
             // If removed song was BEFORE the current playing song (which wasn't the removed one)
             let newCurrentSongIndex = state.currentSongIndex;
             if (removedSongIndexInOriginal < state.currentSongIndex) {
                  newCurrentSongIndex--; // Decrement the index
             }

             let newPlayHistory = state.playHistory;
              // Adjust play history indices if not shuffling
              if (!state.isShuffling) {
                  newPlayHistory = state.playHistory.map(histIndex => {
                      if (histIndex > removedSongIndexInOriginal) return histIndex - 1;
                      if (histIndex === removedSongIndexInOriginal) return -1; // Mark removed index
                      return histIndex;
                  }).filter(histIndex => histIndex !== -1); // Remove marked index
              } else {
                  // Reordering/removing while shuffling makes history mapping complex.
                  // Simplest is to potentially clear history or just leave it, accepting potential odd 'back' behavior.
                  // Let's clear it for simplicity when a song is removed while shuffling.
                  newPlayHistory = state.currentSongIndex !== -1 ? [newCurrentSongIndex] : [];
              }
               return { playlists: updatedPlaylists, playHistory: newPlayHistory, currentSongIndex: newCurrentSongIndex };
          }

          // Default: just update the playlists if no playing state needed changing
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

           if (state.activePlaylistId === playlistId && state.currentSong) {
             // Update current song index based on its new position
             newCurrentSongIndex = newSongs.findIndex(song => song.id === state.currentSong!.id);
             if (newCurrentSongIndex === -1) {
                console.warn("[Store] Current song not found after reorder, resetting index.");
                // This case indicates a problem, maybe the song was unexpectedly removed.
                // Keep the old index for now, or reset? Resetting seems safer.
                newCurrentSongIndex = -1;
             }

             // Update play history indices only if NOT shuffling
             if (!state.isShuffling) {
                 newPlayHistory = state.playHistory.map(histIndex => {
                     // If the index is the one that moved
                     if (histIndex === fromIndex) return toIndex;
                     // If the index was between the move points
                     if (histIndex >= Math.min(fromIndex, toIndex) && histIndex <= Math.max(fromIndex, toIndex)) {
                         if (fromIndex < toIndex) { // Moved down
                             if (histIndex > fromIndex) return histIndex - 1;
                         } else { // Moved up
                             if (histIndex < fromIndex) return histIndex + 1;
                         }
                     }
                     return histIndex; // Index outside the affected range
                 });
             } else {
               // Reordering while shuffling: Clear history for simplicity.
               newPlayHistory = newCurrentSongIndex !== -1 ? [newCurrentSongIndex] : [];
             }
           }


           return { playlists: updatedPlaylists, currentSongIndex: newCurrentSongIndex, playHistory: newPlayHistory };
         }),


     setActivePlaylistId: (playlistId) =>
        set((state) => {
           if (playlistId !== state.activePlaylistId) {
              const newPlaylist = state.playlists.find(p => p.id === playlistId);
              // Check if the currently playing song exists in the new playlist
              const currentSongInNewPlaylistIndex = newPlaylist?.songs.findIndex(s => s.id === state.currentSong?.id) ?? -1;

              if (currentSongInNewPlaylistIndex !== -1) {
                 // Song exists in the new playlist, update index and active ID, keep playing state
                 console.log(`[Store] Switching to playlist ${playlistId}, current song found, continuing playback.`);
                 return {
                     activePlaylistId: playlistId,
                     currentSongIndex: currentSongInNewPlaylistIndex,
                     // Reset history when switching playlist context, even if song is the same
                     playHistory: state.isShuffling ? [currentSongInNewPlaylistIndex] : [],
                     isInSinglePlayMode: false // Ensure not in single play mode
                 };
              } else {
                 // Song does NOT exist in new playlist, stop playback and clear related state
                 console.log(`[Store] Switching to playlist ${playlistId}, current song not found, stopping playback.`);
                 return {
                     activePlaylistId: playlistId,
                     currentSong: null,
                     currentSongIndex: -1,
                     isPlaying: false, // Stop playing
                     playHistory: [],
                     isInSinglePlayMode: false,
                     currentSongProgress: 0,
                     currentSongDuration: 0
                 };
              }
           }
           // If clicking the already active playlist, just ensure single play mode is off
           console.log(`[Store] Re-selecting active playlist ${playlistId}, ensuring not in single mode.`);
           return { activePlaylistId: playlistId, isInSinglePlayMode: false };
        }),


      playPlaylist: (playlistId) => set((state) => {
         const playlist = state.playlists.find((p) => p.id === playlistId);
         if (!playlist || playlist.songs.length === 0) return {};

         let startIndex = 0;
         let shuffledIndices: number[] = [];
         if (state.isShuffling) {
             shuffledIndices = state._getShuffledPlaylistOrder(playlist);
             startIndex = shuffledIndices[0] ?? 0;
         }
         const startSong = playlist.songs[startIndex];

         // Prevent rapid clicks / Restarting unnecessarily
          if (state.currentSong?.id === startSong.id && state.activePlaylistId === playlistId && state.isPlaying) {
              console.log("[Store] Playlist already playing from start, ignoring click.");
              // If shuffling, maybe re-shuffle and restart? Optional behavior.
              return {};
          }
          // If it's the same start song but paused, just play it
          if (state.currentSong?.id === startSong.id && state.activePlaylistId === playlistId && !state.isPlaying) {
              console.log("[Store] Resuming playlist from start.");
              return { isPlaying: true };
          }


         // Start or restart the playlist
         console.log("[Store] Starting playlist playback.", state.isShuffling ? "(Shuffled)" : "");
         return {
           currentSong: startSong,
           currentSongIndex: startIndex,
           activePlaylistId: playlistId,
           isPlaying: true,
           currentSongProgress: 0, // Reset progress
           currentSongDuration: 0, // Reset duration
           playHistory: [startIndex], // Start history with the first song's index
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

          // Determine if history should be reset (switching playlist, turning shuffle ON, or coming from single play mode)
          const isNewContext = state.activePlaylistId !== playlistId || state.isInSinglePlayMode;
          // History always starts with the currently played song's index
          const newHistory = [songIndex];

          console.log("[Store] Playing new song from playlist context.");
          return {
            currentSong: song,
            currentSongIndex: songIndex,
            activePlaylistId: playlistId,
            isPlaying: true,
            currentSongProgress: 0, // Reset progress
            currentSongDuration: 0, // Reset duration
            playHistory: newHistory, // Start history with this song's index
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
            // Retain shuffle/loop settings for playlist mode, but they won't apply here
            // isShuffling: false, // Optionally disable shuffle for single play
            // isLoopingPlaylist: false, // Optionally disable playlist loop
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
                console.log("[Store] Single song finished, stopping playback.");
                return { currentSong: null, currentSongIndex: -1, isPlaying: false, isInSinglePlayMode: false, currentSongProgress: 0, currentSongDuration: 0 };
            }
        }

        // --- Playlist Mode Logic ---
        const activePlaylist = state._getActivePlaylist();
        if (!activePlaylist || activePlaylist.songs.length === 0) {
            console.log("[Store] Play next: No active playlist or playlist empty.");
            return { currentSong: null, currentSongIndex: -1, isPlaying: false, playHistory: [], currentSongProgress: 0, currentSongDuration: 0 };
        }

        const numSongs = activePlaylist.songs.length;
        let nextIndex = -1;

        if (state.isLooping) {
            // If looping current song (in playlist mode), restart it
            console.log("[Store] Looping current song.");
            if (playerRef.current) playerRef.current.seekTo(0);
             return { currentSongProgress: 0, isPlaying: true };
        }


        if (state.isShuffling) {
            console.log("[Store] Play next: Calculating next shuffled song.");
            // Avoid playing the immediate last few songs if possible
            const recentHistory = state.playHistory.slice(-Math.min(state.playHistory.length, Math.floor(numSongs / 2) + 1));
            const availableIndices = activePlaylist.songs.map((_, i) => i).filter(i => !recentHistory.includes(i));

            if (availableIndices.length > 0) {
                nextIndex = availableIndices[Math.floor(Math.random() * availableIndices.length)];
                console.log("[Store] Play next: Found available index:", nextIndex);
            } else {
                 // If all songs recently played, pick a random one excluding the very last one (if possible)
                const possibleIndices = activePlaylist.songs.map((_, i) => i).filter(i => i !== state.currentSongIndex);
                if (possibleIndices.length > 0) {
                    nextIndex = possibleIndices[Math.floor(Math.random() * possibleIndices.length)];
                     console.log("[Store] Play next: All songs recent, picked random excluding last:", nextIndex);
                } else {
                    nextIndex = state.currentSongIndex; // Play the same song again if only one song
                    console.log("[Store] Play next: Only one song, repeating:", nextIndex);
                }
            }
        } else {
            nextIndex = state.currentSongIndex + 1;
            console.log("[Store] Play next: Calculating next sequential song index:", nextIndex);
        }

        // Check bounds and playlist looping
        if (nextIndex >= numSongs) {
            if (state.isLoopingPlaylist) {
                nextIndex = 0;
                 console.log("[Store] Play next: End of playlist, looping back to start:", nextIndex);
            } else {
                // End of playlist, stop playing
                console.log("[Store] Play next: End of playlist, stopping playback.");
                return { currentSong: null, currentSongIndex: -1, isPlaying: false, playHistory: [], currentSongProgress: 0, currentSongDuration: 0 };
            }
        } else if (nextIndex < 0 && !state.isShuffling) {
             // This case should ideally not be reached normally in non-shuffle mode unless index was -1
             console.warn("[Store] Play next: Calculated invalid negative index in sequential mode, resetting to 0.");
             nextIndex = 0;
        }


        const nextSong = activePlaylist.songs[nextIndex];
        if (!nextSong) {
            console.error("[Store] Play next: Could not find song at calculated index:", nextIndex);
             return { currentSong: null, currentSongIndex: -1, isPlaying: false, playHistory: [], currentSongProgress: 0, currentSongDuration: 0 };
        }

        // Add to history
        const newHistory = [...state.playHistory, nextIndex];
        console.log(`[Store] Play next: Playing song "${nextSong.title}" at index ${nextIndex}. History:`, newHistory);


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
                console.log("[Store] Play previous: Restarting single song.");
                playerRef.current.seekTo(0);
                return { currentSongProgress: 0, isPlaying: true };
            }
            // Otherwise, do nothing or maybe just stop? Let's just restart.
             console.log("[Store] Play previous: Restarting single song (near beginning).");
             if (playerRef.current) playerRef.current.seekTo(0);
             return { currentSongProgress: 0, isPlaying: true };
        }

        // --- Playlist Mode Logic ---
        const activePlaylist = state._getActivePlaylist();
        if (!activePlaylist || activePlaylist.songs.length === 0) {
             console.log("[Store] Play previous: No active playlist or playlist empty.");
            return { currentSong: null, currentSongIndex: -1, isPlaying: false, playHistory: [], currentSongProgress: 0, currentSongDuration: 0 };
        }

        // If played more than 3 seconds, restart current song
        if (state.currentSongProgress > 3 && playerRef.current) {
             console.log("[Store] Play previous: Restarting current song (progress > 3s).");
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
             console.log("[Store] Play previous: Using shuffled history. Prev index:", prevIndex);
        } else if (!state.isShuffling) {
            prevIndex = state.currentSongIndex - 1;
            console.log("[Store] Play previous: Calculating previous sequential index:", prevIndex);
            // For sequential, we don't modify history here, just going back
            newHistory = state.playHistory; // Keep existing history
        } else {
           // Shuffling but history has 0 or 1 entry, cannot go back
           console.log("[Store] Play previous: Cannot go back (shuffling with short history). Restarting current song.");
           if (playerRef.current) playerRef.current.seekTo(0);
           return { currentSongProgress: 0, isPlaying: true };
        }

        // Handle beginning of playlist cases
        if (prevIndex < 0) {
            if (state.isLoopingPlaylist && !state.isShuffling) {
                prevIndex = numSongs - 1; // Loop to end
                 console.log("[Store] Play previous: Looping playlist to end:", prevIndex);
            } else {
                 // If not looping or shuffling with no history, restart current song
                 console.log("[Store] Play previous: At start, restarting current song.");
                 if (playerRef.current) playerRef.current.seekTo(0);
                 return { currentSongProgress: 0, isPlaying: true };
            }
        }

         // Check if prevIndex is valid after potential history manipulation
         if (prevIndex < 0 || prevIndex >= numSongs) {
             console.warn("[Store] Play previous: Invalid previous index calculated:", prevIndex);
             if (playerRef.current) playerRef.current.seekTo(0);
             return { currentSongProgress: 0, isPlaying: true }; // Fallback: restart current song
         }


        const prevSong = activePlaylist.songs[prevIndex];
        if (!prevSong) {
            console.error("[Store] Play previous: Could not find song at calculated index:", prevIndex);
             if (playerRef.current) playerRef.current.seekTo(0);
             return { currentSongProgress: 0, isPlaying: true }; // Fallback: restart current song
        }

        console.log(`[Store] Play previous: Playing song "${prevSong.title}" at index ${prevIndex}. History:`, newHistory);

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
               console.log("[Store] Toggle play/pause: No song, doing nothing.");
              return {};
          }
          const newState = !state.isPlaying;
          console.log(`[Store] Toggle play/pause: Setting isPlaying to ${newState}`);
          return { isPlaying: newState };
      }),

      toggleShuffle: () => set((state) => {
          if (state.isInSinglePlayMode) {
               console.log("[Store] Toggle shuffle: Cannot shuffle in single play mode.");
               return {};
          }
          const turningShuffleOn = !state.isShuffling;
          console.log(`[Store] Toggle shuffle: Setting isShuffling to ${turningShuffleOn}`);
          // Reset history only if turning shuffle ON and there's a current song context
          const newHistory = turningShuffleOn && state.currentSongIndex !== -1
                           ? [state.currentSongIndex]
                           : state.playHistory;
          return {
              isShuffling: turningShuffleOn,
              playHistory: newHistory
          };
       }),

      toggleLoop: () => set((state) => {
           const newState = !state.isLooping;
           console.log(`[Store] Toggle loop song: Setting isLooping to ${newState}`);
           return { isLooping: newState };
       }), // Applies to both modes

      toggleLoopPlaylist: () => set((state) => {
          if (state.isInSinglePlayMode) {
               console.log("[Store] Toggle loop playlist: Cannot loop playlist in single play mode.");
               return {};
          }
           const newState = !state.isLoopingPlaylist;
           console.log(`[Store] Toggle loop playlist: Setting isLoopingPlaylist to ${newState}`);
          return { isLoopingPlaylist: newState };
      }),

      // Only update progress if the song hasn't changed since the update was triggered
      setCurrentSongProgress: (progress) => set((state) => {
        // Allow updates if playing OR if we are setting progress to 0 (e.g., seeking manually while paused)
        if (state.isPlaying || progress === 0) {
             return { currentSongProgress: progress };
        }
        return {};
      }),
       // Only update duration if the song hasn't changed
      setCurrentSongDuration: (duration) => set((state) => {
         // We might get duration updates slightly after the song changes.
         // Check if a current song exists before updating its duration.
         if (state.currentSong) {
             return { currentSongDuration: duration };
         }
          // console.log("[Store] Set duration: No current song, ignoring update.");
         return {};
      }),

      setVolume: (volume) => set({ volume: Math.max(0, Math.min(1, volume)), isMuted: volume <= 0 ? true : false }), // Mute if volume is 0 or less
      toggleMute: () => set((state) => {
           const newMuteState = !state.isMuted;
           console.log(`[Store] Toggle mute: Setting isMuted to ${newMuteState}`);
           return { isMuted: newMuteState };
       }),

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
        // Don't persist: currentSong, currentSongIndex, playHistory, isPlaying, currentSongProgress, currentSongDuration, isInSinglePlayMode
      }),
      onRehydrateStorage: (state) => {
        console.log("[Store] Hydration starting...");
        return (persistedState, error) => {
          if (error) {
            console.error("[Store] Hydration error:", error);
          } else if (persistedState) {
            console.log("[Store] Hydration successful. Applying persisted state:", persistedState);

            // De-duplicate songs within each playlist
             const dedupedPlaylists = persistedState.playlists.map(playlist => {
               const uniqueSongs = new Map<string, Song>();
               playlist.songs.forEach(song => {
                 if (!uniqueSongs.has(song.id)) {
                   uniqueSongs.set(song.id, song);
                 } else {
                   console.warn(`[Store Rehydrate] Duplicate song ID ${song.id} ("${song.title}") removed from playlist ${playlist.id} ("${playlist.name}").`);
                 }
               });
               return { ...playlist, songs: Array.from(uniqueSongs.values()) };
             });
             persistedState.playlists = dedupedPlaylists;


            // Reset transient state that shouldn't persist across sessions
            persistedState.isPlaying = false;
            persistedState.currentSong = null;
            persistedState.currentSongIndex = -1;
            persistedState.playHistory = [];
            persistedState.currentSongProgress = 0;
            persistedState.currentSongDuration = 0;
            persistedState.isInSinglePlayMode = false;

             // Ensure activePlaylistId is valid or default to first/null
             let activeIdIsValid = false;
             if (persistedState.activePlaylistId) {
                 activeIdIsValid = persistedState.playlists.some(p => p.id === persistedState.activePlaylistId);
             }

             if (!activeIdIsValid) {
                 persistedState.activePlaylistId = persistedState.playlists[0]?.id ?? null;
                 console.log(`[Store Rehydrate] Active playlist ID was invalid or missing, reset to: ${persistedState.activePlaylistId}`);
             }

            console.log("[Store] Transient state reset complete.");
          } else {
             console.log("[Store] No persisted state found. Initializing with defaults.");
             // Initialize default state if nothing was persisted (e.g., first load)
             if (state) { // state here refers to the initial state creator
                state.playlists = [];
                state.activePlaylistId = null;
                state.volume = 0.8;
                state.isMuted = false;
                state.isShuffling = false;
                state.isLooping = false;
                state.isLoopingPlaylist = false;
                state.currentSong = null;
                state.currentSongIndex = -1;
                state.playHistory = [];
                state.isPlaying = false;
                state.currentSongProgress = 0;
                state.currentSongDuration = 0;
                state.isInSinglePlayMode = false;
             }
          }
        };
      },
      // Optional: Improve logging for state changes
      // stateMiddleware: (config) => (set, get, api) => config((args) => {
      //   console.log("[Store Update]", args);
      //   set(args);
      //   console.log("[Store New State]", get());
      // }, get, api),
    }
  )
);

// Global reference for the player
let playerRef: React.RefObject<ReactPlayer> | null = null;

export const setPlayerRef = (ref: React.RefObject<ReactPlayer>) => {
    playerRef = ref;
};

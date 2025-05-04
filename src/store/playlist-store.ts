
'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Playlist, Song, QueueSong } from '@/lib/types';
import type ReactPlayer from 'react-player'; // Import type for playerRef
import { toast } from '@/hooks/use-toast'; // Correct import for toast

interface PlaylistState {
  playlists: Playlist[];
  activePlaylistId: string | null; // ID of the playlist being *viewed*
  queue: QueueSong[]; // The actual playback queue
  currentQueueIndex: number; // Index within the queue array
  isShuffling: boolean;
  isLooping: boolean; // Loop the current song
  isLoopingPlaylist: boolean; // Loop the entire playlist/queue
  volume: number;
  isMuted: boolean;
  currentSongProgress: number;
  currentSongDuration: number;
  isPlaying: boolean; // Reflects player state

  // --- Derived state (no need to store directly, can be computed) ---
  // currentSong: Song | null; // Can be derived from queue[currentQueueIndex]
  // currentSongPlaylistContextId: string | null; // Context is now the queue itself
  // isInSinglePlayMode: boolean; // Inferred if queue has only 1 song and context is null? Less clear. Replaced by queue logic.

  // Actions
  createPlaylist: (name: string) => void;
  deletePlaylist: (playlistId: string) => void; // Added
  renamePlaylist: (playlistId: string, newName: string) => void;
  addSongToPlaylist: (playlistId: string, song: Song) => boolean; // Return true if added, false if duplicate
  removeSongFromPlaylist: (playlistId: string, songId: string) => void;
  reorderSongInPlaylist: (playlistId: string, fromIndex: number, toIndex: number) => void;
  setActivePlaylistId: (playlistId: string | null) => void; // Only sets the *viewed* playlist ID

  // Queue & Playback Actions
  playPlaylist: (playlistId: string, startIndex?: number) => void; // Plays playlist, adds to queue
  playSongInPlaylistContext: (song: Song, playlistId: string) => void; // Plays song, sets playlist context in queue
  playSingleSong: (song: Song) => void; // Plays song directly, clears queue
  playNextSong: () => void;
  playPreviousSong: () => void;
  togglePlayPause: () => void;
  toggleShuffle: () => void;
  toggleLoop: () => void; // Toggles single song loop
  toggleLoopPlaylist: () => void; // Toggles queue/playlist loop
  setCurrentSongProgress: (progress: number) => void;
  setCurrentSongDuration: (duration: number) => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  clearQueue: () => void;
  removeSongFromQueue: (queueId: string) => void;
  reorderSongInQueue: (fromIndex: number, toIndex: number) => void;
  playFromQueueIndex: (index: number) => void;

  // Internal helper (not directly exposed but used by actions)
  _generateQueueId: () => string; // Helper to create unique queue item IDs
}

const generateId = () => Math.random().toString(36).substring(2, 15);

// Helper function to shuffle an array (Fisher-Yates)
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
      activePlaylistId: null, // The playlist currently being *viewed*
      queue: [],
      currentQueueIndex: -1,
      isPlaying: false,
      isShuffling: false,
      isLooping: false,
      isLoopingPlaylist: false,
      volume: 0.8, // Default volume
      isMuted: false,
      currentSongProgress: 0,
      currentSongDuration: 0,

      _generateQueueId: () => `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,

      // --- Playlist Management ---
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
          let newQueue = state.queue;
          let newCurrentQueueIndex = state.currentQueueIndex;
          let newIsPlaying = state.isPlaying;

          // If the deleted playlist was the one being *viewed*
          if (state.activePlaylistId === playlistId) {
            newActivePlaylistId = updatedPlaylists[0]?.id ?? null;
          }

          // Check if the current queue content originated *solely* from the deleted playlist
          // This is a simplification; a more complex check might be needed if queue allows mixing
          const currentSong = state.queue[state.currentQueueIndex];
          // A simple check: if the current song seems to belong to the deleted playlist context
          // (We might need a better way to track queue origin if mixing is allowed)
          // Let's assume for now queue = playlist content when playing a playlist
          const playlistBeingPlayed = state.playlists.find(p => p.songs.some(s => s.id === currentSong?.id));

          if (playlistBeingPlayed && playlistBeingPlayed.id === playlistId) {
             console.log(`[Store] Playlist being played (${playlistId}) was deleted. Stopping playback.`);
             newQueue = [];
             newCurrentQueueIndex = -1;
             newIsPlaying = false;
          }


          return {
             playlists: updatedPlaylists,
             activePlaylistId: newActivePlaylistId,
             queue: newQueue,
             currentQueueIndex: newCurrentQueueIndex,
             isPlaying: newIsPlaying,
             currentSongProgress: newIsPlaying ? state.currentSongProgress : 0, // Reset progress if stopped
             currentSongDuration: newIsPlaying ? state.currentSongDuration : 0, // Reset duration if stopped
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
          const songExists = playlist.songs.some((s) => s.id === song.id);

          if (songExists) {
             const currentSong = state.queue[state.currentQueueIndex];
             // Avoid toast if song being added is already the current one (prevents spam)
             if (currentSong?.id !== song.id) {
                toast({
                  title: 'Song Already Exists',
                  description: `"${song.title}" is already in the playlist "${playlist.name}".`,
                  variant: 'default',
                });
             }
            songAdded = false;
            console.warn(`[Store] Attempted to add duplicate song ID ${song.id} to playlist ${playlistId} ("${playlist.name}").`);
            return state;
          }

          const updatedSongs = [...playlist.songs, song];
          const updatedPlaylist = { ...playlist, songs: updatedSongs };
          const updatedPlaylists = [...state.playlists];
          updatedPlaylists[playlistIndex] = updatedPlaylist;
          songAdded = true;
          console.log(`[Store] Song ID ${song.id} ("${song.title}") added to playlist ${playlistId} ("${playlist.name}").`);

          // If the playlist being modified is the source of the current queue, add the song to the queue as well
           // This logic might need refinement depending on desired queue behavior (e.g., add only if shuffle is off?)
           // const currentPlaylistSourceId = state.queue[0]?.playlistContextId; // Assuming we add this property
           // if (currentPlaylistSourceId === playlistId) {
           //    // Decide where to add in the queue (end? after current song if shuffle off?)
           // }


          return { playlists: updatedPlaylists };
        });
        return songAdded;
      },

      removeSongFromPlaylist: (playlistId, songId) =>
        set((state) => {
          let songRemovedFromQueue = false;
          const updatedPlaylists = state.playlists.map((p) => {
            if (p.id === playlistId) {
               const updatedSongs = p.songs.filter((s) => s.id !== songId);
               return { ...p, songs: updatedSongs };
            }
            return p;
          });

          // Also remove instances of this song from the current queue
          const initialQueueLength = state.queue.length;
          const newQueue = state.queue.filter(queueSong => queueSong.id !== songId);
          songRemovedFromQueue = newQueue.length < initialQueueLength;

          let newCurrentQueueIndex = state.currentQueueIndex;
          let newIsPlaying = state.isPlaying;

          if (songRemovedFromQueue) {
              const currentQueueSong = state.queue[state.currentQueueIndex];
              // If the removed song WAS the currently playing song
              if (currentQueueSong?.id === songId) {
                  console.log(`[Store] Removed currently playing song (ID: ${songId}) from queue.`);
                  // Try to play the next available song in the modified queue
                  if (newQueue.length > 0) {
                     // If the index was beyond the new length, wrap around or go to last
                     newCurrentQueueIndex = Math.min(state.currentQueueIndex, newQueue.length - 1);
                     // No need to explicitly call playNextSong, just update index and song
                     console.log(`[Store] Moving to next song in queue at index: ${newCurrentQueueIndex}`);
                  } else {
                     // Queue became empty
                     console.log("[Store] Queue became empty after removing song.");
                     newCurrentQueueIndex = -1;
                     newIsPlaying = false;
                  }
              } else {
                  // If the removed song was NOT the current one, adjust the index if needed
                   const removedSongOriginalIndex = state.queue.findIndex(q => q.id === songId);
                   if (removedSongOriginalIndex !== -1 && removedSongOriginalIndex < newCurrentQueueIndex) {
                       newCurrentQueueIndex--; // Shift index back
                   }
                   // Ensure index is valid
                    newCurrentQueueIndex = Math.min(newCurrentQueueIndex, newQueue.length - 1);
                     if (newQueue.length === 0) newCurrentQueueIndex = -1;

              }
          }


          return {
             playlists: updatedPlaylists,
             queue: newQueue,
             currentQueueIndex: newCurrentQueueIndex,
             isPlaying: newIsPlaying,
             currentSongProgress: newIsPlaying ? state.currentSongProgress : 0,
             currentSongDuration: newIsPlaying ? state.currentSongDuration : 0,
           };
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

           // If the reordered playlist is the source of the current queue,
           // AND shuffle is OFF, we might need to update the queue order.
           // This is complex. For now, let's NOT automatically update the queue on playlist reorder.
           // The user can re-play the playlist to get the new order.

           return { playlists: updatedPlaylists };
         }),

      setActivePlaylistId: (playlistId) =>
        set((state) => {
           if (playlistId !== state.activePlaylistId) {
              console.log(`[Store] Switching *viewed* playlist to: ${playlistId}`);
              return { activePlaylistId: playlistId };
           }
           return {};
        }),

      // --- Queue & Playback ---

      playPlaylist: (playlistId, startIndex = 0) => set((state) => {
         const playlist = state.playlists.find((p) => p.id === playlistId);
         if (!playlist || playlist.songs.length === 0) return {};

         let songsToQueue: Song[] = [...playlist.songs];
         let actualStartIndex = Math.max(0, Math.min(startIndex, songsToQueue.length - 1));

         if (state.isShuffling) {
             console.log("[Store] Shuffling playlist for queue.");
             // Shuffle the songs themselves, keep track of the original start song if needed
             const originalStartSong = songsToQueue[actualStartIndex];
             songsToQueue = shuffleArray(songsToQueue);
             // Find the new index of the original start song after shuffle, or just start from 0
             actualStartIndex = songsToQueue.findIndex(s => s.id === originalStartSong.id);
             if (actualStartIndex === -1) actualStartIndex = 0; // Fallback to start if somehow not found
         }

         const newQueue: QueueSong[] = songsToQueue.map(song => ({
             ...song,
             queueId: state._generateQueueId(),
             // playlistContextId: playlistId, // Optionally add context ID
         }));

         console.log(`[Store] Playing playlist "${playlist.name}". Queue set with ${newQueue.length} songs. Starting at index ${actualStartIndex}.`);

         return {
           queue: newQueue,
           currentQueueIndex: actualStartIndex,
           isPlaying: true,
           currentSongProgress: 0,
           currentSongDuration: 0,
           activePlaylistId: playlistId, // Also switch view
           isLoopingPlaylist: state.isLoopingPlaylist, // Persist loop setting
         };
      }),

      playSongInPlaylistContext: (song, playlistId) => {
         // Find the song's index in the specified playlist
         const playlist = get().playlists.find(p => p.id === playlistId);
         if (!playlist) return;
         const songIndex = playlist.songs.findIndex(s => s.id === song.id);
         if (songIndex === -1) return;

         // Delegate to playPlaylist starting from that index
         get().playPlaylist(playlistId, songIndex);
       },

      playSingleSong: (song) => set((state) => {
          const newQueueItem: QueueSong = { ...song, queueId: state._generateQueueId() };
          console.log("[Store] Playing single song. Queue set with 1 song.");
          return {
            queue: [newQueueItem],
            currentQueueIndex: 0,
            isPlaying: true,
            currentSongProgress: 0,
            currentSongDuration: 0,
            isShuffling: false, // Turn off shuffle for single play
            isLoopingPlaylist: false, // Turn off playlist loop
            // activePlaylistId remains unchanged
          };
      }),

     playNextSong: () => set((state) => {
        const { queue, currentQueueIndex, isLooping, isLoopingPlaylist, isShuffling } = state;
        if (queue.length === 0) return {}; // No songs in queue

        const currentSong = queue[currentQueueIndex];

        // 1. Handle single song loop
        if (isLooping && currentSong) {
            console.log("[Store] Looping current song.");
            if (playerRef.current) playerRef.current.seekTo(0);
             return { currentSongProgress: 0, isPlaying: true };
        }

        // 2. Calculate next index
        let nextIndex = currentQueueIndex + 1;

        // 3. Handle end of queue
        if (nextIndex >= queue.length) {
            if (isLoopingPlaylist) {
                console.log("[Store] End of queue, looping playlist.");
                nextIndex = 0; // Loop back to the start
                 // If shuffle is on AND looping playlist, reshuffle the queue? (Spotify behavior)
                 // For simplicity now, just loop back to index 0 of the current queue order.
            } else {
                console.log("[Store] End of queue, stopping playback.");
                return {
                    isPlaying: false,
                    // Optionally clear queue or keep it for manual replay? Keep it for now.
                    // currentQueueIndex: -1, // Keep index at last song? Or reset? Resetting might be confusing.
                     currentSongProgress: 0,
                     // currentSongDuration: 0 // Keep duration of last song?
                 };
            }
        }

        // 4. Check if next song exists (should always be true if nextIndex is valid)
        const nextSong = queue[nextIndex];
        if (!nextSong) {
            console.error("[Store] Play next: Could not find song at calculated index:", nextIndex);
             // This case should ideally not happen if logic is correct
             return { isPlaying: false };
        }

        console.log(`[Store] Playing next song in queue: "${nextSong.title}" at index ${nextIndex}.`);
        return {
            currentQueueIndex: nextIndex,
            isPlaying: true,
            currentSongProgress: 0,
            currentSongDuration: 0,
        };
    }),


    playPreviousSong: () => set((state) => {
        const { queue, currentQueueIndex, isLoopingPlaylist, currentSongProgress } = state;
        if (queue.length === 0) return {};

        // 1. Restart current song if progress > 3 seconds
        if (currentSongProgress > 3 && playerRef.current) {
             console.log("[Store] Play previous: Restarting current song.");
             playerRef.current.seekTo(0);
             return { currentSongProgress: 0, isPlaying: true };
        }

        // 2. Calculate previous index
        let prevIndex = currentQueueIndex - 1;

        // 3. Handle beginning of queue
        if (prevIndex < 0) {
            if (isLoopingPlaylist) {
                console.log("[Store] Beginning of queue, looping playlist to end.");
                prevIndex = queue.length - 1; // Loop to the end
            } else {
                 console.log("[Store] Beginning of queue, restarting first song.");
                 if (playerRef.current) playerRef.current.seekTo(0);
                 return { currentSongProgress: 0, isPlaying: true };
            }
        }

        // 4. Check if previous song exists
        const prevSong = queue[prevIndex];
        if (!prevSong) {
            console.error("[Store] Play previous: Could not find song at calculated index:", prevIndex);
            if (playerRef.current) playerRef.current.seekTo(0); // Restart current as fallback
             return { currentSongProgress: 0, isPlaying: true };
        }

        console.log(`[Store] Playing previous song in queue: "${prevSong.title}" at index ${prevIndex}.`);
        return {
            currentQueueIndex: prevIndex,
            isPlaying: true,
            currentSongProgress: 0,
            currentSongDuration: 0,
        };
    }),

      togglePlayPause: () => set((state) => {
          // Only allow playing if there's a song in the queue
          if (state.queue.length === 0 && !state.isPlaying) {
               console.log("[Store] Toggle play/pause: No song in queue, doing nothing.");
              return {};
          }
           if (state.queue.length > 0 && state.currentQueueIndex === -1 && !state.isPlaying) {
               // If queue exists but nothing selected, play the first song
                console.log("[Store] Toggle play/pause: Playing first song from queue.");
               return { isPlaying: true, currentQueueIndex: 0, currentSongProgress: 0, currentSongDuration: 0 };
           }

          const newState = !state.isPlaying;
          console.log(`[Store] Toggle play/pause: Setting isPlaying to ${newState}`);
          return { isPlaying: newState };
      }),

      toggleShuffle: () => set((state) => {
          const turningShuffleOn = !state.isShuffling;
          console.log(`[Store] Toggle shuffle: Setting isShuffling to ${turningShuffleOn}`);

          let newQueue = state.queue;
          let newCurrentQueueIndex = state.currentQueueIndex;

          if (turningShuffleOn && state.queue.length > 1) {
             // When turning shuffle ON, reshuffle the queue *except* the current song
             const currentSong = state.queue[state.currentQueueIndex];
             if (currentSong) {
                 let songsToShuffle = state.queue.filter(s => s.queueId !== currentSong.queueId);
                 songsToShuffle = shuffleArray(songsToShuffle);
                 newQueue = [currentSong, ...songsToShuffle]; // Place current song at the beginning
                 newCurrentQueueIndex = 0; // Current song is now at index 0
                 console.log("[Store] Shuffle On: Re-shuffled queue, keeping current song first.");
             } else {
                // No current song, just shuffle the whole queue
                newQueue = shuffleArray(state.queue);
                 newCurrentQueueIndex = 0; // Start from the new beginning
                 console.log("[Store] Shuffle On: Shuffled entire queue.");
             }
          } else if (!turningShuffleOn && state.queue.length > 0) {
             // When turning shuffle OFF, try to restore original playlist order IF the queue came from a playlist
             // This is complex. Simplification: Keep the current shuffled order for now.
             // User can replay the playlist to get the original order.
             console.log("[Store] Shuffle Off: Keeping current queue order.");
          }

          return {
              isShuffling: turningShuffleOn,
              queue: newQueue,
              currentQueueIndex: newCurrentQueueIndex,
          };
       }),

      toggleLoop: () => set((state) => {
           const newState = !state.isLooping;
           console.log(`[Store] Toggle loop song: Setting isLooping to ${newState}`);
           // If turning on single loop, ensure playlist loop is off
           return { isLooping: newState, ...(newState && { isLoopingPlaylist: false }) };
       }),

      toggleLoopPlaylist: () => set((state) => {
           const newState = !state.isLoopingPlaylist;
           console.log(`[Store] Toggle loop playlist: Setting isLoopingPlaylist to ${newState}`);
           // If turning on playlist loop, ensure single loop is off
           return { isLoopingPlaylist: newState, ...(newState && { isLooping: false }) };
       }),

      setCurrentSongProgress: (progress) => set((state) => {
        if (state.isPlaying || progress === 0) { // Allow setting progress if paused only if setting to 0 (e.g., on song change)
            const currentSong = state.queue[state.currentQueueIndex];
            const duration = state.currentSongDuration;
             if (currentSong && progress >= 0 && progress <= (duration || Infinity)) {
               return { currentSongProgress: progress };
             }
        }
        return {};
      }),

      setCurrentSongDuration: (duration) => set((state) => {
         const currentSong = state.queue[state.currentQueueIndex];
         if (currentSong) {
             return { currentSongDuration: duration > 0 ? duration : 0 };
         }
         return {};
      }),

      setVolume: (volume) => set({ volume: Math.max(0, Math.min(1, volume)), isMuted: volume <= 0 }), // Auto-mute if volume is 0
      toggleMute: () => set((state) => {
           const newMuteState = !state.isMuted;
           console.log(`[Store] Toggle mute: Setting isMuted to ${newMuteState}`);
           return { isMuted: newMuteState };
       }),

       clearQueue: () => set({ queue: [], currentQueueIndex: -1, isPlaying: false, currentSongProgress: 0, currentSongDuration: 0 }),

       removeSongFromQueue: (queueIdToRemove: string) => set((state) => {
         const initialQueueLength = state.queue.length;
         if (initialQueueLength === 0) return {};

         const removedSongIndex = state.queue.findIndex(q => q.queueId === queueIdToRemove);
         if (removedSongIndex === -1) return {}; // Not found

         const newQueue = state.queue.filter(q => q.queueId !== queueIdToRemove);
         let newCurrentQueueIndex = state.currentQueueIndex;
         let newIsPlaying = state.isPlaying;

         if (removedSongIndex === state.currentQueueIndex) {
            // If removing the currently playing song
            if (newQueue.length > 0) {
               // Move to the next song (or previous if removing last)
               newCurrentQueueIndex = Math.min(state.currentQueueIndex, newQueue.length - 1);
               console.log(`[Store] Removed current song from queue. Moving to index ${newCurrentQueueIndex}.`);
            } else {
               // Queue became empty
               newCurrentQueueIndex = -1;
               newIsPlaying = false;
               console.log("[Store] Removed last song from queue. Stopping playback.");
            }
         } else if (removedSongIndex < state.currentQueueIndex) {
            // If removing a song before the current one, adjust the index
            newCurrentQueueIndex--;
         }
          // Ensure index is valid
          if (newQueue.length === 0) newCurrentQueueIndex = -1;
          else newCurrentQueueIndex = Math.max(0, Math.min(newCurrentQueueIndex, newQueue.length - 1));


         return {
            queue: newQueue,
            currentQueueIndex: newCurrentQueueIndex,
            isPlaying: newIsPlaying,
            currentSongProgress: newIsPlaying ? state.currentSongProgress : 0,
            currentSongDuration: newIsPlaying ? state.currentSongDuration : 0,
         };
      }),

      reorderSongInQueue: (fromIndex, toIndex) => set((state) => {
         if (fromIndex < 0 || fromIndex >= state.queue.length || toIndex < 0 || toIndex >= state.queue.length) {
           return {}; // Invalid indices
         }

         const newQueue = Array.from(state.queue);
         const [movedItem] = newQueue.splice(fromIndex, 1);
         newQueue.splice(toIndex, 0, movedItem);

         let newCurrentQueueIndex = state.currentQueueIndex;

         // Update current index if it was affected by the move
         if (state.currentQueueIndex === fromIndex) {
           newCurrentQueueIndex = toIndex;
         } else if (fromIndex < state.currentQueueIndex && toIndex >= state.currentQueueIndex) {
           newCurrentQueueIndex--;
         } else if (fromIndex > state.currentQueueIndex && toIndex <= state.currentQueueIndex) {
           newCurrentQueueIndex++;
         }

         console.log(`[Store] Reordered queue. Moved from ${fromIndex} to ${toIndex}. New current index: ${newCurrentQueueIndex}`);
         return { queue: newQueue, currentQueueIndex: newCurrentQueueIndex };
       }),

       playFromQueueIndex: (index) => set((state) => {
         if (index < 0 || index >= state.queue.length) return {}; // Invalid index

          // If clicking the currently playing song, toggle play/pause instead? Or just restart? Restart for now.
          // if (index === state.currentQueueIndex && state.isPlaying) {
          //    get().togglePlayPause();
          //    return {};
          // }
           const targetSong = state.queue[index];
           console.log(`[Store] Playing from queue index ${index}: "${targetSong.title}"`);

          return {
             currentQueueIndex: index,
             isPlaying: true,
             currentSongProgress: 0,
             currentSongDuration: 0,
          };
       }),

    }),
    {
      name: 'youtune-playlist-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        // Persist playlists and UI settings
        playlists: state.playlists,
        activePlaylistId: state.activePlaylistId,
        volume: state.volume,
        isMuted: state.isMuted,
        isShuffling: state.isShuffling,
        isLooping: state.isLooping,
        isLoopingPlaylist: state.isLoopingPlaylist,
        // Don't persist playback state: queue, currentQueueIndex, isPlaying, currentSongProgress, currentSongDuration
      }),
      onRehydrateStorage: (state) => {
        console.log("[Store] Hydration starting...");
        return (persistedState, error) => {
          if (error) {
            console.error("[Store] Hydration error:", error);
          } else if (persistedState) {
            console.log("[Store] Hydration successful. Applying persisted state:", persistedState);

            // De-duplicate songs within each playlist on load
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

            // Initialize/Reset transient state
            persistedState.queue = [];
            persistedState.currentQueueIndex = -1;
            persistedState.isPlaying = false;
            persistedState.currentSongProgress = 0;
            persistedState.currentSongDuration = 0;

             // Validate activePlaylistId
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
             if (state) {
                // Initialize persisted state defaults
                state.playlists = [];
                state.activePlaylistId = null;
                state.volume = 0.8;
                state.isMuted = false;
                state.isShuffling = false;
                state.isLooping = false;
                state.isLoopingPlaylist = false;
                // Initialize transient state defaults
                state.queue = [];
                state.currentQueueIndex = -1;
                state.isPlaying = false;
                state.currentSongProgress = 0;
                state.currentSongDuration = 0;
             }
          }
        };
      },
    }
  )
);

// --- Player Reference ---
let playerRef: React.RefObject<ReactPlayer> | null = null;

export const setPlayerRef = (ref: React.RefObject<ReactPlayer>) => {
    playerRef = ref;
};

// --- Derive Current Song ---
// You can select this derived state in components:
// const currentSong = usePlaylistStore(state => state.queue[state.currentQueueIndex] || null);

// src/store/playlist-store.ts
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

  // Playlist context tracking for repopulating queue on loop/shuffle
  currentPlaylistContextId: string | null; // ID of the playlist the current queue is based on
  currentPlaylistContextStartIndex: number; // Original start index within the context playlist

  // Actions
  createPlaylist: (name: string) => void;
  deletePlaylist: (playlistId: string) => void;
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
  _rebuildQueueFromContext: (state: PlaylistState) => QueueSong[]; // Helper to rebuild queue
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
      currentPlaylistContextId: null,
      currentPlaylistContextStartIndex: 0,


      _generateQueueId: () => `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,

      // --- Playlist Management ---
      createPlaylist: (name) =>
        set((state) => {
          console.log('[Store] createPlaylist triggered with name:', name);
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
              console.log('[Store] Setting new active playlist ID:', newPlaylist.id);
          }
          console.log('[Store] createPlaylist finished. New state:', newStateUpdate);
          return newStateUpdate;
        }),

     deletePlaylist: (playlistId) =>
        set((state) => {
          console.log('[Store] deletePlaylist triggered for ID:', playlistId);
          const updatedPlaylists = state.playlists.filter((p) => p.id !== playlistId);
          let newActivePlaylistId = state.activePlaylistId;
          let newQueue = [...state.queue]; // Clone queue
          let newCurrentQueueIndex = state.currentQueueIndex;
          let newIsPlaying = state.isPlaying;
          let newContextId = state.currentPlaylistContextId;

          // If the deleted playlist was the one being *viewed*
          if (state.activePlaylistId === playlistId) {
            newActivePlaylistId = updatedPlaylists[0]?.id ?? null;
             console.log('[Store] Deleted active playlist. New active playlist ID:', newActivePlaylistId);
          }

          // If the deleted playlist was the context for the current queue
          if (state.currentPlaylistContextId === playlistId) {
              console.log('[Store] Deleted playlist was the current playback context. Clearing queue and stopping.');
              newQueue = [];
              newCurrentQueueIndex = -1;
              newIsPlaying = false;
              newContextId = null;
          } else {
              // Remove songs from the queue that belong ONLY to the deleted playlist context (less common scenario now)
              const initialQueueLength = newQueue.length;
              newQueue = newQueue.filter(qSong => qSong.playlistContextId !== playlistId);

              if (newQueue.length < initialQueueLength) {
                  console.log(`[Store] Removed ${initialQueueLength - newQueue.length} songs from queue belonging to deleted playlist ${playlistId}.`);
                  const currentSongRemoved = !newQueue.some(qSong => qSong.queueId === state.queue[state.currentQueueIndex]?.queueId);

                  if (currentSongRemoved) {
                      console.log('[Store] Currently playing song was removed due to playlist deletion.');
                      if (newQueue.length > 0) {
                          // If queue still has items, try to play the next logical one (usually index 0 after filtering)
                          newCurrentQueueIndex = 0;
                          newIsPlaying = true; // Keep playing if possible
                          console.log(`[Store] Moving to new queue index ${newCurrentQueueIndex}.`);
                      } else {
                          // Queue became empty
                          newCurrentQueueIndex = -1;
                          newIsPlaying = false;
                          newContextId = null; // Clear context if queue is empty
                          console.log('[Store] Queue became empty after playlist deletion.');
                      }
                  } else {
                      // Current song wasn't removed, but indices might need adjustment if songs *before* it were removed
                      const originalCurrentQueueId = state.queue[state.currentQueueIndex]?.queueId;
                      const newIndexForCurrent = newQueue.findIndex(qSong => qSong.queueId === originalCurrentQueueId);
                      if (newIndexForCurrent !== -1) {
                          newCurrentQueueIndex = newIndexForCurrent;
                          console.log(`[Store] Current song index adjusted to ${newCurrentQueueIndex} after playlist deletion.`);
                      } else {
                          // Should not happen if current song wasn't removed, but handle defensively
                          newCurrentQueueIndex = 0; // Fallback or handle error
                          if (newQueue.length === 0) {
                              newCurrentQueueIndex = -1;
                              newIsPlaying = false;
                              newContextId = null;
                          }
                          console.warn('[Store] Could not find current song in queue after filtering for playlist deletion. Resetting index.');
                      }
                  }
              }
          }


          const finalState = {
             playlists: updatedPlaylists,
             activePlaylistId: newActivePlaylistId,
             queue: newQueue,
             currentQueueIndex: newCurrentQueueIndex,
             isPlaying: newIsPlaying,
             currentSongProgress: newIsPlaying ? state.currentSongProgress : 0, // Reset progress if stopped
             currentSongDuration: newIsPlaying ? state.currentSongDuration : 0, // Reset duration if stopped
             currentPlaylistContextId: newContextId,
           };
           console.log('[Store] deletePlaylist finished. New state:', finalState);
          return finalState;
        }),

      renamePlaylist: (playlistId, newName) =>
        set((state) => {
          console.log(`[Store] renamePlaylist triggered for ID: ${playlistId}, new name: ${newName}`);
          const updatedPlaylists = state.playlists.map((p) =>
            p.id === playlistId ? { ...p, name: newName } : p
          );
          console.log('[Store] renamePlaylist finished.');
          return { playlists: updatedPlaylists };
        }),

      addSongToPlaylist: (playlistId, song) => {
        let songAdded = false;
        set((state) => {
          console.log(`[Store] addSongToPlaylist triggered for playlist ID: ${playlistId}, song ID: ${song.id}`);
          const playlistIndex = state.playlists.findIndex((p) => p.id === playlistId);
          if (playlistIndex === -1) {
            console.error(`[Store] Playlist with ID ${playlistId} not found.`);
            toast({ title: "Error", description: "Playlist not found.", variant: "destructive" });
            return state;
          }

          const playlist = state.playlists[playlistIndex];
          const songExists = playlist.songs.some((s) => s.id === song.id);

          if (songExists) {
             toast({
               title: 'Song Already Exists',
               description: `"${song.title}" is already in the playlist "${playlist.name}".`,
               variant: 'default',
             });
            songAdded = false;
            console.warn(`[Store] Song ID ${song.id} already exists in playlist ${playlistId}.`);
            return state;
          }

          const updatedSongs = [...playlist.songs, song];
          const updatedPlaylist = { ...playlist, songs: updatedSongs };
          const updatedPlaylists = [...state.playlists];
          updatedPlaylists[playlistIndex] = updatedPlaylist;
          songAdded = true;
          console.log(`[Store] Song ID ${song.id} added to playlist ${playlistId}.`);

           // Check if the added song should be immediately added to the queue
           // This happens if the modified playlist is the current playback context.
           if (state.currentPlaylistContextId === playlistId && state.queue.length > 0) {
               const newQueueItem: QueueSong = {
                   ...song,
                   queueId: state._generateQueueId(),
                   playlistContextId: playlistId,
               };
               let updatedQueue = [...state.queue];

               // Find the index of the last song from the current context playlist in the queue
                let lastContextSongIndex = -1;
                for (let i = updatedQueue.length - 1; i >= 0; i--) {
                  if (updatedQueue[i].playlistContextId === playlistId) {
                    lastContextSongIndex = i;
                    break;
                  }
                }

               // Insert the new song after the last song from the same context, or at the end if no context songs exist
               const insertionIndex = lastContextSongIndex !== -1 ? lastContextSongIndex + 1 : updatedQueue.length;
               updatedQueue.splice(insertionIndex, 0, newQueueItem);

               console.log(`[Store] Added song ${song.id} into the current queue at index ${insertionIndex} (context match).`);
               return { playlists: updatedPlaylists, queue: updatedQueue };
           }


          return { playlists: updatedPlaylists };
        });
        return songAdded;
      },

      removeSongFromPlaylist: (playlistId, songId) =>
        set((state) => {
          console.log(`[Store] removeSongFromPlaylist triggered for playlist ID: ${playlistId}, song ID: ${songId}`);
          let songRemovedFromQueue = false;
          const updatedPlaylists = state.playlists.map((p) => {
            if (p.id === playlistId) {
               const initialSongCount = p.songs.length;
               const updatedSongs = p.songs.filter((s) => s.id !== songId);
               if (updatedSongs.length < initialSongCount) {
                  console.log(`[Store] Removed song ${songId} from playlist ${playlistId}.`);
               }
               return { ...p, songs: updatedSongs };
            }
            return p;
          });

          // Also remove instances of this song *from the current queue* IF the current queue's context matches
          let newQueue = [...state.queue];
          let newCurrentQueueIndex = state.currentQueueIndex;
          let newIsPlaying = state.isPlaying;

          if (state.currentPlaylistContextId === playlistId) {
               const initialQueueLength = state.queue.length;
               const originalCurrentQueueId = state.queue[state.currentQueueIndex]?.queueId; // ID of the song playing before removal

               newQueue = state.queue.filter(queueSong => queueSong.id !== songId);
               songRemovedFromQueue = newQueue.length < initialQueueLength;

               if (songRemovedFromQueue) {
                   console.log(`[Store] Removed ${initialQueueLength - newQueue.length} instance(s) of song ${songId} from queue (context match).`);

                   // Find the new index of the song that *was* playing
                   const newIndexForOriginalCurrent = newQueue.findIndex(qSong => qSong.queueId === originalCurrentQueueId);

                   if (newIndexForOriginalCurrent !== -1) {
                       // The currently playing song wasn't the one removed, just update its index
                       newCurrentQueueIndex = newIndexForOriginalCurrent;
                       console.log(`[Store] Adjusted current queue index to ${newCurrentQueueIndex} after song removal.`);
                   } else {
                        // The currently playing song *was* removed
                        console.log(`[Store] Removed currently playing song (ID: ${songId}) from queue.`);
                        if (newQueue.length > 0) {
                             // Try to play the next available song (the one now at the index where the removed song was)
                            newCurrentQueueIndex = Math.min(state.currentQueueIndex, newQueue.length - 1); // Use the old index or the last valid index
                            if (newCurrentQueueIndex < 0) newCurrentQueueIndex = 0;
                            console.log(`[Store] Moving to next song in queue at index: ${newCurrentQueueIndex}`);
                        } else {
                            // Queue became empty
                            newCurrentQueueIndex = -1;
                            newIsPlaying = false;
                            console.log("[Store] Queue became empty after removing song.");
                        }
                   }
               }
           }


          const finalState = {
             playlists: updatedPlaylists,
             queue: newQueue,
             currentQueueIndex: newCurrentQueueIndex,
             isPlaying: newIsPlaying,
             currentSongProgress: newIsPlaying ? (songRemovedFromQueue && state.queue[state.currentQueueIndex]?.id === songId ? 0 : state.currentSongProgress) : 0,
             currentSongDuration: newIsPlaying ? (songRemovedFromQueue && state.queue[state.currentQueueIndex]?.id === songId ? 0 : state.currentSongDuration) : 0,
           };
            console.log('[Store] removeSongFromPlaylist finished. New state:', finalState);
          return finalState;
        }),

      reorderSongInPlaylist: (playlistId, fromIndex, toIndex) =>
         set((state) => {
           console.log(`[Store] reorderSongInPlaylist triggered for playlist ${playlistId}, from ${fromIndex} to ${toIndex}`);
           const playlistIndex = state.playlists.findIndex((p) => p.id === playlistId);
           if (playlistIndex === -1) {
               console.error(`[Store] Playlist ${playlistId} not found for reordering.`);
               return {};
           }

           const playlist = state.playlists[playlistIndex];
           if (fromIndex < 0 || fromIndex >= playlist.songs.length || toIndex < 0 || toIndex >= playlist.songs.length) {
              console.error(`[Store] Invalid indices for reordering in playlist ${playlistId}: from ${fromIndex}, to ${toIndex}`);
              return {};
           }
           const newSongs = Array.from(playlist.songs);
           const [movedItem] = newSongs.splice(fromIndex, 1);
           newSongs.splice(toIndex, 0, movedItem);

           const updatedPlaylists = [...state.playlists];
           updatedPlaylists[playlistIndex] = { ...playlist, songs: newSongs };
            console.log(`[Store] Playlist ${playlistId} reordered.`);

           // Rebuild queue only if the reordered playlist is the current context
           let updatedQueue = state.queue;
           let updatedIndex = state.currentQueueIndex;
           if (state.currentPlaylistContextId === playlistId) {
               console.log("[Store] Reordered playlist is current context. Rebuilding queue.");
               const currentQueueId = state.queue[state.currentQueueIndex]?.queueId; // Use queueId
               updatedQueue = state._rebuildQueueFromContext({ ...state, playlists: updatedPlaylists });

                // Find the new index of the song that was playing using its unique queueId
                updatedIndex = updatedQueue.findIndex(qSong => qSong.queueId === currentQueueId);

                if (updatedIndex === -1) { // If current song wasn't found (e.g., removed externally?), default to start
                  // Try finding based on song ID as a fallback, less reliable if duplicates exist
                  const currentSongId = state.queue.find(q => q.queueId === currentQueueId)?.id;
                  updatedIndex = updatedQueue.findIndex(qSong => qSong.id === currentSongId);
                  if (updatedIndex === -1) {
                      updatedIndex = 0; // Default to start if still not found
                      if (updatedQueue.length === 0) updatedIndex = -1;
                      console.warn("[Store] Current song not found in rebuilt queue after reorder. Resetting index.");
                  } else {
                      console.log("[Store] Found current song in rebuilt queue by ID fallback.");
                  }
               } else {
                  console.log(`[Store] Queue rebuilt. New current index: ${updatedIndex}`);
               }
           }

           return { playlists: updatedPlaylists, queue: updatedQueue, currentQueueIndex: updatedIndex };
         }),

      setActivePlaylistId: (playlistId) =>
        set((state) => {
           if (playlistId !== state.activePlaylistId) {
              console.log(`[Store] setActivePlaylistId triggered. Switching *viewed* playlist to: ${playlistId}`);
              return { activePlaylistId: playlistId };
           }
           console.log(`[Store] setActivePlaylistId triggered, but playlist ${playlistId} is already active. No change.`);
           return {};
        }),

       // --- Queue & Playback ---

       _rebuildQueueFromContext: (state: PlaylistState): QueueSong[] => {
           const { currentPlaylistContextId, playlists, isShuffling, currentPlaylistContextStartIndex } = state;
           console.log(`[Store _rebuildQueue] Rebuilding queue for context: ${currentPlaylistContextId}, shuffle: ${isShuffling}, start: ${currentPlaylistContextStartIndex}`);

           if (!currentPlaylistContextId) {
               console.log("[Store _rebuildQueue] No context ID, returning empty queue.");
               return [];
           }
           const playlist = playlists.find(p => p.id === currentPlaylistContextId);
           if (!playlist || playlist.songs.length === 0) {
               console.log(`[Store _rebuildQueue] Playlist ${currentPlaylistContextId} not found or empty. Returning empty queue.`);
               return [];
           }

           let songsToQueueSource: Song[] = [...playlist.songs];
           let songsForQueue: Song[] = [];
           let effectiveStartIndex = Math.max(0, Math.min(currentPlaylistContextStartIndex, songsToQueueSource.length - 1));

           if (isShuffling) {
               console.log("[Store _rebuildQueue] Shuffle is ON.");
               const targetSong = songsToQueueSource[effectiveStartIndex];
               const otherSongs = songsToQueueSource.filter((s, i) => i !== effectiveStartIndex);
               const shuffledOtherSongs = shuffleArray(otherSongs);
               songsForQueue = [targetSong, ...shuffledOtherSongs];
               console.log(`[Store _rebuildQueue] Shuffled queue built. Start song "${targetSong?.title}" is first.`);
           } else {
               console.log("[Store _rebuildQueue] Shuffle is OFF.");
               // Play from start index to end, then wrap around from beginning to start index - 1
               const part1 = songsToQueueSource.slice(effectiveStartIndex);
               const part2 = songsToQueueSource.slice(0, effectiveStartIndex);
               songsForQueue = [...part1, ...part2];
               console.log(`[Store _rebuildQueue] Linear queue built starting from index ${effectiveStartIndex}.`);
           }

           const newQueue = songsForQueue.map(song => ({
               ...song,
               queueId: state._generateQueueId(), // Generate new queue IDs
               playlistContextId: currentPlaylistContextId,
           }));

           console.log(`[Store _rebuildQueue] Rebuilt queue has ${newQueue.length} songs.`);
           return newQueue;
       },


       playPlaylist: (playlistId, startIndex = 0) => set((state) => {
          console.log(`[Store playPlaylist] Triggered for playlist ID: ${playlistId}, startIndex: ${startIndex}`);
          const playlist = state.playlists.find((p) => p.id === playlistId);
          if (!playlist) {
              console.error(`[Store playPlaylist] Playlist ${playlistId} not found.`);
              toast({ title: "Error", description: "Playlist not found.", variant: "destructive" });
              return {};
          }
          if (playlist.songs.length === 0) {
              console.warn(`[Store playPlaylist] Playlist ${playlistId} is empty. Cannot play.`);
              toast({ title: "Empty Playlist", description: "Cannot play an empty playlist.", variant: "default" });
              return {};
          }

          // Set the context *before* building the queue
          const newStateWithContext = {
            ...state,
            currentPlaylistContextId: playlistId,
            currentPlaylistContextStartIndex: startIndex,
          };

          const newQueue = state._rebuildQueueFromContext(newStateWithContext); // Use helper

          if (newQueue.length === 0) {
              console.error("[Store playPlaylist] Failed to build queue from context. Aborting.");
              return { currentPlaylistContextId: null }; // Reset context if queue build fails
          }

          console.log(`[Store playPlaylist] Setting new queue from playlist "${playlist.name}". ${newQueue.length} songs. Starting at index 0.`);

          const finalState = {
            queue: newQueue,
            currentQueueIndex: 0, // Always start at 0 in the rebuilt queue
            isPlaying: true,
            currentSongProgress: 0,
            currentSongDuration: 0,
            currentPlaylistContextId: playlistId, // Ensure context is set
            currentPlaylistContextStartIndex: startIndex,
          };
          console.log('[Store playPlaylist] Finished. New state:', finalState);
          return finalState;
       }),

      playSongInPlaylistContext: (song, playlistId) => {
          console.log(`[Store playSongInPlaylistContext] Triggered for song ID: ${song.id}, playlist ID: ${playlistId}`);
         const playlist = get().playlists.find(p => p.id === playlistId);
         if (!playlist) {
              console.error(`[Store playSongInPlaylistContext] Playlist ${playlistId} not found.`);
              toast({ title: "Error", description: "Playlist not found.", variant: "destructive" });
              return;
          }
         const songIndex = playlist.songs.findIndex(s => s.id === song.id);
         if (songIndex === -1) {
             console.error(`[Store playSongInPlaylistContext] Song ${song.id} not found within playlist ${playlistId}.`);
              toast({ title: "Error", description: "Song not found in this playlist.", variant: "destructive" });
             return;
         }
          console.log(`[Store playSongInPlaylistContext] Found song ${song.id} at index ${songIndex} in playlist ${playlistId}. Delegating to playPlaylist.`);
         get().playPlaylist(playlistId, songIndex);
       },

      playSingleSong: (song) => set((state) => {
          console.log(`[Store playSingleSong] Triggered for song ID: ${song.id}`);
          const newQueueItem: QueueSong = {
              ...song,
              queueId: state._generateQueueId(),
          };
          console.log("[Store playSingleSong] Setting queue with 1 song (single play mode).");
          const finalState = {
            queue: [newQueueItem],
            currentQueueIndex: 0,
            isPlaying: true,
            currentSongProgress: 0,
            currentSongDuration: 0,
            isShuffling: false, // Turn off shuffle
            isLoopingPlaylist: false, // Turn off playlist loop
            currentPlaylistContextId: null, // Clear playlist context
            currentPlaylistContextStartIndex: 0,
          };
           console.log('[Store playSingleSong] Finished. New state:', finalState);
          return finalState;
      }),

      playNextSong: () => set((state) => {
        console.log("[Store playNextSong] Triggered.");
        const { queue, currentQueueIndex, isLooping, isLoopingPlaylist, _rebuildQueueFromContext } = state;

        if (currentQueueIndex === -1) {
            console.warn("[Store playNextSong] No song currently playing.");
            return {};
        }

        // 1. Handle single song loop
        if (isLooping) {
            console.log("[Store playNextSong] Looping current song.");
            seekPlayerTo(0); // Tell player to seek to 0
            return { currentSongProgress: 0, isPlaying: true }; // Update store state
        }

        let newQueue = [...queue];
        let nextIndex = -1;

        // Remove the song that just finished/was skipped from the *start* of the queue
        if (newQueue.length > 0) {
            const finishedSong = newQueue.shift(); // Remove the first element
            console.log(`[Store playNextSong] Removed completed/skipped song: "${finishedSong?.title}" from start of queue.`);
        } else {
             console.log("[Store playNextSong] Queue was already empty after attempting shift.");
             return { isPlaying: false, currentQueueIndex: -1, currentSongProgress: 0, currentSongDuration: 0 };
        }


        // Check if the queue is now empty
        if (newQueue.length === 0) {
            console.log("[Store playNextSong] Queue is now empty.");
            if (isLoopingPlaylist) {
                console.log("[Store playNextSong] Playlist Loop is ON. Rebuilding queue from context.");
                const rebuiltQueue = _rebuildQueueFromContext(state); // Use helper

                if (rebuiltQueue.length > 0) {
                    const nextSong = rebuiltQueue[0];
                    console.log(`[Store playNextSong] Looping: Playing first song "${nextSong.title}" of rebuilt queue.`);
                    return {
                        queue: rebuiltQueue, // Replace queue with the rebuilt one
                        currentQueueIndex: 0, // Start from the beginning
                        isPlaying: true,
                        currentSongProgress: 0,
                        currentSongDuration: 0,
                    };
                } else {
                    console.warn("[Store playNextSong] Loop enabled but rebuilt queue is empty. Stopping playback.");
                    return { queue: [], isPlaying: false, currentQueueIndex: -1, currentSongProgress: 0, currentSongDuration: 0 };
                }
            } else {
                console.log("[Store playNextSong] Playlist Loop is OFF. Queue empty. Stopping playback.");
                return {
                    queue: [], // Queue is empty
                    isPlaying: false,
                    currentQueueIndex: -1, // Reset index
                    currentSongProgress: 0,
                    currentSongDuration: 0,
                };
            }
        } else {
            // If the queue is not empty, play the song that is now at index 0
            nextIndex = 0;
            const nextSong = newQueue[nextIndex];
            console.log(`[Store playNextSong] Playing next song in queue: "${nextSong.title}" at new index 0.`);
            return {
                queue: newQueue, // Update queue (song was removed)
                currentQueueIndex: nextIndex,
                isPlaying: true,
                currentSongProgress: 0,
                currentSongDuration: 0,
            };
        }
    }),


    playPreviousSong: () => set((state) => {
        console.log("[Store playPreviousSong] Triggered.");
        const { queue, currentQueueIndex, isLoopingPlaylist, currentSongProgress, _rebuildQueueFromContext } = state;

         // Previous song logic is less common in Spotify-like queues (usually restarts or relies on history)
         // For simplicity, we'll just restart the current song if > 3 seconds, otherwise do nothing substantial
         // A more complex implementation would involve a separate 'history' stack.

        if (queue.length === 0 || currentQueueIndex === -1) {
             console.warn("[Store playPreviousSong] Queue is empty or no song playing.");
             return {};
        }

        // If more than 3 seconds into the song, just restart it
        if (currentSongProgress > 3) {
             console.log("[Store playPreviousSong] Restarting current song (over 3s played).");
             seekPlayerTo(0);
             return { currentSongProgress: 0, isPlaying: true }; // Update store state
        } else {
            // If less than 3 seconds, default behavior is often to restart anyway, or potentially go to actual previous if history was tracked.
            // We'll just restart for now.
            console.log("[Store playPreviousSong] Restarting current song (under 3s played).");
             seekPlayerTo(0);
             return { currentSongProgress: 0, isPlaying: true };
        }

         /* // --- More complex 'true previous' logic (requires history tracking, omitted for now) ---
         // If less than 3 seconds, attempt to play the actual previous song from history
         if (state.playHistory.length > 0) {
             const previousSongFromHistory = state.playHistory.pop(); // Get last played song
             const currentSong = queue[currentQueueIndex];

             // Add current song back to the start of the *main* queue (it will be played after the history song)
             const newQueue = [currentSong, ...queue];
             // Put the song from history at the very beginning to play now
             const queueWithHistory = [previousSongFromHistory, ...newQueue];

             console.log(`[Store playPreviousSong] Playing previous song from history: "${previousSongFromHistory.title}"`);
             return {
                 queue: queueWithHistory,
                 currentQueueIndex: 0, // Play the history song now
                 isPlaying: true,
                 currentSongProgress: 0,
                 currentSongDuration: 0,
                 playHistory: [...state.playHistory] // Update history (removed one)
             };
         } else {
             // No history, just restart the current song
             console.log("[Store playPreviousSong] No history, restarting current song.");
             seekPlayerTo(0);
             return { currentSongProgress: 0, isPlaying: true };
         }
         */
    }),


      togglePlayPause: () => set((state) => {
          console.log("[Store togglePlayPause] Triggered.");
          if (state.queue.length === 0 && !state.isPlaying) {
               console.warn("[Store togglePlayPause] No song in queue, cannot play.");
              return {};
          }
           if (state.queue.length > 0 && state.currentQueueIndex === -1 && !state.isPlaying) {
                console.log("[Store togglePlayPause] Queue exists but nothing selected. Playing first song.");
               return { isPlaying: true, currentQueueIndex: 0, currentSongProgress: 0, currentSongDuration: 0 };
           }

          const newState = !state.isPlaying;
          console.log(`[Store togglePlayPause] Setting isPlaying to ${newState}`);
          return { isPlaying: newState };
      }),

    toggleShuffle: () => set((state) => {
        const turningShuffleOn = !state.isShuffling;
        console.log(`[Store toggleShuffle] Triggered. Setting isShuffling to ${turningShuffleOn}`);

         // Rebuild the queue based on the new shuffle state and current context
        const rebuiltQueue = state._rebuildQueueFromContext({ ...state, isShuffling: turningShuffleOn });

        let newCurrentQueueIndex = -1;
        if (rebuiltQueue.length > 0) {
            // Find the currently playing song in the *new* queue order using queueId
            const currentQueueId = state.queue[state.currentQueueIndex]?.queueId;
            newCurrentQueueIndex = rebuiltQueue.findIndex(qSong => qSong.queueId === currentQueueId);

            // If the current song isn't found (shouldn't happen if context is valid), default to 0
            if (newCurrentQueueIndex === -1) {
                console.warn(`[Store toggleShuffle] Current queue ID ${currentQueueId} not found in rebuilt queue. Defaulting to index 0.`);
                newCurrentQueueIndex = 0;
            }
             console.log(`[Store toggleShuffle] Queue rebuilt with shuffle ${turningShuffleOn}. New index for current song: ${newCurrentQueueIndex}.`);
        } else {
             console.log("[Store toggleShuffle] Rebuilt queue is empty.");
        }


        return {
            isShuffling: turningShuffleOn,
            queue: rebuiltQueue,
            currentQueueIndex: newCurrentQueueIndex,
             isPlaying: rebuiltQueue.length > 0 ? state.isPlaying : false, // Stop if queue becomes empty
        };
    }),


      toggleLoop: () => set((state) => {
           const newState = !state.isLooping;
           console.log(`[Store toggleLoop] Triggered. Setting single song loop to ${newState}`);
           // If turning single loop ON, turn playlist loop OFF
           const finalState = { isLooping: newState, ...(newState && { isLoopingPlaylist: false }) };
           console.log('[Store toggleLoop] Finished. New state:', finalState);
           return finalState;
       }),

      toggleLoopPlaylist: () => set((state) => {
           const newState = !state.isLoopingPlaylist;
           console.log(`[Store toggleLoopPlaylist] Triggered. Setting playlist loop to ${newState}`);
           // If turning playlist loop ON, turn single loop OFF
           const finalState = { isLoopingPlaylist: newState, ...(newState && { isLooping: false }) };
           console.log('[Store toggleLoopPlaylist] Finished. New state:', finalState);
           return finalState;
       }),

       setCurrentSongProgress: (progress) => set((state) => {
           const currentSong = state.queue[state.currentQueueIndex];
           if (currentSong && progress >= 0) {
               const duration = state.currentSongDuration || Infinity;
               const clampedProgress = Math.min(progress, duration);
               // Only update state if the value actually changes to avoid unnecessary re-renders
               if (clampedProgress !== state.currentSongProgress) {
                 return { currentSongProgress: clampedProgress };
               }
           }
           return {};
         }),

      setCurrentSongDuration: (duration) => set((state) => {
         const currentSong = state.queue[state.currentQueueIndex];
         const validDuration = duration > 0 ? duration : 0;
         if (currentSong && validDuration !== state.currentSongDuration) {
             // Reset progress if duration becomes 0 (e.g., on song change before new duration arrives)
             const newProgress = validDuration > 0 ? state.currentSongProgress : 0;
             return { currentSongDuration: validDuration, currentSongProgress: newProgress };
         }
         return {};
      }),

      setVolume: (volume) => set((state) => {
          const newVolume = Math.max(0, Math.min(1, volume));
          const explicitlyUnmuted = state.isMuted && newVolume > 0;
          const autoMuted = newVolume <= 0 && !state.isMuted;
          const newMuteState = explicitlyUnmuted ? false : (autoMuted ? true : state.isMuted);

          if (newVolume !== state.volume || newMuteState !== state.isMuted) {
            console.log(`[Store setVolume] New volume: ${newVolume}. New mute state: ${newMuteState}`);
            return { volume: newVolume, isMuted: newMuteState };
          }
          return {};
      }),

      toggleMute: () => set((state) => {
           const newMuteState = !state.isMuted;
           console.log(`[Store toggleMute] Setting isMuted to ${newMuteState}`);
           const newVolume = !newMuteState && state.volume === 0 ? 0.1 : state.volume;
           return { isMuted: newMuteState, volume: newVolume };
       }),

       clearQueue: () => set((state) => {
            console.log("[Store clearQueue] Triggered.");
            const finalState = {
                queue: [],
                currentQueueIndex: -1,
                isPlaying: false,
                currentSongProgress: 0,
                currentSongDuration: 0,
                currentPlaylistContextId: null, // Clear context
                currentPlaylistContextStartIndex: 0,
             };
             console.log('[Store clearQueue] Finished. New state:', finalState);
            return finalState;
        }),

       removeSongFromQueue: (queueIdToRemove: string) => set((state) => {
         console.log(`[Store removeSongFromQueue] Triggered for queue ID: ${queueIdToRemove}`);
         const initialQueueLength = state.queue.length;
         if (initialQueueLength === 0) {
              console.warn("[Store removeSongFromQueue] Queue is already empty.");
              return {};
         }

         const removedSongIndex = state.queue.findIndex(q => q.queueId === queueIdToRemove);
         if (removedSongIndex === -1) {
             console.warn(`[Store removeSongFromQueue] Song with queue ID ${queueIdToRemove} not found in queue.`);
             return {};
         }

         const newQueue = state.queue.filter(q => q.queueId !== queueIdToRemove);
         let newCurrentQueueIndex = state.currentQueueIndex;
         let newIsPlaying = state.isPlaying;
         let newContextId = state.currentPlaylistContextId;

         console.log(`[Store removeSongFromQueue] Removed song at index ${removedSongIndex}. New queue length: ${newQueue.length}`);

         // Adjust the currentQueueIndex based on the Spotify-like model (index 0 is always playing)
         if (removedSongIndex === 0) { // If the currently playing song was removed
             console.log("[Store removeSongFromQueue] Removed the currently playing song.");
             if (newQueue.length > 0) {
                 // The next song automatically becomes index 0
                 newCurrentQueueIndex = 0;
                 console.log(`[Store removeSongFromQueue] Moving to the new song at index 0.`);
             } else {
                 // Queue became empty
                 newCurrentQueueIndex = -1;
                 newIsPlaying = false;
                 newContextId = null; // Clear context if queue becomes empty
                 console.log("[Store removeSongFromQueue] Queue became empty after removal.");
             }
         } else {
             // If a song *after* the current one was removed, the index doesn't need to change
             // because the current song remains at index 0.
             console.log("[Store removeSongFromQueue] Removed a song later in the queue. Current index remains 0.");
             newCurrentQueueIndex = 0; // Explicitly set to 0, as it's the playing index
         }

          // Ensure index is valid after potential adjustments
          if (newQueue.length === 0) {
              newCurrentQueueIndex = -1;
              newIsPlaying = false; // Stop playing if queue is empty
              newContextId = null;
          } else {
               newCurrentQueueIndex = 0; // Always 0 if queue is not empty
          }


         const finalState = {
            queue: newQueue,
            currentQueueIndex: newCurrentQueueIndex,
            isPlaying: newIsPlaying,
            currentPlaylistContextId: newContextId,
            // Reset progress/duration only if stopping playback or if the current song was removed (index became 0 or -1)
            currentSongProgress: newIsPlaying ? (removedSongIndex === 0 ? 0 : state.currentSongProgress) : 0,
            currentSongDuration: newIsPlaying ? (removedSongIndex === 0 ? 0 : state.currentSongDuration) : 0,
         };
          console.log('[Store removeSongFromQueue] Finished. New state:', finalState);
         return finalState;
      }),

      reorderSongInQueue: (fromIndex, toIndex) => set((state) => {
          console.log(`[Store reorderSongInQueue] Triggered. From ${fromIndex} to ${toIndex}.`);
         if (fromIndex < 0 || fromIndex >= state.queue.length || toIndex < 0 || toIndex >= state.queue.length) {
            console.error(`[Store reorderSongInQueue] Invalid indices for queue reorder: from ${fromIndex}, to ${toIndex}`);
           return {};
         }
         // Cannot move the currently playing song (index 0)
         if (fromIndex === 0) {
              console.warn("[Store reorderSongInQueue] Cannot reorder the currently playing song (index 0).");
              return {};
         }
         // Cannot move a song to index 0
         if (toIndex === 0) {
              console.warn("[Store reorderSongInQueue] Cannot move a song to index 0.");
              return {};
         }


         const newQueue = Array.from(state.queue);
         const [movedItem] = newQueue.splice(fromIndex, 1);
         newQueue.splice(toIndex, 0, movedItem);

         // The currentQueueIndex remains 0 because the currently playing song is never moved.
         const newCurrentQueueIndex = 0;

         const finalState = { queue: newQueue, currentQueueIndex: newCurrentQueueIndex };
          console.log('[Store reorderSongInQueue] Finished. New state:', finalState);
         return finalState;
       }),

       playFromQueueIndex: (index) => set((state) => {
           console.log(`[Store playFromQueueIndex] Triggered with index: ${index}`);
         if (index < 0 || index >= state.queue.length) {
              console.error(`[Store playFromQueueIndex] Invalid queue index: ${index}. Queue length: ${state.queue.length}`);
              return {};
         }
         if (index === 0 && state.isPlaying) { // Check against index 0
             console.log("[Store playFromQueueIndex] Already playing this song. No change.");
             return {}; // Already playing this index
         }

           const targetSong = state.queue[index];
           console.log(`[Store playFromQueueIndex] Playing song "${targetSong.title}" from queue index ${index}.`);

           // Move the selected song to the front of the queue
           const newQueue = [...state.queue];
           const [playedSong] = newQueue.splice(index, 1);
           newQueue.unshift(playedSong);

           console.log(`[Store playFromQueueIndex] Moved song to index 0.`);

          const finalState = {
             queue: newQueue,
             currentQueueIndex: 0, // Always play from index 0
             isPlaying: true,
             currentSongProgress: 0,
             currentSongDuration: 0,
          };
           console.log('[Store playFromQueueIndex] Finished. New state:', finalState);
          return finalState;
       }),

    }),
    {
      name: 'youtune-playlist-storage-v3', // Incremented version for queue logic change
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        playlists: state.playlists,
        activePlaylistId: state.activePlaylistId,
        volume: state.volume,
        isMuted: state.isMuted,
        isShuffling: state.isShuffling,
        isLooping: state.isLooping,
        isLoopingPlaylist: state.isLoopingPlaylist,
        // Persist context information
        currentPlaylistContextId: state.currentPlaylistContextId,
        currentPlaylistContextStartIndex: state.currentPlaylistContextStartIndex,
      }),
      version: 3, // Increment version for queue logic change
       migrate: (persistedState: any, version: number) => {
         console.log(`[Store Migrate] Attempting migration from version ${version}. Current version: 3`);
         if (version < 1) {
              console.log("[Store Migrate] Migrating from version < 1. No specific actions needed for base structure.");
         }
         if (version < 2) {
              console.log("[Store Migrate] Migrating from version < 2. Adding default context fields.");
              persistedState.currentPlaylistContextId = null;
              persistedState.currentPlaylistContextStartIndex = 0;
         }
         if (version < 3) {
              console.log("[Store Migrate] Migrating from version < 3. Resetting queue state due to logic change.");
              // Reset queue and related playback state because the logic changed significantly
              persistedState.queue = [];
              persistedState.currentQueueIndex = -1;
              persistedState.isPlaying = false;
              persistedState.currentSongProgress = 0;
              persistedState.currentSongDuration = 0;
              // Keep context ID if valid, reset start index maybe? Or keep it.
              // Let's keep context ID but reset start index as it's less relevant now.
              persistedState.currentPlaylistContextStartIndex = 0;
         }
         // Add more migration steps for future versions here
         // if (version < 4) { ... }

         console.log("[Store Migrate] Migration finished.");
         return persistedState as PlaylistState;
       },
       onRehydrateStorage: (state) => {
        console.log("[Store] Hydration starting...");
        return (persistedState, error) => {
          if (error) {
            console.error("[Store] Hydration error:", error);
          } else if (persistedState) {
            console.log("[Store] Hydration successful. Applying persisted state:", persistedState);

            // De-duplicate songs within each playlist on load
             const dedupedPlaylists = persistedState.playlists.map(playlist => {
                 if (!playlist || !Array.isArray(playlist.songs)) {
                     console.warn(`[Store Rehydrate] Playlist ${playlist?.id} has invalid 'songs' property. Resetting songs.`);
                     return { ...playlist, songs: [] };
                 }
               const uniqueSongs = new Map<string, Song>();
               playlist.songs.forEach(song => {
                 if (song && song.id) { // Basic check for valid song object
                     if (!uniqueSongs.has(song.id)) {
                       uniqueSongs.set(song.id, song);
                     } else {
                       console.warn(`[Store Rehydrate] Duplicate song ID ${song.id} ("${song.title}") removed from playlist ${playlist.id} ("${playlist.name}").`);
                     }
                 } else {
                     console.warn(`[Store Rehydrate] Invalid song object found in playlist ${playlist.id}. Skipping.`);
                 }
               });
               return { ...playlist, songs: Array.from(uniqueSongs.values()) };
             });
             persistedState.playlists = dedupedPlaylists;

            // Initialize/Reset transient state (Queue, Playback)
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
                 console.log(`[Store Rehydrate] Active playlist ID reset to: ${persistedState.activePlaylistId}`);
             }

             // Validate currentPlaylistContextId
             let contextIdIsValid = false;
             if (persistedState.currentPlaylistContextId) {
                  contextIdIsValid = persistedState.playlists.some(p => p.id === persistedState.currentPlaylistContextId);
             }
              if (!contextIdIsValid) {
                  persistedState.currentPlaylistContextId = null;
                  persistedState.currentPlaylistContextStartIndex = 0;
                  console.log(`[Store Rehydrate] Playback context ID was invalid, reset.`);
              }


            console.log("[Store] Transient state reset complete after hydration.");
          } else {
             console.log("[Store] No persisted state found. Initializing with defaults.");
             if (state) {
                state.playlists = [];
                state.activePlaylistId = null;
                state.volume = 0.8;
                state.isMuted = false;
                state.isShuffling = false;
                state.isLooping = false;
                state.isLoopingPlaylist = false;
                state.queue = [];
                state.currentQueueIndex = -1;
                state.isPlaying = false;
                state.currentSongProgress = 0;
                state.currentSongDuration = 0;
                state.currentPlaylistContextId = null;
                state.currentPlaylistContextStartIndex = 0;
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

// --- Derived State Hook ---
// Gets the *currently playing* song (always at index 0 if playing)
export const useCurrentSong = () => {
  return usePlaylistStore((state) => state.queue[0] ?? null); // Index 0 is the current song
};

// Gets the *entire upcoming queue* (excluding the currently playing song)
export const useUpcomingQueue = () => {
  return usePlaylistStore((state) => state.queue.slice(1)); // All songs after index 0
};


// Hook to get the playlist context ID of the currently playing song
export const useCurrentSongPlaylistContext = () => {
   return usePlaylistStore((state) => state.currentPlaylistContextId);
};


// Helper function to manage the player's seekTo method
export const seekPlayerTo = (seconds: number, type: 'seconds' | 'fraction' = 'seconds') => {
    if (playerRef?.current) {
        playerRef.current.seekTo(seconds, type);
         // Immediately update store progress to reflect the seek
         const duration = usePlaylistStore.getState().currentSongDuration;
         if (duration > 0) {
             const progressSeconds = type === 'seconds' ? seconds : seconds * duration;
             usePlaylistStore.setState({ currentSongProgress: Math.max(0, Math.min(progressSeconds, duration)) });
         } else {
              usePlaylistStore.setState({ currentSongProgress: 0 });
         }
         console.log(`[Player Control] seekPlayerTo called: ${seconds} (${type})`);
    } else {
        console.warn("[Player Control] Player ref not available for seekTo.");
    }
};

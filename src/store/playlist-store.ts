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

          // If the deleted playlist was the one being *viewed*
          if (state.activePlaylistId === playlistId) {
            newActivePlaylistId = updatedPlaylists[0]?.id ?? null;
             console.log('[Store] Deleted active playlist. New active playlist ID:', newActivePlaylistId);
          }

          // Remove songs from the queue that belong ONLY to the deleted playlist context
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
                    newIsPlaying = true;
                    console.log(`[Store] Moving to new queue index ${newCurrentQueueIndex}.`);
                } else {
                    // Queue became empty
                    newCurrentQueueIndex = -1;
                    newIsPlaying = false;
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
                      }
                     console.warn('[Store] Could not find current song in queue after filtering for playlist deletion. Resetting index.');
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

          // If the playlist being modified is the source of the *currently playing* song's context, add it to the queue
           const currentSong = state.queue[state.currentQueueIndex];
           if (currentSong?.playlistContextId === playlistId && !state.isShuffling) { // Only add if not shuffling (shuffle adds all at once)
               const newQueueItem: QueueSong = {
                   ...song,
                   queueId: state._generateQueueId(),
                   playlistContextId: playlistId,
               };
               let updatedQueue = [...state.queue];
               // Add after the current song if shuffle is off
               updatedQueue.splice(state.currentQueueIndex + 1, 0, newQueueItem);
               console.log(`[Store] Added song ${song.id} to the queue after current song.`);
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

          // Also remove instances of this song *from this specific playlist context* from the queue
          const initialQueueLength = state.queue.length;
          const newQueue = state.queue.filter(queueSong => !(queueSong.id === songId && queueSong.playlistContextId === playlistId));
          songRemovedFromQueue = newQueue.length < initialQueueLength;

          let newCurrentQueueIndex = state.currentQueueIndex;
          let newIsPlaying = state.isPlaying;

          if (songRemovedFromQueue) {
              console.log(`[Store] Removed ${initialQueueLength - newQueue.length} instance(s) of song ${songId} (context ${playlistId}) from queue.`);
              const currentQueueSong = state.queue[state.currentQueueIndex];

              // If the removed song WAS the currently playing song AND from the same context
              if (currentQueueSong?.id === songId && currentQueueSong?.playlistContextId === playlistId) {
                  console.log(`[Store] Removed currently playing song (ID: ${songId}, Context: ${playlistId}) from queue.`);
                  if (newQueue.length > 0) {
                     // Try to play the next available song in the modified queue
                     newCurrentQueueIndex = Math.min(state.currentQueueIndex, newQueue.length - 1);
                     // If the removed song was the last one, this index might become -1, handle below
                      if (newCurrentQueueIndex < 0) newCurrentQueueIndex = 0; // Should not happen if newQueue.length > 0
                     console.log(`[Store] Moving to next song in queue at index: ${newCurrentQueueIndex}`);
                  } else {
                     // Queue became empty
                     newCurrentQueueIndex = -1;
                     newIsPlaying = false;
                      console.log("[Store] Queue became empty after removing song.");
                  }
              } else {
                  // If the removed song was NOT the current one, adjust the index if needed
                   // Find original indices of removed songs from this context
                   const removedIndices = state.queue.reduce((acc, qSong, index) => {
                       if (qSong.id === songId && qSong.playlistContextId === playlistId) {
                           acc.push(index);
                       }
                       return acc;
                   }, [] as number[]);

                   // Count how many removed songs were before the current index
                   const removedBeforeCurrent = removedIndices.filter(index => index < state.currentQueueIndex).length;
                   if (removedBeforeCurrent > 0) {
                       newCurrentQueueIndex -= removedBeforeCurrent; // Adjust index back
                        console.log(`[Store] Adjusted current queue index down by ${removedBeforeCurrent}. New index: ${newCurrentQueueIndex}`);
                   }
                   // Ensure index is valid after adjustment
                   if (newQueue.length === 0) {
                       newCurrentQueueIndex = -1;
                   } else {
                       newCurrentQueueIndex = Math.max(0, Math.min(newCurrentQueueIndex, newQueue.length - 1));
                   }
              }
          }


          const finalState = {
             playlists: updatedPlaylists,
             queue: newQueue,
             currentQueueIndex: newCurrentQueueIndex,
             isPlaying: newIsPlaying,
             currentSongProgress: newIsPlaying ? state.currentSongProgress : 0,
             currentSongDuration: newIsPlaying ? state.currentSongDuration : 0,
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

           return { playlists: updatedPlaylists };
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

      playPlaylist: (playlistId, startIndex = 0) => set((state) => {
         console.log(`[Store] playPlaylist triggered for playlist ID: ${playlistId}, startIndex: ${startIndex}`);
         const playlist = state.playlists.find((p) => p.id === playlistId);
         if (!playlist) {
             console.error(`[Store] Playlist ${playlistId} not found.`);
             toast({ title: "Error", description: "Playlist not found.", variant: "destructive" });
             return {};
         }
          if (playlist.songs.length === 0) {
               console.warn(`[Store] Playlist ${playlistId} is empty. Cannot play.`);
               toast({ title: "Empty Playlist", description: "Cannot play an empty playlist.", variant: "default" });
               return {};
           }


         let songsToQueue: Song[] = [...playlist.songs];
         let actualStartIndex = Math.max(0, Math.min(startIndex, songsToQueue.length - 1));

         if (state.isShuffling) {
             console.log("[Store] Shuffle is ON. Shuffling playlist before adding to queue.");
             const originalStartSong = songsToQueue[actualStartIndex];
             // Find the start song first
             // Shuffle the rest
             let restOfSongs = songsToQueue.filter((s, i) => i !== actualStartIndex);
             restOfSongs = shuffleArray(restOfSongs);
             // Combine: start song first, then shuffled rest
             songsToQueue = [originalStartSong, ...restOfSongs];
             actualStartIndex = 0; // Always start at index 0 when shuffling like this
             console.log(`[Store] Shuffled queue. Start song "${originalStartSong.title}" is at index 0.`);
         }

         const newQueue: QueueSong[] = songsToQueue.map(song => ({
             ...song,
             queueId: state._generateQueueId(),
             playlistContextId: playlistId, // Attach context ID
         }));

         console.log(`[Store] Setting new queue from playlist "${playlist.name}". ${newQueue.length} songs. Starting at index ${actualStartIndex}.`);

         const finalState = {
           queue: newQueue,
           currentQueueIndex: actualStartIndex,
           isPlaying: true,
           currentSongProgress: 0,
           currentSongDuration: 0,
           activePlaylistId: playlistId, // Also switch view to this playlist
           // isLoopingPlaylist: state.isLoopingPlaylist, // Persist loop setting - already handled by persist?
         };
         console.log('[Store] playPlaylist finished. New state:', finalState);
         return finalState;
      }),

      playSongInPlaylistContext: (song, playlistId) => {
          console.log(`[Store] playSongInPlaylistContext triggered for song ID: ${song.id}, playlist ID: ${playlistId}`);
         // Find the song's index in the specified playlist
         const playlist = get().playlists.find(p => p.id === playlistId);
         if (!playlist) {
              console.error(`[Store] Playlist ${playlistId} not found for playing song context.`);
              toast({ title: "Error", description: "Playlist not found.", variant: "destructive" });
              return;
          }
         const songIndex = playlist.songs.findIndex(s => s.id === song.id);
         if (songIndex === -1) {
             console.error(`[Store] Song ${song.id} not found within playlist ${playlistId}.`);
              toast({ title: "Error", description: "Song not found in this playlist.", variant: "destructive" });
             return;
         }
          console.log(`[Store] Found song ${song.id} at index ${songIndex} in playlist ${playlistId}. Delegating to playPlaylist.`);
         // Delegate to playPlaylist starting from that index
         get().playPlaylist(playlistId, songIndex);
       },

      playSingleSong: (song) => set((state) => {
          console.log(`[Store] playSingleSong triggered for song ID: ${song.id}`);
          const newQueueItem: QueueSong = {
              ...song,
              queueId: state._generateQueueId(),
              // No playlistContextId for single play
          };
          console.log("[Store] Setting queue with 1 song (single play mode).");
          const finalState = {
            queue: [newQueueItem],
            currentQueueIndex: 0,
            isPlaying: true,
            currentSongProgress: 0,
            currentSongDuration: 0,
            isShuffling: false, // Turn off shuffle
            isLoopingPlaylist: false, // Turn off playlist loop
          };
           console.log('[Store] playSingleSong finished. New state:', finalState);
          return finalState;
      }),

     playNextSong: () => set((state) => {
        console.log("[Store] playNextSong triggered.");
        const { queue, currentQueueIndex, isLooping, isLoopingPlaylist, isShuffling } = state;
        if (queue.length === 0) {
            console.warn("[Store] playNextSong: Queue is empty.");
            return {};
        }

        const currentSong = queue[currentQueueIndex];

        // 1. Handle single song loop
        if (isLooping && currentSong) {
            console.log("[Store] Looping current song.");
            // Rely on Player component effect for seekTo(0)
             return { currentSongProgress: 0, isPlaying: true };
        }

        // 2. Calculate next index
        let nextIndex = currentQueueIndex + 1;

        // 3. Handle end of queue
        if (nextIndex >= queue.length) {
            console.log("[Store] Reached end of queue.");
            if (isLoopingPlaylist) {
                console.log("[Store] Looping playlist is ON.");
                let newQueue = [...state.queue]; // Start with current queue
                let nextSongIndex = 0;

                // If shuffle is also on, reshuffle the *original playlist content* and start again
                const originalPlaylistId = queue[0]?.playlistContextId; // Get context from first song
                if (isShuffling && originalPlaylistId) {
                    console.log(`[Store] Looping & Shuffling: Reshuffling original playlist ${originalPlaylistId}.`);
                    const playlist = get().playlists.find(p => p.id === originalPlaylistId);
                    if (playlist && playlist.songs.length > 0) {
                        let songsToQueue = [...playlist.songs];
                        // Shuffle the entire list
                        songsToQueue = shuffleArray(songsToQueue);
                        // Create the new queue from the fully shuffled list
                        newQueue = songsToQueue.map(song => ({
                            ...song,
                            queueId: state._generateQueueId(),
                            playlistContextId: originalPlaylistId,
                        }));
                        nextSongIndex = 0; // Start from the beginning of the newly shuffled queue
                        console.log(`[Store] New shuffled queue created for loop with ${newQueue.length} songs.`);
                    } else {
                        console.warn(`[Store] Could not find original playlist ${originalPlaylistId} or it's empty. Looping current queue order instead.`);
                        nextSongIndex = 0; // Fallback to looping current queue order
                    }
                } else {
                    console.log("[Store] Looping back to the start of the current queue order.");
                    nextSongIndex = 0; // Loop back to the start of the current order
                }
                 const nextSong = newQueue[nextSongIndex];
                  console.log(`[Store] Looping: Playing song "${nextSong?.title}" at index ${nextSongIndex}.`);
                 return {
                    queue: newQueue, // Update queue if reshuffled
                    currentQueueIndex: nextSongIndex,
                    isPlaying: true,
                    currentSongProgress: 0,
                    currentSongDuration: 0,
                };

            } else {
                console.log("[Store] Looping playlist is OFF. Stopping playback.");
                return {
                    isPlaying: false,
                    // Keep queue and index as is
                     currentSongProgress: 0,
                 };
            }
        }

        // 4. Play the next song in the current queue order
        const nextSong = queue[nextIndex];
        console.log(`[Store] Playing next song in queue: "${nextSong.title}" at index ${nextIndex}.`);
        return {
            currentQueueIndex: nextIndex,
            isPlaying: true,
            currentSongProgress: 0,
            currentSongDuration: 0,
        };
    }),


    playPreviousSong: () => set((state) => {
        console.log("[Store] playPreviousSong triggered.");
        const { queue, currentQueueIndex, isLoopingPlaylist, currentSongProgress } = state;
        if (queue.length === 0) {
             console.warn("[Store] playPreviousSong: Queue is empty.");
             return {};
        }

        // 1. Restart current song if progress > 3 seconds
        if (currentSongProgress > 3) {
             console.log("[Store] Restarting current song.");
             // Rely on Player component effect for seekTo(0)
             return { currentSongProgress: 0, isPlaying: true };
        }

        // 2. Calculate previous index
        let prevIndex = currentQueueIndex - 1;

        // 3. Handle beginning of queue
        if (prevIndex < 0) {
             console.log("[Store] Reached beginning of queue.");
            if (isLoopingPlaylist) {
                console.log("[Store] Looping playlist is ON. Wrapping to end.");
                prevIndex = queue.length - 1; // Loop to the end
            } else {
                 console.log("[Store] Looping playlist is OFF. Restarting first song.");
                 // Rely on Player component effect for seekTo(0)
                 return { currentSongProgress: 0, isPlaying: true };
            }
        }

        // 4. Play the previous song
        const prevSong = queue[prevIndex];
        console.log(`[Store] Playing previous song in queue: "${prevSong.title}" at index ${prevIndex}.`);
        return {
            currentQueueIndex: prevIndex,
            isPlaying: true,
            currentSongProgress: 0,
            currentSongDuration: 0,
        };
    }),

      togglePlayPause: () => set((state) => {
          console.log("[Store] togglePlayPause triggered.");
          if (state.queue.length === 0 && !state.isPlaying) {
               console.warn("[Store] No song in queue, cannot play.");
              return {};
          }
           if (state.queue.length > 0 && state.currentQueueIndex === -1 && !state.isPlaying) {
                console.log("[Store] Queue exists but nothing selected. Playing first song.");
               return { isPlaying: true, currentQueueIndex: 0, currentSongProgress: 0, currentSongDuration: 0 };
           }

          const newState = !state.isPlaying;
          console.log(`[Store] Setting isPlaying to ${newState}`);
          return { isPlaying: newState };
      }),

      toggleShuffle: () => set((state) => {
          const turningShuffleOn = !state.isShuffling;
          console.log(`[Store] toggleShuffle triggered. Setting isShuffling to ${turningShuffleOn}`);

          // If turning shuffle OFF, we don't need to change the queue.
          // If turning shuffle ON, we *could* reshuffle the upcoming part of the queue,
          // but Spotify's behavior is generally to apply it on the *next context play*.
          // Let's stick to the simpler approach: flag changes, applied on next `playPlaylist`.

           if (turningShuffleOn) {
               console.log("[Store] Shuffle is now ON. Will apply on next playlist play or loop reshuffle.");
           } else {
                console.log("[Store] Shuffle is now OFF.");
           }

          return {
              isShuffling: turningShuffleOn,
          };
       }),

      toggleLoop: () => set((state) => {
           const newState = !state.isLooping;
           console.log(`[Store] toggleLoop triggered. Setting single song loop to ${newState}`);
           // If turning on single loop, ensure playlist loop is off
           const finalState = { isLooping: newState, ...(newState && { isLoopingPlaylist: false }) };
            console.log('[Store] toggleLoop finished. New state:', finalState);
           return finalState;
       }),

      toggleLoopPlaylist: () => set((state) => {
           const newState = !state.isLoopingPlaylist;
           console.log(`[Store] toggleLoopPlaylist triggered. Setting playlist loop to ${newState}`);
           // If turning on playlist loop, ensure single loop is off
           const finalState = { isLoopingPlaylist: newState, ...(newState && { isLooping: false }) };
           console.log('[Store] toggleLoopPlaylist finished. New state:', finalState);
           return finalState;
       }),

      setCurrentSongProgress: (progress) => set((state) => {
        // console.log(`[Store] setCurrentSongProgress triggered with progress: ${progress}`); // Too noisy
        if (state.isPlaying || progress === 0) {
            const currentSong = state.queue[state.currentQueueIndex];
            const duration = state.currentSongDuration;
             if (currentSong && progress >= 0 && progress <= (duration || Infinity)) {
               return { currentSongProgress: progress };
             }
        }
        // console.log("[Store] setCurrentSongProgress: Conditions not met (not playing or invalid progress). No change.");
        return {};
      }),

      setCurrentSongDuration: (duration) => set((state) => {
         // console.log(`[Store] setCurrentSongDuration triggered with duration: ${duration}`); // Might be noisy
         const currentSong = state.queue[state.currentQueueIndex];
         if (currentSong) {
             return { currentSongDuration: duration > 0 ? duration : 0 };
         }
         // console.log("[Store] setCurrentSongDuration: No current song. No change.");
         return {};
      }),

      setVolume: (volume) => set((state) => {
          const newVolume = Math.max(0, Math.min(1, volume));
          const newMuteState = newVolume <= 0 || state.isMuted; // Keep muted if already muted, or mute if volume is 0
          // If unmuting via volume slider, explicitly set isMuted to false
          const explicitlyUnmuted = state.isMuted && newVolume > 0;
          console.log(`[Store] setVolume triggered. New volume: ${newVolume}. Explicitly unmuted: ${explicitlyUnmuted}`);
          return { volume: newVolume, isMuted: explicitlyUnmuted ? false : newMuteState };
      }),

      toggleMute: () => set((state) => {
           const newMuteState = !state.isMuted;
           console.log(`[Store] toggleMute triggered. Setting isMuted to ${newMuteState}`);
           // If unmuting and volume is 0, set volume to a default (e.g., 0.1) to make it audible
           const newVolume = !newMuteState && state.volume === 0 ? 0.1 : state.volume;
           return { isMuted: newMuteState, volume: newVolume };
       }),

       clearQueue: () => set((state) => {
            console.log("[Store] clearQueue triggered.");
            const finalState = { queue: [], currentQueueIndex: -1, isPlaying: false, currentSongProgress: 0, currentSongDuration: 0 };
             console.log('[Store] clearQueue finished. New state:', finalState);
            return finalState;
        }),

       removeSongFromQueue: (queueIdToRemove: string) => set((state) => {
         console.log(`[Store] removeSongFromQueue triggered for queue ID: ${queueIdToRemove}`);
         const initialQueueLength = state.queue.length;
         if (initialQueueLength === 0) {
              console.warn("[Store] Queue is already empty.");
              return {};
         }

         const removedSongIndex = state.queue.findIndex(q => q.queueId === queueIdToRemove);
         if (removedSongIndex === -1) {
             console.warn(`[Store] Song with queue ID ${queueIdToRemove} not found in queue.`);
             return {};
         }

         const newQueue = state.queue.filter(q => q.queueId !== queueIdToRemove);
         let newCurrentQueueIndex = state.currentQueueIndex;
         let newIsPlaying = state.isPlaying;

         console.log(`[Store] Removed song at index ${removedSongIndex}. New queue length: ${newQueue.length}`);

         if (removedSongIndex === state.currentQueueIndex) {
            // If removing the currently playing song
             console.log("[Store] Removed the currently playing song.");
            if (newQueue.length > 0) {
               // Move to the next song (or the new song at the same index if something was before it)
               newCurrentQueueIndex = Math.min(state.currentQueueIndex, newQueue.length - 1);
               if (newCurrentQueueIndex < 0) newCurrentQueueIndex = 0; // Should only happen if queue had 1 item
               console.log(`[Store] Moving to queue index ${newCurrentQueueIndex}.`);
            } else {
               // Queue became empty
               newCurrentQueueIndex = -1;
               newIsPlaying = false;
               console.log("[Store] Queue became empty after removal.");
            }
         } else if (removedSongIndex < state.currentQueueIndex) {
            // If removing a song before the current one, adjust the index
            newCurrentQueueIndex--;
             console.log(`[Store] Adjusted current index down to ${newCurrentQueueIndex}.`);
         }
          // Ensure index is valid after potential adjustments
          if (newQueue.length === 0) {
              newCurrentQueueIndex = -1;
          } else {
               newCurrentQueueIndex = Math.max(0, Math.min(newCurrentQueueIndex, newQueue.length - 1));
          }


         const finalState = {
            queue: newQueue,
            currentQueueIndex: newCurrentQueueIndex,
            isPlaying: newIsPlaying,
            currentSongProgress: newIsPlaying ? state.currentSongProgress : 0,
            currentSongDuration: newIsPlaying ? state.currentSongDuration : 0,
         };
          console.log('[Store] removeSongFromQueue finished. New state:', finalState);
         return finalState;
      }),

      reorderSongInQueue: (fromIndex, toIndex) => set((state) => {
          console.log(`[Store] reorderSongInQueue triggered. From ${fromIndex} to ${toIndex}.`);
         if (fromIndex < 0 || fromIndex >= state.queue.length || toIndex < 0 || toIndex >= state.queue.length) {
            console.error(`[Store] Invalid indices for queue reorder: from ${fromIndex}, to ${toIndex}`);
           return {};
         }

         const newQueue = Array.from(state.queue);
         const [movedItem] = newQueue.splice(fromIndex, 1);
         newQueue.splice(toIndex, 0, movedItem);

         let newCurrentQueueIndex = state.currentQueueIndex;

         // Update current index if it was affected by the move
         if (state.currentQueueIndex === fromIndex) {
           newCurrentQueueIndex = toIndex;
           console.log(`[Store] Moved current song. New index: ${newCurrentQueueIndex}`);
         } else if (fromIndex < state.currentQueueIndex && toIndex >= state.currentQueueIndex) {
           newCurrentQueueIndex--;
           console.log(`[Store] Moved song from before current to after. Adjusted index down: ${newCurrentQueueIndex}`);
         } else if (fromIndex > state.currentQueueIndex && toIndex <= state.currentQueueIndex) {
           newCurrentQueueIndex++;
           console.log(`[Store] Moved song from after current to before. Adjusted index up: ${newCurrentQueueIndex}`);
         }

         const finalState = { queue: newQueue, currentQueueIndex: newCurrentQueueIndex };
          console.log('[Store] reorderSongInQueue finished. New state:', finalState);
         return finalState;
       }),

       playFromQueueIndex: (index) => set((state) => {
           console.log(`[Store] playFromQueueIndex triggered with index: ${index}`);
         if (index < 0 || index >= state.queue.length) {
              console.error(`[Store] Invalid queue index: ${index}. Queue length: ${state.queue.length}`);
              return {};
         }

           const targetSong = state.queue[index];
           console.log(`[Store] Playing song "${targetSong.title}" from queue index ${index}.`);

          const finalState = {
             currentQueueIndex: index,
             isPlaying: true,
             currentSongProgress: 0,
             currentSongDuration: 0, // Reset duration for new song
          };
           console.log('[Store] playFromQueueIndex finished. New state:', finalState);
          return finalState;
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
      version: 1, // Increment version if state shape changes significantly
      migrate: (persistedState: any, version: number) => {
        console.log(`[Store Migrate] Attempting migration from version ${version}. Current version: 1`);
        if (version < 1) {
            // Example migration: If older versions had different property names or structures
             // persistedState.newPropertyName = persistedState.oldPropertyName;
             // delete persistedState.oldPropertyName;
             console.log("[Store Migrate] No specific migrations needed for version < 1.");
        }
        // Add more migration logic here for future versions
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

            console.log("[Store] Transient state reset complete after hydration.");
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

// --- Derived State Hook (Example) ---
// You can create custom hooks for complex derived state
export const useCurrentSong = () => {
  return usePlaylistStore((state) => state.queue[state.currentQueueIndex] ?? null);
};

export const useCurrentSongPlaylistContext = () => {
   return usePlaylistStore((state) => state.queue[state.currentQueueIndex]?.playlistContextId ?? null);
}

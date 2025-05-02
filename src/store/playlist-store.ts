
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
  currentSongPlaylistContextId: string | null; // Store the playlist ID the current song is *playing from*
  currentSongIndex: number; // Index within the *playing* playlist's possibly shuffled order. -1 if not part of a playlist context.
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
  setActivePlaylistId: (playlistId: string | null) => void; // Only sets the *viewed* playlist ID
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
  _getPlayingPlaylist: () => Playlist | undefined;
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
      activePlaylistId: null, // The playlist currently being *viewed*
      currentSong: null,
      currentSongPlaylistContextId: null, // The playlist the current song is *playing from*
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

      _getPlayingPlaylist: () => {
        const { playlists, currentSongPlaylistContextId } = get();
        return playlists.find((p) => p.id === currentSongPlaylistContextId);
      },

      // No longer needed as separate function, logic incorporated directly
      // _getShuffledPlaylistOrder: (playlist: Playlist): number[] => { ... },

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
          let newCurrentSongPlaylistContextId = state.currentSongPlaylistContextId;

          // If the deleted playlist was the one being *viewed*
          if (state.activePlaylistId === playlistId) {
            newActivePlaylistId = updatedPlaylists[0]?.id ?? null;
          }
          // If the deleted playlist was the one being *played from*
          if (state.currentSongPlaylistContextId === playlistId) {
            newCurrentSong = null;
            newCurrentSongIndex = -1;
            newIsPlaying = false;
            newIsInSinglePlayMode = false;
            newCurrentSongPlaylistContextId = null; // Clear context
            newHistory = []; // Clear history
          }

          return {
             playlists: updatedPlaylists,
             activePlaylistId: newActivePlaylistId, // Update viewed playlist if needed
             currentSong: newCurrentSong,
             currentSongIndex: newCurrentSongIndex,
             isPlaying: newIsPlaying,
             currentSongPlaylistContextId: newCurrentSongPlaylistContextId, // Update playing context if needed
             playHistory: newHistory, // Clear history if playback stopped
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
            // Avoid showing toast if it's already the current song being added again (e.g., spam click)
            if (state.currentSong?.id !== song.id || state.currentSongPlaylistContextId !== playlistId) {
              toast({
                title: 'Song Already Exists',
                description: `"${song.title}" is already in the playlist "${playlist.name}".`,
                variant: 'default', // Keep it noticeable but not alarming
              });
            }
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
          let removedSongIndexInOriginal = -1;
          let nextSongToPlay: Song | null = null;
          let nextSongIndex = -1;
          let playNext = false;
          let stopPlayback = false;

          const updatedPlaylists = state.playlists.map((p) => {
            if (p.id === playlistId) {
               const originalSongs = [...p.songs];
               removedSongIndexInOriginal = originalSongs.findIndex((s) => s.id === songId);
               const updatedSongs = originalSongs.filter((s) => s.id !== songId);

               // Check if the removed song was the one playing *and* from this playlist context
               if (state.currentSong?.id === songId && state.currentSongPlaylistContextId === playlistId) {
                   wasPlayingRemovedSong = true;
                   const playingPlaylist = get()._getPlayingPlaylist(); // Get current state playlist
                   if (playingPlaylist && updatedSongs.length > 0) { // Check updatedSongs length
                       const numSongsRemaining = updatedSongs.length;
                       let potentialNextIndex = -1;

                       if(state.isShuffling){
                          const remainingIndices = updatedSongs.map((s, i) => i); // indices in the *new* list
                          if(remainingIndices.length > 0){
                             potentialNextIndex = remainingIndices[Math.floor(Math.random() * remainingIndices.length)];
                          }
                       } else {
                          if (removedSongIndexInOriginal < numSongsRemaining) {
                             potentialNextIndex = removedSongIndexInOriginal;
                          } else if (numSongsRemaining > 0) {
                             potentialNextIndex = numSongsRemaining - 1;
                          }
                       }

                       if (potentialNextIndex !== -1 && potentialNextIndex < updatedSongs.length) {
                         nextSongToPlay = updatedSongs[potentialNextIndex];
                         nextSongIndex = potentialNextIndex;
                         playNext = true;
                       } else {
                          stopPlayback = true; // Could not find next song
                       }
                   } else {
                       stopPlayback = true; // Playlist became empty
                   }
               }
               return { ...p, songs: updatedSongs };
            }
            return p;
          });

          // --- State Update Logic ---
          if (wasPlayingRemovedSong) {
             if (playNext && nextSongToPlay) {
                return {
                  playlists: updatedPlaylists,
                  currentSong: nextSongToPlay,
                  currentSongIndex: nextSongIndex,
                  isPlaying: true,
                  currentSongProgress: 0,
                  currentSongDuration: 0,
                  playHistory: state.isShuffling ? [nextSongIndex] : [],
                  isInSinglePlayMode: false,
                  // currentSongPlaylistContextId remains the same
                };
             } else {
                // Stop playback
                return {
                  playlists: updatedPlaylists,
                  currentSong: null,
                  currentSongIndex: -1,
                  isPlaying: false,
                  playHistory: [],
                  currentSongProgress: 0,
                  currentSongDuration: 0,
                  isInSinglePlayMode: false,
                  currentSongPlaylistContextId: null, // Clear context
                };
             }
          } else if (state.currentSongPlaylistContextId === playlistId && state.currentSongIndex !== -1 && removedSongIndexInOriginal !== -1) {
             // If removed song was BEFORE the current playing song (which wasn't the removed one) in the *same* playlist context
             let newCurrentSongIndex = state.currentSongIndex;
             if (removedSongIndexInOriginal < state.currentSongIndex) {
                  newCurrentSongIndex--;
             }

             let newPlayHistory = state.playHistory;
              if (!state.isShuffling) {
                  newPlayHistory = state.playHistory.map(histIndex => {
                      if (histIndex > removedSongIndexInOriginal) return histIndex - 1;
                      if (histIndex === removedSongIndexInOriginal) return -1;
                      return histIndex;
                  }).filter(histIndex => histIndex !== -1);
              } else {
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

           // Update index and history only if the reordered playlist is the one currently playing
           if (state.currentSongPlaylistContextId === playlistId && state.currentSong) {
             newCurrentSongIndex = newSongs.findIndex(song => song.id === state.currentSong!.id);
             if (newCurrentSongIndex === -1) {
                console.warn("[Store] Current song not found after reorder, resetting index.");
                newCurrentSongIndex = -1;
             }

             if (!state.isShuffling) {
                 newPlayHistory = state.playHistory.map(histIndex => {
                     if (histIndex === fromIndex) return toIndex;
                     if (histIndex >= Math.min(fromIndex, toIndex) && histIndex <= Math.max(fromIndex, toIndex)) {
                         if (fromIndex < toIndex) {
                             if (histIndex > fromIndex) return histIndex - 1;
                         } else {
                             if (histIndex < fromIndex) return histIndex + 1;
                         }
                     }
                     return histIndex;
                 });
             } else {
               newPlayHistory = newCurrentSongIndex !== -1 ? [newCurrentSongIndex] : [];
             }
           }

           return { playlists: updatedPlaylists, currentSongIndex: newCurrentSongIndex, playHistory: newPlayHistory };
         }),


     // This now *only* sets the playlist being viewed in the UI.
     // It does NOT affect playback state.
     setActivePlaylistId: (playlistId) =>
        set((state) => {
           if (playlistId !== state.activePlaylistId) {
              console.log(`[Store] Switching *viewed* playlist to: ${playlistId}`);
              return { activePlaylistId: playlistId };
           }
           // No change if clicking the already active playlist view
           return {};
        }),


      playPlaylist: (playlistId) => set((state) => {
         const playlist = state.playlists.find((p) => p.id === playlistId);
         if (!playlist || playlist.songs.length === 0) return {};

         let startIndex = 0;
         let shuffledIndices: number[] = [];
         if (state.isShuffling) {
             // Generate shuffled order based on the target playlist
             const indices = playlist.songs.map((_, index) => index);
             shuffledIndices = shuffleArray(indices);
             startIndex = shuffledIndices[0] ?? 0;
         }
         const startSong = playlist.songs[startIndex];

         // Prevent rapid clicks / Restarting unnecessarily if already playing this playlist's start song
          if (state.currentSong?.id === startSong.id && state.currentSongPlaylistContextId === playlistId && state.isPlaying) {
              console.log("[Store] Playlist already playing from start, ignoring click.");
              return {};
          }
          // If it's the same start song but paused in the same context, just play it
          if (state.currentSong?.id === startSong.id && state.currentSongPlaylistContextId === playlistId && !state.isPlaying) {
              console.log("[Store] Resuming playlist from start.");
              return { isPlaying: true };
          }


         // Start or restart the playlist - SET THE PLAYING CONTEXT
         console.log(`[Store] Starting playback for playlist: ${playlist.name} (${playlistId})`, state.isShuffling ? "(Shuffled)" : "");
         return {
           currentSong: startSong,
           currentSongIndex: startIndex,
           currentSongPlaylistContextId: playlistId, // Set playing context
           isPlaying: true,
           currentSongProgress: 0,
           currentSongDuration: 0,
           playHistory: [startIndex],
           isInSinglePlayMode: false,
           activePlaylistId: playlistId, // Also switch view to this playlist
         };
      }),


      playSong: (song, playlistId) =>
        set((state) => {
          const playlist = state.playlists.find((p) => p.id === playlistId);
          if (!playlist) return {};

          const songIndex = playlist.songs.findIndex((s) => s.id === song.id);
          if (songIndex === -1) return {};

           // Prevent rapid clicks: If this song is already playing *from this playlist context*, do nothing
           if (state.currentSong?.id === song.id && state.currentSongPlaylistContextId === playlistId && state.isPlaying) {
             console.log("[Store] Song already playing from this playlist, ignoring click.");
             return {};
           }
            // If same song but paused *in this playlist context*, just play it
           if (state.currentSong?.id === song.id && state.currentSongPlaylistContextId === playlistId && !state.isPlaying) {
                console.log("[Store] Resuming song playback within playlist context.");
                return { isPlaying: true };
            }

          // History always starts with the currently played song's index when context changes
          const newHistory = [songIndex];

          console.log(`[Store] Playing new song from playlist context: ${playlist.name} (${playlistId})`);
          return {
            currentSong: song,
            currentSongIndex: songIndex,
            currentSongPlaylistContextId: playlistId, // SET playing context
            isPlaying: true,
            currentSongProgress: 0,
            currentSongDuration: 0,
            playHistory: newHistory,
            isInSinglePlayMode: false,
            activePlaylistId: playlistId, // Also switch view to this playlist
          };
        }),

      playSingleSong: (song) => set((state) => {
          // Prevent rapid clicks: If this song is already playing in single mode, do nothing.
          if (state.currentSong?.id === song.id && state.isInSinglePlayMode && state.isPlaying) {
             console.log("[Store] Single song already playing, ignoring click.");
             return {};
          }
          // If same song but paused *in single mode*, just play it
           if (state.currentSong?.id === song.id && state.isInSinglePlayMode && !state.isPlaying) {
               console.log("[Store] Resuming single song playback.");
                return { isPlaying: true };
            }

          console.log("[Store] Playing single song (no playlist context).");
          return {
            currentSong: song,
            currentSongIndex: -1,
            currentSongPlaylistContextId: null, // CLEAR playing context
            isPlaying: true,
            currentSongProgress: 0,
            currentSongDuration: 0,
            playHistory: [],
            isInSinglePlayMode: true,
            // activePlaylistId remains unchanged (view doesn't change)
          };
      }),

     playNextSong: () => set((state) => {
        if (state.isInSinglePlayMode) {
             if (state.isLooping) {
                if (playerRef.current) playerRef.current.seekTo(0);
                 return { currentSongProgress: 0, isPlaying: true };
             } else {
                console.log("[Store] Single song finished, stopping playback.");
                return { currentSong: null, currentSongIndex: -1, isPlaying: false, isInSinglePlayMode: false, currentSongProgress: 0, currentSongDuration: 0, currentSongPlaylistContextId: null };
            }
        }

        // --- Playlist Mode Logic ---
        const playingPlaylist = state._getPlayingPlaylist(); // Use the playlist context
        if (!playingPlaylist || playingPlaylist.songs.length === 0) {
            console.log("[Store] Play next: No active playing context or playlist empty.");
            return { currentSong: null, currentSongIndex: -1, isPlaying: false, playHistory: [], currentSongProgress: 0, currentSongDuration: 0, currentSongPlaylistContextId: null };
        }

        const numSongs = playingPlaylist.songs.length;
        let nextIndex = -1;

        if (state.isLooping) {
            console.log("[Store] Looping current song.");
            if (playerRef.current) playerRef.current.seekTo(0);
             return { currentSongProgress: 0, isPlaying: true };
        }


        if (state.isShuffling) {
            console.log("[Store] Play next: Calculating next shuffled song.");
            const recentHistory = state.playHistory.slice(-Math.min(state.playHistory.length, Math.floor(numSongs / 2) + 1));
            const availableIndices = playingPlaylist.songs.map((_, i) => i).filter(i => !recentHistory.includes(i));

            if (availableIndices.length > 0) {
                nextIndex = availableIndices[Math.floor(Math.random() * availableIndices.length)];
                console.log("[Store] Play next: Found available index:", nextIndex);
            } else {
                const possibleIndices = playingPlaylist.songs.map((_, i) => i).filter(i => i !== state.currentSongIndex);
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

        if (nextIndex >= numSongs) {
            if (state.isLoopingPlaylist) {
                nextIndex = 0;
                 console.log("[Store] Play next: End of playlist, looping back to start:", nextIndex);
            } else {
                console.log("[Store] Play next: End of playlist, stopping playback.");
                return { currentSong: null, currentSongIndex: -1, isPlaying: false, playHistory: [], currentSongProgress: 0, currentSongDuration: 0, currentSongPlaylistContextId: null };
            }
        } else if (nextIndex < 0 && !state.isShuffling) {
             console.warn("[Store] Play next: Calculated invalid negative index in sequential mode, resetting to 0.");
             nextIndex = 0;
        }


        const nextSong = playingPlaylist.songs[nextIndex];
        if (!nextSong) {
            console.error("[Store] Play next: Could not find song at calculated index:", nextIndex);
             return { currentSong: null, currentSongIndex: -1, isPlaying: false, playHistory: [], currentSongProgress: 0, currentSongDuration: 0, currentSongPlaylistContextId: null };
        }

        const newHistory = [...state.playHistory, nextIndex];
        console.log(`[Store] Play next: Playing song "${nextSong.title}" at index ${nextIndex} from playlist ${playingPlaylist.id}. History:`, newHistory);


        return {
            currentSong: nextSong,
            currentSongIndex: nextIndex,
            isPlaying: true,
            currentSongProgress: 0,
            currentSongDuration: 0,
            playHistory: newHistory,
            isInSinglePlayMode: false,
            // currentSongPlaylistContextId remains the same
        };
    }),


    playPreviousSong: () => set((state) => {
        if (state.isInSinglePlayMode) {
            if (state.currentSongProgress > 3 && playerRef.current) {
                playerRef.current.seekTo(0);
                return { currentSongProgress: 0, isPlaying: true };
            }
             if (playerRef.current) playerRef.current.seekTo(0);
             return { currentSongProgress: 0, isPlaying: true };
        }

        // --- Playlist Mode Logic ---
        const playingPlaylist = state._getPlayingPlaylist(); // Use the playlist context
        if (!playingPlaylist || playingPlaylist.songs.length === 0) {
             console.log("[Store] Play previous: No active playing context or playlist empty.");
            return { currentSong: null, currentSongIndex: -1, isPlaying: false, playHistory: [], currentSongProgress: 0, currentSongDuration: 0, currentSongPlaylistContextId: null };
        }

        if (state.currentSongProgress > 3 && playerRef.current) {
             playerRef.current.seekTo(0);
             return { currentSongProgress: 0, isPlaying: true };
        }


        let prevIndex = -1;
        const numSongs = playingPlaylist.songs.length;
        let newHistory = state.playHistory;

        if (state.isShuffling && state.playHistory.length > 1) {
            newHistory = state.playHistory.slice(0, -1);
            prevIndex = newHistory[newHistory.length - 1];
             console.log("[Store] Play previous: Using shuffled history. Prev index:", prevIndex);
        } else if (!state.isShuffling) {
            prevIndex = state.currentSongIndex - 1;
            console.log("[Store] Play previous: Calculating previous sequential index:", prevIndex);
            newHistory = state.playHistory;
        } else {
           console.log("[Store] Play previous: Cannot go back (shuffling with short history). Restarting current song.");
           if (playerRef.current) playerRef.current.seekTo(0);
           return { currentSongProgress: 0, isPlaying: true };
        }

        if (prevIndex < 0) {
            if (state.isLoopingPlaylist && !state.isShuffling) {
                prevIndex = numSongs - 1; // Loop to end
                 console.log("[Store] Play previous: Looping playlist to end:", prevIndex);
            } else {
                 console.log("[Store] Play previous: At start, restarting current song.");
                 if (playerRef.current) playerRef.current.seekTo(0);
                 return { currentSongProgress: 0, isPlaying: true };
            }
        }

         if (prevIndex < 0 || prevIndex >= numSongs) {
             console.warn("[Store] Play previous: Invalid previous index calculated:", prevIndex);
             if (playerRef.current) playerRef.current.seekTo(0);
             return { currentSongProgress: 0, isPlaying: true };
         }


        const prevSong = playingPlaylist.songs[prevIndex];
        if (!prevSong) {
            console.error("[Store] Play previous: Could not find song at calculated index:", prevIndex);
             if (playerRef.current) playerRef.current.seekTo(0);
             return { currentSongProgress: 0, isPlaying: true };
        }

        console.log(`[Store] Play previous: Playing song "${prevSong.title}" at index ${prevIndex} from playlist ${playingPlaylist.id}. History:`, newHistory);

        return {
            currentSong: prevSong,
            currentSongIndex: prevIndex,
            isPlaying: true,
            currentSongProgress: 0,
            currentSongDuration: 0,
            playHistory: newHistory,
            isInSinglePlayMode: false,
            // currentSongPlaylistContextId remains the same
        };
    }),

      togglePlayPause: () => set((state) => {
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
          // Reset history only if turning shuffle ON and there's a current playing context
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
       }),

      toggleLoopPlaylist: () => set((state) => {
          if (state.isInSinglePlayMode) {
               console.log("[Store] Toggle loop playlist: Cannot loop playlist in single play mode.");
               return {};
          }
           const newState = !state.isLoopingPlaylist;
           console.log(`[Store] Toggle loop playlist: Setting isLoopingPlaylist to ${newState}`);
          return { isLoopingPlaylist: newState };
      }),

      setCurrentSongProgress: (progress) => set((state) => {
        if (state.isPlaying || progress === 0) {
             // Check progress is valid before setting
             if (progress >= 0 && progress <= (state.currentSongDuration || Infinity)) {
               return { currentSongProgress: progress };
             }
        }
        return {};
      }),

      setCurrentSongDuration: (duration) => set((state) => {
         if (state.currentSong) {
             return { currentSongDuration: duration > 0 ? duration : 0 }; // Ensure duration is non-negative
         }
         return {};
      }),

      setVolume: (volume) => set({ volume: Math.max(0, Math.min(1, volume)), isMuted: volume <= 0 ? true : false }),
      toggleMute: () => set((state) => {
           const newMuteState = !state.isMuted;
           console.log(`[Store] Toggle mute: Setting isMuted to ${newMuteState}`);
           return { isMuted: newMuteState };
       }),

    }),
    {
      name: 'youtune-playlist-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        playlists: state.playlists,
        activePlaylistId: state.activePlaylistId,
        volume: state.volume,
        isMuted: state.isMuted,
        isShuffling: state.isShuffling,
        isLooping: state.isLooping,
        isLoopingPlaylist: state.isLoopingPlaylist,
        // Don't persist playback state: currentSong, currentSongPlaylistContextId, currentSongIndex, playHistory, isPlaying, currentSongProgress, currentSongDuration, isInSinglePlayMode
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

            // Initialize/Reset transient state
            persistedState.isPlaying = false;
            persistedState.currentSong = null;
            persistedState.currentSongPlaylistContextId = null; // Initialize context ID
            persistedState.currentSongIndex = -1;
            persistedState.playHistory = [];
            persistedState.currentSongProgress = 0;
            persistedState.currentSongDuration = 0;
            persistedState.isInSinglePlayMode = false;

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
                state.playlists = [];
                state.activePlaylistId = null;
                state.volume = 0.8;
                state.isMuted = false;
                state.isShuffling = false;
                state.isLooping = false;
                state.isLoopingPlaylist = false;
                state.currentSong = null;
                state.currentSongPlaylistContextId = null; // Initialize context ID
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
    }
  )
);

// Global reference for the player
let playerRef: React.RefObject<ReactPlayer> | null = null;

export const setPlayerRef = (ref: React.RefObject<ReactPlayer>) => {
    playerRef = ref;
};

// --- Debugging Helper ---
// Use this in your components: useEffect(() => subscribeToStoreChanges(), []);
// function subscribeToStoreChanges() {
//   const unsub = usePlaylistStore.subscribe(
//     (state, prevState) => {
//       console.log('[Store Change Detected]', {
//         changed: Object.keys(state).filter(key => state[key as keyof PlaylistState] !== prevState[key as keyof PlaylistState]),
//         newState: state,
//         prevState,
//       });
//     }
//   );
//   return unsub;
// }

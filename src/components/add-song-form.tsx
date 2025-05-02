// src/components/add-song-form.tsx
'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { getYoutubeMetadataAction } from '@/actions/youtube-actions'; // Action to get metadata
import { extractYoutubeVideoId } from '@/services/youtube'; // Helper to get video ID
import type { Song, Playlist, YoutubeVideoMetadata } from '@/lib/types';
import { usePlaylistStore } from '@/store/playlist-store';
import { SelectPlaylistDialog } from './select-playlist-dialog';
import { Plus, Play, Loader2, Youtube, Music } from 'lucide-react'; // Import necessary icons

// Schema for the URL input form
const addSongSchema = z.object({
  url: z.string().url({ message: 'Please enter a valid URL.' }).refine(
    (url) => {
        const videoId = extractYoutubeVideoId(url);
        return !!videoId; // Ensure a video ID can be extracted
    },
    { message: 'Please enter a valid YouTube video URL.' }
  ),
});

type AddSongFormValues = z.infer<typeof addSongSchema>;

export function AddSongForm() {
  const { toast } = useToast();
  const { playlists, addSongToPlaylist, playSingleSong } = usePlaylistStore((state) => ({
    playlists: state.playlists,
    addSongToPlaylist: state.addSongToPlaylist,
    playSingleSong: state.playSingleSong, // Get the action to play a single song
  }));

  const [isLoading, setIsLoading] = useState(false);
  const [isSelectPlaylistDialogOpen, setIsSelectPlaylistDialogOpen] = useState(false);
  const [songToAdd, setSongToAdd] = useState<Song | null>(null); // Song derived from fetched metadata

  const form = useForm<AddSongFormValues>({
    resolver: zodResolver(addSongSchema),
    defaultValues: {
      url: '',
    },
  });

  // --- Fetch Metadata and Prepare Song ---
  const fetchAndPrepareSong = async (url: string): Promise<Song | null> => {
    setIsLoading(true);
    const videoId = extractYoutubeVideoId(url);

    if (!videoId) {
      toast({
        title: 'Invalid URL',
        description: 'Could not extract YouTube video ID from the URL.',
        variant: 'destructive',
      });
      setIsLoading(false);
      return null;
    }

    try {
      // Use the server action to fetch metadata (requires API key)
      const metadata: YoutubeVideoMetadata = await getYoutubeMetadataAction(videoId);
      const song: Song = {
        id: videoId,
        title: metadata.title,
        author: metadata.author,
        url: `https://www.youtube.com/watch?v=${videoId}`, // Standard URL format
        thumbnailUrl: metadata.thumbnailUrl,
      };
      return song;
    } catch (error: any) {
      console.error('Error fetching metadata via action:', error);
      // Display user-friendly error messages based on the action's throw
      toast({
        title: 'Error Fetching Video Info',
        description: error.message || 'Could not fetch video details.',
        variant: 'destructive',
      });
      return null; // Indicate failure
    } finally {
      setIsLoading(false);
    }
  };


  // --- Submit Handlers ---

  // Handler for "Add to Playlist" button
  const onAddToPlaylist = async (values: AddSongFormValues) => {
    const preparedSong = await fetchAndPrepareSong(values.url);
    if (!preparedSong) return; // Stop if metadata fetch failed

    setSongToAdd(preparedSong);

    if (playlists.length === 0) {
      toast({
        title: 'No Playlists',
        description: 'Create a playlist first to add songs.',
        variant: 'destructive',
      });
      setSongToAdd(null); // Clear song to add state
    } else if (playlists.length === 1) {
      // Add directly to the only playlist
      addSongToSpecificPlaylist(playlists[0].id, preparedSong);
      form.reset(); // Clear form after successful add
    } else {
      // Open dialog to select playlist
      setIsSelectPlaylistDialogOpen(true);
    }
  };

  // Handler for "Play Now" button
  const onPlayNow = async (values: AddSongFormValues) => {
    const preparedSong = await fetchAndPrepareSong(values.url);
    if (!preparedSong) return; // Stop if metadata fetch failed

    playSingleSong(preparedSong); // Play the song directly
    form.reset(); // Clear form after playing
  };

  // --- Playlist Selection Logic ---

  // Called from the SelectPlaylistDialog
  const handlePlaylistSelected = (playlistId: string) => {
    if (songToAdd) {
      addSongToSpecificPlaylist(playlistId, songToAdd);
      form.reset(); // Clear form after successful selection and add
    } else {
      console.error("Error: No song data available when playlist was selected.");
      toast({ title: "Error", description: "Could not add song. Please try again.", variant: "destructive" });
      setIsSelectPlaylistDialogOpen(false); // Ensure dialog closes on error
      setSongToAdd(null);
    }
  };

  // Final step after playlist selection (or if only one playlist exists)
  const addSongToSpecificPlaylist = (playlistId: string, song: Song) => {
    const added = addSongToPlaylist(playlistId, song);
    if (added) {
      toast({
        title: 'Song Added',
        description: `"${song.title}" added to playlist.`,
      });
    }
    // Reset state regardless of add success/fail (duplicate check in store)
    setSongToAdd(null);
    setIsSelectPlaylistDialogOpen(false);
  };

  return (
    <>
      <div className="mb-6 rounded-lg border bg-card p-4 shadow-sm">
        <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <Youtube className="h-5 w-5 text-destructive" /> {/* YouTube Icon */}
            Add Song from YouTube URL
        </h3>
        <Form {...form}>
          <form
            // Separate handlers for each button based on which was clicked
            // onSubmit is not used directly on the form tag
            className="flex flex-col sm:flex-row items-start sm:items-center gap-2"
          >
            <FormField
              control={form.control}
              name="url"
              render={({ field }) => (
                <FormItem className="flex-1 w-full sm:w-auto">
                  <FormLabel className="sr-only">YouTube URL</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Paste YouTube video URL..."
                      {...field}
                      disabled={isLoading}
                      aria-label="YouTube URL Input"
                      className="h-9" // Keep input height consistent
                    />
                  </FormControl>
                  <FormMessage className="mt-1 text-xs" /> {/* Adjust message spacing */}
                </FormItem>
              )}
            />
            <div className="flex gap-2 w-full sm:w-auto justify-end">
              {/* Add to Playlist Button */}
              <Button
                type="button" // Important: type="button" to prevent form submission
                onClick={form.handleSubmit(onAddToPlaylist)}
                disabled={isLoading || !form.formState.isValid}
                variant="outline"
                size="sm"
                className="flex-1 sm:flex-initial" // Allow grow on mobile
                aria-label="Add song to playlist"
              >
                {isLoading ? (
                  <Loader2 className="animate-spin h-4 w-4" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                <span className="ml-2 hidden sm:inline">Add to Playlist</span>
                 <span className="ml-2 sm:hidden">Add</span> {/* Shorter text for mobile */}
              </Button>

              {/* Play Now Button */}
              <Button
                type="button" // Important: type="button"
                onClick={form.handleSubmit(onPlayNow)}
                disabled={isLoading || !form.formState.isValid}
                variant="secondary" // Different visual style
                size="sm"
                className="flex-1 sm:flex-initial" // Allow grow on mobile
                aria-label="Play song now"
              >
                {isLoading ? (
                  <Loader2 className="animate-spin h-4 w-4" />
                ) : (
                  <Play className="h-4 w-4 fill-current" /> // Play icon
                )}
                 <span className="ml-2 hidden sm:inline">Play Now</span>
                 <span className="ml-2 sm:hidden">Play</span> {/* Shorter text for mobile */}
              </Button>
            </div>
          </form>
        </Form>
      </div>

      {/* Playlist Selection Dialog */}
      <SelectPlaylistDialog
        isOpen={isSelectPlaylistDialogOpen}
        onOpenChange={(open) => {
          setIsSelectPlaylistDialogOpen(open);
          // Clear songToAdd if the dialog is closed without selection
          if (!open) {
            setSongToAdd(null);
          }
        }}
        playlists={playlists}
        onSelectPlaylist={handlePlaylistSelected}
        songTitle={songToAdd?.title}
      />
    </>
  );
}

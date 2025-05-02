'use client';

import React, { useState } from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { usePlaylistStore } from '@/store/playlist-store';
import type { Song } from '@/lib/types';
import { Play } from 'lucide-react';
import { SelectPlaylistDialog } from './select-playlist-dialog'; // Import the new dialog

const youtubeUrlSchema = z.object({
  url: z.string().url({ message: 'Please enter a valid YouTube URL.' }).refine(
    (url) => {
      try {
        const parsedUrl = new URL(url);
        return parsedUrl.hostname.includes('youtube.com') || parsedUrl.hostname === 'youtu.be';
      } catch {
        return false;
      }
    },
    { message: 'URL must be from youtube.com or youtu.be.' }
  ),
});

type YoutubeUrlFormValues = z.infer<typeof youtubeUrlSchema>;

interface AddSongFormProps {
  // selectedPlaylistId is no longer directly needed here for adding,
  // but could be kept if needed for other features (e.g., highlighting the current playlist)
  selectedPlaylistId: string | null; // Keep for context, but adding logic will change
}

// Simple interface for the data returned by the CORS proxy
interface YoutubeDLResponse {
  title: string;
  author: string;
  thumbnail: string;
}

export function AddSongForm({ selectedPlaylistId }: AddSongFormProps) {
  const { toast } = useToast();
  const { playlists, addSongToPlaylist, playSingleSong } = usePlaylistStore((state) => ({
      playlists: state.playlists,
      addSongToPlaylist: state.addSongToPlaylist,
      playSingleSong: state.playSingleSong,
  }));
  const [isLoading, setIsLoading] = useState(false); // General loading for add/fetch
  const [isPlayNowLoading, setIsPlayNowLoading] = useState(false);
  const [isSelectPlaylistDialogOpen, setIsSelectPlaylistDialogOpen] = useState(false);
  const [songToAdd, setSongToAdd] = useState<Song | null>(null);

  const form = useForm<YoutubeUrlFormValues>({
    resolver: zodResolver(youtubeUrlSchema),
    defaultValues: {
      url: '',
    },
  });

  const extractVideoId = (urlValue: string): string | null => {
      try {
        const url = new URL(urlValue);
        let videoId = '';
        if (url.hostname === 'youtu.be') {
          videoId = url.pathname.substring(1).split('/')[0];
        } else if (url.hostname.includes('youtube.com')) {
          videoId = url.searchParams.get('v') || '';
          if (!videoId && url.pathname.startsWith('/embed/')) {
            videoId = url.pathname.split('/')[2];
          }
          if (!videoId && url.pathname.startsWith('/shorts/')) {
            videoId = url.pathname.split('/')[2];
           }
        }
        videoId = videoId.split('?')[0];
        return videoId || null;
      } catch (error) {
        console.error("Error parsing URL:", error);
        return null;
      }
  };

  const fetchAndPrepareSong = async (urlValue: string): Promise<Song | null> => {
      const videoId = extractVideoId(urlValue);
      if (!videoId) {
          throw new Error('Could not extract video ID from URL.');
      }

      // Use a CORS proxy to fetch the video metadata without an API key
      const corsProxyUrl = `https://youtube-dl-web.rshanmukh.workers.dev/json?url=https://www.youtube.com/watch?v=${videoId}`;

      try {
          const response = await fetch(corsProxyUrl);
          if (!response.ok) {
              throw new Error(`Failed to fetch metadata from CORS proxy: ${response.status} - ${response.statusText}`);
          }
          const data: YoutubeDLResponse = await response.json();

          const song: Song = {
              id: videoId,
              title: data.title,
              author: data.author,
              url: `https://www.youtube.com/watch?v=${videoId}`, // Use canonical URL
              thumbnailUrl: data.thumbnail,
          };
          return song;
      } catch (error: any) {
          console.error('Error fetching and preparing song:', error);
          throw new Error(`Failed to fetch YouTube video metadata. ${error.message}`);
      }
  };

  // Handles the final step of adding the song after playlist selection (if needed)
  const addSongToSpecificPlaylist = (playlistId: string, song: Song) => {
     const added = addSongToPlaylist(playlistId, song); // Capture the return value
     if (added) { // Only show toast if the song was actually added
       toast({
         title: 'Song Added',
         description: `"${song.title}" added to the playlist.`,
       });
       form.reset(); // Clear the form only on success
     }
     // Reset state regardless of whether it was added (to close dialog etc.)
     setSongToAdd(null);
     setIsSelectPlaylistDialogOpen(false);
     setIsLoading(false);
  };


  // Triggered by the "Add to Playlist" button click
  async function handleAddToPlaylistClick(event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault(); // Prevent potential form submission
    const urlValue = form.getValues('url');
    const validationResult = youtubeUrlSchema.safeParse({ url: urlValue });

    if (!validationResult.success) {
      form.setError('url', { type: 'manual', message: validationResult.error.errors[0]?.message || 'Invalid URL' });
      return;
    }

    setIsLoading(true);
    try {
      const fetchedSong = await fetchAndPrepareSong(urlValue);
      if (!fetchedSong) {
           // Error should have been thrown by fetchAndPrepareSong
           setIsLoading(false);
           return;
      }

      setSongToAdd(fetchedSong); // Store the song data temporarily

      if (playlists.length === 0) {
        toast({
          title: 'No Playlists',
          description: 'Please create a playlist first before adding songs.',
          variant: 'destructive',
        });
        setSongToAdd(null); // Clear temporary song data
        setIsLoading(false);
      } else if (playlists.length === 1) {
        // Add directly to the only playlist
        addSongToSpecificPlaylist(playlists[0].id, fetchedSong);
        // addSongToSpecificPlaylist handles loading false, toast, reset etc.
      } else {
        // Multiple playlists: open the selection dialog
        setIsSelectPlaylistDialogOpen(true);
        // Keep isLoading true until a playlist is selected in the dialog
      }

    } catch (error) {
      console.error('Error preparing song:', error);
      toast({
        title: 'Error Preparing Song',
        description: error instanceof Error ? error.message : 'Could not fetch song details. Please check the URL and try again.',
        variant: 'destructive',
      });
      setSongToAdd(null);
      setIsLoading(false);
    }
    // Note: setIsLoading(false) is handled within the success/error paths or by the dialog callback
  }

  // Called from the SelectPlaylistDialog
  const handlePlaylistSelected = (playlistId: string) => {
     if (songToAdd) {
         addSongToSpecificPlaylist(playlistId, songToAdd);
     } else {
         console.error("Error: No song data available when playlist was selected.");
         toast({ title: "Error", description: "Could not add song. Please try again.", variant: "destructive" });
         setIsSelectPlaylistDialogOpen(false);
         setIsLoading(false);
         setSongToAdd(null);
     }
  };


  async function onPlayNow(event: React.MouseEvent<HTMLButtonElement>) {
     event.preventDefault();
     const urlValue = form.getValues('url');
     const validationResult = youtubeUrlSchema.safeParse({ url: urlValue });

     if (!validationResult.success) {
        form.setError('url', { type: 'manual', message: validationResult.error.errors[0]?.message || 'Invalid URL' });
        return;
     }

    setIsPlayNowLoading(true);
    try {
      const songToPlay = await fetchAndPrepareSong(urlValue);
      if (!songToPlay) return;

      playSingleSong(songToPlay);

      toast({
        title: 'Playing Now',
        description: `"${songToPlay.title}"`,
      });
    } catch (error) {
      console.error('Error playing song:', error);
      toast({
        title: 'Error Playing Song',
        description: error instanceof Error ? error.message : 'Could not play the song. Please check the URL and try again.',
        variant: 'destructive',
      });
    } finally {
      setIsPlayNowLoading(false);
    }
  }

  const isUrlValid = youtubeUrlSchema.safeParse(form.watch()).success;
  const isAnyLoading = isLoading || isPlayNowLoading;

  return (
    <>
      <Form {...form}>
        {/* Use a div instead of form to prevent default submission */}
        <div className="mb-8 flex flex-wrap items-end gap-2 md:flex-nowrap md:gap-4">
          <FormField
            control={form.control}
            name="url"
            render={({ field }) => (
              <FormItem className="flex-1 min-w-[200px]">
                <FormLabel>YouTube URL</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Paste a YouTube link here (e.g., https://www.youtube.com/watch?v=...)"
                    {...field}
                    disabled={isAnyLoading}
                    aria-label="YouTube URL Input"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="flex gap-2 w-full md:w-auto">
            <Button
              type="button"
              variant="outline"
              onClick={onPlayNow}
              disabled={isAnyLoading || !isUrlValid}
              aria-label="Play song now"
              className="flex-1 md:flex-none"
            >
              {isPlayNowLoading ? 'Loading...' : <Play className="mr-2 h-4 w-4" />}
              Play Now
            </Button>
            <Button
              type="button" // Change type to button
              onClick={handleAddToPlaylistClick} // Use the new handler
              disabled={isAnyLoading || !isUrlValid} // Disable only if loading or URL invalid
              aria-label="Add song to playlist"
              className="flex-1 md:flex-none"
            >
              {isLoading ? 'Processing...' : 'Add to Playlist'}
            </Button>
          </div>
        </div>
      </Form>

      {/* Playlist Selection Dialog */}
      <SelectPlaylistDialog
        isOpen={isSelectPlaylistDialogOpen}
        onOpenChange={(open) => {
             setIsSelectPlaylistDialogOpen(open);
             // If dialog is closed without selection, reset loading state
             if (!open) {
                setIsLoading(false);
                setSongToAdd(null);
             }
        }}
        playlists={playlists}
        onSelectPlaylist={handlePlaylistSelected}
        songTitle={songToAdd?.title} // Pass song title for context
      />
    </>
  );
}



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
import { getYoutubeVideoMetadata } from '@/services/youtube';
import type { Song } from '@/lib/types';
import { Play } from 'lucide-react';

const youtubeUrlSchema = z.object({
  url: z.string().url({ message: 'Please enter a valid YouTube URL.' }).refine(
    (url) => {
      // Basic check for youtube.com or youtu.be links
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
  selectedPlaylistId: string | null;
}

export function AddSongForm({ selectedPlaylistId }: AddSongFormProps) {
  const { toast } = useToast();
  const addSongToPlaylist = usePlaylistStore((state) => state.addSongToPlaylist);
  const playSingleSong = usePlaylistStore((state) => state.playSingleSong);
  const [isLoading, setIsLoading] = useState(false);
  const [isPlayNowLoading, setIsPlayNowLoading] = useState(false);

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
          videoId = url.pathname.substring(1).split('/')[0]; // Handle shorts etc.
        } else if (url.hostname.includes('youtube.com')) {
          videoId = url.searchParams.get('v') || '';
          if (!videoId && url.pathname.startsWith('/embed/')) {
            videoId = url.pathname.split('/')[2];
          }
          if (!videoId && url.pathname.startsWith('/shorts/')) {
            videoId = url.pathname.split('/')[2];
           }
        }
        // Further clean videoId if query params are appended
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

    const metadata = await getYoutubeVideoMetadata(videoId);

    const song: Song = {
      id: videoId,
      title: metadata.title,
      author: metadata.author,
      url: urlValue, // Store the original URL or a canonical one
      thumbnailUrl: metadata.thumbnailUrl,
    };
    return song;
  };

  async function onAddToPlaylist(data: YoutubeUrlFormValues) {
    if (!selectedPlaylistId) {
      toast({
        title: 'No Playlist Selected',
        description: 'Please select or create a playlist first.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    try {
      const newSong = await fetchAndPrepareSong(data.url);
      if (!newSong) return; // Error handled within fetchAndPrepareSong via throw

      addSongToPlaylist(selectedPlaylistId, newSong);

      toast({
        title: 'Song Added',
        description: `"${newSong.title}" added to the playlist.`,
      });
      form.reset(); // Clear the form
    } catch (error) {
      console.error('Error adding song:', error);
      toast({
        title: 'Error Adding Song',
        description: error instanceof Error ? error.message : 'Could not add the song. Please check the URL and try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }

  async function onPlayNow(event: React.MouseEvent<HTMLButtonElement>) {
     event.preventDefault(); // Prevent form submission if inside form
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
      // Optionally clear the form after playing
      // form.reset();
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
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onAddToPlaylist)} className="mb-8 flex flex-wrap items-end gap-2 md:flex-nowrap md:gap-4">
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
            type="submit"
            disabled={isAnyLoading || !selectedPlaylistId || !isUrlValid}
            aria-label="Add song to playlist"
             className="flex-1 md:flex-none"
          >
            {isLoading ? 'Adding...' : 'Add to Playlist'}
          </Button>
        </div>
      </form>
    </Form>
  );
}

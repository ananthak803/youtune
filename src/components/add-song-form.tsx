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
import { getYoutubeVideoMetadata } from '@/services/youtube'; // Assuming this service exists
import type { Song } from '@/lib/types';

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
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<YoutubeUrlFormValues>({
    resolver: zodResolver(youtubeUrlSchema),
    defaultValues: {
      url: '',
    },
  });

  async function onSubmit(data: YoutubeUrlFormValues) {
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
       // Extract video ID (simple extraction, might need refinement)
      let videoId = '';
      const url = new URL(data.url);
      if (url.hostname === 'youtu.be') {
        videoId = url.pathname.substring(1);
      } else if (url.hostname.includes('youtube.com')) {
        videoId = url.searchParams.get('v') || '';
         if (!videoId && url.pathname.startsWith('/embed/')) {
          videoId = url.pathname.split('/')[2];
        }
        // Add more robust extraction logic if needed for other URL formats
      }

      if (!videoId) {
          throw new Error('Could not extract video ID from URL.');
      }


      // Fetch metadata (replace with actual API call if available)
      const metadata = await getYoutubeVideoMetadata(videoId);

      const newSong: Song = {
        id: videoId, // Use video ID as song ID for simplicity
        title: metadata.title,
        author: metadata.author,
        url: data.url, // Store the original URL
        thumbnailUrl: metadata.thumbnailUrl,
      };

      addSongToPlaylist(selectedPlaylistId, newSong);

      toast({
        title: 'Song Added',
        description: `"${metadata.title}" added to the playlist.`,
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

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="mb-8 flex items-end gap-4">
        <FormField
          control={form.control}
          name="url"
          render={({ field }) => (
            <FormItem className="flex-1">
              <FormLabel>YouTube URL</FormLabel>
              <FormControl>
                <Input
                  placeholder="Paste a YouTube link here (e.g., https://www.youtube.com/watch?v=...)"
                  {...field}
                  disabled={isLoading}
                  aria-label="YouTube URL Input"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" disabled={isLoading || !selectedPlaylistId} aria-label="Add song to playlist">
          {isLoading ? 'Adding...' : 'Add Song'}
        </Button>
      </form>
    </Form>
  );
}

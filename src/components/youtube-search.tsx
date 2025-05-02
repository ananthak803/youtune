
// src/components/youtube-search.tsx
'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import Image from 'next/image';
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
import { Card, CardContent } from '@/components/ui/card'; // Use CardContent for padding
import { useToast } from '@/hooks/use-toast';
// Correct the import name as suggested by the error
import { searchYoutubeAction, getYoutubeMetadataAction } from '@/actions/youtube-actions';
import type { YoutubeSearchResult, Song, Playlist, YoutubeVideoMetadata } from '@/lib/types';
import { usePlaylistStore } from '@/store/playlist-store';
import { SelectPlaylistDialog } from './select-playlist-dialog';
import { ListPlus, Search, Loader2, Music, Youtube } from 'lucide-react'; // Added Youtube icon
import { ScrollArea } from '@/components/ui/scroll-area';
import { extractYoutubeVideoId } from '@/services/youtube';
import { cn } from '@/lib/utils';


const searchSchema = z.object({
  query: z.string().min(1, { message: 'Please enter a search term.' }),
});

type SearchFormValues = z.infer<typeof searchSchema>;

export function YoutubeSearch() {
  const { toast } = useToast();
  const { playlists, addSongToPlaylist } = usePlaylistStore((state) => ({
    playlists: state.playlists,
    addSongToPlaylist: state.addSongToPlaylist,
  }));

  const [searchResults, setSearchResults] = useState<YoutubeSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSelectPlaylistDialogOpen, setIsSelectPlaylistDialogOpen] = useState(false);
  const [songToAdd, setSongToAdd] = useState<Song | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const form = useForm<SearchFormValues>({
    resolver: zodResolver(searchSchema),
    defaultValues: {
      query: '',
    },
  });

  async function onSubmit(values: SearchFormValues) {
    setIsLoading(true);
    setHasSearched(true);
    setSearchResults([]); // Clear previous results immediately
    try {
      const results = await searchYoutubeAction(values.query);
      setSearchResults(results);
      if (results.length === 0) {
        toast({
          title: 'No Results',
          description: 'No videos found for your search query.',
        });
      }
    } catch (error) {
      console.error('Search failed:', error);
      toast({
        title: 'Search Error',
        description: error instanceof Error ? error.message : 'Could not perform search.',
        variant: 'destructive',
      });
      setSearchResults([]); // Ensure results are cleared on error
    } finally {
      setIsLoading(false);
    }
  }

  // Fetch metadata for a single video ID (used internally)
  const fetchMetadata = async (videoId: string): Promise<Song | null> => {
    try {
      // Use the server action which checks for API key internally
      // Correct the function name usage
      const metadata: YoutubeVideoMetadata = await getYoutubeMetadataAction(videoId);
      const song: Song = {
        id: videoId,
        title: metadata.title,
        author: metadata.author,
        url: `https://www.youtube.com/watch?v=${videoId}`,
        thumbnailUrl: metadata.thumbnailUrl,
      };
      return song;
    } catch (error: any) {
      console.error('Error fetching metadata for search result:', error);
      toast({
        title: 'Error Fetching Video Info',
        description: error.message || 'Could not fetch video details.',
        variant: 'destructive',
      });
      return null; // Indicate failure
    }
  };

  // Initiate adding process (fetch full metadata first)
  const handleInitiateAddSong = async (result: YoutubeSearchResult) => {
    setIsLoading(true); // Show loading state while fetching metadata
    const preparedSong = await fetchMetadata(result.videoId);
    setIsLoading(false);

    if (!preparedSong) return; // Stop if metadata fetch failed

    setSongToAdd(preparedSong);

    if (playlists.length === 0) {
      toast({
        title: 'No Playlists',
        description: 'Please create a playlist first.',
        variant: 'destructive',
      });
      setSongToAdd(null);
    } else if (playlists.length === 1) {
      // Add directly to the only playlist
      addSongToSpecificPlaylist(playlists[0].id, preparedSong);
    } else {
      // Open dialog to select playlist
      setIsSelectPlaylistDialogOpen(true);
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
    setSongToAdd(null);
    setIsSelectPlaylistDialogOpen(false);
  };

  // Called from the SelectPlaylistDialog
  const handlePlaylistSelected = (playlistId: string) => {
    if (songToAdd) {
      addSongToSpecificPlaylist(playlistId, songToAdd);
    } else {
      console.error("Error: No song data available when playlist was selected.");
      toast({ title: "Error", description: "Could not add song. Please try again.", variant: "destructive" });
      setIsSelectPlaylistDialogOpen(false);
      setSongToAdd(null);
    }
  };

  // Placeholder rendering
  const renderPlaceholder = () => (
     <div className="flex items-center justify-center h-full text-muted-foreground flex-col gap-4 text-center p-8"> {/* Increased padding */}
        <Youtube className="w-16 h-16 opacity-30 text-destructive" /> {/* Larger, subtle icon */}
        <p className="text-base font-medium">Search YouTube</p>
        <p className="text-sm">Find videos and add them directly to your playlists.</p>
     </div>
  );

  // Loading state rendering
  const renderLoading = () => (
    <div className="flex justify-center items-center py-12 flex-col gap-4">
        <Loader2 className="animate-spin h-10 w-10 text-primary" />
        <p className="text-muted-foreground">Searching...</p>
    </div>
  );

  return (
    <>
      {/* Search Form Section - sticky */}
       <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm px-4 pt-6 pb-4 border-b mb-4">
         <Form {...form}>
           <form onSubmit={form.handleSubmit(onSubmit)} className="flex items-center gap-2">
             <FormField
               control={form.control}
               name="query"
               render={({ field }) => (
                 <FormItem className="flex-1">
                   <FormLabel className="sr-only">Search Term</FormLabel>
                   <FormControl>
                     <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Search videos..."
                          {...field}
                          disabled={isLoading}
                          aria-label="YouTube Search Input"
                          className="h-9 pl-8 rounded-full focus-visible:ring-primary bg-muted border-transparent focus:border-border focus:bg-background" // Tweaked input style
                        />
                     </div>
                   </FormControl>
                   <FormMessage className="text-xs mt-1" />
                 </FormItem>
               )}
             />
             <Button type="submit" disabled={isLoading} aria-label="Search YouTube" size="icon" className="h-9 w-9 rounded-full flex-shrink-0">
               {isLoading ? <Loader2 className="animate-spin h-4 w-4" /> : <Search className="h-4 w-4" />}
               <span className="sr-only">Search</span>
             </Button>
           </form>
         </Form>
       </div>

      {/* Results Area - Scrollable */}
      <ScrollArea className="flex-1 px-4 pb-6"> {/* Added padding */}
         {isLoading && renderLoading()}

         {!isLoading && searchResults.length > 0 && (
           <div className="space-y-3">
             {searchResults.map((result) => (
               <Card key={result.videoId} className="group overflow-hidden transition-shadow hover:shadow-md border border-transparent hover:border-border bg-card/50 hover:bg-card">
                 <CardContent className="p-0 flex items-center gap-3"> {/* No internal padding, flex layout */}
                   {/* Image Container */}
                   <div className="w-20 h-16 sm:w-24 sm:h-[68px] flex-shrink-0 relative bg-muted overflow-hidden rounded-l-md"> {/* Slightly taller, rounded left */}
                     <Image
                       src={result.thumbnailUrl || '/placeholder-album.svg'}
                       alt={result.title}
                       fill
                       sizes="(max-width: 640px) 80px, 96px" // Responsive sizes
                       className="object-cover transition-transform group-hover:scale-105" // Subtle hover zoom
                       data-ai-hint="youtube video thumbnail"
                       unoptimized // Optimization might be less critical here, consider enabling if needed
                       onError={(e) => {
                         e.currentTarget.style.display = 'none';
                         const parent = e.currentTarget.parentElement;
                         if (parent && !parent.querySelector('.placeholder-icon')) {
                           const icon = document.createElement('div');
                           icon.className = 'placeholder-icon absolute inset-0 flex items-center justify-center text-muted-foreground bg-muted';
                           icon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-music h-6 w-6 opacity-50"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>`;
                           parent.appendChild(icon);
                         }
                       }}
                     />
                   </div>
                   {/* Text Content */}
                   <div className="flex-1 min-w-0 py-2 pr-2"> {/* Padding for text */}
                     <p className="font-medium text-sm leading-snug line-clamp-2 mb-0.5 group-hover:text-primary transition-colors">{result.title}</p> {/* Limit to 2 lines, change color on hover */}
                     <p className="text-xs text-muted-foreground line-clamp-1">{result.author}</p> {/* Limit author to 1 line */}
                   </div>
                   {/* Add Button */}
                   <div className="pr-3 pl-1 flex-shrink-0"> {/* Padding around button */}
                       <Button
                         variant="ghost"
                         size="icon"
                         className={cn(
                            "h-8 w-8 text-muted-foreground transition-opacity opacity-0 group-hover:opacity-100 focus-visible:opacity-100", // Fade in on hover
                            "hover:bg-accent/50 hover:text-accent-foreground", // Subtle hover background
                            (isLoading || isSelectPlaylistDialogOpen || (songToAdd !== null && songToAdd.id === result.videoId)) && "cursor-not-allowed opacity-30" // Dim if disabled
                         )}
                         onClick={() => handleInitiateAddSong(result)}
                         aria-label={`Add "${result.title}" to playlist`}
                         disabled={isLoading || isSelectPlaylistDialogOpen || (songToAdd !== null && songToAdd.id === result.videoId)}
                       >
                         <ListPlus className="h-5 w-5" />
                       </Button>
                   </div>
                 </CardContent>
               </Card>
             ))}
           </div>
         )}

         {/* Placeholder or "No results" message */}
         {!isLoading && !hasSearched && searchResults.length === 0 && renderPlaceholder()}
         {!isLoading && hasSearched && searchResults.length === 0 && (
           <div className="flex items-center justify-center h-full text-muted-foreground flex-col gap-2 text-center p-8">
             <Search className="w-12 h-12 opacity-30" />
             <p className="text-sm mt-2">No results found.</p>
             <p className="text-xs text-muted-foreground/80">Try searching for something else.</p>
           </div>
         )}
      </ScrollArea>

      {/* Dialog remains the same */}
      <SelectPlaylistDialog
        isOpen={isSelectPlaylistDialogOpen}
        onOpenChange={(open) => {
          setIsSelectPlaylistDialogOpen(open);
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

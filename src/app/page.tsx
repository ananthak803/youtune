
'use client';

import { useState, useEffect } from 'react';
import { Sidebar } from '@/components/sidebar';
import { Player } from '@/components/player';
import { PlaylistView } from '@/components/playlist-view';
import { AddSongForm } from '@/components/add-song-form'; // Re-import AddSongForm
import { YoutubeSearch } from '@/components/youtube-search'; // Import the search component
import { QueueView } from '@/components/queue-view'; // Import QueueView
import type { Playlist } from '@/lib/types';
import { usePlaylistStore } from '@/store/playlist-store';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
  DialogClose,
 } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetTrigger, SheetClose } from '@/components/ui/sheet';
import { Plus, ListMusic, Search, Settings, ListOrdered, Youtube, Link as LinkIcon, Share2 } from 'lucide-react'; // Import Youtube icon, LinkIcon, Share2
import { useIsMobile } from '@/hooks/use-mobile';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'; // Import Tooltip components
import { toast } from '@/hooks/use-toast'; // Import toast

export default function Home() {
  // Get state from the store
  const playlists = usePlaylistStore((state) => state.playlists);
  const activePlaylistId = usePlaylistStore((state) => state.activePlaylistId); // ID of the playlist being *viewed*
  const setActivePlaylistId = usePlaylistStore((state) => state.setActivePlaylistId); // Action to change *viewed* playlist

  // Local state
  const [selectedPlaylistForView, setSelectedPlaylistForView] = useState<Playlist | null>(null);
  const [isSearchSidebarOpen, setIsSearchSidebarOpen] = useState(false); // State for search sidebar
  const [isPlaylistSheetOpen, setIsPlaylistSheetOpen] = useState(false); // State for mobile playlist sheet
  const [isQueueSheetOpen, setIsQueueSheetOpen] = useState(false); // State for queue sheet
  const [isAddSongDialogOpen, setIsAddSongDialogOpen] = useState(false); // State for Add Song Dialog

  const isMobile = useIsMobile(); // Check if mobile

  // Effect to update the local state when the activePlaylistId changes in the store
  useEffect(() => {
    const newlySelectedPlaylist = playlists.find((p) => p.id === activePlaylistId) ?? null;
    setSelectedPlaylistForView(newlySelectedPlaylist);
  }, [activePlaylistId, playlists]);

  // Handler for selecting a playlist in the sidebar
  const handleSelectPlaylistForView = (playlist: Playlist) => {
    setActivePlaylistId(playlist.id);
     if (isMobile) {
       setIsPlaylistSheetOpen(false); // Close sheet on selection in mobile
     }
  };

  const handleSharePlaylist = (playlist: Playlist | null) => {
      if (!playlist) return;
      const playlistUrl = `${window.location.origin}/playlist/${playlist.id}`; // Basic share URL structure
      navigator.clipboard.writeText(playlistUrl)
        .then(() => {
          toast({
            title: "Link Copied!",
            description: `Link to playlist "${playlist.name}" copied to clipboard.`,
          });
        })
        .catch(err => {
          console.error('Failed to copy playlist link: ', err);
           toast({
             title: "Copy Failed",
             description: "Could not copy the link to your clipboard.",
             variant: "destructive",
           });
        });
    };


  return (
    <TooltipProvider>
      <div className="flex h-dvh flex-col bg-background text-foreground overflow-hidden"> {/* Use dvh for dynamic viewport height */}
        {/* Header for Mobile */}
        {isMobile && (
          <header className="flex items-center justify-between p-3 border-b bg-card sticky top-0 z-20">
              <h1 className="text-xl font-bold text-primary">YouTune</h1>
              {/* Maybe add share button here too? */}
               <Button
                   variant="ghost"
                   size="icon"
                   onClick={() => handleSharePlaylist(selectedPlaylistForView)}
                   disabled={!selectedPlaylistForView}
                   aria-label="Share current playlist"
                 >
                   <Share2 className="h-5 w-5" />
                 </Button>
          </header>
        )}

        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar (Hidden on Mobile, shown in Sheet) */}
          {!isMobile && (
              <Sidebar
                playlists={playlists}
                selectedPlaylistId={activePlaylistId}
                onSelectPlaylist={handleSelectPlaylistForView}
              />
          )}

          <main className="flex flex-1 flex-col overflow-hidden relative">

            <ScrollArea className="flex-1">
              <div className="container mx-auto px-4 pt-6 pb-8 md:px-8"> {/* Reduced pt to 6 */}

                 {/* Search Button & Add URL Button Container */}
                 <div className="mb-6 flex flex-row items-stretch gap-3"> {/* Stretch items */}

                   {/* Button to open YouTube Search (Main Action) */}
                   <Sheet open={isSearchSidebarOpen} onOpenChange={setIsSearchSidebarOpen}>
                     <SheetTrigger asChild>
                       <Button
                         variant="outline"
                         size="default"
                         className="flex-1 flex items-center gap-2 justify-center h-11" // Take more space, fixed height
                         aria-label="Search YouTube"
                       >
                         <Youtube className="h-5 w-5 text-destructive" />
                         Search YouTube
                       </Button>
                     </SheetTrigger>
                     <SheetContent side="right" className="w-full sm:max-w-md md:max-w-lg flex flex-col p-0"> {/* Adjust max width, remove padding */}
                       <SheetHeader className="px-4 sm:px-6 pt-6 pb-4 border-b sticky top-0 bg-background/95 backdrop-blur-sm z-10">
                          <SheetTitle>Search YouTube</SheetTitle>
                          <SheetDescription>
                            Find videos and add them to your playlists.
                          </SheetDescription>
                       </SheetHeader>
                       <div className="flex-1 overflow-hidden flex flex-col">
                           {/* YoutubeSearch component now handles its own padding and scrolling */}
                           <YoutubeSearch />
                       </div>
                       {/* Close button handled by SheetContent */}
                     </SheetContent>
                   </Sheet>

                   {/* Button to open Add Song via URL Dialog (Secondary Action) */}
                   <Dialog open={isAddSongDialogOpen} onOpenChange={setIsAddSongDialogOpen}>
                     <Tooltip>
                       <TooltipTrigger asChild>
                         <DialogTrigger asChild>
                            <Button
                             variant="outline"
                             size="icon" // Keep as icon button
                             className="shrink-0 h-11 w-11" // Fixed height/width
                             aria-label="Add song from URL"
                            >
                             <LinkIcon className="h-5 w-5" />
                           </Button>
                         </DialogTrigger>
                       </TooltipTrigger>
                       <TooltipContent>
                         <p>Add song from URL</p>
                       </TooltipContent>
                     </Tooltip>
                     <DialogContent className="sm:max-w-[550px]">
                       <DialogHeader>
                         <DialogTitle>Add Song from URL</DialogTitle>
                         <DialogDescription>
                           Paste a YouTube video URL to add it to a playlist or play it directly.
                         </DialogDescription>
                       </DialogHeader>
                       {/* AddSongForm is now inside the dialog */}
                       <div className="pt-4">
                           <AddSongForm onSongAdded={() => setIsAddSongDialogOpen(false)} />
                       </div>
                     </DialogContent>
                   </Dialog>

                 </div>


                {/* Conditional Rendering: Show Playlist or Placeholder */}
                {selectedPlaylistForView ? (
                  <>
                      <Separator className="my-6" />
                      {/* Share Button - Desktop */}
                      {!isMobile && (
                        <div className="flex justify-end mb-4">
                            <Tooltip>
                               <TooltipTrigger asChild>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleSharePlaylist(selectedPlaylistForView)}
                                    disabled={!selectedPlaylistForView}
                                    className="flex items-center gap-2"
                                    aria-label="Share playlist"
                                  >
                                    <Share2 className="h-4 w-4" />
                                    Share
                                  </Button>
                               </TooltipTrigger>
                               <TooltipContent>
                                   <p>Copy link to this playlist</p>
                               </TooltipContent>
                            </Tooltip>
                        </div>
                      )}
                      <PlaylistView playlist={selectedPlaylistForView} />
                  </>
                ) : (
                  <>
                       <Separator className="my-6" />
                       <div className="flex h-[50vh] items-center justify-center text-muted-foreground text-center px-4">
                           <p>Select or create a playlist to get started.</p>
                       </div>
                   </>
                )}
              </div>
            </ScrollArea>
          </main>

        </div>
        {/* Player */}
        <Player />

        {/* Mobile Bottom Navigation */}
        {isMobile && (
          <nav className="flex justify-around items-center p-2 border-t bg-card sticky bottom-0 z-20">
            {/* Playlists Sheet Trigger */}
            <Sheet open={isPlaylistSheetOpen} onOpenChange={setIsPlaylistSheetOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="sm" className="flex flex-col h-auto items-center gap-1 text-muted-foreground text-xs">
                  <ListMusic className="h-5 w-5" />
                  Playlists
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-4/5 max-w-xs p-0">
                <Sidebar
                  playlists={playlists}
                  selectedPlaylistId={activePlaylistId}
                  onSelectPlaylist={handleSelectPlaylistForView}
                />
              </SheetContent>
            </Sheet>

             {/* Search Sheet Trigger */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsSearchSidebarOpen(true)}
              className="flex flex-col h-auto items-center gap-1 text-muted-foreground text-xs"
            >
              <Search className="h-5 w-5" />
              Search
            </Button>

            {/* Add URL Dialog Trigger (Mobile) */}
             <Dialog open={isAddSongDialogOpen} onOpenChange={setIsAddSongDialogOpen}>
                 <DialogTrigger asChild>
                   <Button variant="ghost" size="sm" className="flex flex-col h-auto items-center gap-1 text-muted-foreground text-xs">
                     <LinkIcon className="h-5 w-5" />
                     Add URL
                   </Button>
                 </DialogTrigger>
               <DialogContent>
                  <DialogHeader>
                     <DialogTitle>Add Song from URL</DialogTitle>
                     <DialogDescription>
                       Paste a YouTube video URL.
                     </DialogDescription>
                   </DialogHeader>
                   <div className="pt-4">
                      <AddSongForm onSongAdded={() => setIsAddSongDialogOpen(false)} />
                   </div>
               </DialogContent>
             </Dialog>

             {/* Queue Sheet Trigger */}
             <Sheet open={isQueueSheetOpen} onOpenChange={setIsQueueSheetOpen}>
               <SheetTrigger asChild>
                 <Button variant="ghost" size="sm" className="flex flex-col h-auto items-center gap-1 text-muted-foreground text-xs">
                   <ListOrdered className="h-5 w-5" />
                   Queue
                 </Button>
               </SheetTrigger>
               <SheetContent side="right" className="w-full max-w-md p-0 flex flex-col">
                 <SheetHeader className="p-4 border-b sticky top-0 bg-background/95 backdrop-blur-sm z-10">
                   <SheetTitle>Playback Queue</SheetTitle>
                 </SheetHeader>
                 {/* Add explicit title for accessibility */}
                 <h2 className="sr-only">Playback Queue</h2>
                 <QueueView />
               </SheetContent>
             </Sheet>

          </nav>
        )}
      </div>
    </TooltipProvider>
  );
}

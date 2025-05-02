
'use client';

import * as React from 'react';
import { Plus, ListMusic } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import type { Playlist } from '@/lib/types';
import { CreatePlaylistDialog } from './create-playlist-dialog';
import { usePlaylistStore } from '@/store/playlist-store';
import { Separator } from '@/components/ui/separator'; // Import Separator

interface SidebarProps {
  playlists: Playlist[];
  selectedPlaylistId: string | null; // ID of the playlist currently being *viewed*
  onSelectPlaylist: (playlist: Playlist) => void; // Callback when a playlist is selected for *viewing*
}

export function Sidebar({
  playlists,
  selectedPlaylistId,
  onSelectPlaylist,
}: SidebarProps) {
  const createPlaylist = usePlaylistStore((state) => state.createPlaylist);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = React.useState(false);

  const handleCreatePlaylist = (name: string) => {
    if (name.trim()) {
      createPlaylist(name.trim());
      setIsCreateDialogOpen(false); // Close dialog after creation
    }
  };

  return (
    <aside className="w-60 flex-shrink-0 border-r border-sidebar-border bg-sidebar text-sidebar-foreground p-3 flex flex-col h-screen"> {/* Use sidebar theme, adjust width/padding */}
      {/* App Title */}
      <div className="flex items-center gap-2 px-3 pt-2 pb-4 mb-2">
          <h1 className="text-xl font-bold text-primary">YouTune</h1> {/* Use Primary text color */}
      </div>


      {/* Playlist List */}
      <ScrollArea className="flex-1 mb-3"> {/* Add margin-bottom */}
        <nav className="flex flex-col gap-1 px-1"> {/* Adjust padding */}
          {playlists.map((playlist) => (
            <Button
              key={playlist.id}
              // Use sidebar-accent for selected background
              variant={selectedPlaylistId === playlist.id ? 'secondary' : 'ghost'}
              className={cn(
                'w-full justify-start h-9 rounded-md text-sm', // Slightly smaller height, standard rounding
                selectedPlaylistId === playlist.id
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium' // Use sidebar specific colors
                    : 'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground text-sidebar-foreground/80', // Adjust hover and default text
                'truncate'
              )}
              onClick={() => onSelectPlaylist(playlist)}
            >
              <ListMusic className="mr-2 h-4 w-4 flex-shrink-0" />
              <span className="truncate">{playlist.name}</span>
            </Button>
          ))}
           {playlists.length === 0 && (
             <p className="text-xs text-sidebar-foreground/60 px-2 mt-2 text-center">No playlists yet.</p> // Adjusted text style
           )}
        </nav>
      </ScrollArea>

      {/* Separator */}
       <Separator className="my-2 bg-sidebar-border" />

      {/* Create Playlist Button at Bottom */}
      <div className="mt-auto pb-1 px-1"> {/* mt-auto pushes to bottom, add padding */}
         <Button
            variant="outline" // Changed to outline for better visibility
            className="w-full justify-start h-9 rounded-md text-sm border-sidebar-border text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground hover:border-sidebar-accent" // Match playlist item style, adjust border
            onClick={() => setIsCreateDialogOpen(true)}
          >
            <Plus className="mr-2 h-4 w-4" />
            Create New Playlist
          </Button>
      </div>


       <CreatePlaylistDialog
        isOpen={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onCreate={handleCreatePlaylist}
      />
    </aside>
  );
}

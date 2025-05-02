
'use client';

import * as React from 'react';
import { Plus, ListMusic } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import type { Playlist } from '@/lib/types';
import { CreatePlaylistDialog } from './create-playlist-dialog';
import { usePlaylistStore } from '@/store/playlist-store';

interface SidebarProps {
  playlists: Playlist[];
  selectedPlaylistId: string | null; // ID of the playlist currently being *viewed*
  onSelectPlaylist: (playlist: Playlist) => void; // Callback when a playlist is selected for *viewing*
  // onCreatePlaylist is handled directly by the store
}

export function Sidebar({
  playlists,
  selectedPlaylistId, // This is the ID of the playlist being viewed
  onSelectPlaylist,
}: SidebarProps) {
  const createPlaylist = usePlaylistStore((state) => state.createPlaylist);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = React.useState(false);

  const handleCreatePlaylist = (name: string) => {
    if (name.trim()) {
      createPlaylist(name.trim());
      setIsCreateDialogOpen(false);
    }
  };


  return (
    <aside className="w-64 flex-shrink-0 border-r border-border bg-card p-4 flex flex-col">
      <h2 className="text-2xl font-bold mb-6">YouTune</h2>

      <Button
        variant="ghost"
        className="w-full justify-start mb-4"
        onClick={() => setIsCreateDialogOpen(true)}
      >
        <Plus className="mr-2 h-4 w-4" />
        Create Playlist
      </Button>

      <h3 className="text-sm font-semibold text-muted-foreground mb-2 px-2">Playlists</h3>
      <ScrollArea className="flex-1">
        <nav className="flex flex-col gap-1 pr-2">
          {playlists.map((playlist) => (
            <Button
              key={playlist.id}
              // Highlight based on the selectedPlaylistId prop (the viewed playlist)
              variant={selectedPlaylistId === playlist.id ? 'secondary' : 'ghost'}
              className={cn(
                'w-full justify-start truncate',
                selectedPlaylistId === playlist.id && 'font-semibold' // Keep font-semibold, rely on variant for color
              )}
              onClick={() => onSelectPlaylist(playlist)} // Trigger the view change callback
            >
              <ListMusic className="mr-2 h-4 w-4 flex-shrink-0" />
              <span className="truncate">{playlist.name}</span>
            </Button>
          ))}
           {playlists.length === 0 && (
             <p className="text-sm text-muted-foreground px-2 mt-2">No playlists yet. Create one!</p>
           )}
        </nav>
      </ScrollArea>

       <CreatePlaylistDialog
        isOpen={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onCreate={handleCreatePlaylist}
      />
    </aside>
  );
}

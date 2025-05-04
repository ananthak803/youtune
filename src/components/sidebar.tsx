
// src/components/sidebar.tsx

'use client';

import * as React from 'react';
import { Plus, ListMusic, MoreHorizontal, Trash2, Pencil } from 'lucide-react'; // Added Pencil icon
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import type { Playlist } from '@/lib/types';
import { CreatePlaylistDialog } from './create-playlist-dialog';
import { DeletePlaylistDialog } from './delete-playlist-dialog'; // Import Delete dialog
import { RenamePlaylistDialog } from './rename-playlist-dialog'; // Import Rename dialog
import { usePlaylistStore } from '@/store/playlist-store';
import { Separator } from '@/components/ui/separator';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"; // Import Dropdown components
import { toast } from '@/hooks/use-toast'; // Import toast
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
  } from "@/components/ui/tooltip";


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
  const { createPlaylist, deletePlaylist, renamePlaylist } = usePlaylistStore((state) => ({
     createPlaylist: state.createPlaylist,
     deletePlaylist: state.deletePlaylist, // Get delete action
     renamePlaylist: state.renamePlaylist, // Get rename action
   }));
  const [isCreateDialogOpen, setIsCreateDialogOpen] = React.useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false); // State for delete dialog
  const [playlistToDelete, setPlaylistToDelete] = React.useState<Playlist | null>(null); // State for playlist to delete
  const [isRenameDialogOpen, setIsRenameDialogOpen] = React.useState(false); // State for rename dialog
  const [playlistToRename, setPlaylistToRename] = React.useState<Playlist | null>(null); // State for playlist to rename


  const handleCreatePlaylist = (name: string) => {
    if (name.trim()) {
      createPlaylist(name.trim());
      setIsCreateDialogOpen(false); // Close dialog after creation
       toast({ title: 'Playlist Created', description: `"${name.trim()}" has been created.` });
    }
  };

  // --- Delete Logic ---
  const openDeleteDialog = (playlist: Playlist) => {
    setPlaylistToDelete(playlist);
    setIsDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (playlistToDelete) {
       const deletedName = playlistToDelete.name;
      deletePlaylist(playlistToDelete.id);
      setIsDeleteDialogOpen(false);
      setPlaylistToDelete(null);
      toast({ title: 'Playlist Deleted', description: `"${deletedName}" has been deleted.`, variant: 'destructive' });
    }
  };

   // --- Rename Logic ---
   const openRenameDialog = (playlist: Playlist) => {
      setPlaylistToRename(playlist);
      setIsRenameDialogOpen(true);
    };

    const handleConfirmRename = (newName: string) => {
      if (playlistToRename && newName.trim() && newName.trim() !== playlistToRename.name) {
         const oldName = playlistToRename.name;
        renamePlaylist(playlistToRename.id, newName.trim());
        setIsRenameDialogOpen(false);
        setPlaylistToRename(null);
        toast({ title: 'Playlist Renamed', description: `"${oldName}" renamed to "${newName.trim()}".` });
      } else {
          // Close dialog even if name didn't change or was empty
           setIsRenameDialogOpen(false);
           setPlaylistToRename(null);
           if(newName.trim() === playlistToRename?.name) {
             toast({ title: 'No Change', description: 'Playlist name was not changed.' });
           } else if (!newName.trim()) {
             toast({ title: 'Invalid Name', description: 'Playlist name cannot be empty.', variant: 'destructive'});
           }
      }
    };


  // Ensure this return statement wraps the main JSX
  return (
    <aside className="w-64 flex-shrink-0 border-r border-sidebar-border bg-sidebar text-sidebar-foreground p-3 flex flex-col h-full max-h-dvh select-none"> {/* Use dVH and add select-none */}
      {/* App Title */}
      <div className="flex items-center gap-2 px-3 pt-2 pb-4 mb-1 select-none"> {/* Added select-none */}
          {/* Removed SVG icon */}
          <h1 className="text-xl font-bold text-primary">YouTune</h1>
      </div>

      {/* Create Playlist Button */}
      <div className="px-1 mb-3">
         <Button
            variant="ghost" // More subtle variant
            className="w-full justify-start h-9 rounded-md text-sm border border-sidebar-border text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground hover:border-sidebar-accent"
            onClick={() => setIsCreateDialogOpen(true)}
          >
            <Plus className="mr-2 h-4 w-4" />
            Create Playlist
          </Button>
      </div>

      <Separator className="mb-3 bg-sidebar-border" />

      {/* Playlist List */}
      <ScrollArea className="flex-1 -mx-1"> {/* Negative margin to offset button padding */}
        <nav className="flex flex-col gap-1 px-1 py-1">
          {playlists.map((playlist) => (
            <div key={playlist.id} className="group relative flex items-center w-full select-none"> {/* Added select-none */}
              <Button
                variant={selectedPlaylistId === playlist.id ? 'secondary' : 'ghost'}
                className={cn(
                  'w-full justify-start h-9 rounded-md text-sm pl-3 pr-8', // Added padding for icon
                  selectedPlaylistId === playlist.id
                      ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
                      : 'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground text-sidebar-foreground/80',
                  'truncate'
                )}
                onClick={() => onSelectPlaylist(playlist)}
                title={playlist.name} // Tooltip for long names
              >
                <ListMusic className="mr-2 h-4 w-4 flex-shrink-0" />
                <span className="truncate flex-1">{playlist.name}</span>
              </Button>
              {/* Dropdown Menu for actions */}
               <DropdownMenu>
                 <DropdownMenuTrigger asChild>
                   <Button
                      variant="ghost"
                      size="icon"
                      className="absolute right-1 h-7 w-7 rounded-md opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
                      aria-label={`More options for ${playlist.name}`}
                    >
                     <MoreHorizontal className="h-4 w-4" />
                   </Button>
                 </DropdownMenuTrigger>
                 <DropdownMenuContent side="right" align="start">
                   <DropdownMenuItem
                     onClick={() => openRenameDialog(playlist)}
                   >
                       <Pencil className="mr-2 h-4 w-4" /> Rename
                   </DropdownMenuItem>
                   <DropdownMenuItem
                     className="text-destructive focus:text-destructive focus:bg-destructive/10"
                     onClick={() => openDeleteDialog(playlist)}
                   >
                     <Trash2 className="mr-2 h-4 w-4" /> Delete
                   </DropdownMenuItem>
                 </DropdownMenuContent>
               </DropdownMenu>
            </div>
          ))}
           {playlists.length === 0 && (
             <p className="text-xs text-sidebar-foreground/60 px-2 mt-2 text-center select-none">No playlists yet.</p> // Added select-none
           )}
        </nav>
      </ScrollArea>

      {/* Dialogs */}
       <CreatePlaylistDialog
        isOpen={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onCreate={handleCreatePlaylist}
      />
       <DeletePlaylistDialog
         isOpen={isDeleteDialogOpen}
         onOpenChange={setIsDeleteDialogOpen}
         playlistName={playlistToDelete?.name}
         onConfirm={handleConfirmDelete}
       />
       {/* Rename Playlist Dialog */}
       {playlistToRename && ( // Conditionally render to ensure playlistToRename is not null
         <RenamePlaylistDialog
           isOpen={isRenameDialogOpen}
           onOpenChange={setIsRenameDialogOpen}
           playlist={playlistToRename}
           onRename={handleConfirmRename}
         />
       )}
    </aside>
  );
}

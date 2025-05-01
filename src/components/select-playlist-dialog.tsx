
'use client';

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ListMusic } from 'lucide-react';
import type { Playlist } from '@/lib/types';
import { cn } from '@/lib/utils';

interface SelectPlaylistDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  playlists: Playlist[];
  onSelectPlaylist: (playlistId: string) => void;
  songTitle?: string; // Optional: display the song being added
}

export function SelectPlaylistDialog({
  isOpen,
  onOpenChange,
  playlists,
  onSelectPlaylist,
  songTitle
}: SelectPlaylistDialogProps) {

  const handleSelect = (playlistId: string) => {
    onSelectPlaylist(playlistId);
    // Dialog closure is handled by the parent component after the action completes
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Select Playlist</DialogTitle>
          <DialogDescription>
            Choose a playlist to add {songTitle ? `"${songTitle}"` : "the song"} to.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[40vh] my-4">
          <div className="flex flex-col gap-2 pr-4">
            {playlists.map((playlist) => (
              <Button
                key={playlist.id}
                variant="ghost"
                className="w-full justify-start truncate"
                onClick={() => handleSelect(playlist.id)}
              >
                <ListMusic className="mr-2 h-4 w-4 flex-shrink-0" />
                <span className="truncate">{playlist.name}</span>
              </Button>
            ))}
          </div>
        </ScrollArea>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          {/* No primary action button needed, selection is done via list items */}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

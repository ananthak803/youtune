
'use client';

import React from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button"; // For the action button variant

interface DeletePlaylistDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  playlistName?: string; // Name of the playlist to confirm deletion
  onConfirm: () => void; // Callback function when deletion is confirmed
}

export function DeletePlaylistDialog({
  isOpen,
  onOpenChange,
  playlistName,
  onConfirm
}: DeletePlaylistDialogProps) {

  return (
    <AlertDialog open={isOpen} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. This will permanently delete the
             playlist "{playlistName || 'this playlist'}" and remove all its songs.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel asChild>
             <Button variant="outline">Cancel</Button>
          </AlertDialogCancel>
          <AlertDialogAction asChild>
             <Button variant="destructive" onClick={onConfirm}>Delete</Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

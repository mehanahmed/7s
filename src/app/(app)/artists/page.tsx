"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious, PaginationEllipsis } from '@/components/ui/pagination';
import { Search, MoreVertical, Trash2, Palette } from 'lucide-react';
import type { User } from '@/types';
import { getUsers } from '@/lib/user-service';
import { deleteUserAction } from '@/app/(app)/users/actions';
import { useAuth } from '@/contexts/auth-context';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const DeleteUserDialog = dynamic(() => import('@/components/users/delete-user-dialog').then(mod => mod.DeleteUserDialog));

const getInitials = (name: string) => {
  if (!name) return '??';
  const names = name.split(' ');
  if (names.length === 1) return names[0].charAt(0).toUpperCase();
  return names[0].charAt(0).toUpperCase() + (names[names.length - 1] ? names[names.length - 1].charAt(0).toUpperCase() : '');
};

const ITEMS_PER_PAGE = 25;

export default function ArtistsPage() {
  const { currentUser } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [isLoading, setIsLoading] = useState(true);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const users = await getUsers();
      setAllUsers(users);
    } catch (error) {
      console.error('Failed to load artist list:', error);
      toast({ title: 'Error', description: 'Could not load artists.', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (currentUser && ['SYSTEM_ADMIN', 'ADMIN'].includes(currentUser.role)) {
      void fetchData();
    } else if (currentUser) {
      router.replace('/dashboard');
    }
  }, [currentUser, fetchData, router]);

  const artists = useMemo(() => allUsers.filter(user => user.role === 'ARTIST'), [allUsers]);
  const artistCategories = useMemo(() => Array.from(new Set(
    artists.map(artist => artist.category?.trim()).filter((category): category is string => !!category)
  )).sort((a, b) => a.localeCompare(b)), [artists]);

  const filteredArtists = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return artists.filter(artist => {
      const category = artist.category?.trim() || '';
      const matchesCategory = selectedCategory === 'all' ||
        (selectedCategory === 'uncategorized' ? !category : `category:${category}` === selectedCategory);
      const matchesSearch = !query || artist.name.toLowerCase().includes(query) ||
        artist.email?.toLowerCase().includes(query) || artist.phone?.toLowerCase().includes(query) ||
        artist.address?.toLowerCase().includes(query);
      return matchesCategory && matchesSearch;
    });
  }, [artists, searchTerm, selectedCategory]);

  const totalPages = Math.ceil(filteredArtists.length / ITEMS_PER_PAGE);
  useEffect(() => { setCurrentPage(1); }, [searchTerm, selectedCategory]);
  useEffect(() => { setCurrentPage(page => Math.min(page, Math.max(1, totalPages))); }, [totalPages]);
  const paginatedData = filteredArtists.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const handleConfirmDelete = async () => {
    if (!userToDelete) return;
    setIsDeleting(true);
    try {
      const result = await deleteUserAction(userToDelete.id);
      if (result.success) {
        setUserToDelete(null);
        toast({ title: 'Artist Deleted', description: 'The artist user account has been successfully deleted.' });
        void fetchData();
      } else {
        toast({ title: 'Error', description: result.error || 'Could not delete the artist.', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Could not delete the artist.', variant: 'destructive' });
    } finally {
      setIsDeleting(false);
    }
  };

  const renderPagination = () => {
    const pageNumbers = [];
    const maxPagesToShow = 5;

    if (totalPages <= maxPagesToShow) {
      for (let i = 1; i <= totalPages; i++) pageNumbers.push(i);
    } else {
      let startPage = Math.max(1, currentPage - 2);
      let endPage = Math.min(totalPages, currentPage + 2);

      if (currentPage < 3) endPage = maxPagesToShow;
      else if (currentPage > totalPages - 2) startPage = totalPages - maxPagesToShow + 1;

      if (startPage > 1) {
        pageNumbers.push(1);
        if (startPage > 2) pageNumbers.push('...');
      }
      for (let i = startPage; i <= endPage; i++) pageNumbers.push(i);
      if (endPage < totalPages) {
        if (endPage < totalPages - 1) pageNumbers.push('...');
        pageNumbers.push(totalPages);
      }
    }
    return pageNumbers.map((page, index) => (
      <PaginationItem key={index}>
        {page === '...' ? <PaginationEllipsis />
          : <PaginationLink href="#" onClick={(e) => { e.preventDefault(); setCurrentPage(page as number); }} className={cn(currentPage === page && 'bg-primary text-primary-foreground hover:bg-primary/90')}>
            {page}
          </PaginationLink>
        }
      </PaginationItem>
    ));
  };

  if (!currentUser || !['SYSTEM_ADMIN', 'ADMIN'].includes(currentUser.role)) {
    return <div className="p-8 text-center">Access Denied.</div>;
  }

  return (
    <>
      <div className="space-y-6">
          <Card className="shadow-lg border-none rounded-2xl bg-white overflow-hidden">
            <CardHeader className="p-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <CardTitle className="text-xl font-bold text-gray-800">Artist List</CardTitle>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
                  <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                    <SelectTrigger aria-label="Filter artists by category" className="h-10 w-full sm:w-48 rounded-full bg-gray-50 border-gray-200">
                      <SelectValue placeholder="All Categories" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      <SelectItem value="uncategorized">Uncategorized</SelectItem>
                      {artistCategories.map(category => (
                        <SelectItem key={category} value={`category:${category}`}>{category}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="relative flex-grow sm:flex-grow-0 sm:w-56">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input placeholder="Search artists..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-10 bg-gray-50 border-gray-200 rounded-full h-10 w-full" />
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[calc(100vh-280px)]">
                <Table className="min-w-[800px] table-fixed">
                  <colgroup>
                    <col className="w-[28%]" />
                    <col className="w-[18%]" />
                    <col />
                    <col className="w-[18%]" />
                    <col className="w-24" />
                  </colgroup>
                  <TableHeader className="sticky top-0 z-20">
                    <TableRow className="hover:bg-transparent">
                      <TableHead scope="col" className="pl-6 sticky top-0 bg-background z-20 text-foreground/70">Artist Name</TableHead>
                      <TableHead scope="col" className="sticky top-0 bg-background z-20 text-foreground/70">Phone</TableHead>
                      <TableHead scope="col" className="sticky top-0 bg-background z-20 text-foreground/70">Address</TableHead>
                      <TableHead scope="col" className="sticky top-0 bg-background z-20 text-foreground/70">Category</TableHead>
                      <TableHead scope="col" className="text-center sticky top-0 bg-background z-20 text-foreground/70">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      [...Array(10)].map((_, i) => (
                        <TableRow key={`skel-artist-${i}`}>
                          <TableCell className="pl-6 font-medium">
                            <div className="flex items-center gap-3">
                              <Skeleton className="h-9 w-9 rounded-full" />
                              <Skeleton className="h-4 w-32" />
                            </div>
                          </TableCell>
                          <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                          <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
                          <TableCell className="text-center">
                            <Skeleton className="h-8 w-8 mx-auto rounded-full" />
                          </TableCell>
                        </TableRow>
                      ))
                    ) : paginatedData.length > 0 ? (
                      paginatedData.map(artist => (
                        <TableRow key={artist.id} className="hover:bg-muted/50">
                          <TableCell className="pl-6 font-medium">
                            <div className="flex min-w-0 items-center gap-3">
                              <Avatar className="h-9 w-9 shrink-0 border"><AvatarImage src={artist.avatarUrl || undefined} alt={artist.name} /><AvatarFallback>{getInitials(artist.name)}</AvatarFallback></Avatar>
                              <span className="min-w-0 break-words">{artist.name}</span>
                            </div>
                          </TableCell>
                          <TableCell className="whitespace-nowrap tabular-nums">{artist.phone || 'N/A'}</TableCell>
                          <TableCell className="break-words leading-relaxed">{artist.address || 'N/A'}</TableCell>
                          <TableCell>
                            {artist.category ? <Badge className="max-w-full border-transparent bg-blue-600 text-white hover:bg-blue-600 whitespace-normal break-words text-left">{artist.category}</Badge> : 'N/A'}
                          </TableCell>
                          <TableCell className="text-center">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onSelect={() => setUserToDelete(artist)} className="cursor-pointer text-destructive focus:text-destructive"><Trash2 className="mr-2 h-4 w-4" />Delete Artist</DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow><TableCell colSpan={5} className="h-48 text-center"><Palette className="mx-auto h-12 w-12 opacity-30 mb-3" />No artists found.</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
            {totalPages > 1 && (
              <CardFooter className="py-4 border-t">
                <Pagination><PaginationContent>
                  <PaginationItem><PaginationPrevious href="#" onClick={(e) => { e.preventDefault(); setCurrentPage(p => Math.max(1, p - 1)); }} aria-disabled={currentPage === 1} className={currentPage === 1 ? 'pointer-events-none opacity-50' : ''} /></PaginationItem>
                  {renderPagination()}
                  <PaginationItem><PaginationNext href="#" onClick={(e) => { e.preventDefault(); setCurrentPage(p => Math.min(totalPages, p + 1)); }} aria-disabled={currentPage === totalPages} className={currentPage === totalPages ? 'pointer-events-none opacity-50' : ''} /></PaginationItem>
                </PaginationContent></Pagination>
              </CardFooter>
            )}
          </Card>
      </div>

      {userToDelete && (
        <DeleteUserDialog
          isOpen={!!userToDelete}
          onOpenChange={() => setUserToDelete(null)}
          onConfirmDelete={handleConfirmDelete}
          user={userToDelete}
          isDeleting={isDeleting}
        />
      )}

    </>
  );
}

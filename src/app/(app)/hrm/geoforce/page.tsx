
"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, PlusCircle, GlobeLock, Trash2, MoreVertical, Edit, MapPin } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Slider } from '@/components/ui/slider';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import 'leaflet/dist/leaflet.css';
import 'leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.css';
import "leaflet-defaulticon-compatibility";
import { LatLngExpression, LatLng } from 'leaflet';
import { getOfficeLocations, addOfficeLocation, updateOfficeLocation, deleteOfficeLocation, type CompanyLocation } from '@/lib/office-location-service';


const DEFAULT_MAP_CENTER: LatLngExpression = [23.8103, 90.4125]; // Dhaka
const DEFAULT_MAP_ZOOM = 12;

const OfficeLocationMapPicker = dynamic(
    () => import('@/components/hrm/OfficeLocationMapPicker').then(mod => mod.OfficeLocationMapPicker),
    {
        ssr: false,
        loading: () => <Skeleton className="h-[300px] w-full rounded-md" />,
    }
);


export default function GeoforcePage() {
    const [locations, setLocations] = useState<CompanyLocation[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // State for the form dialog
    const [isFormDialogOpen, setIsFormDialogOpen] = useState(false);
    const [editingLocation, setEditingLocation] = useState<CompanyLocation | null>(null);

    // Form fields state
    const [name, setName] = useState('');
    const [latitude, setLatitude] = useState('');
    const [longitude, setLongitude] = useState('');
    const [radius, setRadius] = useState(500);

    const { toast } = useToast();

    const fetchLocations = useCallback(async () => {
        setIsLoading(true);
        try {
            const fetchedLocations = await getOfficeLocations();
            setLocations(fetchedLocations);
        } catch (error) {
            console.error("Failed to fetch office locations:", error);
            toast({
                title: "Error",
                description: "Could not load office locations.",
                variant: "destructive"
            });
        } finally {
            setIsLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        fetchLocations();
    }, [fetchLocations]);

    const resetForm = () => {
        setName('');
        setLatitude('');
        setLongitude('');
        setRadius(500);
        setEditingLocation(null);
    };

    const handleOpenAddDialog = () => {
        resetForm();
        setIsFormDialogOpen(true);
    };

    const handleOpenEditDialog = (location: CompanyLocation) => {
        setEditingLocation(location);
        setName(location.name);
        setLatitude(String(location.latitude));
        setLongitude(String(location.longitude));
        setRadius(location.radius);
        setIsFormDialogOpen(true);
    };


    const handleAddOrEditLocation = async (e: React.FormEvent) => {
        e.preventDefault();
        const lat = parseFloat(latitude);
        const lng = parseFloat(longitude);

        if (!name || isNaN(lat) || isNaN(lng)) {
            toast({ title: "Invalid Input", description: "Please fill all fields with valid data.", variant: "destructive" });
            return;
        }

        const locationData = { name, latitude: lat, longitude: lng, radius };

        if (editingLocation) {
            const success = await updateOfficeLocation(editingLocation.id, locationData);
            if (success) {
                toast({ title: "Location Updated", description: `${name} has been updated.` });
                fetchLocations();
            } else {
                toast({ title: "Error", description: "Failed to update location.", variant: "destructive" });
            }
        } else {
            const newLocation = await addOfficeLocation(locationData);
            if (newLocation) {
                toast({ title: "Location Added", description: `${name} has been added.` });
                fetchLocations();
            } else {
                toast({ title: "Error", description: "Failed to add location.", variant: "destructive" });
            }
        }

        setIsFormDialogOpen(false);
        resetForm();
    };

    const handleDeleteLocation = async (locationToDelete: CompanyLocation) => {
        const success = await deleteOfficeLocation(locationToDelete.id);
        if (success) {
            toast({ title: "Location Removed", description: `The location "${locationToDelete.name}" has been deleted.` });
            fetchLocations();
        } else {
            toast({ title: "Error", description: "Failed to delete location.", variant: "destructive" });
        }
    };

    const handleGetCurrentLocation = () => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const { latitude: lat, longitude: lng } = position.coords;
                    setLatitude(lat.toFixed(6));
                    setLongitude(lng.toFixed(6));
                    toast({ title: "Location Fetched", description: "Your current location has been set." });
                },
                (error) => {
                    toast({ title: "Location Error", description: `Could not get location: ${error.message}`, variant: "destructive" });
                }
            );
        } else {
            toast({ title: "Location Error", description: "Geolocation is not supported by your browser.", variant: "destructive" });
        }
    };

    const MarkerPosition = useMemo(() => {
        const lat = parseFloat(latitude);
        const lng = parseFloat(longitude);
        if (!isNaN(lat) && !isNaN(lng)) {
            return new LatLng(lat, lng);
        }
        return null;
    }, [latitude, longitude]);

    const isEditMode = !!editingLocation;

    return (
        <>
            <div className="space-y-6 p-4 sm:p-6 lg:p-8">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-foreground">
                            Office Location
                        </h1>
                        <p className="text-base text-muted-foreground mt-1">
                            Define and manage geographic boundaries for employee attendance tracking.
                        </p>
                    </div>
                    <Button size="lg" className="w-full sm:w-auto h-11" onClick={handleOpenAddDialog}>
                        <PlusCircle className="mr-2 h-5 w-5" />
                        Add Office Location
                    </Button>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Defined Locations</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[50px]">#</TableHead>
                                    <TableHead>Office Location</TableHead>
                                    <TableHead>Longitude</TableHead>
                                    <TableHead>Latitude</TableHead>
                                    <TableHead>Radius (m)</TableHead>
                                    <TableHead className="text-right">Action</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    [...Array(3)].map((_, i) => (
                                        <TableRow key={i}>
                                            <TableCell><Skeleton className="h-5 w-full" /></TableCell>
                                            <TableCell><Skeleton className="h-5 w-full" /></TableCell>
                                            <TableCell><Skeleton className="h-5 w-full" /></TableCell>
                                            <TableCell><Skeleton className="h-5 w-full" /></TableCell>
                                            <TableCell><Skeleton className="h-5 w-full" /></TableCell>
                                            <TableCell><Skeleton className="h-5 w-full" /></TableCell>
                                        </TableRow>
                                    ))
                                ) : locations.length > 0 ? (
                                    locations.map((loc, index) => (
                                        <TableRow key={loc.id}>
                                            <TableCell>{index + 1}</TableCell>
                                            <TableCell className="font-medium">{loc.name}</TableCell>
                                            <TableCell>{loc.longitude}</TableCell>
                                            <TableCell>{loc.latitude}</TableCell>
                                            <TableCell>{loc.radius}</TableCell>
                                            <TableCell className="text-right">
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="icon" className="h-8 w-8">
                                                            <MoreVertical className="h-4 w-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuItem onSelect={() => handleOpenEditDialog(loc)} className="cursor-pointer">
                                                            <Edit className="mr-2 h-4 w-4" />
                                                            Edit
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem onClick={() => handleDeleteLocation(loc)} className="text-destructive focus:text-destructive cursor-pointer">
                                                            <Trash2 className="mr-2 h-4 w-4" />
                                                            Delete
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={6} className="h-24 text-center">
                                            No office locations defined.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>

            <Dialog open={isFormDialogOpen} onOpenChange={(open) => { setIsFormDialogOpen(open); if (!open) resetForm(); }}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>{isEditMode ? 'Edit' : 'Add New'} Office Location</DialogTitle>
                        <DialogDescription>
                            {isEditMode ? `Update the details for the "${editingLocation?.name}" location.` : 'Define a new geofence for attendance tracking.'}
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleAddOrEditLocation}>
                        <div className="space-y-4 py-4 max-h-[70vh] overflow-y-auto pr-2">
                            <div className="space-y-1">
                                <Label htmlFor="name">Office Name</Label>
                                <Input id="name" placeholder="e.g., Head Office" value={name} onChange={e => setName(e.target.value)} />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <Label htmlFor="latitude">Latitude</Label>
                                    <Input id="latitude" placeholder="e.g., 23.8103" value={latitude} onChange={e => setLatitude(e.target.value)} />
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor="longitude">Longitude</Label>
                                    <Input id="longitude" placeholder="e.g., 90.4125" value={longitude} onChange={e => setLongitude(e.target.value)} />
                                </div>
                            </div>
                            <Button type="button" variant="outline" size="sm" onClick={handleGetCurrentLocation} className="w-full">
                                <MapPin className="mr-2 h-4 w-4" />
                                Get Current Location
                            </Button>
                            <div className="space-y-1">
                                <Label htmlFor="radius">Radius: {radius} meters</Label>
                                <Slider
                                    id="radius"
                                    min={50}
                                    max={2000}
                                    step={50}
                                    value={[radius]}
                                    onValueChange={(value) => setRadius(value[0])}
                                />
                            </div>
                            {isFormDialogOpen && (
                                <OfficeLocationMapPicker
                                    key={isEditMode ? `edit-${editingLocation?.id}` : 'new'}
                                    center={MarkerPosition || DEFAULT_MAP_CENTER}
                                    zoom={DEFAULT_MAP_ZOOM}
                                    radius={radius}
                                    markerPosition={MarkerPosition}
                                    onLocationChange={(lat, lng) => {
                                        setLatitude(lat.toFixed(6));
                                        setLongitude(lng.toFixed(6));
                                    }}
                                    onMarkerDrag={(lat, lng) => {
                                        setLatitude(lat.toFixed(6));
                                        setLongitude(lng.toFixed(6));
                                    }}
                                />
                            )}
                        </div>
                        <DialogFooter className="pt-4 border-t">
                            <Button type="button" variant="outline" onClick={() => { setIsFormDialogOpen(false); resetForm(); }}>Cancel</Button>
                            <Button type="submit">
                                {isEditMode ? 'Save Changes' : 'Add Location'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </>
    );
}

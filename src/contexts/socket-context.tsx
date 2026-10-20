"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import io from "socket.io-client";

interface SocketContextType {
    socket: any;
    isConnected: boolean;
}

const SocketContext = createContext<SocketContextType>({
    socket: null,
    isConnected: false,
});

export const useSocket = () => useContext(SocketContext);

export const SocketProvider = ({ children }: { children: React.ReactNode }) => {
    const [socket, setSocket] = useState<any>(null);
    const [isConnected, setIsConnected] = useState(false);

    useEffect(() => {
        const socketInstance = io(process.env.NEXT_PUBLIC_SITE_URL || window.location.origin, {
            path: "/api/socket",
            transports: ["polling", "websocket"],
        });

        socketInstance.on("connect", () => {
            setIsConnected(true);
            console.log("Socket connected");
        });

        socketInstance.on("disconnect", () => {
            setIsConnected(false);
            console.log("Socket disconnected");
        });

        setSocket(socketInstance);

        return () => {
            socketInstance.disconnect();
        };
    }, []);

    return (
        <SocketContext.Provider value={{ socket, isConnected }}>
            {children}
        </SocketContext.Provider>
    );
};

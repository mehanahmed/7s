import { Server as ServerIO } from "socket.io";

declare global {
    var socketIO: ServerIO | undefined;
}

export const getIO = () => global.socketIO;
export const setIO = (io: ServerIO) => {
    global.socketIO = io;
};


import { Server as NetServer } from "http";
import { NextApiRequest } from "next";
import { Server as ServerIO } from "socket.io";
import { NextApiResponseServerIO } from "../../types/socket";
import { setIO } from "../../lib/socket-io";

export const config = {
    api: {
        bodyParser: false,
    },
};

const ioHandler = (req: NextApiRequest, res: NextApiResponseServerIO) => {
    if (!res.socket.server.io) {
        const path = "/api/socket";
        const httpServer: NetServer = res.socket.server as any;
        const io = new ServerIO(httpServer, {
            path: path,
            addTrailingSlash: false,
            cors: {
                origin: (origin: string | undefined, cb: (err: Error | null, allow?: boolean) => void) => {
                    if (!origin) return cb(null, true);
                    try {
                        const host = new URL(origin).hostname;
                        const appHost = new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://app.colorhutbd.xyz').hostname;
                        cb(null, host === 'localhost' || host === '127.0.0.1' || host === appHost || host.endsWith('.' + appHost));
                    } catch {
                        cb(null, false);
                    }
                },
                methods: ["GET", "POST"],
                credentials: true
            },
            transports: ["polling", "websocket"],
            allowEIO3: true
        });

        io.on("connection", (socket) => {
            console.log("Client connected:", socket.id);

            socket.on("order-updated", (data) => {
                socket.broadcast.emit("order-updated", data);
            });

            socket.on("project-updated", (data) => {
                socket.broadcast.emit("project-updated", data);
            });

            socket.on("attendance-location-update", (data) => {
                // console.log("Location update received:", data);
                socket.broadcast.emit("attendance-location-update", data);
            });


            socket.on("lead-updated", (data) => {
                socket.broadcast.emit("lead-updated", data);
            });

            socket.on("disconnect", () => {
                console.log("Client disconnected:", socket.id);
            });
        });

        res.socket.server.io = io;
    }
    setIO(res.socket.server.io);

    res.end();
};

export default ioHandler;

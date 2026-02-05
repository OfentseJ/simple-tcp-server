import * as net from "net";
function soInit(socket) {
    const conn = {
        socket: socket,
        err: null,
        ended: false,
        reader: null,
    };
    socket.on("data", (data) => {
        console.assert(!conn.reader);
        conn.socket.pause();
        conn.reader.resolve(data);
        conn.reader = null;
    });
    socket.on("end", () => {
        conn.ended = true;
        if (conn.reader) {
            conn.reader.resolve(Buffer.from(""));
            conn.reader = null;
        }
    });
    socket.on("error", (err) => {
        conn.err = err;
        if (conn.reader) {
            conn.reader.reject(err);
            conn.reader = null;
        }
    });
    return conn;
}
function soRead(conn) {
    console.assert(!conn.reader);
    return new Promise((resolve, reject) => {
        if (conn.err) {
            reject(conn.err);
            return;
        }
        if (conn.ended) {
            resolve(Buffer.from(""));
            return;
        }
        conn.reader = { resolve: resolve, reject: reject };
        conn.socket.resume();
    });
}
function soWrite(conn, data) {
    console.assert(data.length > 0);
    return new Promise((resolve, reject) => {
        if (conn.err) {
            reject(conn.err);
            return;
        }
        conn.socket.write(data, (err) => {
            if (err) {
                reject(err);
            }
            else {
                resolve();
            }
        });
    });
}
function soListen(port, host) {
    const server = net.createServer({
        pauseOnConnect: true,
    });
    const listener = {
        server: server,
        err: null,
        conn: null,
    };
    server.on("connection", (socket) => {
        console.assert(!listener.conn);
        listener.conn.resolve(socket);
        listener.conn = null;
    });
    server.on("error", (err) => {
        listener.err = err;
        if (listener.conn) {
            listener.conn.reject(err);
            listener.conn = null;
        }
    });
    server.listen(port, host);
    return listener;
}
function soAccept(listener) {
    console.assert(!listener.conn);
    return new Promise((resolve, reject) => {
        if (listener.err) {
            reject(listener.err);
            return;
        }
        listener.conn = { resolve: resolve, reject: reject };
    });
}
async function newConn(socket) {
    console.log("new connection", socket.remoteAddress, socket.remotePort);
    try {
        await serveClient(socket);
    }
    catch (exc) {
        console.error("exception:", exc);
    }
    finally {
        socket.destroy();
    }
}
// echo server
async function serveClient(socket) {
    const conn = soInit(socket);
    while (true) {
        const data = await soRead(conn);
        if (data.length === 0) {
            console.log("end connection");
            break;
        }
        console.log("data", data);
        await soWrite(conn, data);
    }
}
// Main server loop
async function serverLoop() {
    const listener = soListen(3000, "127.0.0.1");
    console.log("Server listening on port 3000");
    while (true) {
        try {
            const socket = await soAccept(listener);
            newConn(socket); // Handle connection asynchronously
        }
        catch (err) {
            console.error("Accept error:", err);
            break;
        }
    }
}
serverLoop();
//# sourceMappingURL=echo_server.js.map
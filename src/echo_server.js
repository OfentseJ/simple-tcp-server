import * as net from "net";
import { buffer } from "stream/consumers";
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
function bufPush(buf, data) {
    const newLen = buf.data.length + data.length;
    if (buf.data.length < newLen) {
        //grow capacity
        let cap = Math.max(buf.data.length, 32);
        if (cap < length) {
            cap *= 2;
        }
        const grown = Buffer.alloc(cap);
        buf.data.copy(grown, 0, 0);
        buf.data = grown;
    }
    data.copy(buf.data, buf.length, 0);
    buf.length = newLen;
}
function bufPop(buf, len) {
    buf.data.copyWithin(0, len, buf.length);
    buf.length -= len;
}
function cutMessage(buf) {
    const idx = buf.data.subarray(0, buf.length).indexOf("\n");
    if (idx < 0) {
        return null;
    }
    const msg = Buffer.from(buf.data.subarray(0, idx + 1));
    bufPop(buf, idx + 1);
    return msg;
}
// echo server
async function serveClient(socket) {
    const conn = soInit(socket);
    const buf = { data: Buffer.alloc(0), length: 0 };
    while (true) {
        const msg = cutMessage(buf);
        if (!msg) {
            const data = await soRead(conn);
            bufPush(buf, data);
            // EOF?
            if (data.length === 0) {
                console.log("End of Connection");
                return;
            }
            continue;
        }
        if (msg.equals(Buffer.from("quit\n"))) {
            await soWrite(conn, Buffer.from("Bye.\n"));
            socket.destroy();
            return;
        }
        else {
            const reply = Buffer.concat([Buffer.from("Echo: "), msg]);
            await soWrite(conn, reply);
        }
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
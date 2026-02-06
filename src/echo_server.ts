import * as net from "net";
import { buffer } from "stream/consumers";

type TCPConn = {
  socket: net.Socket;
  err: null | Error;
  ended: boolean;
  reader: null | {
    resolve: (value: Buffer) => void;
    reject: (value: Error) => void;
  };
};

type TCPListener = {
  server: net.Server;
  err: null | Error;
  conn: null | {
    resolve: (value: net.Socket) => void;
    reject: (value: Error) => void;
  };
};

type DynBuf = {
  data: Buffer;
  length: number;
};

function soInit(socket: net.Socket): TCPConn {
  const conn: TCPConn = {
    socket: socket,
    err: null,
    ended: false,
    reader: null,
  };
  socket.on("data", (data: Buffer) => {
    console.assert(!conn.reader);
    conn.socket.pause();
    conn.reader!.resolve(data);
    conn.reader = null;
  });
  socket.on("end", () => {
    conn.ended = true;
    if (conn.reader) {
      conn.reader.resolve(Buffer.from(""));
      conn.reader = null;
    }
  });
  socket.on("error", (err: Error) => {
    conn.err = err;
    if (conn.reader) {
      conn.reader.reject(err);
      conn.reader = null;
    }
  });
  return conn;
}

function soRead(conn: TCPConn): Promise<Buffer> {
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

function soWrite(conn: TCPConn, data: Buffer): Promise<void> {
  console.assert(data.length > 0);
  return new Promise((resolve, reject) => {
    if (conn.err) {
      reject(conn.err);
      return;
    }
    conn.socket.write(data, (err?: Error | null) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

function soListen(port: number, host?: string): TCPListener {
  const server = net.createServer({
    pauseOnConnect: true,
  });

  const listener: TCPListener = {
    server: server,
    err: null,
    conn: null,
  };

  server.on("connection", (socket: net.Socket) => {
    console.assert(!listener.conn);
    listener.conn!.resolve(socket);
    listener.conn = null;
  });

  server.on("error", (err: Error) => {
    listener.err = err;
    if (listener.conn) {
      listener.conn.reject(err);
      listener.conn = null;
    }
  });

  server.listen(port, host);

  return listener;
}

function soAccept(listener: TCPListener): Promise<net.Socket> {
  console.assert(!listener.conn);
  return new Promise((resolve, reject) => {
    if (listener.err) {
      reject(listener.err);
      return;
    }
    listener.conn = { resolve: resolve, reject: reject };
  });
}

function bufPush(buf: DynBuf, data: Buffer) {
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

async function newConn(socket: net.Socket): Promise<void> {
  console.log("new connection", socket.remoteAddress, socket.remotePort);
  try {
    await serveClient(socket);
  } catch (exc) {
    console.error("exception:", exc);
  } finally {
    socket.destroy();
  }
}

// echo server
async function serveClient(socket: net.Socket): Promise<void> {
  const conn: TCPConn = soInit(socket);
  const buf: DynBuf = { data: Buffer.alloc(0), length: 0 };
  while (true) {
    const msg: null | Buffer = cutMessage(buf);
    if (!msg) {
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
    } catch (err) {
      console.error("Accept error:", err);
      break;
    }
  }
}

serverLoop();

import * as net from "net";

function newConn(socket: net.Socket): void {
  console.log("new connection", socket.remoteAddress, socket.remotePort);

  socket.on("end", () => {
    console.log("EOF.");
  });
  socket.on("data", (data: Buffer) => {
    console.log("data", data);
    if (data.includes("1")) socket.write("I love you\n");
    else if (data.includes("I love you")) socket.write("I love you too <3\n");

    if (data.includes("q")) {
      console.log("closing.");
      socket.end();
    }
  });
}

let server = net.createServer({ allowHalfOpen: true });
server.on("err", (err: Error) => {
  throw err;
});
server.on("connection", newConn);
server.listen({ host: "127.0.0.1", port: 1234 });

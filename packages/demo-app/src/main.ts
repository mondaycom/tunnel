import http from 'node:http';

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Hello World\n');
});

const port = process.env.PORT || 8091;
console.log("Listening on port " + port);
server.listen(port);

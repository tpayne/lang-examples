var http = require('http'); // Import Node.js core module

var server = http.createServer(function (req, res) {   //create web server
    if (req.url == '/') { //check the URL of the current request
        // set response header
        res.writeHead(200, { 'Content-Type': 'text/html' }); 
        // set response content    
        res.write('<html><body><p>This is the home Page.</p></body></html>');
        res.end();
    }
    else if (req.url == "/cmd") {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.write('<html><body><p>This is the cmd Page.</p></body></html>');
        res.end();
    }
    else if (req.url == "/version") {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.write('<html><body><p>version 1.0</p></body></html>');
        res.end();
    }
    else
        res.end('Invalid Request!');
});

// Signal handlers...
process.on('SIGTERM', () => {
 server.close(() => {
 })
})

process.on('SIGINT', () => {
 server.close(() => {
 })
})

server.listen(8080); 

console.log('Node.js web server at port 8080 is running..')

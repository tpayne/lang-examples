// Import required core modules
var http = require('http');
var https = require('https');

// Launch the server
var server = http.createServer(function (req, res) {
    // Match the paths...
    if (req.url == '/') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
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
    else if (req.url == "/repostring") {
        const options = {
            headers: { 'User-Agent': 'Mozilla/5.0' }
        };
        https.get("https://api.github.com/users/tpayne/repos",
            options, function (resp) {
                let data = '';
                resp.on('data', (chunk) => {
                    data += chunk;
                });
                resp.on('end', () => {
                    res.writeHead(200, { 'Content-Type': 'text/html' });
                    res.write('<html><body><p>');
                    //res.write(JSON.stringify(data, null, 4));
                    res.write(data);
                    res.write('</p></body></html>');
                    res.end();
                });
            }).on("error", (err) => {
                console.log("Error: ", err.message);
            });
    }
    else
        res.end('Invalid Request!');
}).on("error", (err) => {
    console.log("Error: ", err.message);
});

// Signal handlers...
process.on('SIGTERM', () => {
    server.close(() => {
        console.log('Kill server');
    })
})

process.on('SIGINT', () => {
    server.close(() => {
        console.log('Kill server');
    })
})

server.listen(8080);

console.log('Node.js web server at port 8080 is running...')

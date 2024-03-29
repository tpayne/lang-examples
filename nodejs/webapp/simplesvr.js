// Import required core modules
var http = require('http');
var https = require('https');
var fs = require('fs');
var PropertiesReader = require('properties-reader');
var properties = PropertiesReader('config/app.properties');

const PORT = 8080;
const URL = properties.get("apiURL");

// Launch the server
var server = http.createServer(function (req, res) {
    // Match the paths...
    if (req.url == '/') {
        fs.readFile('html/index.html', function (herr, html) {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.write(html);
            res.end();
        });
    }
    else if (req.url == "/cmd") {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.write('<html><body><p>This is the cmd page.</p></body></html>');
        res.end();
    }
    else if (req.url == "/version") {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.write('<html><body><p>version 1.0</p></body></html>');
        res.end();
    }
    // This is a relay HTTP request example...
    else if (req.url == "/api/repo") {
        const options = {
            headers: { 'User-Agent': 'Mozilla/5.0' }
        };
        https.get(URL,
            options, function (resp) {
                let data = '';
                resp.on('data', (chunk) => {
                    data += chunk;
                });
                resp.on('end', () => {
                    res.writeHead(200, { 'Content-Type': 'text/html' });
                    res.write('<html><body><p>');
                    res.write(data);
                    res.write('</p></body></html>');
                    res.end();
                });
            }).on("error", (err) => {
                console.log("Error: ", err.message);
            });
    }
    // This is a relay HTTP request example...
    else if (req.url == "/repostring") {
        const options = {
            headers: { 'User-Agent': 'Mozilla/5.0' }
        };
        https.get(URL,
            options, function (resp) {
                let data = '';
                resp.on('data', (chunk) => {
                    data += chunk;
                });
                resp.on('end', () => {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    var jsonParsed = JSON.parse(data);
                    res.write(JSON.stringify(jsonParsed, null, 4));
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

server.listen(PORT);

console.log('Node.js web server is running...')

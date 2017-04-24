var sse = require('../src/sse');

module.exports = {
    requestResult: null,
    connections: [],

    sseSetup(req, res) {

        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive'
        });

        res.write('data: ' + JSON.stringify({ action: 'init' }) + '\n\n');

        sse.emit('initialized');

        this.connections.push(res);
    },

    addListener(name) {
        sse.on(name, (data) => {
            this.connections.forEach(function(conn) {
                conn.write('data: ' + JSON.stringify({ action: name, payload: data }) + '\n\n');    
            });
        });
    },

    ping() {
        sse.once('initialized', (data) => {
            setInterval(event => {
                this.connections.forEach(function(conn) {
                    conn.write('data: ' + JSON.stringify({ action: 'ping' }) + '\n\n');
                });
            }, 10000);
        });
    },

    init() {
        this.addListener('addItem');
        this.addListener('removeItem');
        this.addListener('removeAllItems');
        this.addListener('updateProgress');
        this.ping();
    }
}


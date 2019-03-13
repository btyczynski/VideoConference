
export class NetworkGame {
    constructor(state) {
        this.state = state;
        this.timestamp = null;
        this.accept_old = false;
    }

    start() { }

    finish() { }

    subscribePlayer(id, socket) {
        socket.on('game', (message) => {
            console.log("odebrano rpc: " + message.procedure);

            let isNew = message.timestamp >= this.timestamp;

            if (isNew || this.accept_old)
            {
                console.log("zaakceptowano rpc");

                if(isNew)
                    this.timestamp = message.timestamp;

                this.handleRPC(id, message.procedure, message.args);
            }
        });
    }

    unsubscribePlayer(socket) {
        socket.on('game', () => { });
    }

    handleRPC(id, procedure, args) {
        this.state['rpc_' + procedure](id, args);
    }

    sendRPC(socket, procedure, args) {
        console.log("wyslano rpc: " + procedure, this.timestamp);

        socket.emit('game', {
            procedure: procedure,
            args: args,
            timestamp: this.timestamp
        });
    }

    stamp() {
        this.timestamp = Date.now();
    }
}
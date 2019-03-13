
export class GameState {
    constructor() {
        this.state = {}
        this.onChange = null;
    }

    rpc_replication(player, state) {
        if(state != this.state) {
            this.state = state;
            this.emitOnChange();
        }
    }

    emitOnChange() {
        if (this.onChange)
            this.onChange(this.state);
    }
}


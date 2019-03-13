
import { GameState } from './../GameState'
import { Utilities } from './../Utilities'

export class BombGame extends GameState {

    constructor() {
        super();
    }

    init(player1, player2) {

        let sapper = (this.state.sapper == player1) ? player2 : player1;
        let trainer = (this.state.trainer == player2) ? player1 : player2;

        // It will be sent to users
        this.state = {
            sapper: sapper,
            trainer: trainer,
            cut_cables: [],
            finished: false,
            defused: false,
            cables_order: [1, 2, 3, 4],
            end_timestamp: null
        }
    }

    start() {
        // Shuffle cables order
        this.state.cables_order = Utilities.shuffle(this.state.cables_order);

        // Create timer
        const seconds = 25;

        let deadline = new Date();
        deadline.setSeconds(deadline.getSeconds() + seconds);
        this.state.end_timestamp = deadline.getTime();

        this.timeout = setTimeout(() => {
            let result = this.checkWinState();

            if (result)
                this.emitOnChange();

            console.log('Bomb timeout');
        }, 1000 * seconds);

        // Send replication
        this.emitOnChange();
    }

    checkWinState() {
        if (this.state.finished) {
            return false;
        }

        if (Date.now() >= this.state.end_timestamp) {
            this.state.finished = true;
        }

        for (let i = 0; i < this.state.cut_cables.length; ++i) {
            if (this.state.cut_cables[i] != this.state.cables_order[i]) {
                this.state.finished = true;
                break;
            }
        }

        if (!this.state.finished && this.state.cut_cables.length == this.state.cables_order.length) {
            this.state.finished = true;
            this.state.defused = true;
        }

        if (this.state.finished) {
            clearTimeout(this.timeout);
            return true;
        }
    }

    getPlayerState(player) {
        let stateCopy = Object.assign({}, this.state);

        if (player != this.state.trainer) {
            stateCopy.cables_order = [];
            stateCopy.role = 'sapper';
        }
        else {
            stateCopy.role = 'trainer';
        }

        return stateCopy;
    }

    rpc_cutTheCable(player, args) {
        if (this.state.finished)
            return;

        if (player != this.state.sapper)
            return;

        if (this.state.cut_cables.indexOf(args.number) != -1 || args.number > 4 || args.number < 0)
            return;

        this.state.cut_cables.push(args.number);

        if (this.state.cables_order.length != 0)
            this.checkWinState();

        this.emitOnChange();
    }

}
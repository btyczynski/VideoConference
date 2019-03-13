
import { NetworkGame } from './NetworkGame'
import { BombGame } from './../shared/games/BombGame';

export class GameServer extends NetworkGame {
    constructor(players) {
        super(new BombGame());

        this.state.rpc_replication = null;
        this.state.onChange = this.onGameChange.bind(this);
        this.state.init(players[0].id, players[1].id);

        this.players = players;
        this.accept_old = true;
    }

    start() {
        super.start();

        for (let player of this.players) {
            this.subscribePlayer(player.id, player.socket);
        }

        this.stamp();
    }

    finish() {
        super.finish();

        for (let player of this.players) {
            this.unsubscribePlayer(player.socket);
        }
    }

    play() {
        this.state.start();
    }

    onGameChange(state) {
        for (let player of this.players) {
            this.sendReplication(player);
        }

        if (state.finished)
        {
            for (let player of this.players) {
                player.status = 1;
            }

            this.state.init(this.players[0].id, this.players[1].id);
        }
    }

    sendReplication(player) {
        this.sendRPC(player.socket, 'replication', this.state.getPlayerState(player.id));
    }
}
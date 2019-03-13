const express = require('express');
const app = require('express')();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const crypto = require("crypto");


import { GameServer } from './../shared/GameServer';
import { Utilities } from './../shared/Utilities'

class Server {
    constructor() {
        this.motd = "Welcome on the server!";
        this.players = {};
        this.lobby = [];    // Players who are waitin' for a match

        /*
            Send static page
        */
        app.use(express.static(__dirname + '/public'));


        /*
            Socket IO
        */
        io.on('connection', this.handleConnection.bind(this));

        /*
            Start listening
        */
        http.listen(process.argv[2], process.argv[3], () => {
            console.log('Server http running on ' + process.argv[3] + ':' + process.argv[2]);
        });
    }

    handleConnection(socket) {
        // Handle username from first packet
        socket.once('welcome', (message) => {
            console.log("User " + message.username + " connected.");

            let id = crypto.randomBytes(20).toString('hex');
            let username = message.username;

            let player = this.players[id] = {
                socket: socket,
                id: id,
                username: username,
                status: 0,
                room: null
            };

            this.lobby.push(player);

            socket.on('send', (message) => {
                this.handleMessages(message, player);
            });

            socket.on('disconnect', () => {
                this.handleDisconnect(player);
            });

            socket.emit('send', {
                cmd: "welcome",
                motd: this.motd,
                username: username,
                id: id
            });

            this.matchLobby();
        })
    }

    handleDisconnect(player) {
        console.log("User " + player.username + " disconnected.");

        let inRoom = (player.room != null);

        // Close match
        if (inRoom)
            this.finishRoom(player.room);

        // Delete from lobby
        this.removePlayerFromLobby(player);

        // Delete from players
        delete this.players[player.id];

        // Search new match
        if (inRoom)
            this.matchLobby();
    }

    createRoom(player1, player2) {
        let room = new GameServer(
            [player1, player2]
        );

        let msg = {
            cmd: "partner_found"
        }

        for (let player of room.players) {
            player.room = room;
            player.socket.emit('send', msg);
        }

        room.start();
    }

    finishRoom(room) {
        // Add players to lobby
        for (let player of room.players) {
            player.socket.emit('send', {
                cmd: "finish_room"
            });

            player.room = null;
            player.status = 0;
            this.lobby.push(player);
        }

        // Finish game
        room.finish();
    }

    removePlayerFromLobby(player) {
        let indexInLobby = this.lobby.indexOf(player);

        if (indexInLobby > -1) {
            this.lobby.splice(indexInLobby, 1);
        }
    }

    forPartners(player, callback) {
        if (player.room == null)
            throw "Player " + player.username + " does not have any active rooms";

        // Add players to lobby
        for (let partner of player.room.players) {
            if (player != partner)
                callback(partner);
        }
    }

    checkRoomStatus(room, status) {
        for (let player of room.players) {
            if (player.status != status)
                return false;
        }

        return true;
    }


    handleMessages(message, player) {
        console.log("Message from client:", message.cmd);

        switch (message.cmd) {
            case "offer":
            case "answer":
            case "candidate":
                {
                    this.forPartners(player, (partner) => {
                        partner.socket.emit('send', message);
                    });

                    break;
                }
            case "abandon":
                {
                    if (player.room != null) {
                        this.finishRoom(player.room);
                        this.matchLobby();
                    }

                    break;
                }
            case "ready_for_partner":
                {
                    if (player.room != null) {
                        player.status = 1;

                        if (this.checkRoomStatus(player.room, 1)) {
                            player.socket.emit('send', {
                                cmd: "connect_with_partner"
                            });
                        }
                    }

                    break;
                }

            case "ready_room":
                {
                    console.log(player.username + " is ready for game");

                    if (player.room != null) {
                        player.status = 2;

                        if (this.checkRoomStatus(player.room, 2)) {
                            for (let client of player.room.players) {
                                client.socket.emit('send', {
                                    cmd: "ready_room_ack"
                                });
                            }
                        }
                    }

                    break;
                }

            case "ready_game":
                {
                    if (player.room != null) {
                        player.status = 3;

                        if (this.checkRoomStatus(player.room, 3)) {
                            player.room.play();
                        }
                    }
                    break;
                }

        }
    }

    matchLobby() {
        if (this.lobby.length >= 2) {
            this.lobby = Utilities.shuffle(this.lobby);

            this.createRoom(this.lobby[0], this.lobby[1]);

            this.lobby.shift();
            this.lobby.shift();
        }
    }
}

// Turn on the server
const server = new Server();
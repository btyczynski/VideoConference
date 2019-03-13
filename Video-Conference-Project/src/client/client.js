const webrtc = require('webrtc-adapter');
const io = require('socket.io-client');
const adapter = require('webrtc-adapter');

navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia || navigator.oGetUserMedia;

/*
https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/Signaling_and_video_calling#Handling_the_invitation
*/

import { GameClient } from './../shared/GameClient';
import { BombGame } from './../shared/games/BombGame';
import { Renderer } from './renderer';
import { Template } from './template';

class Client {
    constructor(username) {
        console.log("Client creating...");

        this.socket = null;
        this.textChannel = null;

        this.id = null;

        this.game = null;
        this.gameClient = null;

        /////////////////////////
        this.localStream = null;

        this.remoteVideo = document.getElementById("remoteVideo");
        this.localVideo = document.getElementById("localVideo");

        this.template = new Template();
        this.template.showLoginSplash();
        this.template.onJoin = (username) => {
            this.username = username;
            this.createIO();
            this.template.hideLoginSplash();
            this.template.showWaitingSplash();
        }
        this.template.onAbandon = () => {
            this.socket.emit('send', {
                cmd: "abandon"
            });
        }

        this.template.onReady = () => {

            this.socket.emit('send', {
                cmd: "ready_room",
                data: "ready_room"
            });

        }
    }

    parseMessageIO(message) {
        console.log("Message from server:", message);

        switch (message.cmd) {
            case "welcome":
                {
                    /*
                    {
                        cmd: "welcome",
                        motd: "Hello from the server!",
                        username: "your_username",
                        id: "generated_id"
                    }
                    */

                    console.log(message.motd);
                    this.username = message.username;
                    this.id = message.id;

                    break;
                }

            case "partner_found":
                {
                    /*
                    {
                        cmd: "new_game"
                    }
                    */
                    this.createRTC();

                    this.template.hideWaitingSplash();
                    this.template.showPartnerSplash();

                    break;
                }
            case "connect_with_partner":
                {
                    /*
                    {
                        cmd: "connect",
                    }
                    */

                    // Create offer message
                    this.RTCConnection.createOffer({
                        offerToReceiveAudio: 1,
                        offerToReceiveVideo: 1
                    })
                        .then((offer) => {
                            this.RTCConnection.setLocalDescription(offer);

                            this.socket.emit('send', {
                                cmd: "offer",
                                data: this.RTCConnection.localDescription
                            });
                        })
                        .catch((reason) => {
                            console.log(reason);
                        });

                    break;
                }

            case "finish_room":
                {
                    /*
                    {
                        cmd: "finish_game",
                    }
                    */
                    this.rendered.destroy();
                    this.rendered = null;

                    this.gameClient.finish();
                    this.gameClient = null;

                    this.game = null;

                    this.closeRTC();

                    this.template.hidePartnerSplash();
                    this.template.showWaitingSplash();
                    
                    break;
                }

            case "ready_room_ack":
                {
                    console.log("Received signal that both players ready")

                    this.template.hidePartnerSplash();
                    this.template.showGameSplash();

                    this.game = new BombGame();
                    this.gameClient = new GameClient(this.game, this.socket, this.id);

                    // This is so ugly - we need finished state machine not this monster
                    this.rendered = new Renderer(this.gameClient, () => {
                        this.game.onChange = (state) => {
                            this.rendered.applyState(state);
                        };

                        this.gameClient.start();

                        this.socket.emit('send', {
                            cmd: "ready_game"
                        });
                    }, () => {
                        this.rendered.destroy();
                        this.rendered = null;

                        this.gameClient.finish();
                        this.gameClient = null;

                        this.game = null;

                        this.template.hideGameSplash();
                        this.template.showPartnerSplash();
                    });

                    break;
                }


            /* WEBRTC */
            case "candidate":
                {
                    /*
                    {
                        cmd: "candidate",
                        data: {...} // ice object
                    }
                    */

                    this.RTCConnection.addIceCandidate(new RTCIceCandidate(message.data));

                    break;
                }

            case "offer":
                {
                    /*
                    {
                        cmd: "offer",
                        data: {...} // offer object
                    }
                    */

                    this.RTCConnection.setRemoteDescription(message.data)
                        .then(() => {
                            return this.RTCConnection.createAnswer();
                        })
                        .then((answer) => {
                            this.RTCConnection.setLocalDescription(answer);

                            // Send the answer to the remote peer using the signaling server
                            this.socket.emit('send', {
                                cmd: "answer",
                                data: answer
                            });
                        })
                        .catch((error) => {
                            console.log(error);
                        });

                    break;
                }

            case "answer":
                {
                    /*
                    {
                        cmd: "answer",
                        data: {...} // offer object
                    }
                    */

                    this.RTCConnection.setRemoteDescription(message.data)
                        .then(() => {
                            console.log("Answer applied to RemoteDescription")
                        })
                        .catch((error) => {
                            console.log(error);
                        });

                    break;
                }
        }
    }

    createIO() {
        console.log("Creating IO connection...");

        this.socket = io.connect(document.location.origin);

        // Create init message
        let initMessage = {
            cmd: "welcome",
            username: this.username
        }

        this.socket.emit('welcome', initMessage);

        // Subscribe messages from the server
        this.socket.on('send', this.parseMessageIO.bind(this));
    }

    createRTC() {
        // Camera
        navigator.mediaDevices.getUserMedia({
            audio: true,
            video: true
        })
            .then(stream => {
                this.localVideo.srcObject = stream;
                this.localStream = stream;

                let videoTracks = this.localStream.getVideoTracks();
                let audioTracks = this.localStream.getAudioTracks();

                this.RTCConnection = RTCPeerConnection(null);
                this.RTCConnection.onicecandidate = this.iceCandidateHandler.bind(this);
                this.RTCConnection.ontrack = this.gotRemoteStream.bind(this);

                this.localStream.getTracks().forEach(track => {
                    this.RTCConnection.addTrack(track, this.localStream);
                });

                this.socket.emit('send', {
                    cmd: "ready_for_partner"
                });

            })
            .catch((e) => {
                alert('getUserMedia() error: ' + e.name);
            });
    }

    gotRemoteStream(e) {
        if (this.remoteVideo.srcObject !== e.streams[0]) {
            this.remoteVideo.srcObject = e.streams[0];
        }
    }

    closeRTC() {

        // remote
        if (this.remoteVideo.srcObject) {
            this.remoteVideo.srcObject.getTracks().forEach(track => track.stop());
            this.remoteVideo.srcObject = null;
        }

        // local
        if (this.localVideo.srcObject) {
            this.localVideo.srcObject.getTracks().forEach(track => track.stop());
            this.localVideo.srcObject = null;
            this.localStream = null;
        }

        this.RTCConnection.close();
        this.RTCConnection = null;

    }

    iceCandidateHandler(event) {
        if (event.candidate) {
            // Create candidate message
            let candidateMessage = {
                cmd: "candidate",
                data: event.candidate
            }

            this.socket.emit('send', candidateMessage);
        }
    }

}

window.onload = () => {
    let client = new Client();
};
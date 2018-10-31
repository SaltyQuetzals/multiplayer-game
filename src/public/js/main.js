const GUNS = require("../../models/Guns.js")


const GAME_VIEW_WIDTH = 800;
const GAME_VIEW_HEIGHT = 600;
const ZOMBIE_SPEED = 4;
// const ar = GUNS.AutomaticRifle;
const revolver = new GUNS.Revolver();
// const shotgun = GUNS.SawnOffShotgun;

const KEYBOARD = {
    37: 'left',
    38: 'up',
    39: 'right',
    40: 'down',
    87: 'W',
    65: 'A',
    83: 'S',
    68: 'D'
}
const PLR_KEYBOARD = {
    up: 0,
    left: 0,
    down: 0,
    right: 0,
    W: 0,
    A: 0,
    S: 0,
    D: 0
}
const game = new Phaser.Game(
    GAME_VIEW_WIDTH,
    GAME_VIEW_HEIGHT,
    Phaser.AUTO,
    '', {
        init: init,
        preload: preload,
        create: create,
        update: update,
        render: render
    }
);

function init() {
    game.stage.disableVisibilityChange = true;
}

function preload() {
    console.log("preloading");
    game.load.image('bg', '../assets/bg.png');
    game.load.image('bullet', '../assets/bullet.png');
    game.load.spritesheet('zombie_1',
        '../assets/ZombieWalkingSpriteSheet2.png',
        64, // frame width
        64, // frame height
    );
}

var bg;
var gun;
var socket;

function create() {

    console.log("Creating");
    game.physics.startSystem(Phaser.Physics.Arcade);
    bg = game.add.tileSprite(0, 0, GAME_VIEW_WIDTH, GAME_VIEW_HEIGHT, 'bg');

    game.players = {};
    game.targets = game.add.group();
    game.physics.arcade.enable(game.targets);


    game.localPlayer = {}
    game.localPlayer.id = 0;
    game.localPlayer.character = initAvatar('zombie_1', 100, 100, true);

    //Controls
    spacebar = game.input.keyboard.addKey(Phaser.Keyboard.SPACEBAR);


    //Gun
    game.localPlayer.gun = game.add.weapon(revolver._clipSize, 'bullet');
    game.localPlayer.gun.bulletKillType = Phaser.Weapon.KILL_WORLD_BOUNDS;
    game.localPlayer.gun.bulletAngleOffset = 0;
    game.localPlayer.gun.fireAngle = Phaser.ANGLE_RIGHT;
    game.localPlayer.gun.bulletSpeed = 1000;
    game.localPlayer.gun.fireRate = revolver.fireRateMillis;
    game.localPlayer.gun.trackSprite(game.localPlayer.character, 14, 14);
  


    //Keyboard Events
    game.localPlayer.keyboard = { ...PLR_KEYBOARD
    };
    game.input.keyboard.onDownCallback = function (event) {
        if (KEYBOARD[event.keyCode] && !game.localPlayer.keyboard[KEYBOARD[event.keyCode]]) {
            game.localPlayer.keyboard[KEYBOARD[event.keyCode]] = 1;
        }
    }
    game.input.keyboard.onUpCallback = function (event) {
        if (KEYBOARD[event.keyCode] && game.localPlayer.keyboard[KEYBOARD[event.keyCode]]) {
            game.localPlayer.keyboard[KEYBOARD[event.keyCode]] = 0;
        }
    }

    socket = io.connect("http://localhost:3000/");
}

const splitUrl = location.href.split("/");
const roomId = splitUrl[splitUrl.length - 1];

const startGameButton = document.getElementById('start');

function startGame() {
    console.log('BARRRA');
    socket.emit("start game", {
        roomId
    });
}

if (startGameButton) {
    startGameButton.addEventListener('click', startGame);
}




function update() {
    socket.on('connect', () => {

        socket.on('start game', () => {
            console.log('GAME STARTED');
        })
    
        socket.on('serverSocketId', (message) => {
            // console.log('serverSocketID = ' + message.id);
            game.localPlayer.id = message.id;
            game.players[game.localPlayer.id] = game.localPlayer;
        })
    
        socket.on('new player', (message) => {
            if (message.id === game.localPlayer.id) {
                // create all preexisting players
                for (var key in message.players) {
                    if (key != game.localPlayer.id) {
                        let newPlayer = {
                            'character': initAvatar('zombie_1'), 
                            'id' : key
                        };
                        game.players[newPlayer.id] = newPlayer;
                    }
                }
            }
            else {
                // create only new player
                console.log('Another player has joined the room!');
                let newPlayer = {
                    'character': initAvatar('zombie_1'),
                    'id': message.id
                };
                game.players[newPlayer.id] = newPlayer;
                console.log(newPlayer.id);
            }
        })
    
        
        socket.emit("join room", {
            roomId
        });
    
        socket.on('player moved', (message) => {
            // console.log(JSON.stringify(message, null, 3));
            // console.log(game.players);
            avatar = game.players[message.id].character;
            avatar.x = avatar.x + message.movementDelta.xDelta;
            avatar.y = avatar.y + message.movementDelta.yDelta;
        })
    
        socket.on("err", ({
            message
        }) => {
            console.error(message);
        });
    
        socket.on("room full", () => {
            const errorDialog = document.getElementById("room-full-dialog");
            console.log(errorDialog);
            if (errorDialog) {
                errorDialog.style.display = "block";
            }
        });
    })
    
    //LocalPlayer
    movementHandler(game.localPlayer.character, game.localPlayer.gun, game.localPlayer.keyboard);
    //Loop through players (move non-LocalPlayer)
    if (spacebar.isDown) {
        game.localPlayer.gun.fire();
    }

    // Check collisions
    game.physics.arcade.overlap(game.localPlayer.gun.bullets, game.targets, bulletHitHandler, null, game);
}

function render() {
    game.debug.spriteInfo(game.localPlayer.character, 20, 32);
    game.localPlayer.gun.debug(20, 128);
}

function bulletHitHandler(bullet, enemy) {
    console.log("hit");
    bullet.kill();
    enemy.kill();
}

function movementHandler(avatar, gun, keys, /*pos = {x: false,y: false}*/) {
    let eventShouldBeEmitted = false;
    const origZombieX = Number(avatar.x);
    const origZombieY = Number(avatar.y);

    if (keys['left']) {
        avatar.x -= ZOMBIE_SPEED;
        if (!(keys['down'])) {
            avatar.animations.play('left', true);
        }
        eventShouldBeEmitted = true;
    } else if (keys['right']) {
        avatar.x += ZOMBIE_SPEED;
        if (!(keys['down'])) {
            avatar.animations.play('right', true);
        }
        eventShouldBeEmitted = true;
    }

    if (keys['up']) {
        avatar.y -= ZOMBIE_SPEED;
        if (!(keys['left'] || keys['right'])) {
            avatar.animations.play('up', true);
        }
        eventShouldBeEmitted = true;
    } else if (keys['down']) {
        avatar.y += ZOMBIE_SPEED;
        avatar.animations.play('down', true);
        eventShouldBeEmitted = true;
    }


    if (keys['W']) {
        if (keys['D']) {
            gun.fireAngle = Phaser.ANGLE_NORTH_EAST;
        } else if (keys['A']) {
            gun.fireAngle = Phaser.ANGLE_NORTH_WEST;
        } else {
            gun.fireAngle = Phaser.ANGLE_UP;
        }
    } else if (keys['S']) {
        if (keys['D']) {
            gun.fireAngle = Phaser.ANGLE_SOUTH_EAST;
        } else if (keys['A']) {
            gun.fireAngle = Phaser.ANGLE_SOUTH_WEST;
        } else {
            gun.fireAngle = Phaser.ANGLE_DOWN;
        }
    } else if (keys['D']) {
        gun.fireAngle = Phaser.ANGLE_RIGHT;
    } else if (keys['A']) {
        gun.fireAngle = Phaser.ANGLE_LEFT;
    }

    if (any(keys) + any(keys) == 0) {
        // No keys pressed - stop animations
        avatar.animations.stop();
        //zombie.anims.play('idle');

    }
    if (eventShouldBeEmitted) {
        socket.emit("move", {
            roomId,
            movementDelta: {
                xDelta: avatar.x - origZombieX,
                yDelta: avatar.y - origZombieY
            }
        });
    }
}


function initAvatar(spriteSheet, x = 100, y = 100) {
    avatar = game.add.sprite(x, y, spriteSheet);
    avatar.frame = 1;
    game.physics.arcade.enable(avatar);
    avatar.body.collideWorldBounds = true;
    if (game.localPlayer.id != 0) {
        game.targets.add(avatar);
    }

    avatar.animations.add(
        'down',
        [0, 1, 2, 3],
        10,
        false
    );
    avatar.animations.add(
        'right',
        [4, 5, 6, 7],
        10,
        false
    );
    avatar.animations.add(
        'up',
        [8, 9, 10, 11],
        10,
        false
    );
    avatar.animations.add(
        'left',
        [12, 13, 14, 15],
        10,
        false
    );
    avatar.animations.add(
        'idle',
        [16, 17, 18, 19],
        10,
        false
    );
    return avatar;
}

function any(dict) {
    return Object.keys(dict).reduce((acc, cur) => acc + dict[cur], 0);
}
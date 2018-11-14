import {Drop} from '../../../models/Drop';
import {GAME_BOARD_HEIGHT, GAME_BOARD_WIDTH} from '../../../shared/constants';
import {bulletHitHandler, killBullet, melee, pickupDrop} from '../collisons-functs';
import {SocketController} from '../controllers/SocketController';
import * as gameClasses from '../game-classes';
import * as gameConstants from '../game-constants';
import {initPlayer} from '../init-helpers';
import {movementHandler} from '../movement';
import {fireGun} from '../weapon-functs';

export class GameController {
  GAME_STARTED = false;
  shadowTexture!: Phaser.BitmapData;
  lightSprite!: Phaser.Image;
  layer!: Phaser.TilemapLayer;
  map!: Phaser.Tilemap;
  game!: Phaser.Game;
  socket!: SocketController;
  roomId!: string;
  players!: {[key: string]: gameClasses.CustomPlayer};
  drops!: {[key: string]: Drop};
  targets!: Phaser.Group;
  obstacles!: Phaser.Group;
  dropSprites!: Phaser.Group;
  localPlayer!: gameClasses.CustomPlayer;
  username: string;
  numSurvivors!: number;
  HUD!: {ammo: Phaser.Text; health: Phaser.Text; survivors: Phaser.Text;};
  endGame!: Phaser.Text;
  constructor(roomId: string, username: string) {
    this.roomId = roomId;
    this.username = username;
    this.game = new Phaser.Game(
        gameConstants.GAME_VIEW_WIDTH, gameConstants.GAME_VIEW_HEIGHT,
        Phaser.CANVAS, '', {
          preload: this.preload,
          create: this.create,
          update: this.update,
          render: this.render
        });
  }

  preload = ():
      void => {
        console.log('Preloading');
        this.game.load.image('tiles', '../assets/0x72_DungeonTilesetII_v1.png');
        this.game.load.tilemap(
            'map', '../assets/zombie.json', null, Phaser.Tilemap.TILED_JSON);
        this.game.load.image('bullet', '../assets/bullet.png');
        this.game.load.image('Automatic Rifle', '../assets/AutomaticRifle.png');
        this.game.load.image('Revolver', '../assets/Revolver.png');
        this.game.load.image('Shotgun', '../assets/Shotgun.png');
        this.game.load.image('p1', '../assets/WeirdFlex.png');
        this.game.load.image('p2', '../assets/Grit.png');
        this.game.load.image('p3', '../assets/Hammertime.png');
        this.game.load.image('p4', '../assets/Jackpot.png');
        this.game.load.spritesheet(
            'weapons', '../assets/WeaponsSpriteSheet.png',
            64,  // frame width
            64   // frame height
        );
        this.game.load.spritesheet(
            'zombie_1', '../assets/ZombieWalkingSpriteSheet2.png',
            64,  // frame width
            64   // frame height
        );
        this.game.load.spritesheet(
            'survivor_1', '../assets/SurvivorWalkingSpriteSheet.png',
            64,  // frame width
            64   // frame height
        );
        this.game.load.image('field_of_view', '../assets/FieldOfView.png');

        this.game.scale.scaleMode = Phaser.ScaleManager.SHOW_ALL;
        // this.scale.pageAlignHorizontally = true;
        this.game.scale.pageAlignVertically = true;
      }

  create = ():
      void => {
        console.log('Creating');
        this.game.physics.startSystem(Phaser.Physics.ARCADE);

        this.map = this.game.add.tilemap('map');
        this.map.addTilesetImage('0x72_DungeonTilesetII_v1', 'tiles');

        this.layer = this.map.createLayer('Tile Layer 1');
        this.layer.scale.setTo(3);
        this.layer.resizeWorld();

        this.shadowTexture =
            this.game.add.bitmapData(this.game.width, this.game.height);

        this.lightSprite = this.game.add.image(
            this.game.camera.x, this.game.camera.y, this.shadowTexture);

        this.lightSprite.blendMode = Phaser.blendModes.MULTIPLY;

        this.players = {};
        this.drops = {};

        this.targets = this.game.add.group();
        this.game.physics.arcade.enable(this.targets);

        this.obstacles = this.game.add.group();
        this.game.physics.arcade.enable(this.obstacles);

        this.dropSprites = this.game.add.group();
        this.game.physics.arcade.enable(this.dropSprites);

        this.localPlayer = new gameClasses.CustomPlayer();
        this.localPlayer = initPlayer('0', 'local');
        this.localPlayer.id = '0';

        this.localPlayer.cameraSprite = this.game.add.sprite(
            this.localPlayer.character.x, this.localPlayer.character.y);

        this.game.camera.follow(this.localPlayer.cameraSprite);

        this.numSurvivors = 0;

        // Controls
        this.game.input.keyboard.addKey(Phaser.Keyboard.SPACEBAR);


        // Keyboard Events
        this.localPlayer.keyboard = {...gameConstants.keysPressed};
        this.game.input.keyboard.onDownCallback = (event: KeyboardEvent) => {
          if (this.GAME_STARTED && gameConstants.KEYCODES[event.keyCode] &&
              !this.localPlayer
                   .keyboard[gameConstants.KEYCODES[event.keyCode]]) {
            this.localPlayer.keyboard[gameConstants.KEYCODES[event.keyCode]] =
                true;
          }
          // //Alternate Guns for testing purposes
          // if (event.keyCode == Phaser.Keyboard.Z){
          //     switchGun(this.game.localPlayer.gun, shotgun);
          // }
          // if (event.keyCode == Phaser.Keyboard.X){
          //     switchGun(this.game.localPlayer.gun, ar);
          // }
          // if (event.keyCode == Phaser.Keyboard.C){
          //     switchGun(this.game.localPlayer.gun, revolver);
          // }
        };
        this.game.input.keyboard.onUpCallback = (event: KeyboardEvent) => {
          if (this.GAME_STARTED && gameConstants.KEYCODES[event.keyCode] &&
              this.localPlayer
                  .keyboard[gameConstants.KEYCODES[event.keyCode]]) {
            this.localPlayer.keyboard[gameConstants.KEYCODES[event.keyCode]] =
                false;
          }
        };

        this.HUD = Object();
        this.HUD.ammo = this.game.add.text(
            10, gameConstants.GAME_VIEW_HEIGHT - 50, 'Ammo: ',
            {font: 'bold 24px Arial', fill: '#004887', align: 'center'});
        this.HUD.health = this.game.add.text(
            gameConstants.GAME_VIEW_WIDTH / 2 - 100,
            gameConstants.GAME_VIEW_HEIGHT - 50, 'Health: ',
            {font: 'bold 24px Arial', fill: '#af0000', align: 'center'});
        this.HUD.survivors = this.game.add.text(
            gameConstants.GAME_VIEW_WIDTH - 200,
            gameConstants.GAME_VIEW_HEIGHT - 50, 'Survivors: ',
            {font: 'bold 24px Arial', fill: '#004887', align: 'center'});

        this.HUD.ammo.fixedToCamera = true;
        this.HUD.health.fixedToCamera = true;
        this.HUD.survivors.fixedToCamera = true;


        this.endGame = this.game.add.text(
            gameConstants.GAME_VIEW_WIDTH / 2,
            gameConstants.GAME_VIEW_HEIGHT / 2, '',
            {font: 'bold 24px Arial', fill: '#af0000', align: 'center'});
        this.endGame.fixedToCamera = true;

        this.socket = new SocketController(this.roomId, this.username, this);
      }


  update = ():
      void => {
        // LocalPlayer
        movementHandler(
            this.localPlayer, this.localPlayer.gun, this.localPlayer.keyboard);
        // Loop through players (move non-LocalPlayer)
        if (this.localPlayer.keyboard['spacebar']) {
          if (this.localPlayer.isZombie) {
            melee(this.localPlayer);
          } else {
            fireGun();
          }
        }

        this.localPlayer.cameraSprite.x = this.localPlayer.character.x;
        this.localPlayer.cameraSprite.y = this.localPlayer.character.y;

        this.lightSprite.reset(this.game.camera.x, this.game.camera.y);
        this.updateShadowTexture();

        // Check collisions
        this.game.physics.arcade.overlap(
            this.localPlayer.gun.pGun.bullets, this.targets, bulletHitHandler,
            undefined, this);
        this.game.physics.arcade.collide(
            this.localPlayer.character, this.obstacles, undefined, undefined,
            this);
        this.game.physics.arcade.collide(
            this.localPlayer.gun.pGun.bullets, this.obstacles, killBullet,
            undefined, this);
        this.game.physics.arcade.collide(
            this.localPlayer.character, this.dropSprites, pickupDrop, undefined,
            this);
      }

  render = ():
      void => {
        // game.debug.spriteInfo(game.localPlayer.character, 20, 32);
        // game.localPlayer.gun.debug(20, 128);

        this.HUD.ammo.setText('Ammo: ' + this.localPlayer.gun.ammo);
        this.HUD.health.setText('Health: ' + this.localPlayer.health);
        this.HUD.survivors.setText('Survivors: ' + this.numSurvivors);
      }

  updateShadowTexture() {
    this.shadowTexture.context.fillStyle = 'rgb(10, 10, 10)';
    this.shadowTexture.context.fillRect(
        0, 0, this.game.width + 20, this.game.height + 20);
    this.game.world.bringToTop(this.shadowTexture);

    const radius = 100,
          heroX = this.localPlayer.character.x - this.game.camera.x + 30,
          heroY = this.localPlayer.character.y - this.game.camera.y + 30;

    const gradient = this.shadowTexture.context.createRadialGradient(
        heroX, heroY, 100 * 0.75, heroX, heroY, radius);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0.0)');

    this.shadowTexture.context.beginPath();
    this.shadowTexture.context.fillStyle = gradient;
    this.shadowTexture.context.arc(heroX, heroY, radius, 0, Math.PI * 2, false);
    this.shadowTexture.context.fill();

    this.shadowTexture.dirty = true;
  }
}

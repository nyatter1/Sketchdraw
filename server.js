const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

app.use(express.static(path.join(__dirname, 'public')));

// --- 200+ WORDS DATASET ---
const WORDS_POOL = [
    "AARDVARK", "AIRPLANE", "ALARM CLOCK", "ALLIGATOR", "ALPHABET", "AMBULANCE", "ANCHOR", "ANGEL", "ANGLERFISH", "ANT", "APPLE", "APRON", "AQUARIUM", "ARCHERY", "ARM", "ARMADILLO", "ARMOR", "ARROW", "ARTIST", "ASTRONAUT", "ATTIC", "AVOCADO", "AXE", "BABY", "BACKPACK", "BACON", "BADGER", "BAGUETTE", "BAKER", "BALLOON", "BAMBOO", "BANANA", "BANJO", "BARN", "BASEBALL", "BASKET", "BAT", "BATTERY", "BEACH", "BEAR", "BEARD", "BED", "BEE", "BEEHIVE", "BELL", "BELT", "BENCH", "BICYCLE", "BINOCULARS", "BIRD", "BIRTHDAY CAKE", "BISON", "BLACK HOLE", "BLIZZARD", "BLUEBERRY", "BOOST", "BOOT", "BOTTLE", "BOW", "BOWL", "BOX", "BOY", "BRAIN", "BREAD", "BRIDGE", "BROCCOLI", "BROOM", "BRUSH", "BUBBLE", "BUCKET", "BUG", "BULLDOZER", "BUMBLEBEE", "BUNNY", "BURRITO", "BUS", "BUTTERFLY", "BUTTON", "CABIN", "CACTUS", "CAGE", "CAKE", "CALENDAR", "CAMEL", "CAMERA", "CAMPFIRE", "CANDLE", "CANDY", "CANNON", "CANOE", "CAPTAIN", "CAR", "CARROT", "CASTLE", "CAT", "CAVE", "CELLO", "CHAIR", "CHAMELEON", "CHEESE", "CHERRY", "CHESS", "CHICKEN", "CHIMNEY", "CHIPS", "CHOCOLATE", "CHOPSTICKS", "CHURCH", "CITY", "CLAM", "CLOCK", "CLOUD", "CLOWN", "COAT", "COCKROACH", "COCONUT", "COFFEE", "COIN", "COMB", "COMPUTER", "CONE", "COOKIE", "CORN", "COW", "CRAB", "CRAYON", "CROWN", "CRUTCH", "CRYSTAL", "CUBE", "CUP", "CUPCAKE", "CURTAIN", "DAISY", "DART", "DEER", "DESERT", "DESK", "DIAMOND", "DINOSAUR", "DISHWASHER", "DOG", "DOLPHIN", "DONUT", "DOOR", "DRAGON", "DRUM", "DUCK", "EAR", "EARTH", "EGG", "EGGPLANT", "EIFFEL TOWER", "ELBOW", "ELEPHANT", "ELEVATOR", "ELF", "ELK", "ENGINE", "ENVELOPE", "ERASER", "EYE", "EYEBROW", "FACE", "FAIRY", "FAN", "FARM", "FEATHER", "FENCE", "FERRIS WHEEL", "FIRE", "FIRE HYDRANT", "FIREPLACE", "FISH", "FLAG", "FLAMINGO", "FLASHLIGHT", "FLOWER", "FLUTE", "FLY", "FOOT", "FORK", "FORT", "FOX", "FROG", "FRYING PAN", "GHOST", "GIRAFFE", "GLASSES", "GLOVE", "GOAT", "GOLF", "GORILLA", "GRAPE", "GRASS", "GUITAR", "GUM", "HAMBURGER", "HAMMER", "HAND", "HAT", "HEART", "HELICOPTER", "HIPPO", "HOCKEY", "HORSE", "HOSPITAL", "HOUSE", "ICE CREAM", "IGLOO", "ISLAND", "JACKET", "JAR", "JELLYFISH", "KANGAROO", "KEY", "KITE", "KNIFE", "LADDER", "LAMP", "LEAF", "LEMON", "LION", "LIZARD", "LOLLIPOP", "MAGNET", "MAP", "MARS", "MASK", "MILK", "MIRROR", "MONKEY", "MOON", "MOUNTAIN", "MOUSE", "MUSHROOM", "NAIL", "NECKLACE", "NEEDLE", "NEST", "NOSE", "NOTEBOOK", "OCEAN", "OCTOPUS", "ONION", "ORANGE", "OWL", "PAINT", "PALM TREE", "PANDA", "PANTS", "PAPER", "PARROT", "PEACH", "PEAR", "PENCIL", "PENGUIN", "PIANO", "PIG", "PILLOW", "PINEAPPLE", "PIZZA", "PLANE", "PLANET", "PLANT", "PLATE", "POCKET", "POLICE", "POOL", "POPCORN", "POTATO", "PUMPKIN", "PUPPY", "PYRAMID", "QUEEN", "RABBIT", "RAIN", "RAINBOW", "RAT", "RING", "RIVER", "ROBOT", "ROCK", "ROCKET", "ROLLERCOASTER", "ROOSTER", "ROPE", "SAILING", "SANDWICH", "SATURN", "SAXOPHONE", "SCARF", "SCHOOL", "SCISSORS", "SCORPION", "SHARK", "SHEEP", "SHELL", "SHIRT", "SHOE", "SHOWER", "SKATEBOARD", "SKELETON", "SKULL", "SKY", "SLED", "SNAKE", "SNOWMAN", "SOAP", "SOCCER", "SOCK", "SOFA", "SPACESHIP", "SPIDER", "SPOON", "SQUARE", "SQUIRREL", "STAIRS", "STAR", "STEAK", "STETHOSCOPE", "STOMACH", "STOP SIGN", "STRAWBERRY", "SUN", "SUNFLOWER", "SUNGLASSES", "SWORD", "TABLE", "TACO", "TEAPOT", "TELESCOPE", "TENNIS", "TENT", "TIGER", "TOASTER", "TOILET", "TOMATO", "TOOTH", "TOOTHBRUSH", "TORCH", "TOWER", "TRACTOR", "TRAIN", "TREE", "TRUCK", "TRUMPET", "TURTLE", "UMBRELLA", "UNICORN", "VACUUM", "VASE", "VIOLIN", "VOLCANO", "WAGON", "WALRUS", "WATCH", "WATERFALL", "WHALE", "WHEEL", "WINDMILL", "WINDOW", "WITCH", "WOLF", "WORM", "X-RAY", "YACHT", "YOYO", "ZEBRA", "ZIPPER", "ZOMBIE"
];

// --- GAME CONFIGURATION ---
const MAX_ROUNDS = 10;
const ROUND_TIME = 60;
const SELECTION_TIME = 15;

// --- STATE MANAGEMENT ---
let players = {};
let gameState = {
    status: 'waiting', // waiting, selecting, active, intermission, game_over
    round: 1,
    currentWord: '',
    wordChoices: [],
    drawerId: null,
    timer: ROUND_TIME,
    winners: []
};
let timerInterval = null;
let drawerQueue = [];

io.on('connection', (socket) => {
    socket.on('join_game', (userData) => {
        players[socket.id] = { ...userData, id: socket.id, score: 0 };
        io.emit('player_list_update', Object.values(players));
        socket.emit('game_state_update', gameState);

        if (Object.keys(players).length >= 2 && gameState.status === 'waiting') {
            startNextRound();
        }
    });

    socket.on('word_selected', (word) => {
        if (socket.id === gameState.drawerId && gameState.status === 'selecting') {
            gameState.currentWord = word;
            gameState.status = 'active';
            gameState.timer = ROUND_TIME;
            io.emit('game_state_update', gameState);
            startTimer();
        }
    });

    socket.on('draw_stroke', (strokeData) => {
        if (socket.id === gameState.drawerId) {
            socket.broadcast.emit('remote_draw', strokeData);
        }
    });

    socket.on('clear_canvas', () => {
        if (socket.id === gameState.drawerId) {
            io.emit('remote_clear');
        }
    });

    socket.on('send_message', (text) => {
        const player = players[socket.id];
        if (!player || gameState.status !== 'active') return;

        // Drawer and Winners cannot type
        if (socket.id === gameState.drawerId || gameState.winners.includes(socket.id)) return;

        const guess = text.trim().toUpperCase();
        if (guess === gameState.currentWord) {
            // Scoring: more points for faster guesses
            const points = Math.max(10, Math.floor(gameState.timer * 5));
            player.score += points;
            gameState.winners.push(socket.id);
            
            io.emit('correct_guess', { 
                playerName: player.name, 
                players: Object.values(players) 
            });

            // If everyone guessed, end round
            if (gameState.winners.length >= Object.keys(players).length - 1) {
                endRound();
            }
        } else {
            io.emit('new_message', { user: player.name, text: text, type: 'chat' });
        }
    });

    socket.on('disconnect', () => {
        delete players[socket.id];
        drawerQueue = drawerQueue.filter(id => id !== socket.id);
        io.emit('player_list_update', Object.values(players));

        if (socket.id === gameState.drawerId) {
            endRound();
        }

        if (Object.keys(players).length < 2) {
            resetGame();
        }
    });
});

function startNextRound() {
    clearInterval(timerInterval);
    
    const playerIds = Object.keys(players);
    if (playerIds.length < 2) return;

    // Manage drawer queue
    if (drawerQueue.length === 0) {
        drawerQueue = [...playerIds].sort(() => Math.random() - 0.5);
    }
    
    gameState.drawerId = drawerQueue.shift();
    
    // Pick 3 random words for choice
    gameState.wordChoices = [];
    while(gameState.wordChoices.length < 3) {
        const w = WORDS_POOL[Math.floor(Math.random() * WORDS_POOL.length)];
        if(!gameState.wordChoices.includes(w)) gameState.wordChoices.push(w);
    }

    gameState.status = 'selecting';
    gameState.timer = SELECTION_TIME;
    gameState.winners = [];
    gameState.currentWord = '';

    io.emit('game_state_update', gameState);
    io.emit('remote_clear');
    
    startTimer();
}

function startTimer() {
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        gameState.timer--;
        io.emit('timer_update', gameState.timer);

        if (gameState.timer <= 0) {
            if (gameState.status === 'selecting') {
                // Auto pick first word if time runs out
                gameState.currentWord = gameState.wordChoices[0];
                gameState.status = 'active';
                gameState.timer = ROUND_TIME;
                io.emit('game_state_update', gameState);
            } else {
                endRound();
            }
        }
    }, 1000);
}

function endRound() {
    clearInterval(timerInterval);
    gameState.status = 'intermission';
    io.emit('game_state_update', gameState);

    setTimeout(() => {
        if (Object.keys(players).length < 2) {
            resetGame();
            return;
        }

        // Check if everyone has drawn to increment round
        if (drawerQueue.length === 0) {
            gameState.round++;
        }

        if (gameState.round > MAX_ROUNDS) {
            gameState.status = 'game_over';
            io.emit('game_state_update', gameState);
            setTimeout(resetGame, 10000);
        } else {
            startNextRound();
        }
    }, 5000);
}

function resetGame() {
    clearInterval(timerInterval);
    drawerQueue = [];
    gameState = {
        status: 'waiting',
        round: 1,
        currentWord: '',
        wordChoices: [],
        drawerId: null,
        timer: ROUND_TIME,
        winners: []
    };
    // Reset scores
    Object.keys(players).forEach(id => players[id].score = 0);
    io.emit('player_list_update', Object.values(players));
    io.emit('game_state_update', gameState);
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`SketchDash Multiplayer Server running on port ${PORT}`);
});

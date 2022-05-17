function Enum(values) {
    
    for(var name in values)
        this[name] = $.extend({ toString: function(n) { return function() { return n; }; }(name) }, values[name]);
    
}

var Color = new Enum({
    BLACK: {},
    RED: {}
});

var Suit = new Enum({
    HEARTS: { color: Color.RED },
    SPADES: { color: Color.BLACK },
    DIAMONDS: { color: Color.RED },
    CLUBS: { color: Color.BLACK }
});

var Rank = new Enum({
    ACE: { faceValue: 1 },
    TWO: { faceValue: 2 },
    THREE: { faceValue: 3 },
    FOUR: { faceValue: 4 },
    FIVE: { faceValue: 5 },
    SIX: { faceValue: 6 },
    SEVEN: { faceValue: 7 },
    EIGHT: { faceValue: 8 },
    NINE: { faceValue: 9 },
    TEN: { faceValue: 10 },
    JACK: { faceValue: 11 },
    QUEEN: { faceValue: 12 },
    KING: { faceValue: 13 }
});

var Card = function(){
    
    var e = {};
    
    for(var rank in Rank)
        for(var suit in Suit)
            e[rank + "_OF_" + suit] = { rank: Rank[rank], suit: Suit[suit] };
    
    return new Enum(e);
    
}();

var Cards = function() {
    
    var cards = [];
    
    for(var card in Card)
        cards.push(Card[card]);
    
    return cards;
    
}();

var PileType = new Enum({
    WASTE: { faceUp: true },
    STOCK: { faceUp: false },
    FOUNDATION: { faceUp: true },
    TABLEAU_BOTTOM: { faceUp: false },
    TABLEAU_TOP: { faceUp: true }
});

var Pile = function() {
    
    var e = {
        STOCK: { type: PileType.STOCK },
        WASTE: { type: PileType.WASTE }
    };
    
    for(var i = 0; i < 4; ++i)
        e["FOUNDATION_" + i] = { type: PileType.FOUNDATION, index: i };
    
    for(var i = 0; i < 7; ++i) {
        
        e["TABLEAU_BOTTOM_" + i] = { type: PileType.TABLEAU_BOTTOM, index: i }
        e["TABLEAU_TOP_" + i] = { type: PileType.TABLEAU_TOP, index: i }
        
    }
    
    return new Enum(e);
    
}();

var TableauBottoms = [
    Pile.TABLEAU_BOTTOM_0,
    Pile.TABLEAU_BOTTOM_1,
    Pile.TABLEAU_BOTTOM_2,
    Pile.TABLEAU_BOTTOM_3,
    Pile.TABLEAU_BOTTOM_4,
    Pile.TABLEAU_BOTTOM_5,
    Pile.TABLEAU_BOTTOM_6
];

var TableauTops = [
    Pile.TABLEAU_TOP_0,
    Pile.TABLEAU_TOP_1,
    Pile.TABLEAU_TOP_2,
    Pile.TABLEAU_TOP_3,
    Pile.TABLEAU_TOP_4,
    Pile.TABLEAU_TOP_5,
    Pile.TABLEAU_TOP_6
];

var Foundations = [
    Pile.FOUNDATION_0,
    Pile.FOUNDATION_1,
    Pile.FOUNDATION_2,
    Pile.FOUNDATION_3
];

function Position(pile, index) {
    
    this.pile = pile;
    this.index = index;
    
}

var Scoring = new Enum({
    NONE:                  { start:   0, tenSeconds:  0, wasteToTableau: 0, toFoundation:  0, fromFoundation:   0, flipTableau: 0, recycleWaste:    0, undo:  0, timeBonusNumerator: 0 },
    STANDARD:              { start:   0, tenSeconds: -2, wasteToTableau: 5, toFoundation: 10, fromFoundation: -15, flipTableau: 5, recycleWaste: -100, undo:  0, timeBonusNumerator: 700000 },
    STANDARD_UNDO_PENALTY: { start:   0, tenSeconds: -2, wasteToTableau: 5, toFoundation: 10, fromFoundation: -15, flipTableau: 5, recycleWaste: -100, undo: -2, timeBonusNumerator: 700000 },
    VEGAS:                 { start: -52, tenSeconds:  0, wasteToTableau: 0, toFoundation:  5, fromFoundation:  -5, flipTableau: 0, recycleWaste:    0, undo:  0, timeBonusNumerator: 0 }
});

var DrawMode = new Enum({
    DRAW_ONE: { count: 1 },
    DRAW_THREE: { count: 3 }
});

function def(arg, def) {
    return (typeof arg === "undefined") ? def : arg;
}

function GameSettings(scoring, timed, drawMode, infiniteUndo, autoFlipTableau) {
    
    this.scoring = def(scoring, Scoring.STANDARD);
    this.timed = def(timed, true);
    this.drawMode = def(drawMode, DrawMode.DRAW_ONE);
    this.infiniteUndo = def(infiniteUndo, false);
    this.autoFlipTableau = def(autoFlipTableau, true);
    
}

function shuffle(list) {
    
    for(var i = list.length - 1; i > 0; --i) {
        
        var n = Math.floor(Math.random() * (i + 1));
        
        var temp = list[i];
        list[i] = list[n];
        list[n] = temp;
        
    }
    
}

var MoveOrder = new Enum({
    FIRST_OFF_FIRST_ON: {},
    FIRST_OFF_LAST_ON: {}
});

function AtomicMove(src, dest, count, score, order) {
    
    this.src = src;
    this.dest = dest;
    this.count = count;
    this.order = def(order, MoveOrder.FIRST_OFF_LAST_ON);
    this.score = score;
    
}

AtomicMove.prototype.reverse = function() {
    return new AtomicMove(this.dest, this.src, this.count, -this.score, this.order);
};

function Move(atoms) {
    this.atoms = atoms.slice(0);
}

Move.prototype.reverse = function() {
    
    var atoms = this.atoms;
    var rev = [];
    
    for(var i = atoms.length - 1; i >= 0; --i)
        rev.push(atoms[i].reverse());
    
    return new Move(rev);
    
};

function Game(settings) {
    
    this.time = (settings.timed) ? 0 : -1;
    
    this.settings = settings;
    this.won = false;
    
    this.previousMoves = [];
    this.positionByCard = {};
    this.cardsByPile = {};
    
    this.recentlyMoved = {};
    
    for(var pile in Pile)
        this.cardsByPile[pile] = [];
    
    this.score = settings.scoring.start;
    
    var deck = [];
    for(var card in Card)
        deck.push(Card[card]);
    
    shuffle(deck);
    
    // Init tableaus
    for(var i = 0; i < 7; ++i) {
        
        var tableauBottom = TableauBottoms[i];
        var tableauTop = TableauTops[i];
        
        var bottomCards = this.cardsByPile[tableauBottom];
        var topCards = this.cardsByPile[tableauTop];
        
        // Init bottom
        for(var j = 0; j < i; ++j) {
            
            var card = deck.pop();
            
            this.positionByCard[card] = new Position(tableauBottom, j);
            bottomCards.push(card);
            
        }
        
        // Init top
        var card = deck.pop();
        
        this.positionByCard[card] = new Position(tableauTop, 0);
        topCards.push(card);
        
    }
    
    // Init stock
    var stockCards = this.cardsByPile[Pile.STOCK];
    
    for(var i = 0; i < deck.length; ++i) {
        
        var card = deck[i];
        
        this.positionByCard[card] = new Position(Pile.STOCK, i);
        stockCards.push(card);
        
    }
    
}

Game.prototype.clearRecentlyMoved = function() {
    this.recentlyMoved = {};
};

Game.prototype.canTableauAcceptCard = function(index, card) {
    
    var topCards = this.cardsByPile[TableauTops[index]];
    
    // If there are top cards
    if(topCards.length > 0) {
        
        var topCard = topCards[topCards.length - 1];
        
        if(topCard.suit.color === card.suit.color)
            return false;
        
        if(topCard.rank.faceValue !== (card.rank.faceValue + 1))
            return false;
        
        return true;
        
    }
    
    // If there are no top cards
    var bottomCards = this.cardsByPile[TableauBottoms[index]];
    
    if(bottomCards.length > 0)
        return false;
    
    return card.rank === Rank.KING;
    
};

Game.prototype.countFoundationCards = function() {
    
    var inFoundations = 0;
    
    for(var i = 0; i < Foundations.length; ++i)
        inFoundations += this.cardsByPile[Foundations[i]].length;
    
    return inFoundations;
    
};

Game.prototype.flipTableau = function(index) {
    
    var tableauTop = TableauTops[index];
    var tableauBottom = TableauBottoms[index];
    
    var tableauTopCards = this.cardsByPile[tableauTop];
    var tableauBottomCards = this.cardsByPile[tableauBottom];
    
    if(tableauTopCards.length > 0)
        return null;
    
    if(tableauBottomCards.length < 1)
        return null;
    
    return new AtomicMove(tableauBottom, tableauTop, 1, this.settings.scoring.flipTableau);
    
};

Game.prototype.wasteOrFoundationToTableau = function(src, destIndex) {
    
    var srcCards = this.cardsByPile[src];
    
    if(srcCards.length < 1)
        return null;
    
    var card = srcCards[srcCards.length - 1];
    
    if(!this.canTableauAcceptCard(destIndex, card))
        return null;
    
    var score = src.type === PileType.FOUNDATION ? this.settings.scoring.fromFoundation : this.settings.scoring.wasteToTableau;
    
    return new AtomicMove(src, TableauTops[destIndex], 1, score);
    
};

Game.prototype.tableauToTableau = function(srcIndex, destIndex) {
    
    var src = TableauTops[srcIndex];
    var srcCards = this.cardsByPile[src];
    
    for(var i = 0; i < srcCards.length; ++i) {
        
        var card = srcCards[i];
        
        if(this.canTableauAcceptCard(destIndex, card))
            return new AtomicMove(src, TableauTops[destIndex], srcCards.length - i, 0);
        
    }
    
    return null;
    
};

Game.prototype.toTableau = function(src, destIndex) {
    
    // Flipping tableau
    if(src.type === PileType.TABLEAU_BOTTOM && src.index === destIndex)
        return this.flipTableau(destIndex);
    
    // Waste or foundation to tableau
    if(src.type === PileType.WASTE || src.type === PileType.FOUNDATION)
        return this.wasteOrFoundationToTableau(src, destIndex);
    
    // Other tableau to tableau
    if(src.type === PileType.TABLEAU_TOP && src.index !== destIndex)
        return this.tableauToTableau(src.index, destIndex);
    
    return null;
    
};

Game.prototype.toFoundation = function(src, destIndex) {
    
    if(!src.type.faceUp)
        return null;
    
    var srcCards = this.cardsByPile[src];
    if(srcCards.length < 1)
        return null;
    
    var card = srcCards[srcCards.length - 1];
    
    var dest = Foundations[destIndex];
    var destCards = this.cardsByPile[dest];
    
    if(destCards.length === 0) {
        
        if(card.rank !== Rank.ACE)
            return null;
        
    } else {
        
        var toCover = destCards[destCards.length - 1];
        
        if(card.suit !== toCover.suit)
            return null;
        
        if(card.rank.faceValue !== toCover.rank.faceValue + 1)
            return null;
        
    }
    
    return new AtomicMove(src, dest, 1, (src.type !== PileType.FOUNDATION) ? this.settings.scoring.toFoundation : 0);
    
};

Game.prototype.toWaste = function(src) {
    
    if(src !== Pile.STOCK)
        return null;
    
    var stockCards = this.cardsByPile[Pile.STOCK];
    if(stockCards.length === 0)
        return null;
    
    var toMove = Math.min(stockCards.length, this.settings.drawMode.count);
    
    return new AtomicMove(Pile.STOCK, Pile.WASTE, toMove, 0, MoveOrder.FIRST_OFF_FIRST_ON);
    
};

Game.prototype.toStock = function(src) {
    
    if(src !== Pile.WASTE)
        return null;
    
    if(this.settings.scoring === Scoring.VEGAS)
        return null;
    
    if(this.cardsByPile[Pile.STOCK].length > 0)
        return null;
    
    if(this.cardsByPile[Pile.WASTE].length === 0)
        return null;
    
    return new AtomicMove(Pile.WASTE, Pile.STOCK, this.cardsByPile[Pile.WASTE].length, this.settings.scoring.recycleWaste, MoveOrder.FIRST_OFF_FIRST_ON);
    
};

Game.prototype.move = function(src, dest) {
    
    if(src === dest)
        return null;
    
    var atom;
    
    switch(dest.type) {
    
    case PileType.TABLEAU_TOP:
        atom = this.toTableau(src, dest.index);
        break;
    
    case PileType.FOUNDATION:
        atom = this.toFoundation(src, dest.index);
        break;
    
    case PileType.WASTE:
        atom = this.toWaste(src);
        break;
    
    case PileType.STOCK:
        atom = this.toStock(src);
        break;
    
    default:
        atom = null;
        break;
    
    }
    
    if(atom === null)
        return null;
    
    // Apply atoms and return full move
    var move;
    
    this.apply(atom);
    
    // Flip tableau if we uncovered it (and if we're supposed to auto-flip)
    if(this.settings.autoFlipTableau && src.type == PileType.TABLEAU_TOP && this.cardsByPile[TableauTops[src.index]].length === 0 && this.cardsByPile[TableauBottoms[src.index]].length !== 0) {
        
        var flip = this.flipTableau(src.index);
        this.apply(flip);
        
        move = new Move([ atom, flip ]);
        
    } else {
        move = new Move([ atom ]);
    }
    
    this.recordMove(move);
    return move;
    
};

Game.prototype.recordMove = function(move) {
    
    if(!this.settings.infiniteUndo)
        this.previousMoves.length = 0;
    
    this.previousMoves.push(move);
    
};

Game.prototype.canUndo = function() {
    
    if(this.previousMoves.length === 0)
        return false;
    
    var lastMoveIndex = this.previousMoves.length - 1;
    
    var move = this.previousMoves[lastMoveIndex];
    
    // Prevent undo if last move only flipped a tableau card and there are no infinite undos
    if(!this.settings.infiniteUndo && !this.settings.autoFlipTableau && move.atoms[0].src.type === PileType.TABLEAU_BOTTOM)
        return false;
    
    return true;
    
};

Game.prototype.undo = function() {
    
    if(this.previousMoves.length === 0)
        return null;
    
    var lastMoveIndex = this.previousMoves.length - 1;
    
    var move = this.previousMoves[lastMoveIndex];
    
    // Prevent undo if last move only flipped a tableau card and there are no infinite undos
    if(!this.settings.infiniteUndo && !this.settings.autoFlipTableau && move.atoms[0].src.type === PileType.TABLEAU_BOTTOM)
        return null;
    
    move = move.reverse();
    this.previousMoves.length = lastMoveIndex;
    
    var atoms = move.atoms;
    for(var i = 0; i < atoms.length; ++i)
        this.apply(atoms[i]);
    
    this.incrementScore(this.settings.scoring.undo);
    
    return move;
    
};

Game.prototype.apply = function(move) {
    
    if(this.won)
        alert("Debug:  ACK!  Game is won.  No moves after game is won!");
    
    // Get cards
    var srcCards = this.cardsByPile[move.src];
    var destCards = this.cardsByPile[move.dest];
    
    var toMove = srcCards.slice(srcCards.length - move.count);
    
    // Reverse order if necessary
    if(move.order === MoveOrder.FIRST_OFF_FIRST_ON)
        toMove.reverse();
    
    // Update positions
    var destIndex = destCards.length;
    
    for(var i = 0; i < toMove.length; ++i) {
        
        var card = toMove[i];
        
        this.positionByCard[card] = new Position(move.dest, destIndex++);
        this.recentlyMoved[card] = true;
        destCards.push(card);
        
    }
    
    srcCards.length -= toMove.length;
    
    // Score
    this.incrementScore(move.score);
    
    // If move was to foundation, check to see if it was a winning move
    if(move.dest.type === PileType.FOUNDATION) {
        
        if(this.countFoundationCards() === Cards.length) {
            
            // Time bonus
            if(this.time >= 30)
                this.incrementScore(Math.floor(this.settings.scoring.timeBonusNumerator / this.time));
            
            this.won = true;
            
        }
        
    }
    
};

Game.prototype.incrementScore = function(s) {
    
    if(this.won)
        alert("Debug:  ACK!  Game is won so no incrementing score!");
    
    this.score += s;
    
    if(this.score < 0)
        this.score = 0;
    
};

Game.prototype.incrementTime = function() {
    
    if(this.won)
        alert("Debug:  ACK!  Game is won, so no incrementing time!");
    
    if(this.time < 0)
        return;
    
    ++this.time;
    
    if((this.time % 10) === 0)
        this.incrementScore(this.settings.scoring.tenSeconds);
    
};

Game.prototype.getEmptyFoundation = function() {
    
    for(var i = 0; i < Foundations.length; ++i)
        if(this.cardsByPile[Foundations[i]].length === 0)
            return i;
    
    return -1;
    
};

Game.prototype.getFoundation = function(suit) {
    
    for(var i = 0; i < Foundations.length; ++i) {
        
        var foundationCards = this.cardsByPile[Foundations[i]];
        
        if(foundationCards.length > 0 && foundationCards[0].suit === suit)
            return i;
        
    }
    
    return -1;
    
};

Game.prototype.getUsableFoundation = function(card) {
    
    var foundationIndex;
    
    if(card.rank === Rank.ACE) {
        
        foundationIndex = this.getEmptyFoundation();
        
        if(foundationIndex < 0)
            alert("Debug:  ACK!  There should always be a place for an ace!");
        
    } else {
        
        foundationIndex = this.getFoundation(card.suit);
        
        if(foundationIndex < 0)
            return null;
        
        var cards = this.cardsByPile[Foundations[foundationIndex]];
        
        if(card.rank.faceValue !== (cards[cards.length - 1].rank.faceValue + 1))
            return null;
        
    }
    
    return Foundations[foundationIndex];
    
};

Game.prototype.autoFoundation = function(src) {
    
    if(src.type !== PileType.TABLEAU_TOP && src.type !== PileType.WASTE)
        return null;
    
    var cards = this.cardsByPile[src];
    
    if(cards.length === 0)
        return null;
    
    var dest = this.getUsableFoundation(cards[cards.length - 1]);
    
    if(dest === null)
        return null;
    
    return this.move(src, dest);
    
};

Game.prototype.autoFoundations = function() {
    
    var moves = [];
    var dest, src;
    var cards;
    
    var raisedCard;
    
    do {
        
        raisedCard = false;
        
        for(var i = 0; i < TableauTops.length; ++i) {
            
            src = TableauTops[i];
            cards = this.cardsByPile[src];
            
            if(cards.length === 0)
                continue;
            
            dest = this.getUsableFoundation(cards[cards.length - 1]);
            
            if(dest === null)
                continue;
            
            moves.push(this.move(src, dest));
            
            raisedCard = true;
            
        }
        
        var cards = this.cardsByPile[Pile.WASTE];
        
        if(cards.length === 0)
            continue;
        
        dest = this.getUsableFoundation(cards[cards.length - 1]);
        
        if(dest === null)
            continue;
        
        moves.push(this.move(Pile.WASTE, dest));
        raisedCard = true;
        
    } while(raisedCard);
    
    return moves;
    
};

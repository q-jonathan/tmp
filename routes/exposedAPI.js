/** @format */

const router = require("express").Router();
const { squareToInt, intToSquare, pieceValue } = require("../utils/utils");
const explorer = require("lichess-opening-explorer");
const Chess = require("chess.js");

router.route("/calc_move").post((req, res) => {
  let game = req.body.game;
  // let explorer = req.body.explorer
  let engineColor = req.body.colorToMove;
  let currentEval = req.body.currentEval;

  let count = 0;
  let nodeNum = 0;

  makeMove(engineColor, explorer);

  async function makeMove(colorToMove, explorer) {
    explorer
      .analyze(game.fen(), {
        master: false,
        variant: "standard",
        speeds: ["bullet", "blitz", "rapid", "classical"],
        ratings: ["unlimited"],
      })
      .then((analysis) => {
        // do something genious
        console.log(analysis);
        var randomNum = Math.floor(Math.random() * 3);
        if (analysis.moves.length >= 3) {
          game.move(analysis.moves[randomNum].san);
          console.log(analysis.moves[randomNum].san);
          return;
        }
        console.log("kekw");
        count = 0;
        if (game.turn() === "w" && colorToMove === "black") {
          colorToMove = "white";
        }
        const possibleMoves = game.moves();

        //console.log(possibleMoves)
        if (game.game_over() || possibleMoves.length === 0) {
          if (game.in_checkmate()) {
            if (game.turn() === "b") {
              setStateOfGame("White wins by checkmate");
            } else {
              setStateOfGame("Black wins by checkmate");
            }
          }

          if (game.in_draw()) {
            if (game.insufficient_material()) {
              setStateOfGame("Game over - draw by insufficient material");
            }
            setStateOfGame("Game over - draw by 50 move rule");
          }

          if (game.in_stalemate()) {
            setStateOfGame("Draw by stalemate");
          }

          if (game.in_threefold_repetition()) {
            setStateOfGame("Draw by reptition");
          }
          return;
        }
        console.time("Move time");
        const move = minimax(
          game,
          searchDepth,
          0,
          -1000000,
          1000000,
          currentEval
        ); //fix
        console.log(move);
        // console.log(moved.san)
        // if(moved.san.includes("x") === true){
        //   var temp = pieceNum - 1;
        //   setPieceNum(temp);
        // }
        console.timeEnd("Move time");
        console.log("Positions Searched: " + nodeNum);

        res.json({
          move: move,
          count: count,
        });
        return;
      })
      .catch((err) => {
        console.error(err);
      });
  }
  // eval of current board at targetdepth

  function minimax(game, depth, distanceFromRoot, alpha, beta, gameEval) {
    //returns gameEval
    if (depth === 0) {
      nodeNum++;
      if (game.turn() === "b") {
        return -gameEval - 2 * quiescenceEval(game); //returns the cumulative eval
      } else {
        return gameEval + 2 * quiescenceEval(game);
      }
    }

    // run eval
    var prevEval = gameEval;

    var moves = game.moves();
    //console.log(moves)
    moveOrdering(moves, game);
    //console.log(moves)
    var bestMove = null;
    var bestEval = null;
    for (let i = 0; i < moves.length; i++) {
      var gameCopy = new Chess(); //dummy board to pass down
      gameCopy.load(game.fen());
      const moveInfo = gameCopy.move(moves[i]);

      var curGameCopy = new Chess(); //static board to eval, before the move so we know which piece was taken if a capture occurs
      curGameCopy.load_pgn(game.pgn());
      var curEval = trackingEval(
        curGameCopy,
        game.turn(),
        prevEval,
        moveInfo,
        moves[i]
      ); //returns the OBJECTIVE eval for the current move for current move sequence
      if (gameCopy.in_checkmate() === true) {
        if (curGameCopy.turn() === "w") {
          //white's turn on the current board so white made the checkmate

          return 10000;
        } else {
          return -10000;
        }
      }
      var evaluated = -minimax(
        gameCopy,
        depth - 1,
        distanceFromRoot + 1,
        -beta,
        -alpha,
        curEval
      ); //pass down the current eval for that move
      if (evaluated >= beta) {
        //console.log("pruned")
        return beta;
      } else {
        //console.log("didn't prune")
      }

      if (evaluated > alpha) {
        alpha = evaluated;
        bestMove = moves[i];
        //bestEval = evaluated;
        if (distanceFromRoot === 0) {
          bestEval = evaluated;
        }
      }
    }

    if (distanceFromRoot === 0) {
      if (engineColor === "b") {
        setEval(bestEval);
      } else {
        setEval(-bestEval);
      }
      // if(bestMove.includes("x") === true){
      //   var temp = pieceNum - 1;
      //   setPieceNum(temp)
      // }
      return bestMove;
    }
    return alpha;
  }

  function moveOrdering(moves, game) {
    var counter = 0;
    for (let i = 0; i < moves.length; i++) {
      var captures = moves[i].includes("x");
      var checks = moves[i].includes("+");
      if (captures === true || checks === true) {
        var temp = moves[counter];
        moves[counter] = moves[i];
        moves[i] = temp;
        counter++;
      }
    }
    var counter2 = 0;
    for (let i = 0; i < counter; i++) {
      var game = new Chess(game.fen());
      if (
        game.get(
          moves[i].substring(
            moves[i].includes("x") + 1,
            moves[i].includes("x") + 3
          )
        ) !== null
      ) {
        if (
          game.get(
            moves[i].substring(
              moves[i].includes("x") + 1,
              moves[i].includes("x") + 3
            ).type !== "p"
          )
        ) {
          var temp = moves[counter2];
          moves[counter2] = moves[i];
          moves[i] = temp;
          counter2++;
        }
      }
    }
  }

  function quiescenceChecking(moves) {
    //returns a boolean that decides whether the position is quiet or not
    for (let i = 0; i < moves.length; i++) {
      var result = moves[i].includes("x");
      if (result === true) {
        return true;
      }
    }
    //console.log("quiet")
    return false;
  }

  function quiescenceEval(game) {
    //returns a boolean that decides whether the position is quiet or not\

    var moves = game.moves();
    var max = 0;
    for (let i = 0; i < moves.length; i++) {
      var result = moves[i].includes("x");
      if (result === true) {
        var square = moves[i].substring(
          moves[i].indexOf("x") + 1,
          moves[i].indexOf("x") + 3
        );
        var gameCopy = new Chess();
        gameCopy.load_pgn(game.pgn());
        var t = gameCopy.move(moves[i]);
        // if(t === null){
        //   setTestFlags("null !")
        // }else{
        //   setTestFlags(t)
        // }
        if (t !== null) {
          if (t.flags === "e") {
            // console.log(game.turn())
            // console.log(moves[i])
            // console.log(square)
            if (game.turn() === "w") {
              square = intToSquare(squareToInt(square) + 8);
            } else {
              square = intToSquare(squareToInt(square) - 8);
            }
            //console.log(square)
          }
        }
        var piece = game.get(square).type;
        if (piece === "q") {
          if (9 > max) {
            max = 9;
          }
        }
        if (piece === "b") {
          if (3 > max) {
            max = 3;
          }
        }
        if (piece === "n") {
          if (3 > max) {
            max = 3;
          }
          return 3;
        }
        if (piece === "r") {
          if (5 > max) {
            max = 5;
          }
          return 5;
        }
        if (1 > max) {
          max = 1;
        }
      }
    }
    //console.log("quiet")
    return max;
  }

  function trackingEval(game, turnColor, prevEval, moveInfo, move) {
    //"game" is before the move
    //console.time("trackingEval")
    var score = 0;
    var afterMove = new Chess();

    //console.time("fen")
    afterMove.load(game.fen());
    //console.timeEnd("fen")
    //console.time("middle code")
    afterMove.move(move);
    if (afterMove.in_checkmate() === true) {
      score = 10000;
      return score;
    }

    if (afterMove.in_draw() === true) {
      score = 0;
      return score;
    }

    var fromSq = moveInfo.from;
    var toSq = moveInfo.to;
    var piece = moveInfo.piece;
    var color = turnColor; //the one making this move

    if (move === "O-O" || move === "O-O-O") {
      //should implement a check for pawn structure
      //shortcastles
      if (color === "b") {
        score += 10;
      } else {
        score -= 10;
      }
      if (color === "b") {
        return prevEval + score;
      } else {
        return prevEval - score;
      }
    }
    //console.timeEnd("middle code")
    //console.time("piece calc")
    var preValue = pieceValue(piece, fromSq, color);
    var postValue = pieceValue(piece, toSq, color);
    if (color === "w") {
      score += postValue - preValue;
    } else {
      score -= postValue - preValue;
    }
    if (move.includes("x") === true) {
      if (moveInfo.flags === "e") {
        if (color === "w") {
          toSq = intToSquare(squareToInt(toSq) + 8);
        } else {
          toSq = intToSquare(squareToInt(toSq) - 8);
        }
      }
      var opposingColor = "w";
      if (color === "w") {
        opposingColor = "b";
      }
      var captured = pieceValue(game.get(toSq).type, toSq, opposingColor);
      if (color === "w") {
        score += captured;
      } else {
        score -= captured;
      }
    }
    //console.timeEnd("piece calc")
    //console.timeEnd("trackingEval")
    return prevEval + score;
  }

  function evaluation(game) {
    //check player color and begin scanning board
    //keep count of each color's "score" by checking with piece-value matrices
    //add up and find an equation to represent the board as a number
    nodeNum++;
    var score = 0;

    if (game.in_checkmate()) {
      if (game.turn() === "w") {
        return -10000;
      } else {
        return 10000;
      }
    }

    if (game.in_draw()) {
      return 0;
    }
    // prettier-ignore
    var squares = [ "a8", "b8", "c8", "d8", "e8", "f8", "g8", "h8", "a7", "b7", "c7", "d7", "e7", "f7", "g7", "h7", "a6", "b6", "c6", "d6", "e6", "f6", "g6", "h6", "a5", "b5", "c5", "d5", "e5", "f5", "g5", "h5", "a4", "b4", "c4", "d4", "e4", "f4", "g4", "h4", "a3", "b3", "c3", "d3", "e3", "f3", "g3", "h3", "a2", "b2", "c2", "d2", "e2", "f2", "g2", "h2", "a1", "b1", "c1", "d1", "e1", "f1", "g1", "h1", ];
    var black = 0; //stores current score
    var white = 0; //stores current score
    for (let i = 0; i < 64; i++) {
      if (game.get(squares[i]) != null) {
        if (game.get(squares[i]).type === "p") {
          if (game.get(squares[i]).color === "w") {
            white += pawn(i, "w");
          } else {
            black += pawn(i, "b");
          }
        }

        if (game.get(squares[i]).type === "n") {
          if (game.get(squares[i]).color === "w") {
            white += knight(i);
          } else {
            black += knight(i);
          }
        }

        if (game.get(squares[i]).type === "b") {
          if (game.get(squares[i]).color === "w") {
            white += bishop(i);
          } else {
            black += bishop(i);
          }
        }

        if (game.get(squares[i]).type === "r") {
          if (game.get(squares[i]).color === "w") {
            white += rook(i, "w");
          } else {
            black += rook(i, "b");
          }
        }

        if (game.get(squares[i]).type === "q") {
          if (game.get(squares[i]).color === "w") {
            white += queen(i);
          } else {
            black += queen(i);
          }
        }

        if (game.get(squares[i]).type === "k") {
          if (game.get(squares[i]).color === "w") {
            white += king(i, "w");
          } else {
            black += king(i, "b");
          }
        }
      }
    }
    count++;
    score = white - black;
    if (game.turn() === "b") {
      score -= 0; //quiescenceEval(game)
      return -score;
    } else {
      score += 0; //quiescenceEval(game)
    }
    return score;
  }
});

module.exports = router;

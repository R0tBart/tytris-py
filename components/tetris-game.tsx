"use client"

import { useState, useEffect, useCallback } from "react"
import { useInterval } from "@/hooks/use-interval"
import { useWindowSize } from "@/hooks/use-window-size"
import GameBoard from "./game-board"
import GameStats from "./game-stats"
import GameControls from "./game-controls"
import SoundControl from "./sound-control"
import { createEmptyBoard, checkCollision, getRandomPiece, TETROMINOS } from "@/lib/tetris-utils"
import { soundManager } from "@/lib/sound-manager"
import type { Board, Position } from "@/types/tetris-types"

export default function TetrisGame() {
  const { width, height } = useWindowSize()
  const isSmallScreen = width < 640
  const isMediumScreen = width >= 640 && width < 1024
  const isLargeScreen = width >= 1024

  const [gameStarted, setGameStarted] = useState<boolean>(false)
  const [gameOver, setGameOver] = useState<boolean>(false)
  const [score, setScore] = useState<number>(0)
  const [rows, setRows] = useState<number>(0)
  const [level, setLevel] = useState<number>(0)
  const [dropTime, setDropTime] = useState<number | null>(null)
  const [board, setBoard] = useState<Board>(createEmptyBoard())
  const [currentPiece, setCurrentPiece] = useState<string | null>(null)
  const [nextPiece, setNextPiece] = useState<string | null>(null)
  const [position, setPosition] = useState<Position>({ x: 0, y: 0 })
  const [rotation, setRotation] = useState<number>(0)

  // Initialisiere Sound Manager
  useEffect(() => {
    soundManager.initialize()
  }, [])

  // Berechne die optimale Spielfeldgröße basierend auf der Bildschirmgröße
  const calculateBoardSize = useCallback(() => {
    if (isSmallScreen) {
      // Für kleine Bildschirme (Mobilgeräte)
      const boardWidth = Math.min(width * 0.9, 300)
      const boardHeight = boardWidth * 2
      return { width: boardWidth, height: boardHeight }
    } else if (isMediumScreen) {
      // Für mittlere Bildschirme (Tablets)
      const boardHeight = Math.min(height * 0.7, 600)
      const boardWidth = boardHeight / 2
      return { width: boardWidth, height: boardHeight }
    } else {
      // Für große Bildschirme (Desktop)
      const boardHeight = Math.min(height * 0.8, 700)
      const boardWidth = boardHeight / 2
      return { width: boardWidth, height: boardHeight }
    }
  }, [height, isMediumScreen, isSmallScreen, width])

  const boardSize = calculateBoardSize()

  // Initialize game
  const startGame = useCallback(() => {
    // Reset everything
    setBoard(createEmptyBoard())
    setScore(0)
    setRows(0)
    setLevel(0)
    setDropTime(1000)
    setGameOver(false)
    setGameStarted(true)

    // Set initial pieces
    const newPiece = getRandomPiece()
    setCurrentPiece(newPiece)
    setNextPiece(getRandomPiece())

    // Set initial position
    setPosition({
      x: Math.floor((10 - TETROMINOS[newPiece].shape[0].length) / 2),
      y: 0,
    })
    setRotation(0)

    // Spiele Startgeräusch und starte Musik
    soundManager.play("start")
    soundManager.startMusic()
  }, [])

  // Move piece horizontally
  const movePiece = useCallback(
    (dir: number) => {
      if (!gameOver && gameStarted && currentPiece !== null && !checkCollision(board, currentPiece, position.x + dir, position.y, rotation)) {
            setPosition((prev: Position) => ({ ...prev, x: prev.x + dir }))
            soundManager.play("move")
      }
    },
    [board, currentPiece, gameOver, gameStarted, position.x, position.y, rotation],
  )

  // Rotate piece
  const rotatePiece = useCallback(() => {
    if (!gameOver && gameStarted && currentPiece) {
      const newRotation = (rotation + 1) % 4
      if (!checkCollision(board, currentPiece, position.x, position.y, newRotation)) {
        setRotation(newRotation)
        soundManager.play("rotate")
      }
    }
  }, [board, currentPiece, gameOver, gameStarted, position.x, position.y, rotation])

  // Drop piece one row
  const dropPiece = useCallback(() => {
    if (!gameOver && gameStarted && currentPiece) {
      if (!checkCollision(board, currentPiece, position.x, position.y + 1, rotation)) {
        setPosition((prev: Position) => ({ ...prev, y: prev.y + 1 }))
      } else {
        // Piece has landed
        updateBoard()
      }
    }
  }, [board, currentPiece, gameOver, gameStarted, position.x, position.y, rotation])

  // Drop piece all the way down
  const dropPieceToBottom = useCallback(() => {
    if (!gameOver && gameStarted && currentPiece) {
      let newY = position.y
      while (!checkCollision(board, currentPiece, position.x, newY + 1, rotation)) {
        newY += 1
      }
      setPosition((prev: Position) => ({ ...prev, y: newY }))
      soundManager.play("drop")
      updateBoard()
    }
  }, [board, currentPiece, gameOver, gameStarted, position.x, position.y, rotation])

  // Update the board when a piece lands
  const updateBoard = useCallback(() => {
    if (!currentPiece || !nextPiece) {
      return
    }

    // Create a new board with the current piece merged in
    const newBoard = [...board]
    const shape = TETROMINOS[currentPiece].shape[rotation]
    const { color } = TETROMINOS[currentPiece]

    for (let y = 0; y < shape.length; y++) {
      for (let x = 0; x < shape[y].length; x++) {
        if (shape[y][x] !== 0) {
          const boardY = y + position.y
          const boardX = x + position.x
          if (boardY >= 0) {
            newBoard[boardY][boardX] = { color, merged: true }
          }
        }
      }
    }

    // Check for completed rows
    let clearedRows = 0
    for (let y = 0; y < 20; y++) {
      if (newBoard[y].every((cell: { color: string; merged: boolean } | null) => cell !== null)) {
        // Remove the row and add an empty row at the top
        newBoard.splice(y, 1)
        newBoard.unshift(Array(10).fill(null) as Array<{ color: string; merged: boolean } | null>)
        clearedRows += 1
        y -= 1 // Check the same row again
      }
    }

    // Update score and level
    if (clearedRows > 0) {
      // Spiele Sound für gelöschte Reihen
      if (clearedRows === 4) {
        soundManager.play("clearTetris")
      } else {
        soundManager.play("clearLine")
      }

      const points = [0, 40, 100, 300, 1200][clearedRows] * (level + 1)
      setScore((prev: number) => prev + points)
      setRows((prev: number) => {
        const newRows: number = prev + clearedRows
        // Level up every 10 rows
        if (Math.floor(newRows / 10) > Math.floor(prev / 10)) {
          setLevel((prev: number) => prev + 1)
          // Speed up drop time
          setDropTime(1000 * Math.pow(0.8, Math.floor(newRows / 10)))
          // Spiele Level-Up Sound
          soundManager.play("levelUp")
        }
        return newRows
      })
    }

    // Set the new board
    setBoard(newBoard)

    // Get next piece
    setCurrentPiece(nextPiece)
    const newNextPiece = getRandomPiece()
    setNextPiece(newNextPiece)

    // Reset position and rotation
    const newPieceWidth = TETROMINOS[nextPiece].shape[0].length
    setPosition({
      x: Math.floor((10 - newPieceWidth) / 2),
      y: 0,
    })
    setRotation(0)

    // Check for game over
    if (checkCollision(newBoard, nextPiece, Math.floor((10 - newPieceWidth) / 2), 0, 0)) {
      setGameOver(true)
      setDropTime(null)
      // Spiele Game Over Sound und pausiere Musik
      soundManager.play("gameOver")
      soundManager.pauseMusic()
    }
  }, [board, currentPiece, level, nextPiece, position.x, position.y, rotation])

  // Handle key presses
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!gameStarted && e.keyCode === 32) {
        // Space
        startGame()
        return
      }

      if (gameOver) {
        // Bei Game Over kann man mit Leertaste neu starten
        if (e.keyCode === 32) {
          startGame()
        }
        return
      }

      switch (e.keyCode) {
        case 37: // Left arrow
          movePiece(-1)
          break
        case 39: // Right arrow
          movePiece(1)
          break
        case 40: // Down arrow
          dropPiece()
          break
        case 38: // Up arrow
          rotatePiece()
          break
        case 32: // Space
          dropPieceToBottom()
          break
        case 77: // M key for mute/unmute
          soundManager.toggleMute()
          break
        default:
          break
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => {
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [dropPiece, dropPieceToBottom, gameOver, gameStarted, movePiece, rotatePiece, startGame])

  // Auto drop piece
  useInterval(() => {
    dropPiece()
  }, dropTime)

  // Pausiere Musik, wenn das Spiel verlassen wird
  useEffect(() => {
    return () => {
      soundManager.pauseMusic()
    }
  }, [])

  // Füge einen visuellen Effekt für Game Over hinzu
  const gameOverEffect = gameOver ? "opacity-70 blur-[1px]" : ""

  return (
    <div
      className={`
      flex 
      ${isSmallScreen ? "flex-col" : isLargeScreen ? "flex-row" : "flex-col md:flex-row"} 
      gap-6 items-center justify-center
      max-w-full
    `}
    >
      <div className={`relative ${gameOverEffect}`}>
        <GameBoard
          board={board}
          currentPiece={currentPiece}
          position={position}
          rotation={rotation}
          width={boardSize.width}
          height={boardSize.height}
        />
        {gameOver && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="bg-red-500/20 w-full h-full"></div>
          </div>
        )}
      </div>
      <div
        className={`
        flex 
        ${isSmallScreen ? "flex-row" : isLargeScreen ? "flex-col" : "flex-row md:flex-col"} 
        gap-4 flex-wrap justify-center
      `}
      >
        <div className="flex flex-col gap-4">
          <GameStats score={score} rows={rows} level={level} nextPiece={nextPiece} isSmallScreen={isSmallScreen} />
          <div className="flex justify-end">
            <SoundControl />
          </div>
        </div>
        <GameControls
          gameStarted={gameStarted}
          gameOver={gameOver}
          onStart={startGame}
          onMove={movePiece}
          onRotate={rotatePiece}
          onDrop={dropPiece}
          onDropToBottom={dropPieceToBottom}
          isSmallScreen={isSmallScreen}
          score={score}
        />
      </div>
    </div>
  )
}

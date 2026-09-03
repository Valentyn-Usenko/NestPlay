import {
    useEffect,
    useRef
  } from 'react'
  
  const escapeStack = []
  
  let listening = false
  
  function handleKeyDown(event) {
    if (event.key !== 'Escape') {
      return
    }
  
    const topHandler =
      escapeStack[
        escapeStack.length - 1
      ]
  
    if (!topHandler) {
      return
    }
  
    event.preventDefault()
  
    topHandler()
  }
  
  function startListening() {
    if (listening) {
      return
    }
  
    document.addEventListener(
      'keydown',
      handleKeyDown
    )
  
    listening = true
  }
  
  function stopListening() {
    if (
      !listening ||
      escapeStack.length > 0
    ) {
      return
    }
  
    document.removeEventListener(
      'keydown',
      handleKeyDown
    )
  
    listening = false
  }
  
  export default function useEscapeKey(
    onEscape,
    enabled = true
  ) {
    const handlerRef =
      useRef(onEscape)
  
    useEffect(() => {
      handlerRef.current =
        onEscape
    }, [onEscape])
  
    useEffect(() => {
      if (!enabled) {
        return
      }
  
      const handler = () => {
        handlerRef.current?.()
      }
  
      escapeStack.push(
        handler
      )
  
      startListening()
  
      return () => {
        const index =
          escapeStack.lastIndexOf(
            handler
          )
  
        if (index !== -1) {
          escapeStack.splice(
            index,
            1
          )
        }
  
        stopListening()
      }
    }, [enabled])
  }
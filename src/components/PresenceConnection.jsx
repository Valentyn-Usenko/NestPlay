import {
  useEffect
} from 'react'

import {
  connectPresence,
  disconnectPresence
} from '../presenceClient'

export default function PresenceConnection({
  session
}) {
  useEffect(() => {
    if (!session) {
      disconnectPresence()
      return undefined
    }

    void connectPresence()

    return () => {
      disconnectPresence()
    }
  }, [session])

  return null
}

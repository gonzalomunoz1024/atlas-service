import { useEffect, useRef, useState } from 'react'
import type { FlowEvent } from '../types/atlas'
import { DEMO_MODE, nextFlowEvent } from '../lib/demo'

/**
 * Live flow feed. Connects to /ws/flow in normal mode (auto-reconnecting, mirroring the
 * TradingService useWebSocket resilience) or synthesizes events locally in demo mode so the
 * app stays alive with the backend down.
 */
export function useFlowStream(
  component: string,
  onEvent: (e: FlowEvent) => void,
  enabled = true,
  rev?: string,
) {
  const [live, setLive] = useState(false)
  const cbRef = useRef(onEvent)
  cbRef.current = onEvent

  useEffect(() => {
    let stopped = false

    // no live data when the viewed revision isn't running (e.g. an undeployed commit)
    if (!enabled) {
      setLive(false)
      return
    }

    if (DEMO_MODE) {
      let seq = 0
      setLive(true)
      const id = setInterval(() => cbRef.current(nextFlowEvent(component, seq++)), 850)
      return () => {
        stopped = true
        setLive(false)
        clearInterval(id)
      }
    }

    let ws: WebSocket | null = null
    let reconnect: ReturnType<typeof setTimeout> | null = null
    let attempt = 0

    const connect = () => {
      if (stopped) return
      const proto = location.protocol === 'https:' ? 'wss' : 'ws'
      const revParam = rev ? `&rev=${encodeURIComponent(rev)}` : ''
      ws = new WebSocket(
        `${proto}://${location.host}/ws/flow?component=${encodeURIComponent(component)}${revParam}`,
      )

      ws.onopen = () => {
        attempt = 0
        setLive(true)
      }
      ws.onmessage = (msg) => {
        try {
          const evt = JSON.parse(msg.data) as FlowEvent
          if (evt && evt.source && evt.target) cbRef.current(evt)
        } catch {
          /* ignore malformed frames */
        }
      }
      ws.onclose = () => {
        setLive(false)
        if (stopped) return
        attempt += 1
        const delay = Math.min(1000 * 2 ** attempt, 8000)
        reconnect = setTimeout(connect, delay)
      }
      ws.onerror = () => ws?.close()
    }

    connect()
    return () => {
      stopped = true
      setLive(false)
      if (reconnect) clearTimeout(reconnect)
      ws?.close()
    }
  }, [component, enabled, rev])

  return { live }
}

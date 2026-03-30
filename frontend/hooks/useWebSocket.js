import { useEffect } from 'react';
import { useStore } from '../store';

export const useWebSocket = () => {
  const store = useStore();

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;

    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('[WebSocket] Connected');
      store.setWebSocketConnected(true);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        handleWebSocketEvent(data, store);
      } catch (error) {
        console.error('[WebSocket] Parse error:', error);
      }
    };

    ws.onerror = (error) => {
      console.error('[WebSocket] Error:', error);
      store.setWebSocketConnected(false);
    };

    ws.onclose = () => {
      console.log('[WebSocket] Disconnected');
      store.setWebSocketConnected(false);
      // Attempt reconnection after 3 seconds
      setTimeout(() => {
        // Re-run this effect
      }, 3000);
    };

    return () => {
      ws.close();
    };
  }, []);
};

const handleWebSocketEvent = (event, store) => {
  switch (event.type) {
    case 'CHECKIN_EVENT':
    case 'CHECKOUT_EVENT':
      store.addEvent({
        type: event.type,
        gym_name: event.gym_name,
        member_name: event.member_name,
        timestamp: event.timestamp,
        occupancy: event.current_occupancy,
        capacity_pct: event.capacity_pct,
      });
      break;

    case 'PAYMENT_EVENT':
      store.addEvent({
        type: event.type,
        gym_name: event.gym_name,
        member_name: event.member_name,
        amount: event.amount,
        plan_type: event.plan_type,
      });
      break;

    case 'ANOMALY_DETECTED':
      // Trigger anomalies refresh
      fetchAnomalies(store);
      store.addEvent({
        type: 'ANOMALY',
        severity: event.severity,
        message: event.message,
      });
      break;

    case 'ANOMALY_RESOLVED':
      fetchAnomalies(store);
      break;

    case 'SIMULATOR_STATUS':
      store.setSimulatorRunning(event.status === 'running');
      if (event.speed) store.setSimulatorSpeed(event.speed);
      break;

    default:
      console.log('[WebSocket] Unknown event:', event.type);
  }
};

const fetchAnomalies = async (store) => {
  try {
    const response = await fetch('/api/anomalies');
    const data = await response.json();
    store.setAnomalies(data);
  } catch (error) {
    console.error('Error fetching anomalies:', error);
  }
};
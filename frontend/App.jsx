import React, { useEffect } from 'react';
import { useStore } from './store';
import { useWebSocket } from './hooks/useWebSocket';
import Dashboard from './pages/Dashboard';
import './App.css';

function App() {
  const { gyms, setGyms, selectedGymId, setSelectedGymId, webSocketConnected, setWebSocketConnected } = useStore();

  useWebSocket();

  useEffect(() => {
    fetchGyms();
    const interval = setInterval(fetchGyms, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (gyms.length > 0 && !selectedGymId) {
      setSelectedGymId(gyms[0].id);
    }
  }, [gyms]);

  const fetchGyms = async () => {
    try {
      const response = await fetch('/api/gyms');
      const data = await response.json();
      setGyms(data);
    } catch (error) {
      console.error('Error fetching gyms:', error);
    }
  };

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-content">
          <div className="logo-section">
            <h1>⚡ WTF LivePulse</h1>
            <p className="tagline">Real-Time Multi-Gym Intelligence</p>
          </div>

          <div className="header-right">
            <div className={`connection-indicator ${webSocketConnected ? 'connected' : 'disconnected'}`}>
              <span className="pulse"></span>
              {webSocketConnected ? 'Live' : 'Offline'}
            </div>

            {gyms.length > 0 && (
              <select
                value={selectedGymId || ''}
                onChange={(e) => setSelectedGymId(e.target.value)}
                className="gym-selector"
              >
                {gyms.map(gym => (
                  <option key={gym.id} value={gym.id}>
                    {gym.name} ({gym.current_occupancy}/{gym.capacity})
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
      </header>

      <main className="app-main">
        {selectedGymId && <Dashboard />}
      </main>
    </div>
  );
}

export default App;
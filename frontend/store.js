import { create } from 'zustand';

export const useStore = create((set) => ({
  gyms: [],
  selectedGymId: null,
  anomalies: [],
  liveEvents: [],
  simulatorRunning: false,
  simulatorSpeed: 1,
  webSocketConnected: false,

  setGyms: (gyms) => set({ gyms }),
  setSelectedGymId: (gymId) => set({ selectedGymId: gymId }),
  setAnomalies: (anomalies) => set({ anomalies }),
  addEvent: (event) => set((state) => ({
    liveEvents: [event, ...state.liveEvents].slice(0, 20),
  })),
  clearEvents: () => set({ liveEvents: [] }),
  setSimulatorRunning: (running) => set({ simulatorRunning: running }),
  setSimulatorSpeed: (speed) => set({ simulatorSpeed: speed }),
  setWebSocketConnected: (connected) => set({ webSocketConnected: connected }),
}));
import { Component } from '../types'

// Sample components for demonstration
export const sampleComponents: Component[] = [
  {
    id: 'demo-1',
    type: 'resistor',
    position: { x: 200, y: 200 },
    rotation: 0,
    properties: {
      reference: 'R1',
      value: '10kΩ',
    },
    pins: []
  },
  {
    id: 'demo-2',
    type: 'capacitor',
    position: { x: 400, y: 200 },
    rotation: 0,
    properties: {
      reference: 'C1',
      value: '100nF',
    },
    pins: []
  },
  {
    id: 'demo-3',
    type: 'transistor-npn',
    position: { x: 300, y: 350 },
    rotation: 0,
    properties: {
      reference: 'Q1',
      value: '2N2222',
    },
    pins: []
  },
]


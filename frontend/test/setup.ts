import '@testing-library/jest-dom';

// Recharts mide el contenedor con ResizeObserver y offsetWidth/offsetHeight para
// decidir el tamaño del SVG; jsdom no implementa ResizeObserver y devuelve 0 en
// ambas dimensiones, por lo que sin este mock los gráficos de Recharts no
// renderizan ningún hijo en los tests.
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

// @ts-expect-error -- jsdom no define ResizeObserver
globalThis.ResizeObserver = globalThis.ResizeObserver ?? ResizeObserverMock;

Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
  configurable: true,
  value: 600,
});
Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
  configurable: true,
  value: 300,
});
HTMLElement.prototype.getBoundingClientRect = () => ({
  width: 600,
  height: 300,
  top: 0,
  left: 0,
  right: 600,
  bottom: 300,
  x: 0,
  y: 0,
  toJSON() {},
});


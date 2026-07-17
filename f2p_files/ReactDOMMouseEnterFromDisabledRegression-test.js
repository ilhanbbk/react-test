'use strict';

global.IS_REACT_ACT_ENVIRONMENT = true;

// These behaviors are already correct at the base commit and must stay correct
// after the fix: the normal mouseover/mouseout enter/leave flow between enabled
// elements, and mouseleave when moving onto a disabled element (which still
// fires the mouseout of the enabled element being left). They guard against an
// over-broad fix that double-fires or breaks the ordinary case.
describe('mouseenter/mouseleave regressions (P2P)', () => {
  let act;
  let container;
  let React;
  let ReactDOMClient;

  beforeEach(() => {
    jest.resetModules();
    React = require('react');
    ReactDOMClient = require('react-dom/client');
    act = require('internal-test-utils').act;
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  function movePointer(from, to, fromDisabled) {
    if (from && !fromDisabled) {
      from.dispatchEvent(
        new MouseEvent('mouseout', {
          bubbles: true,
          cancelable: true,
          relatedTarget: to,
        }),
      );
    }
    if (to) {
      to.dispatchEvent(
        new MouseEvent('mouseover', {
          bubbles: true,
          cancelable: true,
          relatedTarget: from,
        }),
      );
    }
  }

  it('fires onMouseEnter exactly once when moving from an enabled element', async () => {
    const sourceRef = React.createRef();
    const targetRef = React.createRef();
    let enterCount = 0;

    function App() {
      return (
        <div>
          <button ref={sourceRef}>enabled</button>
          <div ref={targetRef} onMouseEnter={() => enterCount++}>
            target
          </div>
        </div>
      );
    }

    const root = ReactDOMClient.createRoot(container);
    await act(() => root.render(<App />));

    await act(() => movePointer(sourceRef.current, targetRef.current, false));

    expect(enterCount).toBe(1);
  });

  it('fires onMouseLeave when moving from an enabled element onto a disabled element', async () => {
    const sourceRef = React.createRef();
    const disabledRef = React.createRef();
    let leaveCount = 0;

    function App() {
      return (
        <div>
          <div ref={sourceRef} onMouseLeave={() => leaveCount++}>
            source
          </div>
          <button ref={disabledRef} disabled={true}>
            disabled
          </button>
        </div>
      );
    }

    const root = ReactDOMClient.createRoot(container);
    await act(() => root.render(<App />));

    // The enabled source fires its mouseout; the disabled target fires nothing.
    await act(() => {
      sourceRef.current.dispatchEvent(
        new MouseEvent('mouseout', {
          bubbles: true,
          cancelable: true,
          relatedTarget: disabledRef.current,
        }),
      );
    });

    expect(leaveCount).toBe(1);
  });

  it('fires leave then enter when moving between two enabled elements', async () => {
    const sourceRef = React.createRef();
    const targetRef = React.createRef();
    let leaveCount = 0;
    let enterCount = 0;

    function App() {
      return (
        <div>
          <div ref={sourceRef} onMouseLeave={() => leaveCount++}>
            source
          </div>
          <div ref={targetRef} onMouseEnter={() => enterCount++}>
            target
          </div>
        </div>
      );
    }

    const root = ReactDOMClient.createRoot(container);
    await act(() => root.render(<App />));

    await act(() => movePointer(sourceRef.current, targetRef.current, false));

    expect(leaveCount).toBe(1);
    expect(enterCount).toBe(1);
  });
});

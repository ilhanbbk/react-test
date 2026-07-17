'use strict';

global.IS_REACT_ACT_ENVIRONMENT = true;

// React derives onMouseEnter/onMouseLeave from the native mouseover/mouseout
// pair: normally the enter is dispatched while handling the *mouseout* of the
// element the pointer is leaving. Disabled form controls never fire pointer
// events, so that mouseout never happens and React used to drop the enter that
// should have been dispatched while handling the target's mouseover. After the
// fix, moving the pointer off a disabled element must still fire onMouseEnter on
// the element it moves onto.
describe('onMouseEnter fires when the pointer comes from a disabled element (F2P)', () => {
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

  // Simulate moving the pointer from `from` onto `to`. A disabled element does
  // not fire pointer events, so when `fromDisabled` is true we omit the mouseout
  // that an enabled element would have emitted -- exactly like a real browser.
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

  function DisabledSource({type, sourceRef}) {
    switch (type) {
      case 'input':
        return <input ref={sourceRef} disabled={true} />;
      case 'select':
        return (
          <select ref={sourceRef} disabled={true}>
            <option value="a">a</option>
          </select>
        );
      case 'textarea':
        return <textarea ref={sourceRef} disabled={true} />;
      case 'button':
      default:
        return (
          <button ref={sourceRef} disabled={true}>
            disabled
          </button>
        );
    }
  }

  for (const type of ['button', 'input', 'select', 'textarea']) {
    it(`fires onMouseEnter when moving from a disabled <${type}>`, async () => {
      const sourceRef = React.createRef();
      const targetRef = React.createRef();
      let enterCount = 0;

      function App() {
        return (
          <div>
            <DisabledSource type={type} sourceRef={sourceRef} />
            <div ref={targetRef} onMouseEnter={() => enterCount++}>
              target
            </div>
          </div>
        );
      }

      const root = ReactDOMClient.createRoot(container);
      await act(() => root.render(<App />));

      await act(() => movePointer(sourceRef.current, targetRef.current, true));

      expect(enterCount).toBe(1);
    });
  }

  it('faithfully reproduces the issue: moving from a disabled button fires React onMouseEnter', async () => {
    const buttonRef = React.createRef();
    const targetRef = React.createRef();
    let reactEnterCount = 0;

    function App() {
      return (
        <div className="App">
          <button ref={buttonRef} disabled={true}>
            disabled
          </button>
          <div
            ref={targetRef}
            onMouseEnter={() => reactEnterCount++}
            style={{backgroundColor: '#ccc'}}>
            enabled
          </div>
        </div>
      );
    }

    const root = ReactDOMClient.createRoot(container);
    await act(() => root.render(<App />));

    await act(() => movePointer(buttonRef.current, targetRef.current, true));

    expect(reactEnterCount).toBe(1);
  });
});

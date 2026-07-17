'use strict';

global.IS_REACT_ACT_ENVIRONMENT = true;

// JSDOM does not dispatch the `formdata` event when constructing FormData, so
// we polyfill it the same way React's own ReactDOMForm-test does.
const NativeFormData = global.FormData;
const FormDataPolyfill = function FormData(form, submitter) {
  const formData = new NativeFormData(form, submitter);
  const formDataEvent = new Event('formdata', {
    bubbles: true,
    cancelable: false,
  });
  formDataEvent.formData = formData;
  form.dispatchEvent(formDataEvent);
  return formData;
};
NativeFormData.prototype.constructor = FormDataPolyfill;
global.FormData = FormDataPolyfill;

function setNativeInputValue(node, value) {
  const setter = Object.getOwnPropertyDescriptor(
    Object.getPrototypeOf(node),
    'value',
  ).set;
  setter.call(node, value);
}

// These behaviors are already correct at the base commit and must stay correct
// after the fix: controlled text is preserved, and *uncontrolled* fields must
// still be reset by the browser. They guard against an over-broad fix that
// would stop resetting uncontrolled inputs.
describe('form reset regressions (P2P)', () => {
  let act;
  let container;
  let React;
  let ReactDOMClient;
  let useState;

  beforeEach(() => {
    jest.resetModules();
    React = require('react');
    ReactDOMClient = require('react-dom/client');
    act = require('internal-test-utils').act;
    useState = React.useState;
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  async function submitWithAction(form) {
    await act(() => {
      const submitEvent = new Event('submit', {
        bubbles: true,
        cancelable: true,
      });
      submitEvent.submitter = undefined;
      const returnValue = form.dispatchEvent(submitEvent);
      if (!returnValue) {
        return;
      }
      if (!/\s*javascript:/i.test(form.action)) {
        throw new Error('Navigate to: ' + form.action);
      }
    });
  }

  async function resetForm(form) {
    await act(() => {
      form.reset();
    });
  }

  const clickInput = node =>
    act(() => {
      node.dispatchEvent(new MouseEvent('click', {bubbles: true}));
    });

  const typeInput = (node, value) =>
    act(() => {
      setNativeInputValue(node, value);
      node.dispatchEvent(new Event('input', {bubbles: true}));
    });

  const triggers = [
    ['form submission with an action', 'submit'],
    ['form.reset()', 'reset'],
  ];

  async function run(form, kind) {
    if (kind === 'submit') {
      await submitWithAction(form);
    } else {
      await resetForm(form);
    }
  }

  for (const [triggerName, kind] of triggers) {
    describe(`reset by ${triggerName}`, () => {
      it('preserves a controlled text input', async () => {
        const formRef = React.createRef();
        const inputRef = React.createRef();

        function App() {
          const [value, setValue] = useState('');
          return (
            <form ref={formRef} {...(kind === 'submit' ? {action: () => {}} : {})}>
              <input
                ref={inputRef}
                type="text"
                name="text"
                value={value}
                onChange={event => setValue(event.target.value)}
              />
            </form>
          );
        }

        const root = ReactDOMClient.createRoot(container);
        await act(() => root.render(<App />));
        await typeInput(inputRef.current, 'hello');
        expect(inputRef.current.value).toBe('hello');

        await run(formRef.current, kind);
        expect(inputRef.current.value).toBe('hello');
      });

      it('resets an uncontrolled checkbox to its default', async () => {
        const formRef = React.createRef();
        const inputRef = React.createRef();

        function App() {
          return (
            <form ref={formRef} {...(kind === 'submit' ? {action: () => {}} : {})}>
              <input
                ref={inputRef}
                type="checkbox"
                name="checkbox"
                defaultChecked={false}
              />
            </form>
          );
        }

        const root = ReactDOMClient.createRoot(container);
        await act(() => root.render(<App />));
        await clickInput(inputRef.current);
        expect(inputRef.current.checked).toBe(true);

        await run(formRef.current, kind);
        expect(inputRef.current.checked).toBe(false);
      });

      it('resets an uncontrolled radio group to its default', async () => {
        const formRef = React.createRef();
        const radioARef = React.createRef();
        const radioBRef = React.createRef();

        function App() {
          return (
            <form ref={formRef} {...(kind === 'submit' ? {action: () => {}} : {})}>
              <input
                ref={radioARef}
                type="radio"
                name="radio"
                value="a"
                defaultChecked={true}
              />
              <input
                ref={radioBRef}
                type="radio"
                name="radio"
                value="b"
                defaultChecked={false}
              />
            </form>
          );
        }

        const root = ReactDOMClient.createRoot(container);
        await act(() => root.render(<App />));
        await clickInput(radioBRef.current);
        expect(radioARef.current.checked).toBe(false);
        expect(radioBRef.current.checked).toBe(true);

        await run(formRef.current, kind);
        expect(radioARef.current.checked).toBe(true);
        expect(radioBRef.current.checked).toBe(false);
      });
    });
  }
});

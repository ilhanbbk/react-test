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

function setNativeValue(node, value) {
  const setter = Object.getOwnPropertyDescriptor(
    Object.getPrototypeOf(node),
    'value',
  ).set;
  setter.call(node, value);
}

// These behaviors are already correct at the base commit and must stay correct
// after the fix: a controlled text input keeps its value, and an *uncontrolled*
// <select> must still be reset by the browser. They guard against an over-broad
// fix that would stop resetting uncontrolled selects.
describe('form reset regressions for <select> (P2P)', () => {
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

  const typeInput = (node, value) =>
    act(() => {
      setNativeValue(node, value);
      node.dispatchEvent(new Event('input', {bubbles: true}));
    });

  const selectOption = (node, value) =>
    act(() => {
      setNativeValue(node, value);
      node.dispatchEvent(new Event('change', {bubbles: true}));
    });

  async function run(form, kind) {
    if (kind === 'submit') {
      await submitWithAction(form);
    } else {
      await resetForm(form);
    }
  }

  const triggers = [
    ['form submission with an action', 'submit'],
    ['form.reset()', 'reset'],
  ];

  for (const [triggerName, kind] of triggers) {
    describe(`reset by ${triggerName}`, () => {
      it('preserves a controlled text input', async () => {
        const formRef = React.createRef();
        const inputRef = React.createRef();

        function App() {
          const [value, setValue] = useState('');
          return (
            <form
              ref={formRef}
              {...(kind === 'submit' ? {action: () => {}} : {})}>
              <input
                ref={inputRef}
                type="text"
                name="name"
                value={value}
                onChange={event => setValue(event.target.value)}
              />
            </form>
          );
        }

        const root = ReactDOMClient.createRoot(container);
        await act(() => root.render(<App />));
        await typeInput(inputRef.current, 'Sasha');
        expect(inputRef.current.value).toBe('Sasha');

        await run(formRef.current, kind);
        expect(inputRef.current.value).toBe('Sasha');
      });

      it('resets an uncontrolled select to its default option', async () => {
        const formRef = React.createRef();
        const selectRef = React.createRef();

        function App() {
          return (
            <form
              ref={formRef}
              {...(kind === 'submit' ? {action: () => {}} : {})}>
              <select ref={selectRef} name="gender" defaultValue="2">
                <option value="1">1</option>
                <option value="2">2</option>
                <option value="3">3</option>
              </select>
            </form>
          );
        }

        const root = ReactDOMClient.createRoot(container);
        await act(() => root.render(<App />));
        await selectOption(selectRef.current, '3');
        expect(selectRef.current.value).toBe('3');

        await run(formRef.current, kind);
        expect(selectRef.current.value).toBe('2');
      });
    });
  }
});

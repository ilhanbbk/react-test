'use strict';

global.IS_REACT_ACT_ENVIRONMENT = true;

// JSDOM doesn't dispatch the 'formdata' event on submit, so polyfill it.
const NativeFormData = global.FormData;
const FormDataPolyfill = function FormData(form, submitter) {
  const formData = new NativeFormData(form, submitter);
  const formDataEvent = new Event('formdata', {bubbles: true, cancelable: false});
  formDataEvent.formData = formData;
  form.dispatchEvent(formDataEvent);
  return formData;
};
NativeFormData.prototype.constructor = FormDataPolyfill;
global.FormData = FormDataPolyfill;

describe('controlled checkbox form reset (F2P)', () => {
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

  async function submit(form) {
    await act(() => {
      const submitEvent = new Event('submit', {bubbles: true, cancelable: true});
      submitEvent.submitter = undefined;
      const returnValue = form.dispatchEvent(submitEvent);
      if (!returnValue) return;
      if (!/\s*javascript:/i.test(form.action)) {
        throw new Error('Navigate to: ' + form.action);
      }
    });
  }

  it('does not reset a controlled checkbox after form submission with an action', async () => {
    const formRef = React.createRef();
    const boxRef = React.createRef();

    function Page() {
      const [isChecked, setIsChecked] = useState(false);
      return (
        <form ref={formRef} action={() => {}}>
          <input
            ref={boxRef}
            type="checkbox"
            checked={isChecked}
            onChange={e => setIsChecked(e.target.checked)}
          />
        </form>
      );
    }

    const root = ReactDOMClient.createRoot(container);
    await act(() => root.render(<Page />));

    // User checks the box.
    await act(() =>
      boxRef.current.dispatchEvent(new MouseEvent('click', {bubbles: true})),
    );
    expect(boxRef.current.checked).toBe(true);

    // Submit the form with a function action. React auto-resets the form.
    await submit(formRef.current);

    // Bug (pre-fix): the controlled checkbox is reset to unchecked.
    // Expected (post-fix): a controlled checkbox is NOT reset.
    expect(boxRef.current.checked).toBe(true);
  });
});

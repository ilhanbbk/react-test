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

describe('controlled inputs are not reset by form submission or form.reset() (F2P)', () => {
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

  // Dispatch a real submit event. A React form `action` is compiled to a
  // `javascript:` action, and submitting such a form makes React run the action
  // and then automatically reset the form fields.
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

  function makeRefs() {
    return {
      form: React.createRef(),
      text: React.createRef(),
      checkbox: React.createRef(),
      radioA: React.createRef(),
      radioB: React.createRef(),
    };
  }

  function ControlledForm({fields, withAction, refs}) {
    const [text, setText] = useState('');
    const [checkbox, setCheckbox] = useState(false);
    const [radio, setRadio] = useState('a');
    const formProps = withAction ? {action: () => {}} : {};
    return (
      <form ref={refs.form} {...formProps}>
        {fields.text && (
          <input
            ref={refs.text}
            type="text"
            name="text"
            value={text}
            onChange={event => setText(event.target.value)}
          />
        )}
        {fields.checkbox && (
          <input
            ref={refs.checkbox}
            type="checkbox"
            name="checkbox"
            checked={checkbox}
            onChange={event => setCheckbox(event.target.checked)}
          />
        )}
        {fields.radio && (
          <React.Fragment>
            <input
              ref={refs.radioA}
              type="radio"
              name="radio"
              value="a"
              checked={radio === 'a'}
              onChange={() => setRadio('a')}
            />
            <input
              ref={refs.radioB}
              type="radio"
              name="radio"
              value="b"
              checked={radio === 'b'}
              onChange={() => setRadio('b')}
            />
          </React.Fragment>
        )}
      </form>
    );
  }

  // Render the form, then simulate the user editing every controlled field away
  // from its initial (React-controlled) state.
  async function renderAndEdit(fields, kind) {
    const refs = makeRefs();
    const root = ReactDOMClient.createRoot(container);
    await act(() =>
      root.render(
        <ControlledForm
          fields={fields}
          withAction={kind === 'submit'}
          refs={refs}
        />,
      ),
    );

    if (fields.text) {
      await typeInput(refs.text.current, 'hello');
    }
    if (fields.checkbox) {
      await clickInput(refs.checkbox.current);
    }
    if (fields.radio) {
      await clickInput(refs.radioB.current);
    }

    // Precondition: the user's edits are reflected before the reset happens.
    if (fields.text) {
      expect(refs.text.current.value).toBe('hello');
    }
    if (fields.checkbox) {
      expect(refs.checkbox.current.checked).toBe(true);
    }
    if (fields.radio) {
      expect(refs.radioA.current.checked).toBe(false);
      expect(refs.radioB.current.checked).toBe(true);
    }

    return refs;
  }

  // A controlled input's value is owned by React, so resetting the form must
  // not clobber it. This is the assertion that fails before the fix.
  function expectPreserved(refs, fields) {
    if (fields.text) {
      expect(refs.text.current.value).toBe('hello');
    }
    if (fields.checkbox) {
      expect(refs.checkbox.current.checked).toBe(true);
    }
    if (fields.radio) {
      expect(refs.radioA.current.checked).toBe(false);
      expect(refs.radioB.current.checked).toBe(true);
    }
  }

  const fieldCombos = [
    ['checkbox', {checkbox: true}],
    ['radio', {radio: true}],
    ['checkbox and radio', {checkbox: true, radio: true}],
    ['text and checkbox', {text: true, checkbox: true}],
    ['text and radio', {text: true, radio: true}],
    ['text, checkbox and radio', {text: true, checkbox: true, radio: true}],
  ];

  const triggers = [
    ['form submission with an action', 'submit'],
    ['form.reset()', 'reset'],
  ];

  for (const [triggerName, kind] of triggers) {
    describe(`reset by ${triggerName}`, () => {
      for (const [comboName, fields] of fieldCombos) {
        it(`preserves controlled ${comboName}`, async () => {
          const refs = await renderAndEdit(fields, kind);
          if (kind === 'submit') {
            await submitWithAction(refs.form.current);
          } else {
            await resetForm(refs.form.current);
          }
          expectPreserved(refs, fields);
        });
      }
    });
  }
});

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

// A controlled <select> is reset to its default option by the automatic form
// reset that follows a form action (and by form.reset()), even though a
// controlled text <input> in the same form correctly keeps its value. After the
// fix the <select> must behave like the <input> and keep the chosen value.
describe('controlled <select> is not reset by form submission or form.reset() (F2P)', () => {
  let act;
  let container;
  let React;
  let ReactDOMClient;
  let useState;
  let useActionState;

  beforeEach(() => {
    jest.resetModules();
    React = require('react');
    ReactDOMClient = require('react-dom/client');
    act = require('internal-test-utils').act;
    useState = React.useState;
    useActionState = React.useActionState;
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

  // Each select starts on one option and the user chooses a different one.
  const SELECT_INITIAL = ['2', '1'];
  const SELECT_CHOSEN = ['3', '2'];

  function makeRefs() {
    return {
      form: React.createRef(),
      text: React.createRef(),
      selects: [React.createRef(), React.createRef()],
    };
  }

  function ControlledForm({fields, withAction, refs}) {
    const [text, setText] = useState('');
    const [selectValues, setSelectValues] = useState(() =>
      SELECT_INITIAL.slice(0, fields.selectCount),
    );
    // Always call the hook so the action path mirrors the issue's reproduction
    // (a form driven by useActionState).
    const [, formAction] = useActionState(() => Date.now(), 0);
    const formProps = withAction ? {action: formAction} : {};
    return (
      <form ref={refs.form} {...formProps}>
        {fields.text && (
          <input
            ref={refs.text}
            type="text"
            name="name"
            value={text}
            onChange={event => setText(event.target.value)}
          />
        )}
        {selectValues.map((value, index) => (
          <select
            key={index}
            ref={refs.selects[index]}
            name={'select' + index}
            value={value}
            onChange={event => {
              const next = event.target.value;
              setSelectValues(prev => {
                const copy = prev.slice();
                copy[index] = next;
                return copy;
              });
            }}>
            <option value="1">1</option>
            <option value="2">2</option>
            <option value="3">3</option>
          </select>
        ))}
        <button>submit</button>
      </form>
    );
  }

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
      await typeInput(refs.text.current, 'Sasha');
    }
    for (let i = 0; i < fields.selectCount; i++) {
      await selectOption(refs.selects[i].current, SELECT_CHOSEN[i]);
    }

    // Precondition: the user's edits are reflected before the reset happens.
    if (fields.text) {
      expect(refs.text.current.value).toBe('Sasha');
    }
    for (let i = 0; i < fields.selectCount; i++) {
      expect(refs.selects[i].current.value).toBe(SELECT_CHOSEN[i]);
    }

    return refs;
  }

  function expectPreserved(refs, fields) {
    if (fields.text) {
      expect(refs.text.current.value).toBe('Sasha');
    }
    for (let i = 0; i < fields.selectCount; i++) {
      expect(refs.selects[i].current.value).toBe(SELECT_CHOSEN[i]);
    }
  }

  const fieldCombos = [
    ['a controlled select', {selectCount: 1}],
    ['a controlled text input and select', {text: true, selectCount: 1}],
    ['multiple controlled selects', {selectCount: 2}],
  ];

  const triggers = [
    ['form submission with an action', 'submit'],
    ['form.reset()', 'reset'],
  ];

  for (const [triggerName, kind] of triggers) {
    describe(`reset by ${triggerName}`, () => {
      for (const [comboName, combo] of fieldCombos) {
        const fields = {text: false, selectCount: 1, ...combo};
        it(`preserves ${comboName}`, async () => {
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

  it('faithfully reproduces the issue: controlled input is kept but select is reset', async () => {
    const formRef = React.createRef();
    const inputRef = React.createRef();
    const selectRef = React.createRef();

    function Page() {
      const [, formAction] = useActionState(() => Date.now(), 0);
      const [name, setName] = useState('');
      const [type, setType] = useState('2');
      return (
        <form ref={formRef} action={formAction}>
          <input
            ref={inputRef}
            type="text"
            value={name}
            onChange={event => setName(event.target.value)}
          />
          <select
            ref={selectRef}
            name="gender"
            value={type}
            onChange={event => setType(event.target.value)}>
            <option value="1">1</option>
            <option value="2">2</option>
            <option value="3">3</option>
          </select>
          <button>submit</button>
        </form>
      );
    }

    const root = ReactDOMClient.createRoot(container);
    await act(() => root.render(<Page />));

    await typeInput(inputRef.current, 'Sasha');
    await selectOption(selectRef.current, '3');
    expect(inputRef.current.value).toBe('Sasha');
    expect(selectRef.current.value).toBe('3');

    await submitWithAction(formRef.current);

    // The controlled input keeps its value (already correct today); the
    // controlled select must keep its value too after the automatic reset.
    expect(inputRef.current.value).toBe('Sasha');
    expect(selectRef.current.value).toBe('3');
  });
});

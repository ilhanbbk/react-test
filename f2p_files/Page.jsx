import { useState } from "react"

export default function Page() {
  const [isChecked, setIsChecked] = useState(false);

  return (
    <form action={() => {
      console.log("hello world!");
    }}>
      <label>
        Some checkbox
        <input type="checkbox"
          checked={isChecked}
          onChange={(e) => {
            setIsChecked(e.target.checked);
          }}
        />
      </label>
      <button>Submit form</button>
    </form>
  );
}

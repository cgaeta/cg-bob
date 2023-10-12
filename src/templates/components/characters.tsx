import { capitalize } from "../../utils";

export const Character = ({
  name,
  tokens,
  checked,
}: {
  name: string;
  tokens: number;
  checked: boolean;
}) => (
  <label class="block" for={name}>
    <input
      class="mr-2"
      id={name}
      type="radio"
      name="nerd"
      value={name}
      checked={checked}
      hx-get="/actions"
      hx-target="#moves"
      hx-swap="outerHTML"
      hx-include="[name='nerd']"
    />
    {capitalize(name)} - <span id={`${name}-tokens`}>{tokens}</span>
  </label>
);

export const Characters = ({
  tokens,
  checked,
}: {
  tokens: Record<string, number>;
  checked: string;
}) => (
  <div id="nerds">
    {Object.entries(tokens).map(([name, count]) => (
      <Character name={name} tokens={count} checked={checked === name} />
    ))}
  </div>
);

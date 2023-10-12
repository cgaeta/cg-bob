export const MoveList = ({
  title,
  endpoint,
  moves,
  uniqueMoves,
  disabled,
}: {
  title: string;
  endpoint: string;
  moves: string[];
  uniqueMoves: readonly string[];
  disabled?: boolean;
}) => (
  <>
    <h2 class={`text-lg font-semibold${disabled ? " text-gray-500" : ""}`}>
      {title}
    </h2>
    <ul
      class={disabled ? "text-gray-500" : "cursor-pointer"}
      hx-post={endpoint}
      hx-include="#nerds"
      hx-target="#nerds"
    >
      {moves.map((m) => (
        <li>{m}</li>
      ))}
      {uniqueMoves.map((m) => (
        <li>{m}</li>
      ))}
    </ul>
  </>
);

export const Moves = ({
  moves,
  unique,
  disabled,
  swapOb,
}: {
  moves: Record<string, string[]>;
  unique: Record<string, readonly string[]>;
  disabled: boolean;
  swapOb?: boolean;
}) => (
  <div id="moves" hx-swap-oob={swapOb ? "true" : false}>
    <MoveList
      title="Strong Moves (spend a token)"
      endpoint="/strong-move"
      moves={moves.strongMoves}
      uniqueMoves={unique.strongMoves}
      disabled={disabled}
    />
    <MoveList
      title="Normal Moves"
      endpoint="/normal-move"
      moves={moves.normalMoves}
      uniqueMoves={unique.normalMoves}
    />
    <MoveList
      title="Weak Moves"
      endpoint="/weak-move"
      moves={moves.weakMoves}
      uniqueMoves={unique.weakMoves}
    />
    <MoveList
      title="Social Moves"
      endpoint="/social-move"
      moves={moves.socialMoves}
      uniqueMoves={unique.socialMoves}
    />
  </div>
);

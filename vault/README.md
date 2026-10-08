# STS2 Bubble Vault

This folder is designed to be opened directly as an **Obsidian vault**.

The generated entity notes are created by:

`node scripts/build-vault.mjs`

## Structure

- `Cards/`
- `Relics/`
- `Powers/`
- `Potions/`
- `Enchantments/`
- `Keywords/`
- `Mechanics/`
- `Tags/`
- `Effects/`

Each note contains game metadata, detected links, and a **Curated relationships** block.

Anything placed between these markers is preserved when the vault is regenerated:

```md
<!-- CURATED START -->
- modifies [[Cards/Shiv|Shiv]]
<!-- CURATED END -->
```

Use this format for a typed relationship:

```md
- relation name [[Folder/Note|Display Name]]
```

Examples:

```md
- modifies [[Cards/Shiv|Shiv]]
- triggers [[Powers/Poison|Poison]]
- creates [[Cards/Status Card|Status Card]]
```

When the generator runs, those curated links are exported to `data/manual-links.json`. The public graph loads that file and renders curated edges distinctly from relationships inferred from game text.

Use a specific mechanical relationship and an existing target path. Bare `references`, `related`, `synergizes`, `interacts with`, `uses Stars`, and `uses keyword` links are rejected by the same policy as the public graph. Unknown targets and invalid verbs stop generation before any authored notes or exported links are rewritten.

The generated sections can be rebuilt whenever STS2 changes. The curated block is the human-authored layer.

## Credits

Slay the Spire 2 and its game content are by [Mega Crit](https://www.megacrit.com/). STS2 Bubble is an unofficial fan project. Generated entity notes include this credit so it stays with individually shared notes.

Permission to use artwork in notes has been requested from Mega Crit; a response is pending. The repository's `CREDITS.md` tracks the request and any future granted scope.

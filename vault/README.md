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

Use a specific mechanical relationship and an existing target path. Bare `references`, `related`, and `synergizes` links are rejected, and unknown targets stop generation before any authored notes are rewritten.

The generated sections can be rebuilt whenever STS2 changes. The curated block is the human-authored layer.

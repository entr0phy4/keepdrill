import { describe, expect, it } from 'vitest'
import { filterLoadableTree, foldTree, isLoadablePath } from './tree'
import type { GitTreeEntry, TreeNode } from './types'

interface Case {
  n: number
  name: string
  input: readonly GitTreeEntry[]
  expected: TreeNode[]
}

const nestedFixture: GitTreeEntry[] = [
  { path: 'src', type: 'tree', sha: 'abc' },
  { path: 'src/App.tsx', type: 'blob', sha: 'def', size: 120 },
  { path: 'README.md', type: 'blob', sha: 'ghi', size: 50 },
]

const cases: Case[] = [
  {
    n: 1,
    name: 'nested src + App.tsx + sibling README.md',
    input: nestedFixture,
    expected: [
      {
        kind: 'dir',
        name: 'src',
        path: 'src',
        children: [
          {
            kind: 'file',
            name: 'App.tsx',
            path: 'src/App.tsx',
            sha: 'def',
            entryType: 'blob',
            size: 120,
          },
        ],
      },
      {
        kind: 'file',
        name: 'README.md',
        path: 'README.md',
        sha: 'ghi',
        entryType: 'blob',
        size: 50,
      },
    ],
  },
  {
    n: 2,
    name: 'type commit submodule is a file leaf',
    input: [
      { path: 'vendor', type: 'tree', sha: 'dir1' },
      { path: 'vendor/lib', type: 'commit', sha: 'sub1' },
    ],
    expected: [
      {
        kind: 'dir',
        name: 'vendor',
        path: 'vendor',
        children: [
          {
            kind: 'file',
            name: 'lib',
            path: 'vendor/lib',
            sha: 'sub1',
            entryType: 'commit',
          },
        ],
      },
    ],
  },
  {
    n: 3,
    name: 'tree row plus blob under that path yields one dir',
    input: [
      { path: 'src', type: 'tree', sha: 'abc' },
      { path: 'src/App.tsx', type: 'blob', sha: 'def' },
    ],
    expected: [
      {
        kind: 'dir',
        name: 'src',
        path: 'src',
        children: [
          {
            kind: 'file',
            name: 'App.tsx',
            path: 'src/App.tsx',
            sha: 'def',
            entryType: 'blob',
          },
        ],
      },
    ],
  },
  {
    n: 4,
    name: 'empty tree folds to []',
    input: [],
    expected: [],
  },
  {
    n: 5,
    name: 'single root blob becomes one file node',
    input: [{ path: 'README.md', type: 'blob', sha: 'ghi', size: 50 }],
    expected: [
      {
        kind: 'file',
        name: 'README.md',
        path: 'README.md',
        sha: 'ghi',
        entryType: 'blob',
        size: 50,
      },
    ],
  },
  {
    n: 6,
    name: 'sibling order follows first appearance, not locale sort',
    input: [
      { path: 'z.txt', type: 'blob', sha: '1' },
      { path: 'a.txt', type: 'blob', sha: '2' },
    ],
    expected: [
      { kind: 'file', name: 'z.txt', path: 'z.txt', sha: '1', entryType: 'blob' },
      { kind: 'file', name: 'a.txt', path: 'a.txt', sha: '2', entryType: 'blob' },
    ],
  },
]

describe('foldTree — truncated listings (D-15)', () => {
  it('does not take truncated; still folds the returned entries', () => {
    const listing = { truncated: true, tree: nestedFixture }
    expect(foldTree(listing.tree)).toEqual([
      {
        kind: 'dir',
        name: 'src',
        path: 'src',
        children: [
          {
            kind: 'file',
            name: 'App.tsx',
            path: 'src/App.tsx',
            sha: 'def',
            entryType: 'blob',
            size: 120,
          },
        ],
      },
      {
        kind: 'file',
        name: 'README.md',
        path: 'README.md',
        sha: 'ghi',
        entryType: 'blob',
        size: 50,
      },
    ])
  })
})

describe('foldTree — golden cases (REPO-02)', () => {
  it.each(cases)('case $n: $name', ({ input, expected }) => {
    expect(foldTree(input)).toEqual(expected)
  })
})

describe('foldTree — FileNode.size', () => {
  it('omits size when GitTreeEntry has no size', () => {
    const [node] = foldTree([{ path: 'main.ts', type: 'blob', sha: 'abc' }])
    expect(node).toMatchObject({
      kind: 'file',
      name: 'main.ts',
      path: 'main.ts',
      sha: 'abc',
      entryType: 'blob',
    })
    expect((node as { size?: number }).size).toBeUndefined()
  })
})

describe('isLoadablePath — D-05 allowlist', () => {
  it.each([
    ['src/App.tsx', true],
    ['foo.d.ts', true],
    ['x.tsx', true],
    ['a.mjs', false],
    ['b.cjs', false],
    ['.gitignore', false],
    ['.mjs', false],
  ] as const)('%s -> %s', (path, expected) => {
    expect(isLoadablePath(path)).toBe(expected)
  })
})

describe('filterLoadableTree', () => {
  it('keeps loadable files and prunes empty directories', () => {
    expect(filterLoadableTree(foldTree(nestedFixture))).toEqual([
      {
        kind: 'dir',
        name: 'src',
        path: 'src',
        children: [
          {
            kind: 'file',
            name: 'App.tsx',
            path: 'src/App.tsx',
            sha: 'def',
            entryType: 'blob',
            size: 120,
          },
        ],
      },
    ])
  })

  it('returns [] when nothing is loadable', () => {
    expect(
      filterLoadableTree(
        foldTree([
          { path: 'docs', type: 'tree', sha: 'd' },
          { path: 'docs/README.md', type: 'blob', sha: 'r', size: 10 },
        ]),
      ),
    ).toEqual([])
  })
})
